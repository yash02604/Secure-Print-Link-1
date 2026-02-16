import { Router } from 'express';
import { nanoid } from 'nanoid';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { createEncryptedDocument, extractDecryptedDocument, isValidPDF, generatePrintToken, ENCRYPTION_KEY } from '../utils/crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = join(__dirname, '../../uploads');
const upload = multer({ dest: uploadsDir, limits: { fileSize: +(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024) } });

const router = Router();

// In-memory storage for expiration metadata (server memory - lost on restart by design)
// SECURITY MODEL: Single-use view enforcement
// - SUBMITTED → PENDING → (VIEW once) → RELEASED → DELETED
// - View allowed only once per job
// - After viewing, button permanently disabled
// - Files deleted only on expiration or manual deletion
const expirationMetadata = new Map(); // jobId -> { expiresAt, createdAt, token, viewCount, firstViewedAt }
const activeOperations = new Set(); // Track jobIds being processed to prevent cleanup interference
let dbInstance = null;

// Cleanup loop: Periodically scan for expired jobs and clean up
setInterval(() => {
  const currentServerTime = Date.now();
  const expiredJobIds = [];
  
  expirationMetadata.forEach((metadata, jobId) => {
    // SECURITY: Only clean up if job is not currently being operated on
    if (currentServerTime >= metadata.expiresAt && !activeOperations.has(jobId)) {
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

      // Delete from DB (will cascade to documents and analysis)
      if (dbInstance) {
        try {
          dbInstance.prepare('UPDATE jobs SET status = ?, deletedAt = ? WHERE id = ?')
            .run('deleted', new Date().toISOString(), jobId);
          console.log(`[Cleanup] Marked job as deleted in DB: ${jobId}`);
        } catch (err) {
          console.error(`[Cleanup] Error updating job in DB ${jobId}:`, err);
        }
      }
    });
  }
}, 60000); // Run every minute

// Create job (multipart/form-data supported)
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File size exceeds limit (max 20MB)' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'Upload failed' });
    }
    next();
  });
}, (req, res) => {
  const db = req.db;
  dbInstance = db; // Capture db instance for cleanup loop
  const body = req.body || {};
  const userId = body.userId;
  const userName = body.userName;
  const documentName = body.documentName || (req.file?.originalname || 'Document');
  
  if (!userId || !documentName) return res.status(400).json({ error: 'Missing required fields' });

  const id = nanoid();
  activeOperations.add(id); // Lock job during creation

  try {
    const secureToken = nanoid(32);
    
    // Calculate expiration time (server time) - ATOMIC: Done AFTER upload complete
    const expirationDuration = parseInt(body.expirationDuration || 15); // minutes, default 15
    const currentServerTime = Date.now();
    const expiresAt = currentServerTime + (expirationDuration * 60 * 1000); // Convert minutes to milliseconds
    
    const pages = +(body.pages ?? 1);
    const copies = +(body.copies ?? 1);
    const color = body.color === 'true' || body.color === true;
    const duplex = body.duplex === 'true' || body.duplex === true;
    const stapling = body.stapling === 'true' || body.stapling === true;
    const priority = body.priority || 'normal';
    const notes = body.notes || '';

    // Store expiration metadata in server memory
    expirationMetadata.set(id, {
      expiresAt,
      createdAt: currentServerTime,
      token: secureToken,
      viewCount: 0,
      firstViewedAt: null,
      filePath: req.file?.path || null,
      mimetype: req.file?.mimetype,
      originalname: req.file?.originalname
    });
    
    // Prefer explicit public base URL if provided (useful behind tunnels/proxies)
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const computedOrigin = `${protocol}://${host}`;
    const origin = process.env.PUBLIC_BASE_URL || req.headers.origin || computedOrigin;
    const releaseLink = `${origin.replace(/\/$/, '')}/release/${id}?token=${secureToken}`;

    const baseCost = 0.10;
    const colorMultiplier = color ? 2 : 1;
    const duplexMultiplier = duplex ? 0.8 : 1;
    const cost = +(baseCost * pages * copies * colorMultiplier * duplexMultiplier).toFixed(2);

    const stmt = db.prepare(`INSERT INTO jobs (
      id, userId, documentName, pages, copies, color, duplex, stapling, priority, notes,
      status, cost, submittedAt, secureToken, releaseLink, expiresAt, viewCount
    ) VALUES (@id, @userId, @documentName, @pages, @copies, @color, @duplex, @stapling, @priority, @notes,
      'pending', @cost, @submittedAt, @secureToken, @releaseLink, @expiresAt, 0)`);

    stmt.run({
      id, userId, documentName, pages, copies,
      color: color ? 1 : 0, duplex: duplex ? 1 : 0, stapling: stapling ? 1 : 0,
      priority, notes, cost,
      submittedAt: new Date().toISOString(),
      secureToken, releaseLink,
      expiresAt: new Date(expiresAt).toISOString()
    });

    // Store document in DB and run analysis
    if (req.file) {
      const documentId = nanoid();
      const fileContent = fs.readFileSync(req.file.path);
      
      // Encrypt the document content before storing
      const encryptedDocument = createEncryptedDocument(fileContent, req.file.mimetype, req.file.originalname, req.file.size);
      
      db.prepare(`INSERT INTO documents (
        id, jobId, content, mimeType, filename, size, createdAt, isEncrypted, iv, authTag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        documentId, id, encryptedDocument.content, req.file.mimetype, req.file.originalname, req.file.size, new Date().toISOString(), encryptedDocument.isEncrypted ? 1 : 0, encryptedDocument.iv, encryptedDocument.authTag
      );

      // Mock Document Analysis
      const analysisId = nanoid();
      const analysisResult = {
        wordCount: Math.floor(fileContent.length / 6),
        processedAt: new Date().toISOString(),
        status: 'completed',
        features: ['text-extraction', 'metadata-analysis']
      };
      
      db.prepare(`INSERT INTO document_analysis (
        id, documentId, analysisType, result, status, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?)`).run(
        analysisId, documentId, 'basic_metrics', JSON.stringify(analysisResult), 'completed', new Date().toISOString()
      );
    }

    res.json({
      success: true,
      job: { 
        id, userId, documentName, pages, copies, color, duplex, stapling, priority, notes, 
        status: 'pending', cost, submittedAt: new Date().toISOString(), 
        secureToken, releaseLink, expiresAt: new Date(expiresAt).toISOString(), expirationDuration,
        file: req.file ? { filename: req.file.filename, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size } : null 
      }
    });
  } catch (err) {
    console.error('Error during job submission:', err);
    res.status(500).json({ error: 'Failed to process print job' });
  } finally {
    activeOperations.delete(id);
  }
});

// Get job by id + token (with single-view enforcement)
router.get('/:id', (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { token } = req.query;
  
  // Validate token and expiration from server memory
  const currentServerTime = Date.now();
  const metadata = expirationMetadata.get(id);
  
  if (metadata) {
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
            console.log(`[Expired] Deleted file: ${metadata.filePath}`);
          }
        } catch (err) {
          console.error('Error deleting expired file:', err);
        }
      }
      return res.status(410).json({ error: 'Print link has expired' });
    }
  }
  
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (token && token !== job.secureToken) return res.status(403).json({ error: 'Invalid token' });

  // Check if job has been viewed already (single-view enforcement)
  if (job.viewCount > 0) {
    return res.status(403).json({ 
      error: 'Document already viewed (one-time only)',
      alreadyViewed: true,
      viewCount: job.viewCount
    });
  }

  // Fetch document from DB if available
  try {
    const document = db.prepare('SELECT *, CASE WHEN isEncrypted IS NULL THEN 0 ELSE isEncrypted END AS isEncrypted FROM documents WHERE jobId = ?').get(id);
    if (document) {
      let documentContent = document.content;
      console.log('Document found:', document.id);
      console.log('Document is encrypted:', document.isEncrypted);
      
      // If document is encrypted, decrypt it before sending
      if (document.isEncrypted) {
        console.log('Decrypting document with IV:', document.iv, 'and authTag:', document.authTag);
        // Prepare the document object with IV and authTag for decryption
        const encryptedDocument = {
          content: document.content,
          iv: document.iv,
          authTag: document.authTag,
          mimeType: document.mimeType,
          filename: document.filename,
          size: document.size,
          createdAt: document.createdAt,
          isEncrypted: document.isEncrypted
        };
        const decryptedDocument = extractDecryptedDocument(encryptedDocument);
        documentContent = decryptedDocument.content;
        console.log('Decryption successful, content length:', documentContent.length);
      }
      
      const base64 = documentContent.toString('base64');
      console.log('Base64 content length:', base64.length);
      job.document = {
        dataUrl: `data:${document.mimeType};base64,${base64}`,
        mimeType: document.mimeType,
        name: document.filename,
        size: document.size,
        // Include encryption info for client-side handling if needed
        isEncrypted: document.isEncrypted,
        // Don't include the encrypted content in the response to avoid double processing
        encryptedContent: undefined
      };
      console.log('Job document created:', job.document);
      
      // Fetch analysis
      const analysis = db.prepare('SELECT * FROM document_analysis WHERE documentId = ?').get(document.id);
      if (analysis) {
        job.analysis = JSON.parse(analysis.result);
      }
    } else if (metadata?.filePath && fs.existsSync(metadata.filePath)) {
      // Fallback to filesystem if not in DB (for older jobs or if DB storage failed)
      try {
        const fileBuffer = fs.readFileSync(metadata.filePath);
        const base64 = fileBuffer.toString('base64');
        const dataUrl = `data:${metadata.mimetype || 'application/octet-stream'};base64,${base64}`;
        
        job.document = {
          dataUrl,
          mimeType: metadata.mimetype,
          name: metadata.originalname || job.documentName,
          // Filesystem documents are not marked as encrypted
          isEncrypted: false,
          encryptedContent: undefined
        };
      } catch (err) {
        console.error('Error reading file for job:', id, err);
      }
    }
  } catch (err) {
    console.error('Error fetching document/analysis from DB:', err);
  }

  res.json({ job });
});

// Temporary print tokens storage (in production, use Redis or similar)
const printTokens = new Map(); // jobId -> { token, expiresAt, used, createdAt, clientIP }

// Create a temporary print token
router.post('/:id/print-token', (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { token } = req.body || {};

  try {
    // Validate job exists
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!job) {
      console.log(`[AUDIT] Job not found for ID: ${id}`);
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (!token || token !== job.secureToken) {
      console.log(`[AUDIT] Invalid token attempt for job ID: ${id}`);
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    // Check if job has expired
    const now = Date.now();
    const createdAt = new Date(job.createdAt).getTime();
    const expiresAt = createdAt + (job.expiryHours || 24) * 60 * 60 * 1000; // Default to 24 hours
    
    if (now > expiresAt) {
      console.log(`[AUDIT] Attempt to access expired job ID: ${id}`);
      return res.status(410).json({ error: 'This print link has expired' });
    }
    
    // Rate limiting: Check if too many token requests from same IP
    const clientIP = req.ip || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : 'unknown');
    const recentRequests = Array.from(printTokens.values()).filter(tokenInfo => 
      tokenInfo.clientIP === clientIP && 
      Date.now() - tokenInfo.createdAt < 60000 // within last minute
    );
    
    if (recentRequests.length > 10) { // Allow max 10 requests per minute per IP
      console.log(`[AUDIT] Rate limit exceeded for IP: ${clientIP}`);
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }
    
    // Generate a temporary print token (valid for 60 seconds)
    const printToken = generatePrintToken();
    const tokenExpiry = Date.now() + 60000; // 60 seconds
    
    printTokens.set(id, { 
      token: printToken, 
      expiresAt: tokenExpiry, 
      used: false,
      createdAt: Date.now(),
      clientIP: clientIP
    });
    
    console.log(`[AUDIT] Print token created for job ID: ${id}`);
    
    // Clean up expired tokens periodically
    setTimeout(() => {
      const tokenData = printTokens.get(id);
      if (tokenData && Date.now() >= tokenData.expiresAt) {
        printTokens.delete(id);
      }
    }, 60000);
    
    res.json({ success: true, printToken });
  } catch (error) {
    console.error('[AUDIT] Error creating print token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Secure endpoint to decrypt and stream document
// Requires a temporary print token (valid for 60 seconds and single use)
router.get('/decrypt/:jobId', (req, res) => {
  const db = req.db;
  const { jobId } = req.params;
  const { printToken } = req.query;

  try {
    // Validate printToken exists
    if (!printToken) {
      console.log(`[AUDIT] Missing print token for job ID: ${jobId}`);
      return res.status(400).json({ error: 'Print token is required' });
    }
    
    // Validate temporary print token
    const tokenData = printTokens.get(jobId);
    if (!tokenData) {
      console.log(`[AUDIT] No token found for job ID: ${jobId}`);
      return res.status(403).json({ error: 'Invalid print token' });
    }
    
    // Check if token has expired
    if (Date.now() > tokenData.expiresAt) {
      printTokens.delete(jobId); // Clean up expired token
      console.log(`[AUDIT] Expired token attempt for job ID: ${jobId}`);
      return res.status(403).json({ error: 'Print token has expired' });
    }
    
    // Check if token has already been used (prevent replay attacks)
    if (tokenData.used) {
      printTokens.delete(jobId); // Clean up used token
      console.log(`[AUDIT] Reused token attempt for job ID: ${jobId}`);
      return res.status(403).json({ error: 'Print token has already been used' });
    }
    
    // Mark token as used immediately to prevent reuse
    tokenData.used = true;

    // Validate job exists
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) {
      printTokens.delete(jobId); // Clean up token
      console.log(`[AUDIT] Job not found for ID: ${jobId}`);
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Check if job has expired
    const now = Date.now();
    const jobCreatedAt = new Date(job.createdAt).getTime();
    const jobExpiresAt = jobCreatedAt + (job.expiryHours || 24) * 60 * 60 * 1000; // Default to 24 hours
    
    if (now > jobExpiresAt) {
      printTokens.delete(jobId); // Clean up token
      console.log(`[AUDIT] Attempt to access expired job ID: ${jobId}`);
      return res.status(410).json({ error: 'This print link has expired' });
    }
    
    // Fetch document from DB
    const document = db.prepare('SELECT *, CASE WHEN isEncrypted IS NULL THEN 0 ELSE isEncrypted END AS isEncrypted FROM documents WHERE jobId = ?').get(jobId);
    if (!document) {
      printTokens.delete(jobId); // Clean up token
      console.log(`[AUDIT] Document not found for job ID: ${jobId}`);
      return res.status(404).json({ error: 'Document not found' });
    }
    
    let documentContent = document.content;

    // If document is encrypted, decrypt it before sending
    if (document.isEncrypted) {
      try {
        // Create decipher with AES-256-GCM
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(document.iv));
        decipher.setAuthTag(Buffer.from(document.authTag));
        
        let decrypted = decipher.update(Buffer.from(document.content));
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        documentContent = decrypted;

        // Validate PDF header if it's a PDF
        if (document.mimeType && document.mimeType.includes('pdf')) {
          if (!isValidPDF(documentContent)) {
            console.error('[AUDIT] Decryption failed - invalid PDF content for job ID:', jobId);
            printTokens.delete(jobId); // Clean up token
            return res.status(403).json({ error: 'Decryption failed - invalid content' });
          }
          console.log('PDF header validation passed for job ID:', jobId);
        }

        console.log('First 5 bytes after decryption for job ID', jobId, ':', documentContent.slice(0, 5));
      } catch (decryptionError) {
        console.error('[AUDIT] Decryption failed for job ID:', jobId, decryptionError);
        printTokens.delete(jobId); // Clean up token
        return res.status(403).json({ error: 'Decryption failed - authentication error' });
      }
    }
    
    console.log(`[AUDIT] Document decrypted successfully for job ID: ${jobId}`);

    // Set proper response headers
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.filename || 'document')}"`);
    res.setHeader('Content-Length', documentContent.length);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Stream the decrypted document content
    res.send(documentContent);

    // Clean up token after successful response
    setTimeout(() => {
      printTokens.delete(jobId);
    }, 1000); // Small delay to ensure response is sent

  } catch (err) {
    console.error('[AUDIT] Error in decrypt endpoint:', err);
    // Clean up token on error
    printTokens.delete(jobId);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// View job document (single-use only)
router.post('/:id/view', (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { token, userId } = req.body || {};
  
  activeOperations.add(id); // Lock job during view confirmation
  
  try {
    // Validate token and expiration from server memory
    const currentServerTime = Date.now();
    const metadata = expirationMetadata.get(id);
    
    if (metadata) {
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
        return res.status(410).json({ error: 'Print link has expired' });
      }
    }
    
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!token || token !== job.secureToken) return res.status(403).json({ error: 'Invalid token' });
    
    // SINGLE-USE ENFORCEMENT: Check if already viewed
    if (job.viewCount > 0) {
      return res.status(403).json({ 
        error: 'Document already viewed (one-time only)',
        alreadyViewed: true,
        viewCount: job.viewCount
      });
    }

    // Record the view
    const now = new Date().toISOString();
    const viewId = nanoid();
    
    // Update job view count and timestamps
    db.prepare('UPDATE jobs SET viewCount = viewCount + 1, firstViewedAt = ?, lastViewedAt = ? WHERE id = ?')
      .run(now, now, id);
    
    // Log the view for audit trail
    db.prepare(`INSERT INTO job_views (id, jobId, userId, viewedAt, userAgent, ipAddress) 
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(
        viewId, 
        id, 
        userId || 'anonymous', 
        now, 
        req.headers['user-agent'] || '', 
        req.ip || req.connection.remoteAddress || ''
      );

    // Update in-memory metadata
    if (metadata) {
      metadata.viewCount = 1;
      metadata.firstViewedAt = now;
      expirationMetadata.set(id, metadata);
      console.log(`[View] Job ${id} viewed for the first time by user ${userId}`);
    }

    // Return document data for preview (NOT download)
    let documentData = null;
    const document = db.prepare('SELECT *, CASE WHEN isEncrypted IS NULL THEN 0 ELSE isEncrypted END AS isEncrypted FROM documents WHERE jobId = ?').get(id);
    if (document) {
      let documentContent = document.content;
      
      // If document is encrypted, decrypt it before sending
      if (document.isEncrypted) {
        // Prepare the document object with IV and authTag for decryption
        const encryptedDocument = {
          content: document.content,
          iv: document.iv,
          authTag: document.authTag,
          mimeType: document.mimeType,
          filename: document.filename,
          size: document.size,
          createdAt: document.createdAt,
          isEncrypted: document.isEncrypted
        };
        const decryptedDocument = extractDecryptedDocument(encryptedDocument);
        documentContent = decryptedDocument.content;
      }
      
      const base64 = documentContent.toString('base64');
      documentData = {
        dataUrl: `data:${document.mimeType};base64,${base64}`,
        mimeType: document.mimeType,
        name: document.filename,
        size: document.size,
        // Include encryption info for client-side handling if needed
        isEncrypted: document.isEncrypted,
        // Don't include the encrypted content in the response to avoid double processing
        encryptedContent: undefined
      };
    } else if (metadata?.filePath && fs.existsSync(metadata.filePath)) {
      const fileBuffer = fs.readFileSync(metadata.filePath);
      const base64 = fileBuffer.toString('base64');
      documentData = {
        dataUrl: `data:${metadata.mimetype || 'application/octet-stream'};base64,${base64}`,
        mimeType: metadata.mimetype,
        name: metadata.originalname || job.documentName,
        // Filesystem documents are not marked as encrypted
        isEncrypted: false,
        encryptedContent: undefined
      };
    }

    res.json({ 
      success: true, 
      document: documentData,
      viewCount: 1,
      firstViewedAt: now,
      message: 'Document preview opened. This was a one-time view - the button is now permanently disabled.'
    });
  } catch (err) {
    console.error('Error during job view:', err);
    res.status(500).json({ error: 'Failed to open document preview' });
  } finally {
    activeOperations.delete(id);
  }
});

// Release job (requires token) - only possible AFTER viewing
router.post('/:id/release', (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { token, printerId, releasedBy } = req.body || {};
  
  activeOperations.add(id); // Lock job during release operation
  
  try {
    // Validate token and expiration from server memory
    const currentServerTime = Date.now();
    const metadata = expirationMetadata.get(id);
    
    if (metadata) {
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
        return res.status(410).json({ error: 'Print link has expired' });
      }
    }
    
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!token || token !== job.secureToken) return res.status(403).json({ error: 'Invalid token' });
    
    // REJECTION: Already released jobs
    if (job.status === 'released') {
      return res.status(409).json({ error: 'Print job has already been released' });
    }
    
    // Check if job has been viewed (single-use view must occur before release)
    if (job.viewCount === 0) {
      return res.status(403).json({ 
        error: 'Document must be viewed before releasing. Click the view button first.',
        requiresView: true
      });
    }

    // Update job status to released and track release metadata
    db.prepare('UPDATE jobs SET status = ?, releasedAt = ?, printerId = ?, releasedBy = ? WHERE id = ?')
      .run('released', new Date().toISOString(), printerId || null, releasedBy || null, id);

    // SECURITY: Clear document data from DB on release
    try {
      db.prepare('DELETE FROM documents WHERE jobId = ?').run(id);
      console.log(`[Release] Cleared document data for job ${id}`);
    } catch (docErr) {
      console.error(`[Release] Error clearing document data for job ${id}:`, docErr);
    }

    console.log(`[Release] Job ${id} released for printing on printer ${printerId} by user ${releasedBy}`);

    // Update in-memory metadata
    if (metadata) {
      expirationMetadata.set(id, {
        ...metadata,
        status: 'released'
      });
    }

    res.json({ 
      success: true, 
      message: 'Print job released successfully!',
      status: 'released'
    });
  } catch (err) {
    console.error('Error during job release:', err);
    res.status(500).json({ error: 'Failed to release print job' });
  } finally {
    activeOperations.delete(id);
  }
});

// Complete job (mark as completed)
router.post('/:id/complete', (req, res) => {
  const db = req.db;
  const { id } = req.params;
  
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  // Can only complete released jobs
  if (job.status !== 'released') {
    return res.status(400).json({ error: 'Job must be released before marking as completed' });
  }
  
  db.prepare('UPDATE jobs SET status = ?, completedAt = ? WHERE id = ?')
    .run('completed', new Date().toISOString(), id);

  console.log(`[Complete] Job ${id} marked as completed`);
  
  res.json({ success: true, message: 'Job marked as completed' });
});

// Get all jobs (admin or filtered by user)
router.get('/', (req, res) => {
  const db = req.db;
  const { userId } = req.query;
  
  let query = 'SELECT * FROM jobs';
  let params = [];
  
  if (userId) {
    query += ' WHERE userId = ?';
    params.push(userId);
  }
  
  query += ' ORDER BY submittedAt DESC';
  
  const jobs = db.prepare(query).all(params);
  res.json({ jobs });
});

// Get expired jobs for cleanup verification
router.get('/cleanup/expired', (req, res) => {
  const currentServerTime = Date.now();
  const expired = [];
  
  expirationMetadata.forEach((metadata, jobId) => {
    if (currentServerTime >= metadata.expiresAt) {
      expired.push({
        id: jobId,
        expiredAt: metadata.expiresAt,
        originalToken: metadata.token.substring(0, 8) + '...' 
      });
    }
  });
  
  res.json({ expired });
});

export default router;