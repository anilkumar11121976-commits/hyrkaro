import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { razorpayWebhook } from './controllers/paymentController.js';
import { apiLimiter, sanitizeRequest } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Render/Railway/Nginx load balancer

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin(origin, cb) {
        // allow server-to-server / curl (no origin) and configured frontends
        if (!origin || env.clientUrls.includes(origin.replace(/\/$/, ''))) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(compression());
  app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // Razorpay webhook needs the raw body for signature verification
  app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), razorpayWebhook);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(sanitizeRequest);

  app.get('/', (_req, res) => res.json({ name: 'HyrKro API', status: 'ok', docs: '/api/health' }));
  app.use('/api', apiLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
