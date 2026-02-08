/**
 * Test file for AES encryption/decryption
 * Run this in browser console to verify functionality
 */

import { encryptFileAES, decryptFileAES, createEncryptedFile, isEncryptedFile, getOriginalFileName } from './aesCrypto';

// Test function - run in browser console
async function testAESEncryption() {
  console.log('🧪 Starting AES Encryption Test...');
  
  try {
    // Create a test file
    const testContent = 'This is a secret document that should be encrypted!';
    const testBlob = new Blob([testContent], { type: 'text/plain' });
    const testFile = new File([testBlob], 'test-document.txt', { type: 'text/plain' });
    
    console.log('📄 Original file:', testFile.name, testFile.size, 'bytes');
    
    // Test encryption
    const secret = 'test-secret-key-12345';
    console.log('🔑 Using secret:', secret);
    
    const { encryptedBlob, iv } = await encryptFileAES(testFile, secret);
    console.log('🔒 Encrypted blob size:', encryptedBlob.size, 'bytes');
    console.log('🔢 IV length:', iv.length, 'bytes');
    
    // Create encrypted file
    const encryptedFile = createEncryptedFile(testFile, encryptedBlob);
    console.log('📁 Encrypted file name:', encryptedFile.name);
    console.log('✅ Is encrypted file:', isEncryptedFile(encryptedFile.name));
    console.log('🔤 Original name:', getOriginalFileName(encryptedFile.name));
    
    // Test decryption
    const decryptedBuffer = await decryptFileAES(encryptedBlob, iv, secret);
    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    
    console.log('🔓 Decrypted content:', decryptedText);
    console.log('✅ Decryption successful:', decryptedText === testContent);
    
    if (decryptedText === testContent) {
      console.log('🎉 All tests passed! AES encryption/decryption is working correctly.');
    } else {
      console.error('❌ Decryption failed - content mismatch');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Export for manual testing
window.testAESEncryption = testAESEncryption;

console.log('_AES Crypto Test Loaded_');
console.log('Run testAESEncryption() in console to test');

export { testAESEncryption };
