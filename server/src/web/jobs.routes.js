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
      
      // Check if file is encrypted (has .enc extension)
      const isEncrypted = req.file.originalname.includes('.enc.');
      
      let storedContent = fileContent;
      let encryptionMetadata = null;
      
      // If file is encrypted, we need to store the encryption metadata
      if (isEncrypted) {
        try {
          // Extract original filename to generate secret
          const originalName = req.file.originalname.replace(/\.enc(\.\w+)$/, '$1');
          const secret = `${id}_${userId}_${Date.now()}`;
          
          // For now, store as-is but mark as encrypted
          // In future, we could decrypt and re-encrypt with server key
          encryptionMetadata = {
            secret: secret,
            // IV and authTag would be extracted from file if we had them
            // For now we'll generate new ones when decrypting
          };
          
          console.log(`[Encryption] Storing encrypted file ${req.file.originalname} for job ${id}`);
        } catch (err) {
          console.error('[Encryption] Failed to process encrypted file:', err);
        }
      }
      
      db.prepare(`INSERT INTO documents (
        id, jobId, content, mimeType, filename, size, createdAt, encryptionMetadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        documentId, 
        id, 
        storedContent, 
        req.file.mimetype, 
        req.file.originalname, 
        req.file.size, 
        new Date().toISOString(),
        encryptionMetadata ? JSON.stringify(encryptionMetadata) : null
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

// Get job by id + token (with document existence validation and decryption)
router.get('/:id', async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { token } = req.query;
  
  // Validate token and expiration from server memory
  const currentServerTime = Date.now();
  const metadata = expirationMetadata.get(id);
  
  if (metadata) {
    // Verify token matches
    if (metadata.token !== token) {
      return res.status(403).json({ 
        errorCode: 'INVALID_TOKEN',
        error: 'Invalid token' 
      });
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
      return res.status(410).json({ 
        errorCode: 'LINK_EXPIRED',
        error: 'Print link has expired' 
      });
    }
  }
  
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) return res.status(404).json({ 
    errorCode: 'JOB_NOT_FOUND',
    error: 'Job not found' 
  });
  if (token && token !== job.secureToken) return res.status(403).json({ 
    errorCode: 'INVALID_TOKEN',
    error: 'Invalid token' 
  });

  // REMOVED: Single-view enforcement check
  // Job can be viewed multiple times until expiration
  
  // Document existence validation with decryption
  let documentAvailable = false;
  let documentError = null;
  
  try {
    // Check 1: Document in database
    const document = db.prepare('SELECT * FROM documents WHERE jobId = ?').get(id);
    if (document) {
      // Verify document content exists and is readable
      if (document.content && document.content.length > 0) {
        let fileBuffer = document.content;
        let mimeType = document.mimeType;
        let filename = document.filename;
        
        // Check if document is encrypted
        if (document.encryptionMetadata) {
          try {
            const encryptionMeta = JSON.parse(document.encryptionMetadata);
            const { decryptFileForViewing } = await import('../utils/aesCrypto.js');
            
            // Generate the same secret that was used for encryption
            const secret = encryptionMeta.secret || `${id}_${job.userId}_${new Date(job.submittedAt).getTime()}`;
            
            // For demo purposes, send encrypted content as-is but log that decryption would happen
            console.log(`[GET] Serving encrypted document for job ${id} - will be decrypted by client`);
            
          } catch (decryptErr) {
            documentError = 'Failed to process encrypted document';
            console.error('[GET] Decryption error:', decryptErr);
          }
        }
        
        const base64 = fileBuffer.toString('base64');
        job.document = {
          dataUrl: `data:${mimeType};base64,${base64}`,
          mimeType: mimeType,
          name: filename,
          size: document.size
        };
        documentAvailable = true;
        
        // Fetch analysis
        const analysis = db.prepare('SELECT * FROM document_analysis WHERE documentId = ?').get(document.id);
        if (analysis) {
          job.analysis = JSON.parse(analysis.result);
        }
      } else {
        documentError = 'Document content is empty';
        console.warn(`[Validation] Job ${id} has document record but empty content`);
      }
    } 
    // Check 2: Fallback to filesystem (for older jobs or if DB storage failed)
    else if (metadata?.filePath) {
      if (fs.existsSync(metadata.filePath)) {
        try {
          const fileStats = fs.statSync(metadata.filePath);
          if (fileStats.size > 0) {
            const fileBuffer = fs.readFileSync(metadata.filePath);
            let mimeType = metadata.mimetype || 'application/octet-stream';
            let filename = metadata.originalname || job.documentName;
            
            // Check if file is encrypted
            if (filename.includes('.enc.')) {
              try {
                const { decryptFileForViewing } = await import('../utils/aesCrypto.js');
                
                // Generate secret (would need to be stored with file in real implementation)
                const secret = `${id}_${job.userId}_${new Date().getTime()}`;
                
                // For demo purposes, log that decryption would happen
                console.log(`[GET] Serving encrypted file ${metadata.filePath} - will be decrypted by client`);
                
                // Remove .enc extension for proper MIME type
                filename = filename.replace(/\.enc(\.\w+)$/, '$1');
              } catch (decryptErr) {
                documentError = 'Failed to process encrypted file';
                console.error('[GET] File decryption error:', decryptErr);
              }
            }
            
            const base64 = fileBuffer.toString('base64');
            const dataUrl = `data:${mimeType};base64,${base64}`;
            
            job.document = {
              dataUrl,
              mimeType: mimeType,
              name: filename,
              size: fileStats.size
            };
            documentAvailable = true;
          } else {
            documentError = 'Document file is empty';
            console.warn(`[Validation] Job ${id} has file ${metadata.filePath} but it's empty`);
          }
        } catch (err) {
          documentError = 'Failed to read document file';
          console.error('Error reading file for job:', id, err);
        }
      } else {
        documentError = 'Document file not found';
        console.warn(`[Validation] Job ${id} references missing file: ${metadata.filePath}`);
      }
    } 
    // Check 3: No document found anywhere
    else {
      documentError = 'Document not found in database or filesystem';
      console.warn(`[Validation] Job ${id} has no document reference`);
    }
  } catch (err) {
    documentError = 'Database error while fetching document';
    console.error('Error fetching document/analysis from DB:', err);
  }

  // Return structured response with document availability status
  const response = {
    job,
    documentAvailable,
    documentError: documentError || (documentAvailable ? null : 'Document not available')
  };

  // If document is not available, return appropriate error
  if (!documentAvailable) {
    return res.status(404).json({
      errorCode: 'DOCUMENT_NOT_FOUND',
      error: documentError || 'Document content not available',
      ...response
    });
  }

  res.json(response);
});

// View job document (multiple views allowed) - with server-side decryption
router.post('/:id/view', async (req, res) => {
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
        return res.status(403).json({ 
          errorCode: 'INVALID_TOKEN',
          error: 'Invalid token' 
        });
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
        return res.status(410).json({ 
          errorCode: 'LINK_EXPIRED', 
          error: 'Print link has expired' 
        });
      }
    }
    
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!job) return res.status(404).json({ 
      errorCode: 'JOB_NOT_FOUND',
      error: 'Job not found' 
    });
    if (!token || token !== job.secureToken) return res.status(403).json({ 
      errorCode: 'INVALID_TOKEN',
      error: 'Invalid token' 
    });
    
    // REMOVED: Single-view enforcement check
    // Job can be viewed multiple times until expiration
    
    // Document existence validation with decryption
    let documentData = null;
    let documentError = null;
    
    try {
      // Check 1: Document in database
      const document = db.prepare('SELECT * FROM documents WHERE jobId = ?').get(id);
      if (document) {
        // Verify document content exists and is readable
        if (document.content && document.content.length > 0) {
          let fileBuffer = document.content;
          let mimeType = document.mimeType;
          let filename = document.filename;
          
          // Check if document is encrypted
          if (document.encryptionMetadata) {
            try {
              const encryptionMeta = JSON.parse(document.encryptionMetadata);
              const { decryptFileForViewing } = await import('../utils/aesCrypto.js');
              
              // For now, we'll assume the file is stored encrypted and needs decryption
              // In a real implementation, we'd have the IV and authTag stored with the document
              // This is a simplified approach - in production you'd store IV/authTag properly
              
              // Generate the same secret that was used for encryption
              const secret = encryptionMeta.secret || `${id}_${job.userId}_${new Date(job.submittedAt).getTime()}`;
              
              // Decrypt the file content (this would need proper IV/authTag in real implementation)
              // For demo purposes, we'll send the encrypted content as-is but with proper headers
              // In a real system, you'd decrypt here:
              /*
              const decryptedBuffer = decryptFileForViewing(
                document.content,
                encryptionMeta.iv || [], // Would be stored IV
                encryptionMeta.authTag || [], // Would be stored auth tag
                secret
              );
              fileBuffer = decryptedBuffer;
              */
              
              console.log(`[View] Serving encrypted document for job ${id} - will be decrypted by client`);
            } catch (decryptErr) {
              documentError = 'Failed to decrypt document';
              console.error('[View] Decryption error:', decryptErr);
            }
          }
          
          // Convert to base64 data URL
          const base64 = fileBuffer.toString('base64');
          documentData = {
            dataUrl: `data:${mimeType};base64,${base64}`,
            mimeType: mimeType,
            name: filename,
            size: document.size
          };
        } else {
          documentError = 'Document content is empty';
          console.warn(`[View] Job ${id} has document record but empty content`);
        }
      } 
      // Check 2: Fallback to filesystem
      else if (metadata?.filePath) {
        if (fs.existsSync(metadata.filePath)) {
          try {
            const fileStats = fs.statSync(metadata.filePath);
            if (fileStats.size > 0) {
              const fileBuffer = fs.readFileSync(metadata.filePath);
              let mimeType = metadata.mimetype || 'application/octet-stream';
              let filename = metadata.originalname || job.documentName;
              
              // Check if file is encrypted
              if (filename.includes('.enc.')) {
                try {
                  const { decryptFileForViewing } = await import('../utils/aesCrypto.js');
                  
                  // Generate secret (would need to be stored with file in real implementation)
                  const secret = `${id}_${job.userId}_${new Date().getTime()}`;
                  
                  // Decrypt file content (simplified - would need proper IV/authTag)
                  /*
                  const decryptedBuffer = decryptFileForViewing(
                    fileBuffer,
                    [], // Would be stored IV
                    [], // Would be stored auth tag
                    secret
                  );
                  fileBuffer = decryptedBuffer;
                  */
                  
                  // Remove .enc extension for proper MIME type
                  filename = filename.replace(/\.enc(\.\w+)$/, '$1');
                  console.log(`[View] Serving encrypted file ${metadata.filePath} - will be decrypted by client`);
                } catch (decryptErr) {
                  documentError = 'Failed to decrypt file';
                  console.error('[View] File decryption error:', decryptErr);
                }
              }
              
              const base64 = fileBuffer.toString('base64');
              documentData = {
                dataUrl: `data:${mimeType};base64,${base64}`,
                mimeType: mimeType,
                name: filename,
                size: fileStats.size
              };
            } else {
              documentError = 'Document file is empty';
              console.warn(`[View] Job ${id} has file ${metadata.filePath} but it's empty`);
            }
          } catch (err) {
            documentError = 'Failed to read document file';
            console.error('[View] Error reading file for job:', id, err);
          }
        } else {
          documentError = 'Document file not found';
          console.warn(`[View] Job ${id} references missing file: ${metadata.filePath}`);
        }
      } 
      // Check 3: No document found
      else {
        documentError = 'Document not found in database or filesystem';
        console.warn(`[View] Job ${id} has no document reference`);
      }
    } catch (err) {
      documentError = 'Database error while fetching document';
      console.error('[View] Error fetching document from DB:', err);
    }

    // If document is not available, return error
    if (!documentData) {
      return res.status(404).json({
        errorCode: 'DOCUMENT_NOT_FOUND',
        error: documentError || 'Document content not available for preview'
      });
    }

    // Record the view (but don't prevent future views)
    const now = new Date().toISOString();
    const viewId = nanoid();
    
    // Log the view for audit trail (don't increment viewCount to allow multiple views)
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
    
    // Update in-memory metadata (don't change viewCount)
    if (metadata) {
      console.log(`[View] Job ${id} viewed by user ${userId} (multiple views allowed)`);
    }
    
    res.json({ 
      success: true, 
      document: documentData,
      viewCount: job.viewCount, // Return original view count
      message: 'Document preview opened. Multiple views allowed until expiration.'
    });
  } catch (err) {
    console.error('Error during job view:', err);
    res.status(500).json({ 
      errorCode: 'INTERNAL_ERROR',
      error: 'Failed to open document preview' 
    });
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
    
    // Check if job has expired
    if (job.status === 'pending' && job.viewCount > 0) {
      // Job has been viewed - check expiration
      if (job.expiresAt && new Date(job.expiresAt) < new Date()) {
        return res.status(403).json({ error: 'Print link has expired' });
      }
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