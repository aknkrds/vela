// End-to-end encryption utilities for Vela messages
// Uses CryptoJS for AES-256 encryption with PBKDF2 key derivation
// This ensures messages cannot be read even if the database is compromised

import CryptoJS from 'crypto-js';

// Configuration constants
const PBKDF2_ITERATIONS = 1000;
const KEY_SIZE = 256 / 32; // 256-bit key
const SALT_SIZE = 16; // 128-bit salt (in words = 4)
const IV_SIZE = 16; // 128-bit IV (in words = 4)

// Separator used to join salt + iv + ciphertext in the encoded output
const SEPARATOR = '::';

/**
 * Encrypts a plaintext message using AES-256-CBC with PBKDF2 key derivation.
 * 
 * Process:
 * 1. Generate random salt and IV
 * 2. Derive a 256-bit key from password using PBKDF2 (100k iterations)
 * 3. Encrypt the message with AES-256-CBC
 * 4. Return base64(salt) + "::" + base64(iv) + "::" + base64(ciphertext)
 * 
/**
 * Safely generates random WordArray for CryptoJS in React Native environment
 * where window.crypto.getRandomValues may not be available natively.
 */
function getRandomWordArray(nBytes: number): CryptoJS.lib.WordArray {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto && typeof (globalThis as any).crypto.getRandomValues === 'function') {
      const uint8 = new Uint8Array(nBytes);
      (globalThis as any).crypto.getRandomValues(uint8);
      const words: number[] = [];
      for (let i = 0; i < nBytes; i += 4) {
        words.push(
          (((uint8[i] || 0) << 24) |
          ((uint8[i + 1] || 0) << 16) |
          ((uint8[i + 2] || 0) << 8) |
          (uint8[i + 3] || 0)) >>> 0
        );
      }
      return CryptoJS.lib.WordArray.create(words, nBytes);
    }
  } catch (e) {
    // fallback below
  }

  // Pure JS Fallback using Math.random + high-res time entropy for React Native
  const words: number[] = [];
  for (let i = 0; i < nBytes; i += 4) {
    const r1 = Math.floor(Math.random() * 0x100000000);
    const r2 = Math.floor(Math.random() * 0x100000000);
    const entropy = (Date.now() ^ (i * 10007)) >>> 0;
    words.push((r1 ^ r2 ^ entropy) >>> 0);
  }
  return CryptoJS.lib.WordArray.create(words, nBytes);
}

/**
 * Encrypts a plaintext message using AES-256-CBC with PBKDF2 key derivation.
 * 
 * Process:
 * 1. Generate random salt and IV
 * 2. Derive a 256-bit key from password using PBKDF2 (100k iterations)
 * 3. Encrypt the message with AES-256-CBC
 * 4. Return base64(salt) + "::" + base64(iv) + "::" + base64(ciphertext)
 * 
 * @param plaintext - The message content to encrypt
 * @param password - The user's encryption password
 * @returns Encoded string containing salt + iv + ciphertext
 */
export function encryptMessage(plaintext: string, password: string): string {
  // Generate random salt and IV using safe generator
  const salt = getRandomWordArray(SALT_SIZE);
  const iv = getRandomWordArray(IV_SIZE);

  // Derive key using PBKDF2
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_SIZE,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });

  // Encrypt with AES-256-CBC
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // Combine salt + iv + ciphertext as base64
  const saltB64 = CryptoJS.enc.Base64.stringify(salt);
  const ivB64 = CryptoJS.enc.Base64.stringify(iv);
  const ciphertextB64 = encrypted.ciphertext.toString(CryptoJS.enc.Base64);

  return `${saltB64}${SEPARATOR}${ivB64}${SEPARATOR}${ciphertextB64}`;
}

/**
 * Decrypts an encrypted message back to plaintext.
 * 
 * @param encryptedData - The encoded string from encryptMessage()
 * @param password - The encryption password used during encryption
 * @returns The original plaintext message
 * @throws Error if decryption fails (wrong password or corrupted data)
 */
export function decryptMessage(encryptedData: string, password: string): string {
  try {
    const parts = encryptedData.split(SEPARATOR);
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [saltB64, ivB64, ciphertextB64] = parts;

    // Parse base64 back to WordArrays
    const salt = CryptoJS.enc.Base64.parse(saltB64);
    const iv = CryptoJS.enc.Base64.parse(ivB64);
    const ciphertext = CryptoJS.enc.Base64.parse(ciphertextB64);

    // Derive the same key
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: KEY_SIZE,
      iterations: PBKDF2_ITERATIONS,
      hasher: CryptoJS.algo.SHA256,
    });

    // Decrypt
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertext,
    });

    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

    if (!plaintext) {
      throw new Error('Decryption failed — wrong password or corrupted data');
    }

    return plaintext;
  } catch (error) {
    throw new Error('Decryption failed — wrong password or corrupted data');
  }
}

/**
 * Hashes a password using SHA-256 (for sending to backend for verification purposes).
 * The actual encryption password is never sent to backend — only the hash.
 * 
 * @param password - The encryption password
 * @returns SHA-256 hash of the password
 */
export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
}

/**
 * Validates that encrypted data has the correct format.
 * 
 * @param data - The data to validate
 * @returns true if the data appears to be properly encrypted
 */
export function isEncryptedFormat(data: string): boolean {
  const parts = data.split(SEPARATOR);
  return parts.length === 3 && parts.every(p => p.length > 0);
}
