import { Router } from 'express';
import { nanoid } from 'nanoid';
import multer from 'multer';
import crypto from 'crypto';
import { appwriteQuery, createFileInputFromBuffer, generateUniqueId } from '../storage/appwrite.js';

const upload = multer({
  storage: multer.memoryStorage()
});

const router = Router();
let cleanupAppwrite = null;
let cleanupRunning = false;

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

const decryptDocumentForJob = (buffer, jobId, { strict = false } = {}) => {
  if (!buffer || buffer.length < 28) {
    if (strict) {
      throw new Error('Encrypted document payload is invalid or empty');
    }
    return buffer;
  }

  const key = deriveJobKey(jobId);
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encryptedData = buffer.subarray(28);

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  } catch (err) {
    if (strict) {
      throw new Error(`Failed to decrypt document for job ${jobId}`);
    }
    console.error('Failed to decrypt document for job, falling back to raw content:', jobId, err);
    return buffer;
  }
};

const getOrigin = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const computedOrigin = `${protocol}://${host}`;
  return process.env.PUBLIC_BASE_URL || req.headers.origin || computedOrigin;
};

const asBoolean = (value) => value === true || value === 1 || value === '1' || value === 'true';

const extractErrorMessage = (error) => String(error?.message || error?.response || error || '');

const isUnknownAttributeError = (error) =>
  /unknown attribute|invalid document structure|attribute not found/i.test(extractErrorMessage(error));

const toBuffer = async (input) => {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  if (ArrayBuffer.isView(input)) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (input?.body) {
    return toBuffer(input.body);
  }
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

const downloadAndDecryptJobFile = async (appwrite, jobDoc, jobId) => {
  const encryptedPayload = await appwrite.storage.getFileDownload(appwrite.bucketId, jobDoc.fileId);
  const encryptedBuffer = await toBuffer(encryptedPayload);
  return decryptDocumentForJob(encryptedBuffer, jobId, { strict: true });
};

const appwriteReady = (req, res) => {
  if (!req.appwrite) {
    res.status(500).json({ error: 'Appwrite is not configured on the server' });
    return false;
  }
  return true;
};

const storageReady = (appwrite, res) => {
  if (!appwrite?.bucketId) {
    res.status(500).json({ error: 'Appwrite storage bucket is not configured on the server' });
    return false;
  }
  return true;
};

const parseJob = (doc, req) => {
  const jobId = doc.jobId || doc.$id;
  const token = doc.token;
  const releaseLink =
    doc.releaseLink || `${getOrigin(req).replace(/\/$/, '')}/release/${jobId}?token=${token}`;
  const status = doc.status || 'pending';
  const viewCount =
    typeof doc.viewCount === 'number' ? doc.viewCount : (status === 'pending' ? 0 : 1);

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
    status,
    cost: Number(doc.cost || 0),
    submittedAt: doc.submittedAt || doc.createdAt,
    secureToken: token,
    releaseLink,
    expiresAt: doc.expiresAt,
    viewCount,
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

const getJobDocument = async (appwrite, jobId) => {
  return appwrite.databases.getDocument(appwrite.databaseId, appwrite.collectionId, jobId);
};

const updateJobDocument = async (appwrite, jobId, data, fallbackData = null) => {
  try {
    return await appwrite.databases.updateDocument(
      appwrite.databaseId,
      appwrite.collectionId,
      jobId,
      data
    );
  } catch (error) {
    if (fallbackData && isUnknownAttributeError(error)) {
      return appwrite.databases.updateDocument(
        appwrite.databaseId,
        appwrite.collectionId,
        jobId,
        fallbackData
      );
    }
    throw error;
  }
};

const createJobDocument = async (appwrite, jobId, fullData, minimalData) => {
  try {
    return await appwrite.databases.createDocument(
      appwrite.databaseId,
      appwrite.collectionId,
      jobId,
      fullData
    );
  } catch (error) {
    if (isUnknownAttributeError(error)) {
      return appwrite.databases.createDocument(
        appwrite.databaseId,
        appwrite.collectionId,
        jobId,
        minimalData
      );
    }
    throw error;
  }
};

const deleteFileSilently = async (appwrite, fileId) => {
  if (!fileId) return;
  try {
    await appwrite.storage.deleteFile(appwrite.bucketId, fileId);
  } catch (error) {
    if (error?.code !== 404) {
      console.error('Failed to delete Appwrite file:', fileId, error);
    }
  }
};

const expireJob = async (appwrite, jobDoc) => {
  await deleteFileSilently(appwrite, jobDoc.fileId);
  await updateJobDocument(appwrite, jobDoc.$id, { status: 'deleted' }, { status: 'deleted' });
};

const isExpired = (expiresAt) => {
  if (!expiresAt) return false;
  return Date.now() >= new Date(expiresAt).getTime();
};

const cleanupExpiredJobs = async () => {
  if (!cleanupAppwrite || cleanupRunning) return;
  cleanupRunning = true;
  try {
    const nowIso = new Date().toISOString();
    const { documents } = await cleanupAppwrite.databases.listDocuments(
      cleanupAppwrite.databaseId,
      cleanupAppwrite.collectionId,
      [
        appwriteQuery.lessThanEqual('expiresAt', nowIso),
        appwriteQuery.notEqual('status', 'deleted'),
        appwriteQuery.limit(100)
      ]
    );

    for (const doc of documents) {
      await expireJob(cleanupAppwrite, doc);
    }
  } catch (error) {
    console.error('Expired job cleanup failed:', error);
  } finally {
    cleanupRunning = false;
  }
};

setInterval(() => {
  cleanupExpiredJobs();
}, 60000);

router.use((req, res, next) => {
  if (req.appwrite && !cleanupAppwrite) {
    cleanupAppwrite = req.appwrite;
  }
  next();
});

router.post('/', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(500).json({ error: 'Upload failed' });
    }
    return next();
  });
}, async (req, res) => {
  if (!appwriteReady(req, res)) return;

  const appwrite = req.appwrite;
  if (!storageReady(appwrite, res)) return;
  const body = req.body || {};
  const userId = body.userId;
  const userName = body.userName;
  const documentName = body.documentName || req.file?.originalname || 'Document';
  const jobId = nanoid();
  const secureToken = nanoid(32);

  if (!userId || !documentName || !req.file) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const expirationDuration = parseInt(body.expirationDuration || 15, 10);
  const expiresAt = new Date(Date.now() + expirationDuration * 60 * 1000).toISOString();
  const submittedAt = new Date().toISOString();
  const createdAt = submittedAt;
  const origin = getOrigin(req);
  const releaseLink = `${origin.replace(/\/$/, '')}/release/${jobId}?token=${secureToken}`;
  const pages = +(body.pages ?? 1);
  const copies = +(body.copies ?? 1);
  const color = body.color === 'true' || body.color === true;
  const duplex = body.duplex === 'true' || body.duplex === true;
  const stapling = body.stapling === 'true' || body.stapling === true;
  const priority = body.priority || 'normal';
  const notes = body.notes || '';

  const baseCost = 0.1;
  const colorMultiplier = color ? 2 : 1;
  const duplexMultiplier = duplex ? 0.8 : 1;
  const cost = +(baseCost * pages * copies * colorMultiplier * duplexMultiplier).toFixed(2);

  let uploadedFile = null;
  try {
    const encryptedContent = encryptDocumentForJob(req.file.buffer, jobId);
    uploadedFile = await appwrite.storage.createFile(
      appwrite.bucketId,
      generateUniqueId(),
      createFileInputFromBuffer(encryptedContent, req.file.originalname)
    );

    const minimalJobData = {
      jobId,
      token: secureToken,
      fileId: uploadedFile.$id,
      mimeType: req.file.mimetype,
      expiresAt,
      status: 'pending',
      createdAt
    };

    const fullJobData = {
      ...minimalJobData,
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
      firstViewedAt: null,
      lastViewedAt: null,
      filename: req.file.originalname,
      size: req.file.size
    };

    await createJobDocument(appwrite, jobId, fullJobData, minimalJobData);

    return res.json({
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
        expiresAt,
        expirationDuration,
        file: {
          filename: uploadedFile.$id,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        }
      }
    });
  } catch (error) {
    console.error('Error during Appwrite job submission:', error);
    if (uploadedFile?.$id) {
      await deleteFileSilently(appwrite, uploadedFile.$id);
    }
    return res.status(500).json({ error: 'Failed to process print job' });
  }
});

router.get('/cleanup/expired', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const nowIso = new Date().toISOString();

  try {
    const { documents } = await appwrite.databases.listDocuments(
      appwrite.databaseId,
      appwrite.collectionId,
      [
        appwriteQuery.lessThanEqual('expiresAt', nowIso),
        appwriteQuery.notEqual('status', 'deleted'),
        appwriteQuery.limit(100)
      ]
    );

    const expired = documents.map((doc) => ({
      id: doc.jobId || doc.$id,
      expiredAt: doc.expiresAt,
      originalToken: `${String(doc.token || '').slice(0, 8)}...`
    }));
    return res.json({ expired });
  } catch (error) {
    console.error('Failed to list expired jobs:', error);
    return res.status(500).json({ error: 'Failed to fetch expired jobs' });
  }
});

router.get('/:id', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  if (!storageReady(appwrite, res)) return;
  const { id } = req.params;
  const { token } = req.query;

  try {
    const jobDoc = await getJobDocument(appwrite, id);
    if (!token || token !== jobDoc.token) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    if (isExpired(jobDoc.expiresAt)) {
      await expireJob(appwrite, jobDoc);
      return res.status(410).json({ error: 'Print link has expired' });
    }

    if ((jobDoc.status || 'pending') !== 'pending') {
      return res.status(403).json({
        error: 'Document already viewed (one-time only)',
        alreadyViewed: true,
        viewCount: 1
      });
    }

    const decryptedBuffer = await downloadAndDecryptJobFile(appwrite, jobDoc, id);
    const base64 = decryptedBuffer.toString('base64');
    const job = parseJob(jobDoc, req);
    job.document = {
      dataUrl: `data:${jobDoc.mimeType};base64,${base64}`,
      mimeType: jobDoc.mimeType,
      name: jobDoc.documentName || jobDoc.filename || 'Document',
      size: Number(jobDoc.size || decryptedBuffer.length)
    };

    return res.json({ job });
  } catch (error) {
    if (error?.code === 404) {
      return res.status(404).json({ error: 'Job not found' });
    }
    console.error('Error fetching Appwrite job:', error);
    return res.status(500).json({ error: 'Failed to fetch print job' });
  }
});

router.get('/:id/content', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  if (!storageReady(appwrite, res)) return;
  const { id } = req.params;
  const { token } = req.query;

  try {
    const jobDoc = await getJobDocument(appwrite, id);
    if (!token || token !== jobDoc.token) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (isExpired(jobDoc.expiresAt)) {
      await expireJob(appwrite, jobDoc);
      return res.status(410).json({ error: 'Print link has expired' });
    }
    if (!jobDoc.fileId) {
      return res.status(404).json({ error: 'Document content not available' });
    }

    const decryptedBuffer = await downloadAndDecryptJobFile(appwrite, jobDoc, id);
    res.setHeader('Content-Type', jobDoc.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(jobDoc.documentName || jobDoc.filename || 'Document')}"`
    );
    res.setHeader('Content-Length', decryptedBuffer.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(decryptedBuffer);
  } catch (error) {
    if (error?.code === 404) {
      return res.status(404).json({ error: 'Job not found' });
    }
    console.error('Error fetching job content:', error);
    return res.status(500).json({ error: 'Failed to fetch document content' });
  }
});

router.post('/:id/view', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  if (!storageReady(appwrite, res)) return;
  const { id } = req.params;
  const { token } = req.body || {};

  try {
    const jobDoc = await getJobDocument(appwrite, id);
    if (!token || token !== jobDoc.token) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    if (isExpired(jobDoc.expiresAt)) {
      await expireJob(appwrite, jobDoc);
      return res.status(410).json({ error: 'Print link has expired' });
    }

    if ((jobDoc.status || 'pending') !== 'pending') {
      return res.status(403).json({
        error: 'Document already viewed (one-time only)',
        alreadyViewed: true,
        viewCount: 1
      });
    }

    const decryptedBuffer = await downloadAndDecryptJobFile(appwrite, jobDoc, id);
    const base64 = decryptedBuffer.toString('base64');
    const now = new Date().toISOString();

    await updateJobDocument(
      appwrite,
      id,
      { status: 'viewed', viewCount: 1, firstViewedAt: now, lastViewedAt: now },
      { status: 'viewed' }
    );

    return res.json({
      success: true,
      document: {
        dataUrl: `data:${jobDoc.mimeType};base64,${base64}`,
        mimeType: jobDoc.mimeType,
        name: jobDoc.documentName || jobDoc.filename || 'Document',
        size: Number(jobDoc.size || decryptedBuffer.length)
      },
      viewCount: 1,
      firstViewedAt: now,
      message: 'Document preview opened. This was a one-time view - the button is now permanently disabled.'
    });
  } catch (error) {
    if (error?.code === 404) {
      return res.status(404).json({ error: 'Job not found' });
    }
    console.error('Error during Appwrite job view:', error);
    return res.status(500).json({ error: 'Failed to open document preview' });
  }
});

router.post('/:id/release', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  if (!storageReady(appwrite, res)) return;
  const { id } = req.params;
  const { token, printerId, releasedBy } = req.body || {};

  try {
    const jobDoc = await getJobDocument(appwrite, id);
    if (!token || token !== jobDoc.token) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    if (isExpired(jobDoc.expiresAt)) {
      await expireJob(appwrite, jobDoc);
      return res.status(410).json({ error: 'Print link has expired' });
    }

    if (jobDoc.status === 'released') {
      return res.status(409).json({ error: 'Print job has already been released' });
    }

    if ((jobDoc.status || 'pending') === 'pending') {
      return res.status(403).json({
        error: 'Document must be viewed before releasing. Click the view button first.',
        requiresView: true
      });
    }

    const releasedAt = new Date().toISOString();
    await updateJobDocument(
      appwrite,
      id,
      { status: 'released', releasedAt, printerId: printerId || null, releasedBy: releasedBy || null },
      { status: 'released' }
    );

    return res.json({
      success: true,
      message: 'Print job released successfully!',
      status: 'released'
    });
  } catch (error) {
    if (error?.code === 404) {
      return res.status(404).json({ error: 'Job not found' });
    }
    console.error('Error during Appwrite job release:', error);
    return res.status(500).json({ error: 'Failed to release print job' });
  }
});

router.post('/:id/complete', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { id } = req.params;

  try {
    const jobDoc = await getJobDocument(appwrite, id);
    if (jobDoc.status !== 'released') {
      return res.status(400).json({ error: 'Job must be released before marking as completed' });
    }

    await updateJobDocument(
      appwrite,
      id,
      { status: 'completed', completedAt: new Date().toISOString() },
      { status: 'completed' }
    );
    return res.json({ success: true, message: 'Job marked as completed' });
  } catch (error) {
    if (error?.code === 404) {
      return res.status(404).json({ error: 'Job not found' });
    }
    console.error('Error completing Appwrite job:', error);
    return res.status(500).json({ error: 'Failed to complete print job' });
  }
});

router.get('/', async (req, res) => {
  if (!req.appwrite) {
    return res.json({ jobs: [] });
  }
  const appwrite = req.appwrite;
  const { userId } = req.query;
  let offset = 0;
  const jobs = [];

  try {
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
      .filter((job) => !userId || !job.userId || String(job.userId) === String(userId))
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

    return res.json({ jobs: mapped });
  } catch (error) {
    console.error('Error listing Appwrite jobs:', error);
    return res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

export default router;
