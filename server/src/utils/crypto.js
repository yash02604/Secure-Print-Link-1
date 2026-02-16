import crypto from 'crypto';
import { promisify } from 'util';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// Use environment variable for encryption key, or generate a default (not recommended for production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : crypto.randomBytes(KEY_LENGTH);

if (ENCRYPTION_KEY.length !== KEY_LENGTH) {
  throw new Error(`Encryption key must be ${KEY_LENGTH} bytes long`);
}

// Export the encryption key for use in other modules
export { ENCRYPTION_KEY };

/**
 * Encrypt data using AES-256-GCM
 * @param {Buffer} data - The data to encrypt
 * @returns {Object} - Object containing encrypted data, iv, and authTag
 */
export function encryptData(data) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(data);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted,
    iv: iv,
    authTag: authTag
  };
}

/**
 * Decrypt data using AES-256-GCM
 * @param {Buffer} encryptedData - The encrypted data
 * @param {Buffer} iv - Initialization vector
 * @param {Buffer} authTag - Authentication tag
 * @returns {Buffer} - Decrypted data
 */
export function decryptData(encryptedData, iv, authTag) {
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted;
}

/**
 * Create an encrypted document object for storage
 * @param {Buffer} fileBuffer - Original file buffer
 * @param {string} mimeType - File mime type
 * @param {string} filename - Original filename
 * @param {number} size - File size
 * @returns {Object} - Object with encrypted content and metadata
 */
export function createEncryptedDocument(fileBuffer, mimeType, filename, size) {
  const { encryptedData, iv, authTag } = encryptData(fileBuffer);
  
  return {
    content: encryptedData,
    iv: iv,
    authTag: authTag,
    mimeType,
    filename,
    size,
    createdAt: new Date().toISOString(),
    isEncrypted: true
  };
}

/**
 * Extract and decrypt document from stored encrypted object
 * @param {Object} encryptedDocument - Stored encrypted document object
 * @returns {Object} - Object with decrypted content and metadata
 */
export function extractDecryptedDocument(encryptedDocument) {
  if (!encryptedDocument.isEncrypted) {
    // If not encrypted, return as-is
    return encryptedDocument;
  }

  const decryptedContent = decryptData(encryptedDocument.content, encryptedDocument.iv, encryptedDocument.authTag);
  
  return {
    content: decryptedContent,
    mimeType: encryptedDocument.mimeType,
    filename: encryptedDocument.filename,
    size: encryptedDocument.size,
    createdAt: encryptedDocument.createdAt,
    isEncrypted: false
  };
}

/**
 * Generate a secure print token
 * @returns {string} - Random token for print authorization
 */
export function generatePrintToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate PDF header in buffer
 * @param {Buffer} buffer - Buffer to check
 * @returns {boolean} - True if buffer starts with valid PDF header
 */
export function isValidPDF(buffer) {
  if (buffer.length < 4) {
    return false;
  }
  
  // Check for %PDF header
  const header = buffer.slice(0, 4).toString('ascii');
  return header.startsWith('%PDF');
}