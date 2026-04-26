import * as admin from 'firebase-admin';
import { Invoice, InvoiceCounter, Client, InvoiceType, InvoiceStatus } from '../../../src/types';
import * as logger from 'firebase-functions/logger';

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Creates an invoice specifically via the WhatsApp bot.
 * Performs the same transactional logic as the client app.
 */
export async function createInvoiceFromWhatsApp(
  businessId: string,
  resolvedData: any, // Contains clientId, lines, totals
  intentData: any
): Promise<Invoice> {
  const db = admin.firestore();
  
  const invoiceRef = db.collection(`businesses/${businessId}/invoices`).doc();
  const counterRef = db.collection(`businesses/${businessId}/counters`).doc('invoice');
  
  if (!resolvedData.clientId) {
      throw new Error("Client ID is missing in resolvedData");
  }

  const clientRef = db.collection(`businesses/${businessId}/clients`).doc(resolvedData.clientId);

  const currentYear = new Date().getFullYear();

  return await db.runTransaction(async (transaction) => {
    // 1. Reads
    const counterDoc = await transaction.get(counterRef);
    const clientDoc = await transaction.get(clientRef);
    
    if (!clientDoc.exists) {
      throw new Error(`Client ${resolvedData.clientId} not found`);
    }

    // 2. Logic
    let nextNumber = 1;
    if (counterDoc.exists) {
      const c = counterDoc.data() as InvoiceCounter;
      if (c.currentYear === currentYear) {
        nextNumber = c.lastNumber + 1;
      }
    }

    const paddedNum = nextNumber.toString().padStart(4, '0');
    const invoiceNumber = `F-${currentYear}-${paddedNum}`;
    
    // Default payment terms (30 days if not specified by intentData or business config)
    // We'll just use 30 days default for the bot, or parse intentData.dueDate if available
    let dueDateMillis = Date.now() + (30 * 24 * 60 * 60 * 1000); 
    // Wait, the intent parsing is a bit loose on dates for now, so let's stick to 30 days
    
    const issueDate = admin.firestore.Timestamp.now();
    const dueDate = admin.firestore.Timestamp.fromMillis(dueDateMillis);

    const newInvoice: any = {
      id: invoiceRef.id,
      businessId,
      clientId: resolvedData.clientId,
      number: invoiceNumber,
      type: 'facture' as InvoiceType,
      status: 'sent' as InvoiceStatus, // Skip draft for WhatsApp
      issueDate: issueDate,
      dueDate: dueDate,
      lines: resolvedData.lines || [],
      totals: resolvedData.totals || {
          totalHT: 0, tvaBreakdown: [], totalTVA: 0, totalTTC: 0
      },
      payments: [],
      dgiStatus: null,
      notes: intentData.notes || '',
      createdBy: 'whatsapp-bot',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 3. Writes
    transaction.set(invoiceRef, newInvoice);
    transaction.set(counterRef, {
      businessId,
      currentYear,
      lastNumber: nextNumber,
    });

    // Update client totals because status='sent'
    const clientData = clientDoc.data() as Client;
    const ttc = newInvoice.totals.totalTTC;
    
    transaction.update(clientRef, {
      totalInvoiced: (clientData.totalInvoiced || 0) + ttc,
      balance: (clientData.balance || 0) + ttc,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return newInvoice as Invoice;
  });
}
