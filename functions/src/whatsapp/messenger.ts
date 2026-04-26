import { WHATSAPP_API_BASE_URL, whatsappConfig } from './config';
import { OutboundMessage, OutboundButton, OutboundListSection } from './types';
import * as logger from 'firebase-functions/logger';

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000; // 1s → 4s → 16s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWhatsAppMessage(data: OutboundMessage, retries = MAX_RETRIES): Promise<string | undefined> {
  const url = `${WHATSAPP_API_BASE_URL}/${whatsappConfig.metaPhoneNumberId}/messages`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappConfig.metaAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        // Don't retry 4xx client errors (except 429 rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          logger.error('WhatsApp API client error (no retry)', { status: response.status, data: responseData });
          throw new Error(`WhatsApp API Error ${response.status}: ${JSON.stringify(responseData)}`);
        }
        throw new Error(`WhatsApp API Error ${response.status}: ${JSON.stringify(responseData)}`);
      }

      return responseData.messages?.[0]?.id;
    } catch (error) {
      if (attempt < retries) {
        const delayMs = BACKOFF_BASE_MS * Math.pow(4, attempt); // 1s, 4s, 16s
        logger.warn(`WhatsApp send failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delayMs}ms`, { error });
        await sleep(delayMs);
      } else {
        logger.error(`WhatsApp send failed after ${retries + 1} attempts`, error);
        throw error;
      }
    }
  }
  // Unreachable — loop always returns or throws, but TS requires this
  return undefined;
}

export async function sendTextMessage(waId: string, text: string) {
  const payload: OutboundMessage = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: waId,
    type: 'text',
    text: {
      preview_url: false,
      body: text
    }
  };
  return sendWhatsAppMessage(payload);
}

export async function sendButtonMessage(waId: string, bodyText: string, buttons: { id: string; title: string }[]) {
  if (buttons.length > 3) {
    throw new Error('WhatsApp only supports a maximum of 3 buttons.');
  }

  const outboundButtons: OutboundButton[] = buttons.map(btn => ({
    type: 'reply',
    reply: {
      id: btn.id,
      title: btn.title
    }
  }));

  const payload: OutboundMessage = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: waId,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: bodyText
      },
      action: {
        buttons: outboundButtons
      }
    }
  };
  return sendWhatsAppMessage(payload);
}

export async function sendListMessage(waId: string, bodyText: string, sections: OutboundListSection[], buttonText: string = 'Choisir') {
  const payload: OutboundMessage = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: waId,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: bodyText
      },
      action: {
        button: buttonText,
        sections: sections
      }
    }
  };
  return sendWhatsAppMessage(payload);
}

export async function sendDocumentMessage(waId: string, mediaIdOrUrl: string, filename: string, caption?: string) {
  const payload: OutboundMessage = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: waId,
    type: 'document',
    document: {
      // If it starts with http, it's a URL, otherwise assume it's a Meta Media ID
      ...(mediaIdOrUrl.startsWith('http') ? { link: mediaIdOrUrl } : { id: mediaIdOrUrl }),
      filename,
      caption
    }
  };
  return sendWhatsAppMessage(payload);
}

export async function uploadMedia(buffer: Buffer, mimeType: string, filename: string = 'document.pdf') {
  const url = `${WHATSAPP_API_BASE_URL}/${whatsappConfig.metaPhoneNumberId}/media`;
  
  const formData = new FormData();
  formData.append('messaging_product', 'whatsapp');
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappConfig.metaAccessToken}`,
        // Note: fetch will automatically set the correct Content-Type for multipart/form-data
      },
      body: formData as any
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      logger.error('WhatsApp Media Upload Error', responseData);
      throw new Error(`WhatsApp Media Upload Error: ${JSON.stringify(responseData)}`);
    }

    return responseData.id;
  } catch (error) {
    logger.error('Failed to upload media to WhatsApp', error);
    throw error;
  }
}

export async function sendWelcomeMessage(waId: string) {
  const welcomeText = `🎉 Bienvenue sur Fatura WhatsApp ! Vous pouvez maintenant créer des factures en envoyant un simple message.

Exemple: "Facture pour Ahmed, consulting 5000dh"

Envoyez "aide" pour plus d'informations.`;
  
  return sendTextMessage(waId, welcomeText);
}
