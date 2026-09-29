/**
 * Repair database indexes after a schema change: `npm run fix-indexes`
 *
 * Mongoose creates missing indexes but never rewrites one that already exists
 * with the same name. So a database built by an older version of this app keeps
 * the old rules — most painfully the plain `unique` index on `users.email`,
 * which makes the SECOND account without an email fail with
 * "Is email se account pehle se bana hai".
 *
 * This script syncs every model's indexes to the current schema and, when an
 * index cannot be built, explains which rows are in the way.
 */
import mongoose from 'mongoose';
import { assertEnv } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';

import User from '../models/User.js';
import Otp from '../models/Otp.js';
import FreelancerProfile from '../models/FreelancerProfile.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Review from '../models/Review.js';
import Requirement from '../models/Requirement.js';
import Interest from '../models/Interest.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import AdminLog from '../models/AdminLog.js';
import Waitlist from '../models/Waitlist.js';

assertEnv();

const MODELS = [
  User, Otp, FreelancerProfile, Conversation, Message, Order,
  Payment, Review, Requirement, Interest, Notification, Setting, AdminLog, Waitlist,
];

/** Explain, in plain terms, which rows block a unique index. */
async function diagnose(Model, err) {
  const name = Model.modelName;
  const msg = String(err?.message || err);

  if (name === 'User' && /email/i.test(msg)) {
    const dupes = await Model.aggregate([
      { $match: { email: { $type: 'string' } } },
      { $group: { _id: '$email', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ]);
    if (dupes.length) {
      console.error(`  -> ${dupes.length} email(s) are used by more than one account:`);
      dupes.slice(0, 10).forEach((d) => console.error(`     ${d._id} (${d.n} accounts)`));
      console.error('     Clear the duplicates, then run this again.');
      return;
    }
  }

  if (name === 'User' && /phone/i.test(msg)) {
    const noPhone = await Model.countDocuments({ phone: { $in: [null, ''] } });
    const dupes = await Model.aggregate([
      { $group: { _id: '$phone', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ]);
    console.error(`  -> ${noPhone} account(s) have no phone number and ${dupes.length} phone(s) are duplicated.`);
    console.error('     Login is by mobile OTP now, so accounts without a phone cannot sign in.');
    console.error('     On a dev database the quickest fix is: drop the database and run `npm run seed`.');
    return;
  }

  console.error(`  -> ${msg}`);
}

async function run() {
  await connectDB();
  console.log(`\nSyncing indexes on ${mongoose.connection.name}\n`);

  let changed = 0;
  let failed = 0;

  for (const Model of MODELS) {
    const label = Model.modelName.padEnd(18);
    try {
      // syncIndexes drops indexes the schema no longer declares and builds the
      // ones it does — exactly what a stale unique index needs.
      const dropped = await Model.syncIndexes();
      if (dropped?.length) {
        changed += dropped.length;
        console.log(`${label} rebuilt: ${dropped.join(', ')}`);
      } else {
        console.log(`${label} ok`);
      }
    } catch (e) {
      failed += 1;
      console.error(`${label} FAILED`);
      await diagnose(Model, e);
    }
  }

  console.log(
    `\n${changed ? `${changed} index(es) rebuilt.` : 'No index changes were needed.'}` +
      (failed ? ` ${failed} model(s) could not be synced — see the notes above.` : ' All good.'),
  );
  if (!failed) console.log('Signup should work now.\n');

  await disconnectDB();
}

run().catch(async (e) => {
  console.error(e);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
