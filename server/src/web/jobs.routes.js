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
const expirationMetadata = new Map(); // jobId -> { expiresAt, createdAt, token, used }
const usedTokens = new Set(); // Prevent token reuse

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
  expirationMetadata.set(id, {
    expiresAt,
    createdAt: currentServerTime,
    token: secureToken,
    used: false,
    filePath: req.file?.path || null, // Store file path for deletion
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
    // Check if token has been used
    if (usedTokens.has(token)) {
      return res.status(403).json({ error: 'Token has already been used' });
    }
    
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
router.post('/:id/release', (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { token, printerId, releasedBy } = req.body || {};
  
  // Validate token and expiration from server memory
  const currentServerTime = Date.now();
  const metadata = expirationMetadata.get(id);
  
  if (metadata) {
    // Check if token has been used (prevent reuse)
    if (usedTokens.has(token)) {
      return res.status(403).json({ error: 'Token has already been used' });
    }
    
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
  if (job.status !== 'pending') return res.status(400).json({ error: 'Not pending' });
  if (!token || token !== job.secureToken) return res.status(403).json({ error: 'Invalid token' });

  // Mark token as used (prevent reuse)
  if (metadata) {
    usedTokens.add(token);
    expirationMetadata.set(id, { ...metadata, used: true });
  }

  db.prepare('UPDATE jobs SET status = ?, releasedAt = ?, printerId = ?, releasedBy = ? WHERE id = ?')
    .run('printing', new Date().toISOString(), printerId || null, releasedBy || null, id);

  // Schedule file deletion after printing (simulate 3 second delay)
  setTimeout(() => {
    if (metadata?.filePath) {
      try {
        if (fs.existsSync(metadata.filePath)) {
          fs.unlinkSync(metadata.filePath);
          console.log(`[Release] Deleted file after printing: ${metadata.filePath}`);
        }
        // Clean up metadata
        expirationMetadata.delete(id);
      } catch (err) {
        console.error('Error deleting file after printing:', err);
      }
    }
    
    // Update job status to completed
    db.prepare('UPDATE jobs SET status = ?, completedAt = ? WHERE id = ?')
      .run('completed', new Date().toISOString(), id);
  }, 3000);

  res.json({ success: true });
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


