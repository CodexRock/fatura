import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { sendDocumentMessage, sendTextMessage, uploadMedia } from './messenger';
import { logActivity } from '../index';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

/**
 * Polls for the generated PDF on an invoice, uploads it to WhatsApp Media API,
 * and sends it as a document message back to the user.
 *
 * The onInvoiceCreated trigger generates the PDF asynchronously. This function
 * waits for the pdfUrl field to appear on the invoice document, then downloads
 * the PDF from Firebase Storage, uploads it to WhatsApp, and delivers it.
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
    let pdfUrl: string | null = null;
    let invoiceNumber = '';
    let totalTTC = 0;
    const maxAttempts = 15; // 15 x 2s = 30 seconds

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
        break;
      }

      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (pdfUrl) {
      // Download the PDF from Firebase Storage
      const filePath = `invoices/${businessId}/${invoiceId}.pdf`;
      const file = bucket.file(filePath);

      const [exists] = await file.exists();
      if (!exists) {
        logger.error('PDF file not found in Storage', { filePath });
        await sendFallbackMessage(waId, invoiceNumber);
        await markSessionDelivered(sessionRef);
        return;
      }

      const [pdfBuffer] = await file.download();

      // Upload PDF to WhatsApp Media API
      const mediaId = await uploadMedia(
        Buffer.from(pdfBuffer),
        'application/pdf',
        `${invoiceNumber}.pdf`
      );

      // Send the document via WhatsApp
      const totalFormatted = (totalTTC / 100).toFixed(2);
      const caption = `✅ Votre facture ${invoiceNumber} est prête ! Montant: ${totalFormatted} MAD TTC.\nTransférez ce PDF à votre client.`;

      await sendDocumentMessage(
        waId,
        mediaId,
        `${invoiceNumber}.pdf`,
        caption
      );

      logger.info('Invoice PDF delivered via WhatsApp', {
        businessId, invoiceId, invoiceNumber, waId
      });

      await logActivity(businessId, "system", "WhatsApp: PDF envoyé", "invoice", invoiceId, {
        invoiceNumber,
        waId,
        mediaId
      });
    } else {
      // PDF didn't arrive within 30 seconds — send fallback
      logger.warn('PDF generation timed out for WhatsApp delivery', {
        businessId, invoiceId
      });
      await sendFallbackMessage(waId, invoiceNumber);
    }

    // Mark session as delivered
    await markSessionDelivered(sessionRef);

  } catch (error) {
    logger.error('Error delivering invoice PDF via WhatsApp', {
      businessId, invoiceId, error
    });
    
    // Still try to notify the user
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
