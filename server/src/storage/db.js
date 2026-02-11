import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export function createDb(dbPath) {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      name TEXT,
      email TEXT,
      department TEXT,
      role TEXT,
      pin TEXT
    );

    CREATE TABLE IF NOT EXISTS printers (
      id TEXT PRIMARY KEY,
      name TEXT,
      location TEXT,
      model TEXT,
      status TEXT,
      ip TEXT,
      capabilities TEXT,
      department TEXT
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      documentName TEXT,
      pages INTEGER,
      copies INTEGER,
      color INTEGER,
      duplex INTEGER,
      stapling INTEGER,
      priority TEXT,
      notes TEXT,
      status TEXT,  -- pending, released, completed, deleted
      cost REAL,
      submittedAt TEXT,
      releasedAt TEXT,
      completedAt TEXT,
      cancelledAt TEXT,
      printerId TEXT,
      releasedBy TEXT,
      secureToken TEXT,
      releaseLink TEXT,
      expiresAt TEXT,
      viewCount INTEGER DEFAULT 0,  -- Track how many times document was viewed
      firstViewedAt TEXT,          -- When first viewed
      lastViewedAt TEXT,           -- When last viewed
      deletedAt TEXT               -- When deleted (soft delete marker)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      jobId TEXT,
      content BLOB,
      mimeType TEXT,
      filename TEXT,
      size INTEGER,
      createdAt TEXT,
      FOREIGN KEY(jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_analysis (
      id TEXT PRIMARY KEY,
      documentId TEXT,
      analysisType TEXT,
      result TEXT,
      status TEXT,
      createdAt TEXT,
      FOREIGN KEY(documentId) REFERENCES documents(id) ON DELETE CASCADE
    );
    
    -- Job view logs for audit trail
    CREATE TABLE IF NOT EXISTS job_views (
      id TEXT PRIMARY KEY,
      jobId TEXT,
      userId TEXT,
      viewedAt TEXT,
      userAgent TEXT,
      ipAddress TEXT,
      FOREIGN KEY(jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );
    
    -- Chat system tables
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      printerShopId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastMessageAt TEXT,
      UNIQUE(userId, printerShopId),
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(printerShopId) REFERENCES printers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      senderRole TEXT NOT NULL,
      message TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      readStatus INTEGER DEFAULT 0,
      FOREIGN KEY(conversationId) REFERENCES conversations(id) ON DELETE CASCADE
    );
    
    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_jobs_userId ON jobs(userId);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_expiresAt ON jobs(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_jobs_secureToken ON jobs(secureToken);
    CREATE INDEX IF NOT EXISTS idx_documents_jobId ON documents(jobId);
    CREATE INDEX IF NOT EXISTS idx_job_views_jobId ON job_views(jobId);
    
    -- Chat indexes for performance
    CREATE INDEX IF NOT EXISTS idx_conversations_userId ON conversations(userId);
    CREATE INDEX IF NOT EXISTS idx_conversations_printerShopId ON conversations(printerShopId);
    CREATE INDEX IF NOT EXISTS idx_conversations_lastMessageAt ON conversations(lastMessageAt);
    CREATE INDEX IF NOT EXISTS idx_messages_conversationId ON messages(conversationId);
    CREATE INDEX IF NOT EXISTS idx_messages_createdAt ON messages(createdAt);
    CREATE INDEX IF NOT EXISTS idx_messages_readStatus ON messages(readStatus);
  `);

  return db;
}