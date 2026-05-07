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
 * A set of emojis to use as carriers for the hidden message.
 */
const CARRIERS = ['🔒', '🤫', '👻', '✨', '💎', '🛡️', '💬', '🕵️', '🤖', '🌟'];

/**
 * Encodes a string into zero-width characters.
 */
function encodeToZeroWidth(text: string): string {
  return text
    .split('')
    .map((char) => {
      const binary = char.charCodeAt(0).toString(2).padStart(8, '0');
      return binary
        .split('')
        .map((bit) => (bit === '1' ? ZW.ONE : ZW.ZERO))
        .join('');
    })
    .join('') + ZW.SEP;
}

/**
 * Decodes zero-width characters back into a string.
 */
function decodeFromZeroWidth(zwString: string): string {
  const cleanZW = zwString.split(ZW.SEP)[0];
  let result = '';
  
  for (let i = 0; i < cleanZW.length; i += 8) {
    const byte = cleanZW.substring(i, i + 8);
    if (byte.length < 8) break;
    
    const binary = byte
      .split('')
      .map((char) => (char === ZW.ONE ? '1' : '0'))
      .join('');
    
    result += String.fromCharCode(parseInt(binary, 2));
  }
  
  return result;
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
 * Encrypts a plaintext string using AES-256-CBC and hides it in a carrier emoji using Zero-Width steganography.
 */
export function encryptMessage(plaintext: string, keyHex: string): string {
  try {
    const key = CryptoJS.enc.Hex.parse(keyHex);
    
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
    
    // Combine IV + Ciphertext in a format that can be easily recovered
    const payload = iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.ciphertext.toString(CryptoJS.enc.Hex);
    
    // Encode to Zero-Width
    const hiddenData = encodeToZeroWidth(payload);
    
    // Pick a random carrier
    const carrier = CARRIERS[Math.floor(Math.random() * CARRIERS.length)];
    
    return carrier + hiddenData;
  } catch (e) {
    console.error('Encryption Failed:', e);
    return '⚠️ Encryption Error';
  }
}

/**
 * Decrypts a carrier emoji with hidden zero-width ciphertext using AES-256-CBC.
 */
export function decryptMessage(carrierWithHidden: string, keyHex: string): string {
  try {
    const key = CryptoJS.enc.Hex.parse(keyHex);
    
    // Extract zero-width data (skip the carrier emoji)
    // We use a regex to find the zero-width sequence
    const match = carrierWithHidden.match(/[\u200B-\u200D]+/);
    if (!match) return '🔒 [No hidden data]';
    
    const payload = decodeFromZeroWidth(match[0]);
    const [ivHex, ciphertextHex] = payload.split(':');
    
    if (!ivHex || !ciphertextHex) return '🔒 [Invalid payload]';

    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: CryptoJS.enc.Hex.parse(ciphertextHex) } as any,
      key,
      {
        iv: CryptoJS.enc.Hex.parse(ivHex),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error('Decryption Failed:', e);
    return '🔒 [Decryption Error]';
  }
}
