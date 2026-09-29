import { uploadBuffer, isCloudinaryConfigured } from '../config/cloudinary.js';
import cloudinary from '../config/cloudinary.js';
import { env } from '../config/env.js';

/**
 * PDF §9: the client reviews a watermarked preview; the real file unlocks only
 * after they approve the milestone.
 *
 * Images and PDFs get a real Cloudinary watermark transformation. Anything else
 * (zip, video, docx) has no safe preview, so we expose metadata only — the
 * client sees the file exists and its size, but cannot download it until release.
 */
export function canPreview(mime = '') {
  return mime.startsWith('image/') || mime === 'application/pdf';
}

const WATERMARK_TEXT = 'HyrKro preview - approve karne ke baad original milega';

/**
 * Build a watermarked, downsized delivery URL for an already-uploaded asset.
 * Returns null when no safe preview can be produced.
 */
export function previewUrlFor(publicId, resourceType = 'image', mime = '') {
  if (!isCloudinaryConfigured() || !publicId || !canPreview(mime)) return null;
  try {
    return cloudinary.url(publicId, {
      resource_type: resourceType === 'image' ? 'image' : 'image',
      secure: true,
      transformation: [
        { width: 1280, crop: 'limit', quality: 'auto:low' },
        { effect: 'blur:120' },
        {
          overlay: { font_family: 'Arial', font_size: 46, font_weight: 'bold', text: WATERMARK_TEXT },
          color: '#FFFFFF',
          opacity: 70,
          gravity: 'center',
        },
      ],
    });
  } catch {
    return null;
  }
}

/** Upload one delivery file and return both the private original and its preview. */
export async function uploadDelivery(file, orderId) {
  const resourceType = file.mimetype.startsWith('image/')
    ? 'image'
    : file.mimetype.startsWith('video/')
      ? 'video'
      : 'raw';
  const r = await uploadBuffer(file.buffer, {
    folder: `orders/${orderId}`,
    resourceType,
    filename: file.originalname,
  });
  const original = {
    url: r.secure_url,
    publicId: r.public_id,
    name: file.originalname,
    mime: file.mimetype,
    resourceType: r.resource_type,
    size: file.size,
  };
  const preview = {
    name: file.originalname,
    mime: file.mimetype,
    size: file.size,
    resourceType: r.resource_type,
    url: previewUrlFor(r.public_id, r.resource_type, file.mimetype),
  };
  return { original, preview };
}

export const watermarkFolder = () => `${env.cloudinary.folder}/orders`;
