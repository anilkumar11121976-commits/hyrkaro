import multer from 'multer';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route nahi mila: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Server error';
  let details = err.details;

  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File bahut badi hai' : `Upload error: ${err.message}`;
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Galat ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field];
    if (value === null || value === undefined) {
      /**
       * A duplicate on an EMPTY value means a stale unique index, not a real
       * clash — e.g. an old non-partial index on users.email colliding on null.
       * Blaming the field confuses everyone, because the user never filled it.
       */
      status = 500;
      message = env.isProd
        ? 'Kuch gadbad ho gayi. Thodi der baad try karo.'
        : `Database index "${field}" khaali value pe clash kar raha hai. Backend mein chalao: npm run fix-indexes`;
      console.error(
        `[db] Duplicate-key error on an empty "${field}". This is a stale unique index — run: npm run fix-indexes`,
      );
    } else {
      const labels = { email: 'Is email se account pehle se bana hai', phone: 'Is number se account pehle se bana hai' };
      message = labels[field] || `${field} pehle se maujood hai`;
    }
  } else if (err.name === 'ValidationError') {
    status = 422;
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = details[0]?.message || 'Invalid data';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Session expire ho gaya, dobara login karo';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request bahut badi hai';
  }

  if (status >= 500) {
    console.error('[error]', req.method, req.originalUrl, err);
    // Only scrub messages from genuinely unexpected (programmer/crash) errors.
    // An AppError with isOperational is one we deliberately threw with a safe,
    // already-Hinglish message for the person to read (e.g. "OTP nahi bhej
    // paye: <reason>") — hiding that in production left no way to see why an
    // operation failed without digging through server logs.
    if (env.isProd && !err.isOperational) message = 'Kuch gadbad ho gayi. Thodi der baad try karo.';
  }

  res.status(status).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(!env.isProd && status >= 500 ? { stack: err.stack } : {}),
  });
}