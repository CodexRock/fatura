import * as functions from 'firebase-functions';

// We use getters so that the config is read at runtime instead of module load time.
// This is important for Firebase Functions to pick up config changes properly,
// and it provides placeholder fallbacks for when the config isn't fully set yet.
export const whatsappConfig = {
  get metaAppSecret() { return process.env.META_APP_SECRET || 'PLACEHOLDER_SECRET'; },
  get metaAccessToken() { return process.env.META_ACCESS_TOKEN || 'PLACEHOLDER_TOKEN'; },
  get metaPhoneNumberId() { return process.env.META_PHONE_NUMBER_ID || 'PLACEHOLDER_PHONE_ID'; },
  get metaWabaId() { return process.env.META_WABA_ID || 'PLACEHOLDER_WABA_ID'; },
  get verifyToken() { return process.env.WHATSAPP_VERIFY_TOKEN || 'PLACEHOLDER_VERIFY_TOKEN'; },
  get geminiApiKey() { return process.env.GEMINI_API_KEY || 'PLACEHOLDER_GEMINI_KEY'; }
};

export const WHATSAPP_API_BASE_URL = 'https://graph.facebook.com/v19.0';
