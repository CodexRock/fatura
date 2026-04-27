import * as logger from 'firebase-functions/logger';
import { whatsappConfig } from './config';
import { Twilio } from 'twilio';

let twilioClient: Twilio | null = null;

function getTwilioClient() {
  if (!twilioClient) {
    if (whatsappConfig.twilioAccountSid === 'PLACEHOLDER_SID' || whatsappConfig.twilioAuthToken === 'PLACEHOLDER_TOKEN') {
      logger.error('Twilio credentials not configured');
      return null;
    }
    twilioClient = new Twilio(whatsappConfig.twilioAccountSid, whatsappConfig.twilioAuthToken);
  }
  return twilioClient;
}

/**
 * Sends a text message via Twilio WhatsApp API.
 * @param waId The recipient's WhatsApp ID (e.g., '33766455249')
 * @param text The message content.
 */
export async function sendTextMessage(waId: string, text: string): Promise<string | undefined> {
  const client = getTwilioClient();
  if (!client) throw new Error('Twilio client not initialized');

  const formattedTo = `whatsapp:+${waId.replace('whatsapp:', '').replace('+', '')}`;

  try {
    const message = await client.messages.create({
      from: whatsappConfig.twilioPhoneNumber,
      to: formattedTo,
      body: text
    });
    logger.info('Message sent via Twilio', { sid: message.sid, to: formattedTo });
    return message.sid;
  } catch (error) {
    logger.error('Failed to send message via Twilio', { error, to: formattedTo });
    throw error;
  }
}

/**
 * Sends a document (PDF) via Twilio WhatsApp API.
 * @param waId The recipient's WhatsApp ID.
 * @param mediaUrl A publicly accessible URL to the document.
 * @param filename The filename for the document.
 * @param caption Optional caption.
 */
export async function sendDocumentMessage(waId: string, mediaUrl: string, filename: string, caption?: string): Promise<string | undefined> {
  const client = getTwilioClient();
  if (!client) throw new Error('Twilio client not initialized');

  const formattedTo = `whatsapp:+${waId.replace('whatsapp:', '').replace('+', '')}`;

  try {
    const message = await client.messages.create({
      from: whatsappConfig.twilioPhoneNumber,
      to: formattedTo,
      mediaUrl: [mediaUrl],
      body: caption || filename
    });
    logger.info('Document sent via Twilio', { sid: message.sid, to: formattedTo, mediaUrl });
    return message.sid;
  } catch (error) {
    logger.error('Failed to send document via Twilio', { error, to: formattedTo, mediaUrl });
    throw error;
  }
}

// Sandbox doesn't support interactive buttons well without templates.
// We'll map these to simple text responses for the user to reply to.
export async function sendButtonMessage(waId: string, bodyText: string, buttons: { id: string; title: string }[]) {
  const options = buttons.map((b, i) => `[${i + 1}] ${b.title}`).join('\n');
  const fullText = `${bodyText}\n\n${options}\n\nRépondez avec le chiffre correspondant.`;
  return sendTextMessage(waId, fullText);
}

export async function sendListMessage(waId: string, bodyText: string, sections: any[]) {
  let options = '';
  let count = 1;
  for (const section of sections) {
    if (section.title) options += `*${section.title}*\n`;
    for (const row of section.rows) {
      options += `[${count++}] ${row.title}${row.description ? ` (${row.description})` : ''}\n`;
    }
  }
  const fullText = `${bodyText}\n\n${options}\n\nRépondez avec le chiffre correspondant.`;
  return sendTextMessage(waId, fullText);
}

export async function sendWelcomeMessage(waId: string) {
  const welcomeText = `🎉 Bienvenue sur Fatura WhatsApp ! (via Twilio Sandbox)

Vous pouvez maintenant créer des factures en envoyant un simple message.

Exemple: "Facture pour Ahmed, consulting 5000dh"

Envoyez "aide" pour plus d'informations.`;
  
  return sendTextMessage(waId, welcomeText);
}
