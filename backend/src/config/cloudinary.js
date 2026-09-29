import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

export const isCloudinaryConfigured = () =>
  Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
}

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer
 * @param {{folder?: string, resourceType?: 'image'|'raw'|'video'|'auto', filename?: string}} opts
 */
export function uploadBuffer(buffer, { folder = 'misc', resourceType = 'auto', filename } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.cloudinary.folder}/${folder}`,
        resource_type: resourceType,
        use_filename: Boolean(filename),
        filename_override: filename,
        unique_filename: true,
        overwrite: false,
      },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(buffer);
  });
}

export async function deleteAsset(publicId, resourceType = 'image') {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (e) {
    console.warn('[cloudinary] delete failed', publicId, e.message);
  }
}

export default cloudinary;
