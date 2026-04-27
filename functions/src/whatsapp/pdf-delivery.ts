import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { sendDocumentMessage, sendTextMessage } from './messenger';
import { logActivity } from '../index';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

/**
 * Polls for the generated PDF on an invoice, generates a signed URL,
 * and sends it via Twilio WhatsApp.
 */
export async function deliverInvoicePDF(
  businessId: string,
  invoiceId: string,
  sessionId: string,
  waId: string
): Promise<void> {
  const invoiceRef = db.collection(`businesses/${businessId}/invoices`).doc(invoiceId);
  const sessionRef = db.collection(`businesses/${businessId}/whatsappSessions`).doc(sessionId);

  try {
    // Poll for pdfUrl on the invoice (check every 2 seconds, max 30 seconds)
    let invoiceNumber = '';
    let totalTTC = 0;
    let pdfUrl = '';
    let pdfUrlFound = false;
    const maxAttempts = 15;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const invoiceDoc = await invoiceRef.get();
      if (!invoiceDoc.exists) {
        logger.error('Invoice not found during PDF delivery', { businessId, invoiceId });
        break;
      }

      const invoiceData = invoiceDoc.data()!;
      invoiceNumber = invoiceData.number || invoiceId;
      totalTTC = invoiceData.totals?.totalTTC || 0;

      if (invoiceData.pdfUrl) {
        pdfUrl = invoiceData.pdfUrl;
        pdfUrlFound = true;
        break;
      }

      if (attempt === 3) {
        await sendTextMessage(waId, "⚙️ Finalisation du document...");
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (pdfUrlFound) {
      // Send the document via Twilio using the public URL
      const totalFormatted = (totalTTC / 100).toFixed(2);
      const caption = `✅ Votre facture ${invoiceNumber} est prête ! Montant: ${totalFormatted} MAD TTC.\nTransférez ce PDF à votre client.`;

      await sendDocumentMessage(
        waId,
        pdfUrl,
        `${invoiceNumber}.pdf`,
        caption
      );

      logger.info('Invoice PDF delivered via Twilio', {
        businessId, invoiceId, invoiceNumber, waId
      });

      await logActivity(businessId, "system", "WhatsApp: PDF envoyé", "invoice", invoiceId, {
        invoiceNumber,
        waId
      });
    } else {
      logger.warn('PDF generation timed out for WhatsApp delivery', {
        businessId, invoiceId
      });
      await sendFallbackMessage(waId, invoiceNumber);
    }

    await markSessionDelivered(sessionRef);

  } catch (error) {
    logger.error('Error delivering invoice PDF via WhatsApp', {
      businessId, invoiceId, error
    });
    
    try {
      await sendTextMessage(
        waId,
        `La facture a été créée mais l'envoi du PDF a échoué. Retrouvez-la dans l'application Fatura.`
      );
    } catch (sendError) {
      logger.error('Failed to send fallback message', sendError);
    }

    await markSessionDelivered(sessionRef);
  }
}

async function sendFallbackMessage(waId: string, invoiceNumber: string): Promise<void> {
  await sendTextMessage(
    waId,
    `La facture ${invoiceNumber} a été créée mais le PDF prend du temps. Retrouvez-la dans l'application Fatura.`
  );
}

async function markSessionDelivered(sessionRef: FirebaseFirestore.DocumentReference): Promise<void> {
  try {
    await sessionRef.update({
      state: 'delivered',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error('Failed to mark session as delivered', error);
  }
}
