import multer from 'multer';
import crypto from 'crypto';
import {
  createAppwriteServices,
  createFileInputFromBuffer,
  generateUniqueId,
  appwriteQuery
} from './appwrite.js';

const upload = multer({ storage: multer.memoryStorage() });
const makeId = (size = 21) => crypto.randomBytes(Math.max(16, size)).toString('base64url').slice(0, size);
const supportedUploadExtensions = new Set([
  '.pdf', '.doc', '.docx', '.txt', '.rtf',
  '.xls', '.xlsx', '.csv',
  '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
  '.json', '.html', '.htm'
]);

const getExtension = (filename = '') => {
  const lower = filename.toLowerCase();
  const idx = lower.lastIndexOf('.');
  return idx === -1 ? '' : lower.substring(idx);
};

const asBoolean = (value) => value === true || value === 1 || value === '1' || value === 'true';

const getMasterKey = () => {
  const rawKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me';
  return crypto.createHash('sha256').update(rawKey).digest();
};

const deriveJobKey = (jobId) => {
  const masterKey = getMasterKey();
  return crypto.hkdfSync('sha256', masterKey, Buffer.from(jobId), 'secure-print-job', 32);
};

const encryptDocumentForJob = (buffer, jobId) => {
  const key = deriveJobKey(jobId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encryptedData = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encryptedData]);
};

const decryptDocumentForJob = (buffer, jobId) => {
  if (!buffer || buffer.length < 28) {
    throw new Error('Encrypted document payload is invalid or empty');
  }
  const key = deriveJobKey(jobId);
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encryptedData = buffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
};

const toBuffer = async (input) => {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  if (ArrayBuffer.isView(input)) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (input?.body) return toBuffer(input.body);
  if (input && typeof input.getReader === 'function') {
    const reader = input.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
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

const getOrigin = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  return process.env.PUBLIC_BASE_URL || `${protocol}://${host}`;
};

const parseJob = (doc, req) => {
  const origin = getOrigin(req);
  const jobId = doc.jobId || doc.$id;
  return {
    id: jobId,
    userId: doc.userId || '',
    userName: doc.userName || '',
    documentName: doc.documentName || doc.filename || 'Document',
    pages: Number(doc.pages || 1),
    copies: Number(doc.copies || 1),
    color: asBoolean(doc.color),
    duplex: asBoolean(doc.duplex),
    stapling: asBoolean(doc.stapling),
    priority: doc.priority || 'normal',
    notes: doc.notes || '',
    status: doc.status || 'pending',
    cost: Number(doc.cost || 0),
    submittedAt: doc.submittedAt || doc.createdAt,
    secureToken: doc.token,
    releaseLink: doc.releaseLink || `${origin.replace(/\/$/, '')}/release/${jobId}?token=${doc.token}`,
    expiresAt: doc.expiresAt,
    viewCount: typeof doc.viewCount === 'number' ? doc.viewCount : 0,
    firstViewedAt: doc.firstViewedAt || null,
    lastViewedAt: doc.lastViewedAt || null,
    releasedAt: doc.releasedAt || null,
    completedAt: doc.completedAt || null,
    printerId: doc.printerId || null,
    releasedBy: doc.releasedBy || null,
    fileId: doc.fileId || null,
    mimeType: doc.mimeType || 'application/octet-stream'
  };
};

const isExpired = (expiresAt) => expiresAt ? Date.now() >= new Date(expiresAt).getTime() : false;

const markJobExpired = async (appwrite, jobDoc) => {
  if ((jobDoc.status || '') === 'expired') {
    return;
  }
  await appwrite.databases.updateDocument(
    appwrite.databaseId,
    appwrite.collectionId,
    jobDoc.$id || jobDoc.jobId,
    { status: 'expired' }
  );
};

const runUpload = (req, res) =>
  new Promise((resolve, reject) => {
    upload.single('file')(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

const listJobs = async (req, res, appwrite) => {
  const { userId } = req.query;
  let offset = 0;
  const jobs = [];
  while (true) {
    const { documents, total } = await appwrite.databases.listDocuments(
      appwrite.databaseId,
      appwrite.collectionId,
      [appwriteQuery.limit(100), appwriteQuery.offset(offset)]
    );
    jobs.push(...documents);
    offset += documents.length;
    if (jobs.length >= total || documents.length === 0) break;
  }
  const mapped = jobs
    .map((doc) => parseJob(doc, req))
    .filter((job) => job.status !== 'deleted')
    .filter((job) => !userId || !job.userId || String(job.userId) === String(userId))
    .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  return res.status(200).json({ jobs: mapped });
};

const getJob = async (req, res, appwrite, id, token) => {
  const jobDoc = await appwrite.databases.getDocument(appwrite.databaseId, appwrite.collectionId, id);
  if (!token || token !== jobDoc.token) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  if (isExpired(jobDoc.expiresAt)) {
    await markJobExpired(appwrite, jobDoc);
    return res.status(410).json({ error: 'Print link has expired' });
  }
  return res.status(200).json({ job: parseJob(jobDoc, req) });
};

const getJobContent = async (res, appwrite, id, token) => {
  const jobDoc = await appwrite.databases.getDocument(appwrite.databaseId, appwrite.collectionId, id);
  if (!token || token !== jobDoc.token) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  if (isExpired(jobDoc.expiresAt)) {
    await markJobExpired(appwrite, jobDoc);
    return res.status(410).json({ error: 'Print link has expired' });
  }
  if (!jobDoc.fileId) {
    return res.status(404).json({ error: 'Document content not available' });
  }
  const fileStream = await appwrite.storage.getFileDownload(appwrite.bucketId, jobDoc.fileId);
  const encryptedBuffer = await toBuffer(fileStream);
  const decryptedBuffer = decryptDocumentForJob(encryptedBuffer, id);
  res.setHeader('Content-Type', jobDoc.mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(jobDoc.documentName || jobDoc.filename || 'Document')}"`
  );
  res.setHeader('Content-Length', decryptedBuffer.length);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(decryptedBuffer);
};

const viewJob = async (res, appwrite, id, token) => {
  const jobDoc = await appwrite.databases.getDocument(appwrite.databaseId, appwrite.collectionId, id);
  if (!token || token !== jobDoc.token) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  if (isExpired(jobDoc.expiresAt)) {
    await markJobExpired(appwrite, jobDoc);
    return res.status(410).json({ error: 'Print link has expired' });
  }
  if ((jobDoc.status || 'pending') !== 'pending') {
    return res.status(403).json({ error: 'Document already viewed (one-time only)', alreadyViewed: true, viewCount: 1 });
  }
  const fileStream = await appwrite.storage.getFileDownload(appwrite.bucketId, jobDoc.fileId);
  const encryptedBuffer = await toBuffer(fileStream);
  const decryptedBuffer = decryptDocumentForJob(encryptedBuffer, id);
  const now = new Date().toISOString();
  await appwrite.databases.updateDocument(
    appwrite.databaseId,
    appwrite.collectionId,
    id,
    { status: 'viewed', viewCount: 1, firstViewedAt: now, lastViewedAt: now }
  );
  return res.status(200).json({
    success: true,
    document: {
      dataUrl: `data:${jobDoc.mimeType};base64,${decryptedBuffer.toString('base64')}`,
      mimeType: jobDoc.mimeType,
      name: jobDoc.documentName || jobDoc.filename || 'Document',
      size: Number(jobDoc.size || decryptedBuffer.length)
    },
    viewCount: 1,
    firstViewedAt: now
  });
};

const createJob = async (req, res, appwrite) => {
  await runUpload(req, res);
  const body = req.body || {};
  const userId = body.userId;
  const userName = body.userName;
  const documentName = body.documentName || req.file?.originalname || 'Document';
  if (!userId || !documentName || !req.file) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!supportedUploadExtensions.has(getExtension(req.file.originalname))) {
    return res.status(400).json({ error: 'Unsupported file type. Allowed: PDF, images, Word, Excel, PowerPoint, text.' });
  }
  if (!appwrite.bucketId) {
    return res.status(500).json({ error: 'Appwrite storage bucket is not configured on the server' });
  }

  const jobId = makeId(21);
  const secureToken = makeId(32);
  const expirationDuration = parseInt(body.expirationDuration || 15, 10);
  const expiresAt = new Date(Date.now() + expirationDuration * 60 * 1000).toISOString();
  const submittedAt = new Date().toISOString();
  const createdAt = submittedAt;
  const pages = +(body.pages ?? 1);
  const copies = +(body.copies ?? 1);
  const color = body.color === 'true' || body.color === true;
  const duplex = body.duplex === 'true' || body.duplex === true;
  const stapling = body.stapling === 'true' || body.stapling === true;
  const priority = body.priority || 'normal';
  const notes = body.notes || '';
  const baseCost = 0.1;
  const cost = +(baseCost * pages * copies * (color ? 2 : 1) * (duplex ? 0.8 : 1)).toFixed(2);
  const origin = getOrigin(req);
  const releaseLink = `${origin.replace(/\/$/, '')}/release/${jobId}?token=${secureToken}`;

  const encryptedContent = encryptDocumentForJob(req.file.buffer, jobId);
  let uploadedFile;
  try {
    uploadedFile = await appwrite.storage.createFile(
      appwrite.bucketId,
      generateUniqueId(),
      createFileInputFromBuffer(encryptedContent, req.file.originalname)
    );
  } catch (storageError) {
    const msg = String(storageError?.message || '');
    if (/extension|mime|file type|invalid file/i.test(msg)) {
      return res.status(400).json({ error: 'File type is blocked by Appwrite bucket settings. Allow this extension in Appwrite Storage bucket.' });
    }
    throw storageError;
  }

  const payload = {
    jobId,
    token: secureToken,
    fileId: uploadedFile.$id,
    mimeType: req.file.mimetype,
    expiresAt,
    status: 'pending',
    createdAt,
    userId,
    userName: userName || '',
    documentName,
    pages,
    copies,
    color,
    duplex,
    stapling,
    priority,
    notes,
    cost,
    submittedAt,
    releaseLink,
    viewCount: 0,
    filename: req.file.originalname,
    size: req.file.size
  };

  await appwrite.databases.createDocument(appwrite.databaseId, appwrite.collectionId, jobId, payload);

  return res.status(200).json({
    success: true,
    job: {
      id: jobId,
      userId,
      userName: userName || '',
      documentName,
      pages,
      copies,
      color,
      duplex,
      stapling,
      priority,
      notes,
      status: 'pending',
      cost,
      submittedAt,
      secureToken,
      releaseLink,
      expiresAt
    }
  });
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const appwrite = createAppwriteServices();
    const id = req.query.id || req.query.jobId || null;
    const action = req.query.action || null;
    const token = req.query.token || req.body?.token || null;

    if (req.method === 'GET' && !id) {
      return await listJobs(req, res, appwrite);
    }
    if (req.method === 'GET' && id && action === 'content') {
      return await getJobContent(res, appwrite, id, token);
    }
    if (req.method === 'GET' && id) {
      return await getJob(req, res, appwrite, id, token);
    }
    if (req.method === 'POST' && id && action === 'view') {
      return await viewJob(res, appwrite, id, token);
    }
    if (req.method === 'POST' && !id) {
      return await createJob(req, res, appwrite);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('jobs api error:', error);
    if (error?.code === 404) {
      return res.status(404).json({ error: 'Job not found' });
    }
    return res.status(500).json({ error: 'Server error', message: error?.message || 'Unknown error' });
  }
}
