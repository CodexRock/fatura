import * as functions from 'firebase-functions';

// We use getters so that the config is read at runtime instead of module load time.
// This is important for Firebase Functions to pick up config changes properly,
// and it provides placeholder fallbacks for when the config isn't fully set yet.
export const whatsappConfig = {
  get twilioAccountSid() { return process.env.TWILIO_ACCOUNT_SID || 'PLACEHOLDER_SID'; },
  get twilioAuthToken() { return process.env.TWILIO_AUTH_TOKEN || 'PLACEHOLDER_TOKEN'; },
  get twilioPhoneNumber() { return process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+14155238886'; }, // Sandbox number
  get geminiApiKey() { return process.env.GEMINI_API_KEY || 'PLACEHOLDER_GEMINI_KEY'; }
};

export const WHATSAPP_API_BASE_URL = 'https://graph.facebook.com/v19.0';
