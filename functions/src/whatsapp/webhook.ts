import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
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

const messageRateLimits = new Map<string, RateWindow>();
const MESSAGE_RATE_LIMIT = 60;
const MESSAGE_RATE_WINDOW_MS = 60 * 1000;

const invoiceRateLimits = new Map<string, RateWindow>();
const INVOICE_RATE_LIMIT = 20;
const INVOICE_RATE_WINDOW_MS = 60 * 60 * 1000;

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
  window.timestamps = window.timestamps.filter(ts => now - ts < windowMs);
  if (window.timestamps.length >= limit) return true;
  window.timestamps.push(now);
  return false;
}

export function isMessageRateLimited(businessId: string): boolean {
  return isRateLimited(messageRateLimits, businessId, MESSAGE_RATE_LIMIT, MESSAGE_RATE_WINDOW_MS);
}

export function isInvoiceRateLimited(businessId: string): boolean {
  return isRateLimited(invoiceRateLimits, businessId, INVOICE_RATE_LIMIT, INVOICE_RATE_WINDOW_MS);
}

export function recordInvoiceCreation(businessId: string): void {
  let window = invoiceRateLimits.get(businessId);
  if (!window) {
    window = { timestamps: [] };
    invoiceRateLimits.set(businessId, window);
  }
  window.timestamps.push(Date.now());
}

/**
 * Webhook Handler for Twilio WhatsApp
 */
export const whatsappWebhook = functions.region('europe-west1').https.onRequest(async (req, res) => {
  // Twilio sends POST requests with form-urlencoded body
  if (req.method !== 'POST') {
    res.sendStatus(405);
    return;
  }

  try {
    const payload = req.body;
    const messageId = payload.MessageSid;
    const from = payload.From || ''; // format: whatsapp:+33766455249
    const body = payload.Body || '';
    
    // Extract waId (phone number without prefix)
    const waId = from.replace('whatsapp:', '').replace('+', '');

    if (!messageId || !waId) {
      logger.warn('Invalid Twilio payload', { payload });
      res.sendStatus(400);
      return;
    }

    // ── Deduplication ──
    if (isDuplicate(messageId)) {
      logger.info('Duplicate message skipped', { messageId });
      res.status(200).send('<Response></Response>');
      return;
    }

    // ── Lookup business link ──
    const linkDoc = await admin.firestore().collection('whatsappLinks').doc(waId).get();
    if (!linkDoc.exists) {
      logger.info('Message from unregistered number', { waId });
      // We still need to respond with 200 to Twilio
      res.status(200).send('<Response></Response>');
      await sendTextMessage(waId, "Désolé, ce numéro n'est pas lié à un compte Fatura. Activez WhatsApp dans les Paramètres de l'application.");
      return;
    }

    const linkData = linkDoc.data()!;
    if (!linkData.isActive) {
      logger.info('Message from inactive link', { waId });
      res.status(200).send('<Response></Response>');
      await sendTextMessage(waId, "Votre accès WhatsApp Fatura est actuellement désactivé. Réactivez-le dans les Paramètres.");
      return;
    }

    const businessId = linkData.businessId;

    // ── Rate Limiting ──
    if (isMessageRateLimited(businessId)) {
      logger.warn('Message rate limit hit', { businessId, waId });
      res.status(200).send('<Response></Response>');
      await sendTextMessage(waId, "Vous envoyez trop de messages. Réessayez dans une minute.");
      return;
    }

    // Update last message timestamp
    linkDoc.ref.update({
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp()
    }).catch(err => logger.warn('Failed to update lastMessageAt', { err }));

    logger.info('Processing Twilio message', { waId, businessId, messageId });
    
    // Transform Twilio payload to the format expected by engine.ts
    // engine.ts expects: { id, from, type: 'text', text: { body } }
    const engineMessage = {
      id: messageId,
      from: waId,
      type: 'text',
      text: { body: body }
    };

    // Acknowledge to Twilio immediately
    res.status(200).send('<Response></Response>');

    try {
      await processMessage(businessId, waId, engineMessage as any);
    } catch (err) {
      logger.error('Error in processMessage', { error: err, businessId, waId, messageId });
      await sendTextMessage(waId, "Une erreur est survenue lors du traitement de votre message. Réessayez.");
    }

  } catch (error) {
    logger.error('Error processing Twilio webhook', error);
    res.sendStatus(500);
  }
});
