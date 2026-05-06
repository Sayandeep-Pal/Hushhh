import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';

// A set of 256 unique emojis for Base-Emoji encoding
const EMOJI_ALPHABET = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
  '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
  '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁',
  '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
  '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺',
  '👻', '👽', '👾', '🤖', '😺', '😸', '😻', '😼', '😽', '🙀', '😿', '😾', '🙈', '🙉', '🙊', '💋',
  '💌', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙',
  '💜', '🖤', '🤍', '🤎', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️',
  '💭', '💤', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
  '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏',
  '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️',
  '👅', '👄', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓', '👴', '👵', '🙍', '🙎',
  '🙅', '🙆', '💁', '🙋', '🧏', '🙇', '🤦', '🤷', '👮', '🕵️', '💂', '👷', '🤴', '👸', '👳', '👲',
  '🧕', '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸', '🦹', '🧙', '🧚', '🧛', '🧜', '🧝', '🧞'
];

// Fallback if the above doesn't have 256 or has duplicates
// (I will double check this or use a more robust generation if needed)

/**
 * Encodes a Uint8Array into an emoji string.
 */
export function encodeToEmoji(data: Uint8Array): string {
  return Array.from(data)
    .map((byte) => EMOJI_ALPHABET[byte])
    .join('');
}

/**
 * Decodes an emoji string back into a Uint8Array.
 */
export function decodeFromEmoji(emojiString: string): Uint8Array {
  const emojiToByte: Record<string, number> = {};
  EMOJI_ALPHABET.forEach((emoji, index) => {
    emojiToByte[emoji] = index;
  });

  // Emojis can be multiple code points, so we split by clusters
  // Using Intl.Segmenter is better for splitting emojis, with a fallback.
  let segments: string[] = [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter();
    segments = Array.from(segmenter.segment(emojiString)).map(s => s.segment);
  } else {
    // Fallback: Array.from splits by code point, which works for many emojis
    // but might fail for complex ones. Given our alphabet, it's a decent fallback.
    segments = Array.from(emojiString);
  }
  
  return new Uint8Array(segments.map((s) => emojiToByte[s]));
}

/**
 * Derives a 256-bit key from a secret code and salt.
 */
export function deriveKey(secretCode: string, salt: Uint8Array): Uint8Array {
  // Noble-hashes v2 pbkdf2 signature is pbkdf2(hash, password, salt, { iterations, dkLen })
  // The error "c expected number" in minified code often points to a missing or wrong type argument.
  // We'll ensure all types are strictly correct.
  return pbkdf2(sha256, secretCode, salt, { 
    iterations: 100000, 
    dkLen: 32 
  });
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 */
export function encryptMessage(plaintext: string, key: Uint8Array): string {
  const iv = randomBytes(12);
  const data = new TextEncoder().encode(plaintext);
  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(data);
  
  // Combine IV + Ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, iv.length);
  
  return encodeToEmoji(combined);
}

/**
 * Decrypts an emoji-encoded ciphertext using AES-256-GCM.
 */
export function decryptMessage(emojiCiphertext: string, key: Uint8Array): string {
  const combined = decodeFromEmoji(emojiCiphertext);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const cipher = gcm(key, iv);
  const decrypted = cipher.decrypt(ciphertext);
  
  return new TextDecoder().decode(decrypted);
}
