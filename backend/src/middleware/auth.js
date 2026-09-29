import User from '../models/User.js';
import { verifyToken } from '../utils/helpers.js';
import { forbidden, unauthorized } from '../utils/AppError.js';

function readToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

async function resolveUser(token) {
  const payload = verifyToken(token);
  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('Account nahi mila, dobara login karo');
  if (user.isBlocked) throw forbidden('Aapka account block hai. Support se baat karein.');
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    throw unauthorized('Password badal gaya hai, dobara login karo');
  }
  return user;
}

export async function protect(req, _res, next) {
  const token = readToken(req);
  if (!token) return next(unauthorized());
  try {
    req.user = await resolveUser(token);
    next();
  } catch (e) {
    if (e.isOperational) return next(e);
    next(unauthorized('Session expire ho gaya, dobara login karo'));
  }
}

/** Attaches req.user if a valid token is present; never fails. */
export async function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = await resolveUser(token);
    } catch {
      /* ignore */
    }
  }
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
