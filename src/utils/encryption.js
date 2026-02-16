import CryptoJS from 'crypto-js';
import { Buffer } from 'buffer';

// Generate a secret key for encryption/decryption
// In production, this should be stored securely (e.g., environment variables, secure key management)
const SECRET_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'SecurePrintLinkDefaultSecretKey2023!'; 

/**
 * Encrypt document content
 * @param {Buffer|string} content - Document content to encrypt
 * @returns {string} - Base64 encrypted content
 */
export const encryptDocument = (content) => {
  try {
    // Convert buffer to base64 string if it's a buffer
    let contentString;
    if (Buffer.isBuffer(content)) {
      contentString = content.toString('base64');
    } else if (typeof content === 'string') {
      contentString = content;
    } else {
      throw new Error('Content must be a Buffer or string');
    }

    // Encrypt the content
    const encrypted = CryptoJS.AES.encrypt(contentString, SECRET_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt document');
  }
};

/**
 * Decrypt document content
 * @param {string} encryptedContent - Encrypted content to decrypt
 * @returns {Buffer} - Decrypted content as buffer
 */
export const decryptDocument = (encryptedContent) => {
  try {
    // Decrypt the content
    const decrypted = CryptoJS.AES.decrypt(encryptedContent, SECRET_KEY);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

    if (!decryptedString) {
      throw new Error('Failed to decrypt document - invalid content');
    }

    // Convert back to buffer if it was originally a buffer (base64 encoded)
    if (isValidBase64(decryptedString)) {
      return Buffer.from(decryptedString, 'base64');
    }

    return Buffer.from(decryptedString, 'utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt document');
  }
};

/**
 * Check if a string is valid base64
 * @param {string} str - String to check
 * @returns {boolean} - True if valid base64
 */
const isValidBase64 = (str) => {
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
};

/**
 * Create an encrypted document object for storage
 * @param {Buffer} fileBuffer - Original file buffer
 * @param {string} mimeType - File mime type
 * @param {string} filename - Original filename
 * @param {number} size - File size
 * @returns {Object} - Object with encrypted content and metadata
 */
export const createEncryptedDocument = (fileBuffer, mimeType, filename, size) => {
  const encryptedContent = encryptDocument(fileBuffer);
  
  return {
    content: encryptedContent,
    mimeType,
    filename,
    size,
    createdAt: new Date().toISOString(),
    isEncrypted: true
  };
};

/**
 * Extract and decrypt document from stored encrypted object
 * @param {Object} encryptedDocument - Stored encrypted document object
 * @returns {Object} - Object with decrypted content and metadata
 */
export const extractDecryptedDocument = (encryptedDocument) => {
  if (!encryptedDocument.isEncrypted) {
    // If not encrypted, return as-is
    return encryptedDocument;
  }

  const decryptedContent = decryptDocument(encryptedDocument.content);
  
  return {
    content: decryptedContent,
    mimeType: encryptedDocument.mimeType,
    filename: encryptedDocument.filename,
    size: encryptedDocument.size,
    createdAt: encryptedDocument.createdAt,
    isEncrypted: false
  };
};