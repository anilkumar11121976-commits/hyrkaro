import path from 'path';
import multer from 'multer';
import { ALLOWED_MIME, BLOCKED_EXT, MAX_UPLOAD_MB } from '../config/constants.js';
import { badRequest } from '../utils/AppError.js';

const storage = multer.memoryStorage();

/** PDF §5: block by extension as well as MIME — a renamed .exe must not slip through. */
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (BLOCKED_EXT.includes(ext)) return cb(badRequest(`${ext} file allowed nahi hai`));
  if (!ALLOWED_MIME.includes(file.mimetype)) return cb(badRequest('Ye file type allowed nahi hai'));
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 5 },
});

export const imageOnly = multer({
  storage,
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(badRequest('Sirf image upload karo (jpg, png, webp)')),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
