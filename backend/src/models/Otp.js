import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * One row per phone number. The code itself is never stored in the clear
 * (PDF §2: "password nahi hota" — the OTP is the credential, so treat it like one).
 */
const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    // Rolling window used to rate-limit resends per number.
    sentCount: { type: Number, default: 1 },
    windowStartedAt: { type: Date, default: Date.now },
    lastSentAt: { type: Date, default: Date.now },
    consumedAt: Date,
  },
  { timestamps: true },
);

// Rows clean themselves up a day after they expire.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export const hashCode = (phone, code) =>
  crypto.createHash('sha256').update(`${phone}:${code}`).digest('hex');

otpSchema.methods.matches = function matches(code) {
  const a = Buffer.from(this.codeHash);
  const b = Buffer.from(hashCode(this.phone, code));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export default mongoose.model('Otp', otpSchema);
