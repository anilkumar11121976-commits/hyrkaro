export class AppError extends Error {
  constructor(message, statusCode = 400, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

export const badRequest = (m, d) => new AppError(m, 400, d);
export const unauthorized = (m = 'Login zaroori hai') => new AppError(m, 401);
export const forbidden = (m = 'Aapko is kaam ki permission nahi hai') => new AppError(m, 403);
export const notFound = (m = 'Nahi mila') => new AppError(m, 404);
export const conflict = (m) => new AppError(m, 409);
