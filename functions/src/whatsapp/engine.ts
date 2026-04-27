import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { WebhookMessage } from './types';
import { WhatsAppSession, InvoiceLine, NlpIntent } from '../../../src/types';
import { parseInvoiceIntent, parseMoroccanPrice } from './nlp';
import { findClientByName, findProductByLabel } from './matcher';
import { sendTextMessage, sendButtonMessage, sendListMessage } from './messenger';
import { calculateLineTotals, calculateInvoiceTotals } from './tva-server';
import { createInvoiceFromWhatsApp } from './invoice-creator';
import { deliverInvoicePDF } from './pdf-delivery';
import { isInvoiceRateLimited, recordInvoiceCreation } from './webhook';
import { logActivity } from '../index';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const MAX_CONSECUTIVE_ERRORS = 3;
const MAX_MESSAGE_LENGTH = 1000;

const HELP_MESSAGE = `📋 Comment utiliser Fatura WhatsApp:

Créer une facture:
→ "Facture pour [client], [produit] [prix]dh"
→ "Facture pour Ahmed Benali, consulting 5000 MAD"

Options:
→ "sans TVA" pour une facture sans TVA
→ "TTC" si le prix inclut la TVA
→ "échéance 15 jours" pour changer l'échéance

Commandes:
→ "aide" — afficher ce message
→ "annuler" — annuler la session en cours

Le bot utilise les clients et produits de votre compte Fatura.`;

// ─────────────────────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────────────────────
async function getOrCreateSession(businessId: string, waId: string): Promise<WhatsAppSession> {
  const sessionsRef = db.collection(`businesses/${businessId}/whatsappSessions`);
  const snapshot = await sessionsRef
    .where('waId', '==', waId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  let session: WhatsAppSession | null = null;
  if (!snapshot.empty) {
    const s = snapshot.docs[0].data() as WhatsAppSession;
    s.id = snapshot.docs[0].id;
    const expiresAt = (s.expiresAt as any).toMillis ? (s.expiresAt as any).toMillis() : s.expiresAt;
    if (expiresAt > Date.now() && s.state !== 'delivered') {
      session = s;
    }
  }

  if (!session) {
    const newRef = sessionsRef.doc();
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 60 * 1000);
    const newSession: any = {
      id: newRef.id,
      businessId,
      waId,
      state: 'idle',
      intentData: {},
      resolvedData: {},
      pendingField: null,
      messageHistory: [],
      invoiceId: null,
      errorCount: 0,
      currentOptions: [],
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await newRef.set(newSession);
    newSession.expiresAt = expiresAt; 
    session = newSession as WhatsAppSession;
    
    await logActivity(businessId, "system", "WhatsApp: session démarrée", "whatsappSession", newRef.id, { waId });
  }

  return session;
}

async function updateSession(businessId: string, sessionId: string, data: Partial<WhatsAppSession>): Promise<void> {
  const ref = db.collection(`businesses/${businessId}/whatsappSessions`).doc(sessionId);
  await ref.update({
    ...data,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function resetSession(businessId: string, sessionId: string): Promise<void> {
  const ref = db.collection(`businesses/${businessId}/whatsappSessions`).doc(sessionId);
  await ref.update({
    state: 'idle',
    intentData: {},
    resolvedData: {},
    pendingField: null,
    errorCount: 0,
    currentOptions: [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function incrementErrorCount(businessId: string, session: WhatsAppSession): Promise<number> {
  const newCount = (session.errorCount || 0) + 1;
  await updateSession(businessId, session.id, { errorCount: newCount } as any);
  return newCount;
}

async function addMessageToHistory(businessId: string, sessionId: string, role: 'user' | 'bot', content: string) {
  const ref = db.collection(`businesses/${businessId}/whatsappSessions`).doc(sessionId);
  await db.runTransaction(async (transaction) => {
    const docSnap = await transaction.get(ref);
    if (!docSnap.exists) return;
    const session = docSnap.data() as WhatsAppSession;
    const history = session.messageHistory || [];
    history.push({
      role,
      content,
      timestamp: admin.firestore.Timestamp.now() as any
    });
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
    transaction.update(ref, {
      messageHistory: history,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Message Parsing Helpers
// ─────────────────────────────────────────────────────────────

function getReplyId(message: WebhookMessage, session: WhatsAppSession): string | null {
  if (message.type === 'interactive') {
    return message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || null;
  }
  
  if (message.type === 'text') {
    const text = message.text?.body?.trim();
    if (!text) return null;
    
    // Check if it's a number corresponding to an option
    const index = parseInt(text, 10);
    if (!isNaN(index) && session.currentOptions && index > 0 && index <= session.currentOptions.length) {
      return session.currentOptions[index - 1];
    }

    // Also check if the text matches the option ID exactly (for robustness)
    if (session.currentOptions?.includes(text)) {
      return text;
    }
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────
export async function processMessage(businessId: string, waId: string, message: WebhookMessage) {
  let session: WhatsAppSession;

  try {
    session = await getOrCreateSession(businessId, waId);
  } catch (err) {
    logger.error('Failed to get/create session', { error: err, businessId, waId });
    await safeSend(waId, "Erreur de base de données. Réessayez dans quelques instants.");
    return;
  }

  try {
    // ── Reject non-text/interactive messages ──
    if (message.type !== 'text' && message.type !== 'interactive') {
      await sendTextMessage(waId, "Je ne comprends que les messages texte pour l'instant. Envoyez votre demande en texte.");
      return;
    }

    // ── Extract text content ──
    const messageText = message.type === 'text' ? message.text?.body : 
      (message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || message.interactive?.list_reply?.id);
      
    if (!messageText || messageText.trim().length === 0) return;

    if (messageText.length > MAX_MESSAGE_LENGTH) {
      await sendTextMessage(waId, "Message trop long. Veuillez raccourcir votre message.");
      return;
    }

    await addMessageToHistory(businessId, session.id, 'user', messageText);

    const lowerText = messageText.toLowerCase().trim();
    
    if (lowerText === 'aide' || lowerText === 'help') {
      await sendTextMessage(waId, HELP_MESSAGE);
      return;
    }

    if (lowerText === 'annuler') {
      if (session.state !== 'idle') {
        await resetSession(businessId, session.id);
        await sendTextMessage(waId, "Session annulée.");
      } else {
        await sendTextMessage(waId, "Rien à annuler.");
      }
      return;
    }

    // ── State machine dispatch ──
    switch (session.state) {
      case 'idle':
      case 'parsing_intent':
        await handleParsingIntent(businessId, waId, session, messageText);
        break;
      case 'awaiting_client':
        await handleAwaitingClient(businessId, waId, session, message);
        break;
      case 'creating_client':
        await handleCreatingClient(businessId, waId, session, messageText);
        break;
      case 'awaiting_product':
        await handleAwaitingProduct(businessId, waId, session, messageText);
        break;
      case 'awaiting_details':
        await handleAwaitingDetails(businessId, waId, session, messageText);
        break;
      case 'confirming':
        await handleConfirming(businessId, waId, session, message);
        break;
      case 'generating':
        await sendTextMessage(waId, "⏳ Votre facture est en cours de génération, veuillez patienter.");
        break;
      case 'delivered':
      case 'error':
        await resetSession(businessId, session.id);
        const freshSession = await getOrCreateSession(businessId, waId);
        await handleParsingIntent(businessId, waId, freshSession, messageText);
        break;
    }

    if ((session.errorCount || 0) > 0) {
      await updateSession(businessId, session.id, { errorCount: 0 } as any);
    }

  } catch (error: any) {
    logger.error('Error processing message', {
      error: error.message,
      stack: error.stack,
      businessId,
      sessionId: session.id,
      state: session.state,
      waId,
    });

    const errorCount = await incrementErrorCount(businessId, session);

    if (errorCount >= MAX_CONSECUTIVE_ERRORS) {
      await resetSession(businessId, session.id);
      await safeSend(waId, "Plusieurs erreurs consécutives se sont produites. Votre session a été réinitialisée. Veuillez réessayer.");
    } else {
      await safeSend(waId, "Désolé, une erreur technique est survenue. Réessayez.");
    }
  }
}

async function safeSend(waId: string, text: string): Promise<void> {
  try {
    await sendTextMessage(waId, text);
  } catch (err) {
    logger.error('safeSend: failed to send error notification', { err, waId });
  }
}

// ─────────────────────────────────────────────────────────────
// State Handlers
// ─────────────────────────────────────────────────────────────

async function handleParsingIntent(businessId: string, waId: string, session: WhatsAppSession, text: string) {
  await sendTextMessage(waId, "⏳ Je m'en occupe ! Un instant...");
  
  let intent: NlpIntent;
  try {
    intent = await parseInvoiceIntent(text, session.messageHistory);
  } catch (err) {
    logger.error('NLP API failure', { error: err, businessId });
    await sendTextMessage(waId, "Désolé, une erreur technique est survenue. Réessayez.");
    return;
  }

  if (intent.confidence < 0.5 && intent.intent === 'create_invoice') {
    await sendTextMessage(waId, "Je n'ai pas bien compris. Essayez par exemple : \"Facture pour Ahmed, consulting 5000dh\"");
    return;
  }

  if (intent.intent === 'create_invoice') {
    await updateSession(businessId, session.id, { 
      state: 'parsing_intent',
      intentData: intent.entities as any
    });

    if (intent.entities.clientName) {
      await sendTextMessage(waId, `🔍 Recherche du client "${intent.entities.clientName}"...`);
      const match = await findClientByName(businessId, intent.entities.clientName);
      if (match.exact) {
        await logActivity(businessId, "system", "WhatsApp: client résolu", "client", match.exact.id, { 
          method: "exact_match",
          name: match.exact.name 
        });
        await updateSession(businessId, session.id, {
          state: 'awaiting_product',
          resolvedData: { ...session.resolvedData, clientId: match.exact.id }
        });
        await processProductPhase(businessId, waId, session.id, intent);
      } else if (match.fuzzy.length > 0) {
        const options = match.fuzzy.slice(0, 5).map(c => `client_${c.id}`);
        await updateSession(businessId, session.id, { state: 'awaiting_client', currentOptions: options });
        
        const sections = [{
          title: "Clients trouvés",
          rows: match.fuzzy.slice(0, 5).map(c => ({ id: `client_${c.id}`, title: c.name, description: '' }))
        }];
        await sendListMessage(waId, `Plusieurs clients correspondent à "${intent.entities.clientName}". Lequel ?`, sections);
      } else {
        const options = ['create_client', 'retry_client'];
        await updateSession(businessId, session.id, { state: 'awaiting_client', currentOptions: options });
        
        await sendButtonMessage(waId, `Client "${intent.entities.clientName}" introuvable. Voulez-vous le créer ?`, [
          { id: 'create_client', title: 'Oui, créer' },
          { id: 'retry_client', title: 'Non, réessayer' }
        ]);
      }
    } else {
      await updateSession(businessId, session.id, { state: 'awaiting_client', currentOptions: [] });
      await sendTextMessage(waId, "Pour quel client voulez-vous créer la facture ?");
    }
  } else if (intent.intent === 'unknown') {
    await sendTextMessage(waId, "Je n'ai pas compris. Essayez \"aide\" pour voir des exemples.");
  }
}

async function handleAwaitingClient(businessId: string, waId: string, session: WhatsAppSession, message: WebhookMessage) {
  const replyId = getReplyId(message, session);
  
  if (replyId) {
    if (replyId === 'create_client') {
      await updateSession(businessId, session.id, { state: 'creating_client', currentOptions: [] });
      await sendTextMessage(waId, "Entrez l'ICE du client (ou tapez \"passer\" pour ignorer) :");
    } else if (replyId === 'retry_client') {
      await updateSession(businessId, session.id, { currentOptions: [] });
      await sendTextMessage(waId, "Quel est le nom du client ?");
    } else if (replyId?.startsWith('client_')) {
      const clientId = replyId.replace('client_', '');
      await logActivity(businessId, "system", "WhatsApp: client résolu", "client", clientId, { 
        method: "list_selection",
        waId 
      });
      await updateSession(businessId, session.id, {
        state: 'awaiting_product',
        currentOptions: [],
        resolvedData: { ...session.resolvedData, clientId }
      });
      await processProductPhase(businessId, waId, session.id, { entities: session.intentData } as any);
    }
  } else if (message.type === 'text') {
    const text = message.text?.body;
    if (!text) return;
    const match = await findClientByName(businessId, text);
    if (match.exact) {
        await logActivity(businessId, "system", "WhatsApp: client résolu", "client", match.exact.id, { 
          method: "exact_match",
          name: match.exact.name 
        });
        await updateSession(businessId, session.id, {
          state: 'awaiting_product',
          currentOptions: [],
          resolvedData: { ...session.resolvedData, clientId: match.exact.id }
        });
        await processProductPhase(businessId, waId, session.id, { entities: session.intentData } as any);
    } else {
      const options = ['create_client', 'retry_client'];
      await updateSession(businessId, session.id, { currentOptions: options });
      await sendButtonMessage(waId, `Client "${text}" introuvable.`, [
          { id: 'create_client', title: 'Créer nouveau' },
          { id: 'retry_client', title: 'Réessayer' }
      ]);
    }
  }
}

async function handleCreatingClient(businessId: string, waId: string, session: WhatsAppSession, text: string) {
  let ice = text.trim();
  if (ice.toLowerCase() === 'passer') {
    ice = '';
  }
  
  const clientName = session.intentData.clientName || 'Nouveau Client';
  const newClientRef = db.collection(`businesses/${businessId}/clients`).doc();
  await newClientRef.set({
    id: newClientRef.id,
    businessId,
    name: clientName,
    ice,
    totalInvoiced: 0,
    totalPaid: 0,
    balance: 0,
    address: { street: '', city: '', postalCode: '', country: 'MA' },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await logActivity(businessId, "system", "WhatsApp: client résolu", "client", newClientRef.id, { 
    method: "created",
    name: clientName 
  });

  await updateSession(businessId, session.id, {
    state: 'awaiting_product',
    resolvedData: { ...session.resolvedData, clientId: newClientRef.id }
  });

  await sendTextMessage(waId, `Client "${clientName}" créé avec succès.`);
  await processProductPhase(businessId, waId, session.id, { entities: session.intentData } as any);
}

async function processProductPhase(businessId: string, waId: string, sessionId: string, intent: NlpIntent) {
  const sessionDoc = await db.collection(`businesses/${businessId}/whatsappSessions`).doc(sessionId).get();
  const session = sessionDoc.data() as WhatsAppSession;

  if (intent.entities.productLabel) {
    const match = await findProductByLabel(businessId, intent.entities.productLabel);
    const label = match.exact ? match.exact.label : intent.entities.productLabel;
    
    if (intent.entities.unitPrice !== undefined && intent.entities.unitPrice !== null) {
      const tvaRate = intent.entities.tvaOverride !== null ? intent.entities.tvaOverride : 20;
      const quantity = intent.entities.quantity || 1;
      let unitPrice = intent.entities.unitPrice; 
      
      if (intent.entities.priceType === 'TTC') {
         unitPrice = Math.round((unitPrice * 100) / (100 + tvaRate));
      }

      const line: InvoiceLine = {
        id: "temp_line_id",
        description: label,
        quantity,
        unitPrice,
        tvaRate: tvaRate as any,
        totalHT: 0, totalTVA: 0, totalTTC: 0
      };
      
      const { taxableBase, totalTVA, totalTTC } = calculateLineTotals(unitPrice, quantity, tvaRate, undefined);
      line.totalHT = taxableBase;
      line.totalTVA = totalTVA;
      line.totalTTC = totalTTC;

      const lines = [line];
      const totals = calculateInvoiceTotals(lines);

      await updateSession(businessId, session.id, {
        state: 'confirming',
        resolvedData: { ...session.resolvedData, lines, totals }
      });
      await sendConfirmation(businessId, waId, session.id);
    } else {
      await updateSession(businessId, session.id, {
        state: 'awaiting_details',
        pendingField: 'price'
      });
      await sendTextMessage(waId, `Quel est le prix HT pour "${label}" ? (ex: 5000dh)`);
    }
  } else {
    await updateSession(businessId, session.id, {
      state: 'awaiting_details',
      pendingField: 'product_label'
    });
    await sendTextMessage(waId, "Quelle est la description du produit/service ?");
  }
}

async function handleAwaitingProduct(businessId: string, waId: string, session: WhatsAppSession, text: string) {
  session.intentData.productLabel = text;
  await updateSession(businessId, session.id, {
    intentData: session.intentData
  });
  await processProductPhase(businessId, waId, session.id, { entities: session.intentData } as any);
}

async function handleAwaitingDetails(businessId: string, waId: string, session: WhatsAppSession, text: string) {
  if (session.pendingField === 'product_label') {
    session.intentData.productLabel = text;
    await updateSession(businessId, session.id, { intentData: session.intentData });
    await processProductPhase(businessId, waId, session.id, { entities: session.intentData } as any);
  } else if (session.pendingField === 'price') {
    const price = parseMoroccanPrice(text);
    if (price <= 0) {
      await sendTextMessage(waId, "Veuillez entrer un prix valide supérieur à 0.");
      return;
    }
    session.intentData.unitPrice = price;
    await updateSession(businessId, session.id, { intentData: session.intentData });
    await processProductPhase(businessId, waId, session.id, { entities: session.intentData } as any);
  }
}

async function sendConfirmation(businessId: string, waId: string, sessionId: string) {
  const sessionDoc = await db.collection(`businesses/${businessId}/whatsappSessions`).doc(sessionId).get();
  const session = sessionDoc.data() as WhatsAppSession;

  const clientDoc = await db.collection(`businesses/${businessId}/clients`).doc(session.resolvedData.clientId!).get();
  const clientName = clientDoc.data()?.name || "Client Inconnu";

  const lines = session.resolvedData.lines || [];
  const totals = session.resolvedData.totals;
  if (lines.length === 0 || !totals) return;

  const line = lines[0];
  const tvaStr = line.tvaRate === 0 ? "Sans TVA" : `TVA ${line.tvaRate}%: ${(totals.totalTVA / 100).toFixed(2)}`;
  const summary = `📋 Facture pour *${clientName}*:\n• ${line.description} — ${line.quantity} x ${(line.unitPrice / 100).toFixed(2)} MAD HT\n• ${tvaStr}\n• *Total TTC: ${(totals.totalTTC / 100).toFixed(2)} MAD*\n\nVoulez-vous la générer ?`;

  const options = ['generate_invoice', 'modify_invoice', 'cancel_invoice'];
  await updateSession(businessId, session.id, { currentOptions: options });

  await sendButtonMessage(waId, summary, [
    { id: 'generate_invoice', title: '✅ Générer' },
    { id: 'modify_invoice', title: '✏️ Modifier' },
    { id: 'cancel_invoice', title: '❌ Annuler' }
  ]);
}

async function handleConfirming(businessId: string, waId: string, session: WhatsAppSession, message: WebhookMessage) {
  const replyId = getReplyId(message, session);
  
  if (replyId) {
    if (replyId === 'cancel_invoice') {
      await logActivity(businessId, "system", "WhatsApp: session annulée", "whatsappSession", session.id, { waId });
      await resetSession(businessId, session.id);
      await sendTextMessage(waId, "Facture annulée.");
    } else if (replyId === 'modify_invoice') {
      await sendModifyOptions(businessId, waId, session.id);
    } else if (replyId === 'generate_invoice') {
      await logActivity(businessId, "system", "WhatsApp: facture confirmée", "whatsappSession", session.id, { waId });
      await generateAndDeliver(businessId, waId, session);
    } else if (replyId?.startsWith('modify_')) {
      await handleModifyField(businessId, waId, session, replyId);
    }
  } else if (message.type === 'text' && session.pendingField) {
    const text = message.text?.body;
    if (!text) return;
    await handleModifyValue(businessId, waId, session, text);
  }
}

async function sendModifyOptions(businessId: string, waId: string, sessionId: string) {
  const options = ['modify_description', 'modify_price', 'modify_quantity', 'modify_tva'];
  await updateSession(businessId, sessionId, { currentOptions: options });

  const sections = [{
    title: "Que voulez-vous modifier ?",
    rows: [
      { id: 'modify_description', title: 'Description', description: 'Changer la description du service' },
      { id: 'modify_price', title: 'Prix unitaire', description: 'Changer le prix HT' },
      { id: 'modify_quantity', title: 'Quantité', description: 'Changer la quantité' },
      { id: 'modify_tva', title: 'TVA', description: 'Changer le taux de TVA' },
    ]
  }];
  await sendListMessage(waId, "Sélectionnez le champ à modifier :", sections);
}

async function handleModifyField(businessId: string, waId: string, session: WhatsAppSession, replyId: string) {
  const fieldMap: Record<string, { field: string; prompt: string }> = {
    'modify_description': { field: 'description', prompt: 'Entrez la nouvelle description :' },
    'modify_price': { field: 'price', prompt: 'Entrez le nouveau prix HT (ex: 5000dh) :' },
    'modify_quantity': { field: 'quantity', prompt: 'Entrez la nouvelle quantité :' },
    'modify_tva': { field: 'tva', prompt: 'Entrez le nouveau taux de TVA (0, 7, 10, 14 ou 20) :' },
  };

  const mapping = fieldMap[replyId];
  if (!mapping) return;

  await updateSession(businessId, session.id, {
    state: 'confirming',
    pendingField: mapping.field,
    currentOptions: [] // Clear options while waiting for text input
  });
  await sendTextMessage(waId, mapping.prompt);
}

async function handleModifyValue(businessId: string, waId: string, session: WhatsAppSession, text: string) {
  const lines = session.resolvedData.lines || [];
  if (lines.length === 0) {
    await sendTextMessage(waId, "Erreur: aucune ligne à modifier.");
    return;
  }

  const line = lines[0];
  const field = session.pendingField;

  if (field === 'description') {
    line.description = text;
  } else if (field === 'price') {
    const price = parseMoroccanPrice(text);
    if (price <= 0) {
      await sendTextMessage(waId, "Prix invalide. Réessayez (ex: 5000dh) :");
      return;
    }
    line.unitPrice = price;
  } else if (field === 'quantity') {
    const qty = parseInt(text, 10);
    if (isNaN(qty) || qty <= 0) {
      await sendTextMessage(waId, "Quantité invalide. Entrez un nombre supérieur à 0 :");
      return;
    }
    line.quantity = qty;
  } else if (field === 'tva') {
    const tva = parseInt(text, 10);
    if (![0, 7, 10, 14, 20].includes(tva)) {
      await sendTextMessage(waId, "Taux de TVA invalide. Valeurs acceptées : 0, 7, 10, 14, 20");
      return;
    }
    line.tvaRate = tva as any;
  }

  const { taxableBase, totalTVA, totalTTC } = calculateLineTotals(
    line.unitPrice, line.quantity, line.tvaRate, undefined
  );
  line.totalHT = taxableBase;
  line.totalTVA = totalTVA;
  line.totalTTC = totalTTC;

  const totals = calculateInvoiceTotals(lines);

  await updateSession(businessId, session.id, {
    state: 'confirming',
    pendingField: null,
    resolvedData: { ...session.resolvedData, lines, totals }
  });

  await sendConfirmation(businessId, waId, session.id);
}

// ─────────────────────────────────────────────────────────────
// Invoice Generation
// ─────────────────────────────────────────────────────────────

async function generateAndDeliver(businessId: string, waId: string, session: WhatsAppSession) {
  if (isInvoiceRateLimited(businessId)) {
    await sendTextMessage(waId, "Vous avez atteint le nombre maximum de factures pour cette heure. Réessayez plus tard.");
    return;
  }

  await updateSession(businessId, session.id, { state: 'generating' });
  
  try {
    const invoice = await createInvoiceFromWhatsApp(businessId, session.resolvedData, session.intentData);
    recordInvoiceCreation(businessId);

    await logActivity(businessId, "system", "WhatsApp: facture créée", "invoice", invoice.id, { 
      invoiceNumber: invoice.number,
      waId
    });

    await updateSession(businessId, session.id, { 
      state: 'generating',
      invoiceId: invoice.id 
    });
    
    await sendTextMessage(waId, `🚀 Facture ${invoice.number} créée ! Je génère maintenant le PDF...`);
    deliverInvoicePDF(businessId, invoice.id, session.id, waId).catch(err => {
      logger.error('Async PDF delivery failed', { error: err, businessId, invoiceId: invoice.id });
    });
    
  } catch (e: any) {
    logger.error('Failed to generate invoice', {
      error: e.message,
      stack: e.stack,
      businessId,
      sessionId: session.id,
    });
    await logActivity(businessId, "system", "WhatsApp: erreur", "whatsappSession", session.id, { 
      error: e.message,
      context: "generateAndDeliver"
    });
    await updateSession(businessId, session.id, { state: 'error' });
    await sendTextMessage(waId, "Erreur lors de la création de la facture. Réessayez.");
  }
}
