/**
 * AES-256-GCM Encryption/Decryption Utility
 * Uses Web Crypto API for client-side encryption
 */

const AES_CRYPTO_CONFIG = {
  algorithm: 'AES-GCM',
  keyDerivation: 'PBKDF2',
  hash: 'SHA-256',
  iterations: 100000,
  keyLength: 256,
  ivLength: 12 // 96 bits for GCM
};

/**
 * Derive encryption key from secret using PBKDF2
 * @param {string} secret - Secret string for key derivation
 * @returns {Promise<CryptoKey>} Derived AES key
 */
async function deriveKey(secret) {
  const encoder = new TextEncoder();
  const salt = encoder.encode('secure-print-link-salt'); // Fixed salt for deterministic derivation
  const secretBuffer = encoder.encode(secret);
  
  // Import secret as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    secretBuffer,
    { name: AES_CRYPTO_CONFIG.keyDerivation },
    false,
    ['deriveKey']
  );
  
  // Derive AES key using PBKDF2
  return await crypto.subtle.deriveKey(
    {
      name: AES_CRYPTO_CONFIG.keyDerivation,
      salt: salt,
      iterations: AES_CRYPTO_CONFIG.iterations,
      hash: AES_CRYPTO_CONFIG.hash
    },
    keyMaterial,
    {
      name: AES_CRYPTO_CONFIG.algorithm,
      length: AES_CRYPTO_CONFIG.keyLength
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt file using AES-256-GCM
 * @param {File|Blob} file - File to encrypt
 * @param {string} secret - Secret for key derivation
 * @returns {Promise<{encryptedBlob: Blob, iv: Uint8Array}>} Encrypted data and IV
 */
export async function encryptFileAES(file, secret) {
  try {
    // Convert file to ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(AES_CRYPTO_CONFIG.ivLength));
    
    // Derive encryption key
    const key = await deriveKey(secret);
    
    // Encrypt data
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: AES_CRYPTO_CONFIG.algorithm,
        iv: iv
      },
      key,
      fileBuffer
    );
    
    // Create encrypted blob with .enc extension
    const encryptedBlob = new Blob([encryptedBuffer], {
      type: 'application/octet-stream'
    });
    
    return {
      encryptedBlob,
      iv
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt file using AES-256-GCM
 * @param {Blob|ArrayBuffer} encryptedData - Encrypted data
 * @param {Uint8Array} iv - Initialization vector
 * @param {string} secret - Secret for key derivation
 * @returns {Promise<ArrayBuffer>} Decrypted data
 */
export async function decryptFileAES(encryptedData, iv, secret) {
  try {
    // Convert to ArrayBuffer if it's a Blob
    const encryptedBuffer = encryptedData instanceof Blob 
      ? await encryptedData.arrayBuffer()
      : encryptedData;
    
    // Derive decryption key
    const key = await deriveKey(secret);
    
    // Decrypt data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: AES_CRYPTO_CONFIG.algorithm,
        iv: iv
      },
      key,
      encryptedBuffer
    );
    
    return decryptedBuffer;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Create encrypted File object with .enc extension
 * @param {File} originalFile - Original file
 * @param {Blob} encryptedBlob - Encrypted blob
 * @returns {File} Encrypted file with .enc extension
 */
export function createEncryptedFile(originalFile, encryptedBlob) {
  const originalName = originalFile.name;
  const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
  const extension = originalName.substring(originalName.lastIndexOf('.'));
  const encryptedFileName = `${nameWithoutExt}.enc${extension}`;
  
  return new File([encryptedBlob], encryptedFileName, {
    type: 'application/octet-stream',
    lastModified: originalFile.lastModified
  });
}

/**
 * Extract original filename from encrypted filename
 * @param {string} encryptedFileName - Encrypted filename (e.g., "document.enc.pdf")
 * @returns {string} Original filename (e.g., "document.pdf")
 */
export function getOriginalFileName(encryptedFileName) {
  // Remove .enc prefix from extension
  return encryptedFileName.replace(/\.enc(\.\w+)$/, '$1');
}

/**
 * Check if filename indicates encrypted file
 * @param {string} filename - Filename to check
 * @returns {boolean} True if file is encrypted (.enc extension)
 */
export function isEncryptedFile(filename) {
  return filename.includes('.enc.');
}

/**
 * Securely clear sensitive data from memory
 * @param {ArrayBuffer|Uint8Array} buffer - Buffer to clear
 */
export function clearSensitiveData(buffer) {
  if (buffer instanceof ArrayBuffer) {
    // Clear ArrayBuffer by setting all bytes to 0
    const view = new Uint8Array(buffer);
    for (let i = 0; i < view.length; i++) {
      view[i] = 0;
    }
  } else if (buffer instanceof Uint8Array) {
    // Clear Uint8Array
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = 0;
    }
  }
}

// Export configuration for reference
export { AES_CRYPTO_CONFIG };
