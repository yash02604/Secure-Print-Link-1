import multer from 'multer';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { createAppwriteServices, createFileInputFromBuffer, generateUniqueId } from '../server/src/appwrite.js';

const upload = multer({ storage: multer.memoryStorage() });

const runUpload = (req, res) =>
  new Promise((resolve, reject) => {
    upload.single('file')(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

const getMasterKey = () => {
  const rawKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me';
  return crypto.createHash('sha256').update(rawKey).digest();
};

const deriveFileKey = (fileId) => {
  const masterKey = getMasterKey();
  return crypto.hkdfSync('sha256', masterKey, Buffer.from(fileId), 'secure-file-encryption', 32);
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const appwrite = createAppwriteServices();
    if (!appwrite.bucketId) {
      return res.status(500).json({ error: 'Appwrite storage bucket is not configured on the server' });
    }
    await runUpload(req, res);
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const fileId = nanoid();
    const fileKey = deriveFileKey(fileId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', fileKey, iv);
    const encryptedData = Buffer.concat([cipher.update(req.file.buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combinedEncrypted = Buffer.concat([iv, authTag, encryptedData]);

    const storageFile = await appwrite.storage.createFile(
      appwrite.bucketId,
      generateUniqueId(),
      createFileInputFromBuffer(combinedEncrypted, req.file.originalname)
    );

    return res.status(200).json({
      success: true,
      file: {
        id: fileId,
        storageFileId: storageFile.$id,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('upload api error:', error);
    return res.status(500).json({ error: 'Server error', message: error?.message || 'Unknown error' });
  }
}
