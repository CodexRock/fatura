import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';
import { whatsappConfig } from './config';
import * as logger from 'firebase-functions/logger';
import { NlpIntent } from '../../../src/types';

// Helper to parse Moroccan price formats into centimes (integer)
// Handles: "8500dh", "8 500 MAD", "8.500,00", "8500,50"
export function parseMoroccanPrice(priceStr: string): number {
  if (!priceStr) return 0;
  
  // Clean up the string: remove letters, currency symbols, and spaces
  let cleaned = priceStr.replace(/[^\d.,]/g, '').trim();
  
  // If we have something like "8.500,00" (dot for thousands, comma for decimals)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Determine which is which. In Moroccan format, comma is usually decimal.
    const lastCommaIndex = cleaned.lastIndexOf(',');
    const lastDotIndex = cleaned.lastIndexOf('.');
    
    if (lastCommaIndex > lastDotIndex) {
      // 8.500,00 -> 8500.00
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // 8,500.00 -> 8500.00
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Just a comma: "8500,50" -> 8500.50
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes('.')) {
    // Just a dot. Could be thousands (8.500) or decimal (8500.50).
    // If it has 3 digits after the dot, it's likely thousands.
    const parts = cleaned.split('.');
    if (parts[parts.length - 1].length === 3) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }
  
  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;
  
  return Math.round(value * 100);
}

const nlpSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    intent: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['create_invoice', 'check_status', 'cancel', 'help', 'unknown'],
      description: "The primary action the user wants to perform.",
    },
    confidence: {
      type: SchemaType.NUMBER,
      description: "Confidence score between 0.0 and 1.0. Lower it if missing client name or price.",
    },
    entities: {
      type: SchemaType.OBJECT,
      properties: {
        clientName: { type: SchemaType.STRING, nullable: true },
        productLabel: { type: SchemaType.STRING, nullable: true },
        quantity: { type: SchemaType.NUMBER, nullable: true },
        unitPrice: { type: SchemaType.NUMBER, nullable: true, description: "Raw price amount extracted. We will convert it to centimes separately." },
        currency: { type: SchemaType.STRING, format: 'enum', enum: ['MAD'], nullable: true },
        tvaOverride: { type: SchemaType.NUMBER, nullable: true, description: "If they specify 'sans TVA', this is 0. Else use standard Moroccan rates: 20, 14, 10, 7." },
        priceType: { type: SchemaType.STRING, format: 'enum', enum: ['HT', 'TTC'], nullable: true, description: "Default to HT if ambiguous." },
        dueDate: { type: SchemaType.STRING, nullable: true, description: "ISO format date or null." },
        notes: { type: SchemaType.STRING, nullable: true }
      },
      required: []
    }
  },
  required: ["intent", "confidence", "entities"]
};

const SYSTEM_INSTRUCTION = `
You are an intent parser for a Moroccan invoicing app called Fatura.
Your job is to extract structured data from natural language French and Moroccan Arabic (Darija) messages.
Users will ask you to create invoices, like: "Facture pour Ahmed, logo design 8500dh".

Rules:
1. Extract clientName, productLabel, quantity, unitPrice (just the number), TVA overrides, and dates.
2. Default quantity to 1 if not specified but a product is mentioned.
3. Price formats: They might say "8500dh", "8500 MAD", "8.500,00", "huit mille". Extract the raw number, e.g. 8500.
4. "HT" = hors taxe (before tax), "TTC" = toutes taxes comprises (with tax). Default priceType to "HT" when ambiguous.
5. "sans TVA" or "0%" = tvaOverride: 0.
6. If the user says "aide" or "help", intent is "help". If "annuler", intent is "cancel".
7. Confidence: If intent is create_invoice but you can't find a clientName or unitPrice, lower confidence < 0.5.
8. Multi-line is possible. If multiple items are specified, for now, just extract the first prominent one or combine them into notes/productLabel.
`;

export async function parseInvoiceIntent(
  message: string, 
  messageHistory: { role: 'user' | 'bot', content: string }[] = []
): Promise<NlpIntent> {
  try {
    const apiKey = whatsappConfig.geminiApiKey;
    if (!apiKey || apiKey === 'PLACEHOLDER_GEMINI_KEY') {
      logger.warn("Gemini API Key is missing or placeholder. NLP parsing will fail or return mock.");
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "models/gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: nlpSchema,
        temperature: 0.1,
      },
      systemInstruction: SYSTEM_INSTRUCTION
    });

    let context = "Conversation History:\n";
    for (const msg of messageHistory) {
      context += `${msg.role.toUpperCase()}: ${msg.content}\n`;
    }
    context += `\nCURRENT MESSAGE TO PARSE:\nUSER: ${message}`;

    const result = await model.generateContent(context);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    // Convert parsed unitPrice to centimes
    let unitPriceCentimes: number | null = null;
    if (parsed.entities?.unitPrice !== undefined && parsed.entities?.unitPrice !== null) {
       // Gemini gives us a number. e.g. 8500. Convert to centimes.
       unitPriceCentimes = Math.round(parsed.entities.unitPrice * 100);
    } else {
       // Attempt to parse it from the original message if Gemini missed it but it was there?
       // Usually Gemini gets the number right.
    }

    const intent: NlpIntent = {
      intent: parsed.intent || 'unknown',
      confidence: parsed.confidence || 0,
      entities: {
        clientName: parsed.entities?.clientName || null,
        productLabel: parsed.entities?.productLabel || null,
        quantity: parsed.entities?.quantity || null,
        unitPrice: unitPriceCentimes,
        currency: 'MAD',
        tvaOverride: parsed.entities?.tvaOverride !== undefined ? parsed.entities.tvaOverride : null,
        priceType: parsed.entities?.priceType || 'HT',
        dueDate: parsed.entities?.dueDate || null,
        notes: parsed.entities?.notes || null
      }
    };

    logger.info("NLP Parse Result", { message, intent });
    return intent;

  } catch (error: any) {
    logger.error("Error parsing NLP intent", { 
      error: error?.message || error,
      status: error?.status,
      details: error?.response?.data || error?.details,
      message 
    });
    return {
      intent: 'unknown',
      confidence: 0,
      entities: {
        clientName: null,
        productLabel: null,
        quantity: null,
        unitPrice: null,
        currency: 'MAD',
        tvaOverride: null,
        priceType: 'HT',
        dueDate: null,
        notes: null
      }
    };
  }
}
