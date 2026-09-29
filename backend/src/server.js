import http from 'http';
import { assertEnv, env } from './config/env.js';
import { connectDB, disconnectDB, repairLegacyIndexes } from './config/db.js';
import { createApp } from './app.js';
import { initSocket } from './sockets/index.js';
import { startJobs, stopJobs } from './jobs/index.js';
import { isRazorpayConfigured } from './config/razorpay.js';
import { isCloudinaryConfigured } from './config/cloudinary.js';
import { isSmsConfigured } from './config/sms.js';

assertEnv();

const app = createApp();
const server = http.createServer(app);
initSocket(server);

async function start() {
  try {
    await connectDB();
  } catch (e) {
    console.error('[db] Could not connect to MongoDB:', e.message);
    process.exit(1);
  }
  await repairLegacyIndexes();
  startJobs();
  server.listen(env.port, () => {
    console.log(`[api] HyrKro API running on port ${env.port} (${env.nodeEnv})`);
    console.log(`[api] Login:    ${isSmsConfigured() ? 'OTP over SMS' : 'DEMO OTP (no SMS keys — code shown in response)'}`);
    console.log(`[api] Payments: ${isRazorpayConfigured() ? 'Razorpay LIVE/TEST keys' : 'DEMO mode (no Razorpay keys)'}`);
    console.log(`[api] Uploads:  ${isCloudinaryConfigured() ? 'Cloudinary' : 'disabled (no Cloudinary keys)'}`);
  });
}

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} received, shutting down...`);
  stopJobs();
  server.close(async () => {
    await disconnectDB().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('[api] Unhandled rejection:', err));
process.on('uncaughtException', (err) => {
  console.error('[api] Uncaught exception:', err);
  shutdown('uncaughtException');
});

start();
