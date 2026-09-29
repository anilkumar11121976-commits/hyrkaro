import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  mongoose.connection.on('connected', () => console.log('[db] MongoDB connected'));
  mongoose.connection.on('error', (err) => console.error('[db] MongoDB error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));

  await mongoose.connect(env.mongoUri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20,
  });
}

export async function disconnectDB() {
  await mongoose.connection.close();
}

/**
 * Mongoose creates missing indexes but never rewrites one that already exists,
 * so a database built by the old email+password version keeps a plain
 * `unique: true` index on users.email. Every account created since then has no
 * email, they all index as null, and the second one fails with
 * "Is email se account pehle se bana hai" — with no email field in sight.
 *
 * Drop that one stale index on boot so the correct partial index is built.
 * Everything else is left alone; `npm run fix-indexes` handles the rest.
 */
export async function repairLegacyIndexes() {
  if (process.env.SKIP_INDEX_REPAIR === 'true') return;
  try {
    const users = mongoose.connection.collection('users');
    const indexes = await users.indexes();
    const emailIndex = indexes.find(
      (i) => i.key && Object.keys(i.key).length === 1 && i.key.email === 1,
    );
    if (!emailIndex) return;

    const isSafe = Boolean(emailIndex.partialFilterExpression || emailIndex.sparse);
    if (isSafe || !emailIndex.unique) return;

    console.warn(
      `[db] Found a legacy unique index "${emailIndex.name}" on users.email that blocks accounts without an email. Replacing it...`,
    );
    await users.dropIndex(emailIndex.name);
    const { default: User } = await import('../models/User.js');
    await User.syncIndexes();
    console.warn('[db] users.email index replaced with a partial unique index. Signup is unblocked.');
  } catch (e) {
    console.warn(
      `[db] Could not repair the users.email index automatically (${e.message}). Run: npm run fix-indexes`,
    );
  }
}
