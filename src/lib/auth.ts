import { auth } from './firebase';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { ConfirmationResult, User } from 'firebase/auth';

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

/**
 * Normalizes Moroccan phone numbers into strict E.164 verification standard formats (+212).
 * Allows graceful inputs like "0612345678", "612345678", or "+212612345678"
 */
export function normalizeMoroccanPhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = '+212' + cleaned.slice(1);
  } else if (cleaned.startsWith('212')) {
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+212' + cleaned;
  }
  
  return cleaned;
}

/**
 * Prepares the invisible reCAPTCHA check natively preventing abuse, and initializes the SMS payload.
 */
export async function signInWithPhone(
  phoneNumber: string,
  containerId: string = 'recaptcha-container'
): Promise<ConfirmationResult> {
  const normPhone = normalizeMoroccanPhone(phoneNumber);
  
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA verified - allow processing
      }
    });
  }

  return await signInWithPhoneNumber(auth, normPhone, window.recaptchaVerifier);
}

/**
 * Validates the 6 digit code received by the client payload.
 */
export async function verifyOTP(confirmationResult: ConfirmationResult, code: string) {
  return await confirmationResult.confirm(code);
}

/**
 * Standardizes the log out mechanism flushing cached cookies natively against Firebase mappings.
 */
export async function signOut() {
  if (window.recaptchaVerifier) {
    window.recaptchaVerifier.clear();
    window.recaptchaVerifier = null;
  }
  return await firebaseSignOut(auth);
}

/**
 * Primary sync pipeline hooked explicitly downstream for the React DOM tree rendering states.
 */
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
