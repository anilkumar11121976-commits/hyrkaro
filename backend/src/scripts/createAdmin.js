/* Create or promote the first admin from .env: `npm run create-admin` */
import { assertEnv } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';

assertEnv();

const {
  ADMIN_NAME = 'HyrKro Admin',
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_PHONE,
} = process.env;

async function run() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ chars) in .env');
    process.exit(1);
  }
  const phone = String(ADMIN_PHONE || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) {
    console.error('Set ADMIN_PHONE to a valid 10-digit mobile number in .env (admins log in by phone too)');
    process.exit(1);
  }

  await connectDB();
  const email = ADMIN_EMAIL.toLowerCase().trim();
  let user = await User.findOne({ $or: [{ email }, { phone }] });
  if (user) {
    user.role = 'admin';
    user.email = email;
    user.phone = phone;
    user.password = ADMIN_PASSWORD;
    user.phoneVerifiedAt = user.phoneVerifiedAt || new Date();
    await user.save();
    console.log(`Updated ${email} / ${phone} -> admin`);
  } else {
    await User.create({
      name: ADMIN_NAME,
      email,
      phone,
      password: ADMIN_PASSWORD,
      role: 'admin',
      phoneVerifiedAt: new Date(),
      acceptedPolicyAt: new Date(),
    });
    console.log(`Created admin ${email} / ${phone}`);
  }
  console.log('Admin can sign in at /admin/login with email + password, or by OTP on that phone.');
  await disconnectDB();
}

run().catch(async (e) => {
  console.error(e);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
