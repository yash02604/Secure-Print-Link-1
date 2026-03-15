import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAppwriteServices, createFileInputFromBuffer, generateUniqueId } from './storage/appwrite.js';
import jobsRouter from './web/jobs.routes.js';
import printersRouter from './web/printers.routes.js';
import authRouter from './web/auth.routes.js';
import fs from 'fs';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import multer from 'multer';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../../.env') });
dotenv.config({ path: join(__dirname, '../../env.local') });

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

let appwrite = null;
try {
  appwrite = createAppwriteServices();
} catch (error) {
  console.error(error.message);
}

const upload = multer({
  storage: multer.memoryStorage()
});

const getMasterKey = () => {
  const rawKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me';
  return crypto.createHash('sha256').update(rawKey).digest();
};

const deriveFileKey = (fileId) => {
  const masterKey = getMasterKey();
  return crypto.hkdfSync('sha256', masterKey, Buffer.from(fileId), 'secure-file-encryption', 32);
};

const toBuffer = async (input) => {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  if (ArrayBuffer.isView(input)) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (input && typeof input.arrayBuffer === 'function') {
    const arrayBuffer = await input.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  if (input && typeof input.on === 'function') {
    const chunks = [];
    for await (const chunk of input) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error('Unsupported Appwrite file payload');
};

const authMiddleware = (req, res, next) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = { id: String(userId) };
  next();
};

// routes
app.use('/api/jobs', (req, res, next) => { req.appwrite = appwrite; next(); }, jobsRouter);
app.use('/api/printers', (req, res, next) => { req.appwrite = appwrite; next(); }, printersRouter);
app.use('/api/auth', (req, res, next) => { req.appwrite = appwrite; next(); }, authRouter);

app.post('/upload', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!appwrite) {
      return res.status(500).json({ error: 'Appwrite is not configured on the server' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/svg+xml'
    ]);

    if (!allowedMimeTypes.has(req.file.mimetype)) {
      return res.status(400).json({ error: 'Unsupported file type. Allowed: PDF, images, Word, Excel, PowerPoint, text.' });
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

    await appwrite.databases.createDocument(
      appwrite.databaseId,
      appwrite.filesCollectionId,
      fileId,
      {
        fileId,
        storageFileId: storageFile.$id,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        createdAt: new Date().toISOString()
      }
    );

    res.json({
      id: fileId,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (err) {
    next(err);
  }
});

app.get('/decrypt/:id', authMiddleware, async (req, res, next) => {
  const { id } = req.params;

  try {
    if (!appwrite) {
      return res.status(500).json({ error: 'Appwrite is not configured on the server' });
    }

    const record = await appwrite.databases.getDocument(
      appwrite.databaseId,
      appwrite.filesCollectionId,
      id
    );

    const fileKey = deriveFileKey(id);
    const encryptedPayload = await appwrite.storage.getFileDownload(appwrite.bucketId, record.storageFileId);
    const encryptedBuffer = await toBuffer(encryptedPayload);
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const encryptedData = encryptedBuffer.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);

    res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(record.filename || 'document.bin')}"`
    );
    res.setHeader('Content-Length', decryptedBuffer.length);
    res.setHeader('Cache-Control', 'no-store');

    Readable.from(decryptedBuffer).pipe(res);
  } catch (err) {
    if (err?.code === 404) {
      return res.status(404).json({ error: 'File not found' });
    }
    next(err);
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

// Serve React build in production for internet-facing single URL
const buildDir = join(__dirname, '../../build');
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(buildDir, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});
export default app;
export { app };

if (process.argv[1] && process.argv[1] === __filename) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SecurePrint backend running on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}
