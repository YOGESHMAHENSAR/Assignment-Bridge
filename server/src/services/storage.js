import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import env from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

if (env.cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
} else {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const safeName = (name = 'file') =>
  name.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'file';

const uploadToCloudinary = (file, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `assignment-bridge/${folder}`,
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          name: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          resourceType: result.resource_type,
        });
      }
    );
    stream.end(file.buffer);
  });

const saveLocally = async (file) => {
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName(file.originalname)}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, name), file.buffer);
  return {
    url: `${env.serverUrl}/uploads/${name}`,
    publicId: `local:${name}`,
    name: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  };
};

/** Store multer memory files; returns metadata array for the Task model. */
export async function storeFiles(files = [], folder = 'tasks') {
  const results = [];
  try {
    for (const file of files) {
      // sequential keeps memory use low and makes cleanup on failure simple
      results.push(env.cloudinaryEnabled ? await uploadToCloudinary(file, folder) : await saveLocally(file));
    }
  } catch (err) {
    await removeFiles(results);
    throw err;
  }
  return results.map(({ resourceType, ...rest }) => rest); // eslint-disable-line no-unused-vars
}

/** Best-effort deletion, never throws. */
export async function removeFiles(files = []) {
  await Promise.all(
    files.map(async (f) => {
      try {
        if (!f.publicId) return;
        if (f.publicId.startsWith('local:')) {
          await fs.promises.unlink(path.join(UPLOAD_DIR, f.publicId.slice(6)));
        } else if (env.cloudinaryEnabled) {
          const resourceType = /\/(image|raw|video)\/upload\//.exec(f.url)?.[1] || 'image';
          await cloudinary.uploader.destroy(f.publicId, { resource_type: resourceType });
        }
      } catch {
        /* ignore */
      }
    })
  );
}
