import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

/**
 * validate({ body, query, params }) with zod schemas.
 * Parsed values are stored on req.valid.{body,query,params}; req.body is replaced
 * with the parsed body (unknown keys stripped).
 */
export const validate = (schemas) => (req, _res, next) => {
  try {
    req.valid = req.valid || {};
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const parsed = schemas[part].parse(req[part] ?? {});
      req.valid[part] = parsed;
      if (part === 'body') req.body = parsed;
    }
    next();
  } catch (e) {
    if (e instanceof ZodError) {
      const issues = e.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      const first = issues[0];
      return next(new AppError(first ? `${first.field ? first.field + ': ' : ''}${first.message}` : 'Invalid data', 422, issues));
    }
    next(e);
  }
};
