import Razorpay from 'razorpay';
import { env } from './env.js';

/**
 * Razorpay is optional. When keys are missing (or look like placeholders) the
 * app silently runs in DEMO payment mode: no errors, payments are simulated.
 */
export const isRazorpayConfigured = () => {
  const { keyId, keySecret } = env.razorpay;
  if (!keyId || !keySecret) return false;
  if (/x{4,}|your_|change/i.test(keyId + keySecret)) return false;
  return keyId.startsWith('rzp_');
};

let client = null;
export function getRazorpay() {
  if (!isRazorpayConfigured()) return null;
  if (!client) client = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  return client;
}
