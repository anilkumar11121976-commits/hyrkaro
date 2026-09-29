import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { razorpayWebhook } from './controllers/paymentController.js';
import { apiLimiter, sanitizeRequest } from './middleware/security.js';
import {
  errorHandler,
  notFoundHandler,
} from './middleware/error.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Render / Railway / Nginx / proxy
  app.set('trust proxy', 1);

  // ---------- CORS ----------
  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests without Origin:
        // curl, Postman, server-to-server, health checks, etc.
        if (!origin) {
          return callback(null, true);
        }

        const normalizedOrigin = origin
          .trim()
          .replace(/\/$/, '');

        const configuredOrigins = env.clientUrls
          .map((url) => url.trim().replace(/\/$/, ''))
          .filter(Boolean);

        // 1. Exact CLIENT_URL match
        if (configuredOrigins.includes(normalizedOrigin)) {
          return callback(null, true);
        }

        // 2. Allow HyrKaro Vercel deployments
        //
        // Examples:
        // https://hyrkaro.vercel.app
        // https://hyrkaro-git-main-rahul-b95f.vercel.app
        // https://hyrkaro-xxxxx-rahul-b95f.vercel.app
        //
        if (
          /^https:\/\/hyrkaro(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(
            normalizedOrigin
          )
        ) {
          return callback(null, true);
        }

        // 3. Allow localhost during development
        if (
          /^http:\/\/localhost(?::\d+)?$/i.test(
            normalizedOrigin
          )
        ) {
          return callback(null, true);
        }

        // 4. Allow 127.0.0.1 during development
        if (
          /^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(
            normalizedOrigin
          )
        ) {
          return callback(null, true);
        }

        console.warn(
          `[cors] Blocked origin: ${normalizedOrigin}`
        );

        console.warn(
          `[cors] Configured origins: ${
            configuredOrigins.length
              ? configuredOrigins.join(', ')
              : 'NONE'
          }`
        );

        return callback(
          new Error(
            `CORS blocked origin: ${normalizedOrigin}`
          )
        );
      },

      credentials: true,

      methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ],

      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'Pragma',
      ],

      exposedHeaders: [
        'Content-Disposition',
      ],

      optionsSuccessStatus: 204,
    })
  );

  // ---------- Performance ----------
  app.use(compression());

  // ---------- Logging ----------
  app.use(
    morgan(
      env.isProd
        ? 'combined'
        : 'dev'
    )
  );

  // ---------- Razorpay Webhook ----------
  // Raw body must be available for signature verification.
  app.post(
    '/api/payments/webhook',
    express.raw({
      type: 'application/json',
      limit: '1mb',
    }),
    razorpayWebhook
  );

  // ---------- Body Parsers ----------
  app.use(
    express.json({
      limit: '1mb',
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: '1mb',
    })
  );

  // ---------- Sanitization ----------
  app.use(sanitizeRequest);

  // ---------- Health / Root ----------
  app.get('/', (_req, res) => {
    res.json({
      name: 'HyrKro API',
      status: 'ok',
      docs: '/api/health',
    });
  });

  // ---------- API ----------
  app.use(
    '/api',
    apiLimiter,
    routes
  );

  // ---------- 404 ----------
  app.use(notFoundHandler);

  // ---------- Error ----------
  app.use(errorHandler);

  return app;
}