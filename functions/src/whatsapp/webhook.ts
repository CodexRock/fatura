import * as functions from 'firebase-functions';
import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { whatsappConfig } from './config';
import { WebhookPayload } from './types';
import { sendTextMessage } from './messenger';
import { processMessage } from './engine';

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// ─────────────────────────────────────────────────────────────
// In-memory deduplication (simple TTL set)
// ─────────────────────────────────────────────────────────────
const processedMessageIds = new Map<string, number>(); // messageId → timestamp
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isDuplicate(messageId: string): boolean {
  // Evict stale entries when the map grows
  if (processedMessageIds.size > 500) {
    const now = Date.now();
    for (const [id, ts] of processedMessageIds) {
      if (now - ts > DEDUP_TTL_MS) processedMessageIds.delete(id);
    }
  }

  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.set(messageId, Date.now());
  return false;
}

// ─────────────────────────────────────────────────────────────
// Rate Limiting — Sliding window counters (in-memory)
// ─────────────────────────────────────────────────────────────
interface RateWindow {
  timestamps: number[];
}

// Per-business message rate: max 60 per minute
const messageRateLimits = new Map<string, RateWindow>();
const MESSAGE_RATE_LIMIT = 60;
const MESSAGE_RATE_WINDOW_MS = 60 * 1000; // 1 minute

// Per-business invoice creation rate: max 20 per hour
const invoiceRateLimits = new Map<string, RateWindow>();
const INVOICE_RATE_LIMIT = 20;
const INVOICE_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(
  store: Map<string, RateWindow>,
  businessId: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  let window = store.get(businessId);

  if (!window) {
    window = { timestamps: [] };
    store.set(businessId, window);
  }

  // Remove expired timestamps
  window.timestamps = window.timestamps.filter(ts => now - ts < windowMs);

  if (window.timestamps.length >= limit) {
    return true;
  }

  window.timestamps.push(now);
  return false;
}

/**
 * Check message rate limit for a business.
 * Returns true if the business is rate-limited.
 */
export function isMessageRateLimited(businessId: string): boolean {
  return isRateLimited(messageRateLimits, businessId, MESSAGE_RATE_LIMIT, MESSAGE_RATE_WINDOW_MS);
}

/**
 * Check invoice creation rate limit for a business.
 * Returns true if the business is rate-limited.
 */
export function isInvoiceRateLimited(businessId: string): boolean {
  return isRateLimited(invoiceRateLimits, businessId, INVOICE_RATE_LIMIT, INVOICE_RATE_WINDOW_MS);
}

/**
 * Record an invoice creation event for rate limiting.
 */
export function recordInvoiceCreation(businessId: string): void {
  let window = invoiceRateLimits.get(businessId);
  if (!window) {
    window = { timestamps: [] };
    invoiceRateLimits.set(businessId, window);
  }
  window.timestamps.push(Date.now());
}

// Periodic cleanup of stale rate limit entries (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of messageRateLimits) {
    window.timestamps = window.timestamps.filter(ts => now - ts < MESSAGE_RATE_WINDOW_MS);
    if (window.timestamps.length === 0) messageRateLimits.delete(key);
  }
  for (const [key, window] of invoiceRateLimits) {
    window.timestamps = window.timestamps.filter(ts => now - ts < INVOICE_RATE_WINDOW_MS);
    if (window.timestamps.length === 0) invoiceRateLimits.delete(key);
  }
}, 10 * 60 * 1000);

// ─────────────────────────────────────────────────────────────
// Webhook Handler
// ─────────────────────────────────────────────────────────────
export const whatsappWebhook = functions.region('europe-west1').https.onRequest(async (req, res) => {
  // ── GET: Webhook Verification ──
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === whatsappConfig.verifyToken) {
      logger.info('Webhook verified successfully!');
      res.status(200).send(challenge);
    } else {
      logger.warn('Failed webhook verification', { mode, token });
      res.sendStatus(403);
    }
    return;
  }

  // ── POST: Message Processing ──
  if (req.method === 'POST') {
    // Verify HMAC-SHA256 signature
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      logger.warn('Missing x-hub-signature-256 header');
      res.sendStatus(403);
      return;
    }

    const rawBody = req.rawBody;
    const hmac = crypto.createHmac('sha256', whatsappConfig.metaAppSecret);
    hmac.update(rawBody);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      logger.warn('Invalid webhook signature');
      res.sendStatus(403);
      return;
    }

    // Acknowledge receipt to Meta immediately (must respond in <15s)
    res.sendStatus(200);

    try {
      const body = req.body as WebhookPayload;

      if (body.object !== 'whatsapp_business_account') {
        return;
      }

      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (!change.value.messages || change.value.messages.length === 0) continue;

          for (const message of change.value.messages) {
            const messageId = message.id;

            // ── Deduplication ──
            if (isDuplicate(messageId)) {
              logger.info('Duplicate message skipped', { messageId });
              continue;
            }

            const waId = message.from;
            
            // ── Lookup business link ──
            const linkDoc = await admin.firestore().collection('whatsappLinks').doc(waId).get();
            if (!linkDoc.exists) {
              logger.info('Message from unregistered number', { waId });
              await sendTextMessage(waId, "Désolé, ce numéro n'est pas lié à un compte Fatura. Activez WhatsApp dans les Paramètres de l'application.");
              continue;
            }

            const linkData = linkDoc.data()!;
            if (!linkData.isActive) {
              logger.info('Message from inactive link', { waId });
              await sendTextMessage(waId, "Votre accès WhatsApp Fatura est actuellement désactivé. Réactivez-le dans les Paramètres.");
              continue;
            }

            const businessId = linkData.businessId;

            // ── Rate Limiting ──
            if (isMessageRateLimited(businessId)) {
              logger.warn('Message rate limit hit', { businessId, waId });
              await sendTextMessage(waId, "Vous envoyez trop de messages. Réessayez dans une minute.");
              continue;
            }

            // Update last message timestamp
            linkDoc.ref.update({
              lastMessageAt: admin.firestore.FieldValue.serverTimestamp()
            }).catch(err => logger.warn('Failed to update lastMessageAt', { err }));

            logger.info('Processing message', { waId, businessId, messageId, type: message.type });
            
            try {
              await processMessage(businessId, waId, message);
            } catch (err) {
              logger.error('Error in processMessage', { error: err, businessId, waId, messageId });
              try {
                await sendTextMessage(waId, "Une erreur est survenue lors du traitement de votre message. Réessayez.");
              } catch (sendErr) {
                logger.error('Failed to send error notification', { sendErr });
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error processing webhook payload', error);
    }
  } else {
    res.sendStatus(405);
  }
});
