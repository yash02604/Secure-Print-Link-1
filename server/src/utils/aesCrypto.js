/**
 * Server-side AES-256-GCM Encryption/Decryption Utility
 * Uses Node.js crypto module for server-side operations
 */

import crypto from 'crypto';

const AES_CRYPTO_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  hash: 'sha256',
  iterations: 100000,
  keyLength: 32, // 256 bits
  ivLength: 12,  // 96 bits for GCM
  authTagLength: 16 // 128 bits
};

// Fixed salt for deterministic key derivation (same as frontend)
const FIXED_SALT = 'secure-print-link-salt';

/**
 * Derive encryption key from secret using PBKDF2
 * @param {string} secret - Secret string for key derivation
 * @returns {Buffer} Derived AES key
 */
function deriveKey(secret) {
  const salt = Buffer.from(FIXED_SALT, 'utf8');
  const secretBuffer = Buffer.from(secret, 'utf8');
  
  // Derive AES key using PBKDF2
  return crypto.pbkdf2Sync(
    secretBuffer,
    salt,
    AES_CRYPTO_CONFIG.iterations,
    AES_CRYPTO_CONFIG.keyLength,
    AES_CRYPTO_CONFIG.hash
  );
}

/**
 * Encrypt buffer using AES-256-GCM
 * @param {Buffer} data - Data to encrypt
 * @param {string} secret - Secret for key derivation
 * @returns {Object} Encrypted data with IV and auth tag
 */
export function encryptBufferAES(data, secret) {
  try {
    // Generate random IV
    const iv = crypto.randomBytes(AES_CRYPTO_CONFIG.ivLength);
    
    // Derive encryption key
    const key = deriveKey(secret);
    
    // Create cipher
    const cipher = crypto.createCipheriv(AES_CRYPTO_CONFIG.algorithm, key, iv);
    
    // Encrypt data
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    return {
      encryptedData: encrypted,
      iv: iv,
      authTag: authTag
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt buffer using AES-256-GCM
 * @param {Buffer} encryptedData - Encrypted data
 * @param {Buffer} iv - Initialization vector
 * @param {Buffer} authTag - Authentication tag
 * @param {string} secret - Secret for key derivation
 * @returns {Buffer} Decrypted data
 */
export function decryptBufferAES(encryptedData, iv, authTag, secret) {
  try {
    // Validate inputs
    if (!Buffer.isBuffer(encryptedData)) {
      throw new Error('Encrypted data must be a Buffer');
    }
    if (!Buffer.isBuffer(iv) || iv.length !== AES_CRYPTO_CONFIG.ivLength) {
      throw new Error(`Invalid IV length. Expected ${AES_CRYPTO_CONFIG.ivLength} bytes`);
    }
    if (!Buffer.isBuffer(authTag) || authTag.length !== AES_CRYPTO_CONFIG.authTagLength) {
      throw new Error(`Invalid auth tag length. Expected ${AES_CRYPTO_CONFIG.authTagLength} bytes`);
    }
    
    // Derive decryption key
    const key = deriveKey(secret);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(AES_CRYPTO_CONFIG.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt data
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  } catch (error) {
    if (error.message.includes('Unsupported state or unable to authenticate data')) {
      throw new Error('Decryption failed: Invalid authentication tag or corrupted data');
    }
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Decrypt file content for viewing/printing
 * @param {Buffer} fileContent - Encrypted file content from database
 * @param {Array} storedIv - IV stored in job metadata (as array)
 * @param {Array} storedAuthTag - Auth tag stored in job metadata (as array)
 * @param {string} secret - Secret used for encryption
 * @returns {Buffer} Decrypted file content
 */
export function decryptFileForViewing(fileContent, storedIv, storedAuthTag, secret) {
  try {
    // Convert stored arrays back to Buffers
    const iv = Buffer.from(storedIv);
    const authTag = Buffer.from(storedAuthTag);
    
    // Decrypt the file content
    const decryptedContent = decryptBufferAES(fileContent, iv, authTag, secret);
    
    // Validate decrypted content
    if (!decryptedContent || decryptedContent.length === 0) {
      throw new Error('Decrypted content is empty');
    }
    
    return decryptedContent;
  } catch (error) {
    console.error('[AES Server] Decryption failed:', error.message);
    throw error;
  }
}

/**
 * Store encryption metadata with job
 * @param {string} secret - Encryption secret
 * @param {Buffer} iv - Initialization vector
 * @param {Buffer} authTag - Authentication tag
 * @returns {Object} Metadata to store
 */
export function createEncryptionMetadata(secret, iv, authTag) {
  return {
    secret: secret,
    iv: Array.from(iv), // Convert to array for JSON storage
    authTag: Array.from(authTag) // Convert to array for JSON storage
  };
}

// Export configuration for reference
export { AES_CRYPTO_CONFIG };