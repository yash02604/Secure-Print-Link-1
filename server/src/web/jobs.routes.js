import { Router } from 'express';
import { nanoid } from 'nanoid';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = join(__dirname, '../../uploads');
const upload = multer({ dest: uploadsDir, limits: { fileSize: +(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024) } });

const router = Router();

// In-memory storage for expiration metadata (server memory - lost on restart by design)
// SECURITY MODEL: Multi-use links within time window, NOT single-use
// - Links are usable MULTIPLE times until expiration
// - Each release is authenticated but does NOT invalidate the link
// - Only expiration time invalidates the link
const expirationMetadata = new Map(); // jobId -> { expiresAt, createdAt, token, releaseCount }

// Cleanup loop: Periodically scan for expired jobs
setInterval(() => {
  const currentServerTime = Date.now();
  const expiredJobIds = [];
  
  expirationMetadata.forEach((metadata, jobId) => {
    if (currentServerTime >= metadata.expiresAt) {
      expiredJobIds.push(jobId);
    }
  });
  
  // Clean up expired jobs
  if (expiredJobIds.length > 0) {
    console.log(`[Cleanup] Removing ${expiredJobIds.length} expired print job(s)`);
    expiredJobIds.forEach(jobId => {
      const metadata = expirationMetadata.get(jobId);
      expirationMetadata.delete(jobId);
      
      // Delete file from filesystem
      if (metadata?.filePath) {
        try {
          if (fs.existsSync(metadata.filePath)) {
            fs.unlinkSync(metadata.filePath);
            console.log(`[Cleanup] Deleted expired file: ${metadata.filePath}`);
          }
        } catch (err) {
          console.error(`[Cleanup] Error deleting expired file ${metadata.filePath}:`, err);
        }
      }
    });
  }
}, 60000); // Run every minute

// Create job
// Create job (multipart/form-data supported)
router.post('/', upload.single('file'), (req, res) => {
  const db = req.db;
  const body = req.body || {};
  const userId = body.userId;
  const userName = body.userName;
  const documentName = body.documentName || (req.file?.originalname || 'Document');
  const pages = +(body.pages ?? 1);
  const copies = +(body.copies ?? 1);
  const color = body.color === 'true' || body.color === true;
  const duplex = body.duplex === 'true' || body.duplex === true;
  const stapling = body.stapling === 'true' || body.stapling === true;
  const priority = body.priority || 'normal';
  const notes = body.notes || '';

  if (!userId || !documentName) return res.status(400).json({ error: 'Missing fields' });

  const id = nanoid();
  const secureToken = nanoid(32);
  
  // Calculate expiration time (server time)
  const expirationDuration = parseInt(body.expirationDuration || 15); // minutes, default 15
  const currentServerTime = Date.now();
  const expiresAt = currentServerTime + (expirationDuration * 60 * 1000); // Convert minutes to milliseconds
  
  // Store expiration metadata in server memory
  // Multi-use design: Track release count instead of "used" flag
  expirationMetadata.set(id, {
    expiresAt,
    createdAt: currentServerTime,
    token: secureToken,
    releaseCount: 0, // Track how many times this link has been used (for logging/auditing)
    filePath: req.file?.path || null, // Store file path - deleted ONLY on expiration
    mimetype: req.file?.mimetype,
    originalname: req.file?.originalname
  });
  
  // Prefer explicit public base URL if provided (useful behind tunnels/proxies)
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost || req.headers.host;
  const protocol = forwardedProto || (req.secure ? 'https' : 'http');
  const computedOrigin = `${protocol}://${host}`;
  const origin = process.env.PUBLIC_BASE_URL || req.headers.origin || computedOrigin || `http://localhost:${process.env.PORT || 4000}`;
  const releaseLink = `${origin.replace(/\/$/, '')}/release/${id}?token=${secureToken}`;

  const baseCost = 0.10;
  const colorMultiplier = color ? 2 : 1;
  const duplexMultiplier = duplex ? 0.8 : 1;
  const cost = +(baseCost * pages * copies * colorMultiplier * duplexMultiplier).toFixed(2);

  const stmt = db.prepare(`INSERT INTO jobs (
    id, userId, documentName, pages, copies, color, duplex, stapling, priority, notes,
    status, cost, submittedAt, secureToken, releaseLink, expiresAt
  ) VALUES (@id, @userId, @documentName, @pages, @copies, @color, @duplex, @stapling, @priority, @notes,
    'pending', @cost, @submittedAt, @secureToken, @releaseLink, @expiresAt)`);

  stmt.run({
    id, userId, documentName, pages, copies,
    color: color ? 1 : 0, duplex: duplex ? 1 : 0, stapling: stapling ? 1 : 0,
    priority, notes, cost,
    submittedAt: new Date().toISOString(),
    secureToken, releaseLink,
    expiresAt: new Date(expiresAt).toISOString()
  });

  res.json({
    success: true,
    job: { 
      id, userId, documentName, pages, copies, color, duplex, stapling, priority, notes, 
      status: 'pending', cost, submittedAt: new Date().toISOString(), 
      secureToken, releaseLink, expiresAt: new Date(expiresAt).toISOString(), expirationDuration,
      file: req.file ? { filename: req.file.filename, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size } : null 
    }
  });
});

// Get job by id + token
router.get('/:id', (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { token } = req.query;
  
  // Validate token and expiration from server memory
  const currentServerTime = Date.now();
  const metadata = expirationMetadata.get(id);
  
  if (metadata) {
    // SECURITY: Multi-use validation - check token and expiration ONLY
    // Do NOT check if token was used before (multi-use design)
    
    // Verify token matches
    if (metadata.token !== token) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    // Verify expiration (server time check)
    if (currentServerTime >= metadata.expiresAt) {
      // Expired - clean up
      expirationMetadata.delete(id);
      if (metadata.filePath) {
        try {
          if (fs.existsSync(metadata.filePath)) {
            fs.unlinkSync(metadata.filePath); // Delete file
            console.log(`[Expired] Deleted file: ${metadata.filePath}`);
          }
        } catch (err) {
          console.error('Error deleting expired file:', err);
        }
      }
      return res.status(403).json({ error: 'Print link has expired' });
    }
  }
  
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  if (token && token !== job.secureToken) return res.status(403).json({ error: 'Invalid token' });

  // Attach document data if available
  if (metadata?.filePath && fs.existsSync(metadata.filePath)) {
    try {
      const fileBuffer = fs.readFileSync(metadata.filePath);
      const base64 = fileBuffer.toString('base64');
      const dataUrl = `data:${metadata.mimetype || 'application/octet-stream'};base64,${base64}`;
      
      job.document = {
        dataUrl,
        mimeType: metadata.mimetype,
        name: metadata.originalname || job.documentName
      };
    } catch (err) {
      console.error('Error reading file for job:', id, err);
    }
  }

  res.json({ job });
});

// Release job (requires token)
// SECURITY MODEL: Multi-use release within time window
// - Same link can be used multiple times until expiration
// - Each release is authenticated and logged
// - Job status does NOT prevent re-release (allows multiple prints)
// - Files are NOT deleted after release (only on expiration)
router.post('/:id/release', (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { token, printerId, releasedBy } = req.body || {};
  
  // Validate token and expiration from server memory
  const currentServerTime = Date.now();
  const metadata = expirationMetadata.get(id);
  
  if (metadata) {
    // SECURITY: Multi-use validation - NO "already used" check
    // Only verify token correctness and expiration
    
    // Verify token matches
    if (metadata.token !== token) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    // Verify expiration (server time check)
    if (currentServerTime >= metadata.expiresAt) {
      // Expired - clean up
      expirationMetadata.delete(id);
      if (metadata.filePath) {
        try {
          if (fs.existsSync(metadata.filePath)) {
            fs.unlinkSync(metadata.filePath);
          }
        } catch (err) {
          console.error('Error deleting expired file:', err);
        }
      }
      return res.status(403).json({ error: 'Print link has expired' });
    }
  }
  
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  if (!token || token !== job.secureToken) return res.status(403).json({ error: 'Invalid token' });
  
  // MULTI-USE: Do NOT check job.status - allow re-release of completed jobs
  // This enables printing the same job multiple times within the time window

  // Track release count for auditing (optional)
  if (metadata) {
    metadata.releaseCount = (metadata.releaseCount || 0) + 1;
    expirationMetadata.set(id, metadata);
    console.log(`[Release] Job ${id} released ${metadata.releaseCount} time(s)`);
  }

  // Update job metadata (last release time, printer, user) but keep status as 'pending'
  // This allows the same job to be released multiple times
  db.prepare('UPDATE jobs SET releasedAt = ?, printerId = ?, releasedBy = ? WHERE id = ?')
    .run(new Date().toISOString(), printerId || null, releasedBy || null, id);

  // DO NOT delete files after release - files are deleted ONLY on expiration
  // DO NOT change status to 'completed' - keep job available for re-release

  res.json({ success: true, releaseCount: metadata?.releaseCount || 1 });
});

// Complete job (simulate)
router.post('/:id/complete', (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE jobs SET status = ?, completedAt = ? WHERE id = ?')
    .run('completed', new Date().toISOString(), id);
  res.json({ success: true });
});

export default router;


