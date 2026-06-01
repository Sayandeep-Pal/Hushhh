import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';

/**
 * Zero-Width Characters for Steganography (NullMoji mechanism)
 */
const ZW = {
  ZERO: '\u200B', // Zero Width Space
  ONE: '\u200C',  // Zero Width Non-Joiner
  SEP: '\u200D',  // Zero Width Joiner (used as a separator/terminator)
};

/**
 * A set of unique icons to use as carriers for the hidden message.
 */
const CARRIERS = [
  '(✯‿✯)-->', 
  '⸜(*⌒◡⌒*)->',
  '(っ˘з(˘⌣˘ )->',
  '( •⌄• )✧-->',
  '(๑˃̵ᴗ˂̵)و-->',
  '(〃‿〃)-->',
  '(◕‿◕✿)-->',
  '٩(◕‿◕｡)۶->',
  '(*^‿^*)-->'
];

/**
 * Encodes a string into zero-width characters (handling multi-byte UTF-8).
 */
function encodeToZeroWidth(text: string): string {
  // Convert string to UTF-8 bytes to handle multi-byte characters
  const bytes = CryptoJS.enc.Utf8.parse(text);
  const hex = bytes.toString(CryptoJS.enc.Hex);
  
  let zwResult = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byteHex = hex.substring(i, i + 2);
    const byte = parseInt(byteHex, 16);
    const binary = byte.toString(2).padStart(8, '0');
    
    zwResult += binary
      .split('')
      .map((bit) => (bit === '1' ? ZW.ONE : ZW.ZERO))
      .join('');
  }
  
  return zwResult + ZW.SEP;
}

/**
 * Decodes zero-width characters back into a string.
 */
function decodeFromZeroWidth(zwString: string): string {
  const cleanZW = zwString.split(ZW.SEP)[0];
  let hexResult = '';
  
  for (let i = 0; i < cleanZW.length; i += 8) {
    const byteBits = cleanZW.substring(i, i + 8);
    if (byteBits.length < 8) break;
    
    const binary = byteBits
      .split('')
      .map((char) => (char === ZW.ONE ? '1' : '0'))
      .join('');
    
    const byte = parseInt(binary, 2);
    hexResult += byte.toString(16).padStart(2, '0');
  }
  
  try {
    const bytes = CryptoJS.enc.Hex.parse(hexResult);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return '';
  }
}

/**
 * Derives a key from a secret code and salt using PBKDF2.
 */
export function deriveKey(secretCode: string, salt: string): string {
  return CryptoJS.PBKDF2(secretCode, salt, {
    keySize: 256 / 32,
    iterations: 1000
  }).toString();
}

/**
 * Generates a key fingerprint for comparison.
 * Hash the first 8 chars of the PBKDF2-derived key (hex string).
 */
export function getKeyFingerprint(keyHex: string): string {
  return CryptoJS.SHA256(keyHex.substring(0, 8)).toString().substring(0, 16);
}

/**
 * Encrypts a plaintext string using AES-256-CBC and hides it in a carrier icon using Zero-Width steganography.
 * Attaches a key fingerprint for verification.
 */
export function encryptMessage(plaintext: string, keyHex: string): string {
  try {
    const key = CryptoJS.enc.Hex.parse(keyHex);
    const fingerprint = getKeyFingerprint(keyHex);
    
    // Use expo-crypto for secure random IV generation
    const ivBytes = Crypto.getRandomBytes(16);
    const iv = CryptoJS.enc.Hex.parse(
      Array.from(ivBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    );
    
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Combine Fingerprint + IV + Ciphertext
    const payload = fingerprint + ':' + iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.ciphertext.toString(CryptoJS.enc.Hex);
    
    // Encode to Zero-Width
    const hiddenData = encodeToZeroWidth(payload);
    
    // Pick a random carrier
    const carrier = CARRIERS[Math.floor(Math.random() * CARRIERS.length)];
    
    return carrier + hiddenData;
  } catch (e) {
    return '⚠️ Encryption Error';
  }
}

/**
 * Decrypts a carrier icon with hidden zero-width ciphertext using AES-256-CBC.
 * Verifies the key fingerprint before attempting decryption.
 */
export function decryptMessage(carrierWithHidden: string, keyHex: string): string {
  try {
    const key = CryptoJS.enc.Hex.parse(keyHex);
    const currentFingerprint = getKeyFingerprint(keyHex);
    
    // Extract zero-width data
    const match = carrierWithHidden.match(/[\u200B-\u200D]+/);
    if (!match) return '(－‸－) [No hidden data]';
    
    const payload = decodeFromZeroWidth(match[0]);
    const parts = payload.split(':');
    
    // Handle legacy format (iv:ciphertext) and new format (fingerprint:iv:ciphertext)
    let fingerprint, ivHex, ciphertextHex;
    if (parts.length === 3) {
      [fingerprint, ivHex, ciphertextHex] = parts;
    } else {
      [ivHex, ciphertextHex] = parts;
      fingerprint = null; // Legacy message
    }
    
    if (!ivHex || !ciphertextHex) return '(－‸－) [Invalid payload]';

    // Verify fingerprint if present
    if (fingerprint && fingerprint !== currentFingerprint) {
      return 'FINGERPRINT_MISMATCH';
    }

    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: CryptoJS.enc.Hex.parse(ciphertextHex) } as any,
      key,
      {
        iv: CryptoJS.enc.Hex.parse(ivHex),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    
    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedText) throw new Error('Decryption resulted in empty string');
    return decryptedText;
  } catch (e) {
    return '(－‸－) [Decryption Error]';
  }
}
