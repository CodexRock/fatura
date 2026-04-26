import { parseMoroccanPrice, parseInvoiceIntent } from '../nlp';
import { jaroWinklerSimilarity } from '../matcher';

// Simple mock for GoogleGenerativeAI
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockImplementation(() => ({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              intent: 'create_invoice',
              confidence: 0.9,
              entities: {
                clientName: 'Ahmed',
                productLabel: 'logo design',
                quantity: 1,
                unitPrice: 8500,
                currency: 'MAD',
                tvaOverride: null,
                priceType: 'HT',
                dueDate: null,
                notes: null
              }
            })
          }
        })
      }))
    })),
    SchemaType: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER' },
    Schema: {}
  };
});

// Mock config
jest.mock('../config', () => ({
  whatsappConfig: {
    geminiApiKey: 'MOCK_API_KEY'
  }
}));

// Mock logger
jest.mock('firebase-functions/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('NLP & Matcher Helpers', () => {

  describe('parseMoroccanPrice', () => {
    it('parses basic integer strings', () => {
      expect(parseMoroccanPrice('500')).toBe(50000);
      expect(parseMoroccanPrice('8500')).toBe(850000);
    });

    it('parses strings with suffixes (dh, MAD)', () => {
      expect(parseMoroccanPrice('8500dh')).toBe(850000);
      expect(parseMoroccanPrice('15000 MAD')).toBe(1500000);
      expect(parseMoroccanPrice('8500,50 dh')).toBe(850050);
    });

    it('handles Moroccan dot-for-thousands and comma-for-decimals format', () => {
      expect(parseMoroccanPrice('8.500,00')).toBe(850000);
      expect(parseMoroccanPrice('15.000,50')).toBe(1500050);
    });

    it('handles simple decimals', () => {
      expect(parseMoroccanPrice('8500.50')).toBe(850050);
      expect(parseMoroccanPrice('8500,50')).toBe(850050);
    });
    
    it('handles spaced numbers', () => {
      expect(parseMoroccanPrice('8 500 MAD')).toBe(850000);
    });
  });

  describe('jaroWinklerSimilarity', () => {
    it('returns 1.0 for exact matches', () => {
      expect(jaroWinklerSimilarity('Ahmed', 'Ahmed')).toBe(1.0);
    });

    it('returns high score (> 0.8) for minor typos', () => {
      const score = jaroWinklerSimilarity('Ahmed', 'Ahmad');
      expect(score).toBeGreaterThan(0.8);
    });

    it('returns low score (< 0.5) for completely different words', () => {
      const score = jaroWinklerSimilarity('Ahmed', 'Karim');
      expect(score).toBeLessThan(0.5);
    });

    it('handles case and diacritics', () => {
      const score1 = jaroWinklerSimilarity('Océane', 'oceane');
      expect(score1).toBe(1.0);
    });
  });

  describe('parseInvoiceIntent (Mocked Gemini)', () => {
    it('extracts intent correctly from message', async () => {
      const message = "Facture pour Ahmed, logo design 8500dh";
      const result = await parseInvoiceIntent(message);

      expect(result.intent).toBe('create_invoice');
      expect(result.confidence).toBe(0.9);
      expect(result.entities.clientName).toBe('Ahmed');
      expect(result.entities.productLabel).toBe('logo design');
      expect(result.entities.unitPrice).toBe(850000); // Converted by our wrapper
    });
  });

});
