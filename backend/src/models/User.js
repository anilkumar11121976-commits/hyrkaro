import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { CITY_SLUGS, KYC_STATUS, LANGS, ROLES } from '../config/constants.js';

const fileSchema = new mongoose.Schema({ url: String, publicId: String }, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // PDF §2: login is by mobile + OTP, so phone is the identity. Email is optional.
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Sahi 10 digit mobile number likho'],
    },
    phoneVerifiedAt: Date,
    // Optional. The unique index is declared below as a PARTIAL index so that
    // accounts without an email (the normal case — login is by OTP) never
    // collide with each other. `sparse` alone is not enough: it still indexes
    // an explicit null.
    email: { type: String, lowercase: true, trim: true, maxlength: 120 },
    // Only admins keep a password (PDF §2 removes passwords for clients/freelancers).
    password: { type: String, minlength: 8, select: false },
    passwordChangedAt: Date,

    // PDF §2: one account can switch between client and freelancer.
    role: { type: String, enum: ROLES, default: 'client', index: true },
    roles: { type: [String], enum: ROLES, default: undefined },

    companyName: { type: String, trim: true, maxlength: 120 },
    city: { type: String, enum: [...CITY_SLUGS, ''], default: '' },
    avatar: { type: fileSchema, default: undefined },
    lang: { type: String, enum: LANGS, default: 'hinglish' },

    // PDF §12: no payout without KYC.
    kyc: {
      status: { type: String, enum: KYC_STATUS, default: 'none', index: true },
      panLast4: String,
      legalName: { type: String, trim: true, maxlength: 120 },
      document: { type: fileSchema, default: undefined },
      payout: {
        method: { type: String, enum: ['upi', 'bank', ''], default: '' },
        upiId: { type: String, trim: true, maxlength: 80 },
        accountLast4: String,
        ifsc: { type: String, trim: true, maxlength: 15 },
        bankName: { type: String, trim: true, maxlength: 80 },
      },
      submittedAt: Date,
      reviewedAt: Date,
      note: String,
    },

    isBlocked: { type: Boolean, default: false },
    blockReason: String,
    /** PDF §5: strikes for repeatedly sharing contact details in chat. */
    contactStrikes: { type: Number, default: 0 },

    lastSeenAt: Date,
    acceptedPolicyAt: Date,

    // PDF §17: account deletion is scheduled, not immediate.
    deletionRequestedAt: Date,
    deletionScheduledFor: Date,
    deletedAt: Date,
  },
  { timestamps: true },
);

userSchema.index({ deletionScheduledFor: 1 }, { sparse: true });
/**
 * Only rows that actually hold an email string are indexed, so any number of
 * accounts can exist without one.
 *
 * Upgrading from the old email+password schema? That database still carries a
 * plain `unique: true` index on email, and Mongoose never rewrites an existing
 * index — run `npm run fix-indexes` once to replace it.
 */
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(plain, this.password);
};

/** Roles this account may switch into (PDF §2). Admin is never self-assignable. */
userSchema.methods.availableRoles = function availableRoles() {
  const set = new Set(this.roles?.length ? this.roles : [this.role]);
  if (this.role === 'admin') return ['admin'];
  set.add(this.role);
  return [...set].filter((r) => r !== 'admin');
};

userSchema.methods.toPublic = function toPublic() {
  return {
    _id: this._id,
    name: this.name,
    role: this.role,
    city: this.city,
    avatar: this.avatar,
    companyName: this.companyName,
    lastSeenAt: this.lastSeenAt,
  };
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
