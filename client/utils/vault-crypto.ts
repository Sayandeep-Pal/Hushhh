import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';

const randomHex = (byteLength: number) => Array.from(Crypto.getRandomBytes(byteLength))
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');

const equalStrings = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

const deriveWrappingKey = (passcode: string, salt: string) => CryptoJS.PBKDF2(passcode, salt, {
  keySize: 512 / 32,
  iterations: 310000,
  hasher: CryptoJS.algo.SHA256,
}).toString();

const encryptWithKey = (plaintext: string, keyHex: string, version: string) => {
  if (!/^[a-f0-9]{128}$/i.test(keyHex)) throw new Error('Invalid vault key');
  const encryptionKey = CryptoJS.enc.Hex.parse(keyHex.slice(0, 64));
  const macKey = CryptoJS.enc.Hex.parse(keyHex.slice(64));
  const ivHex = randomHex(16);
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const ciphertext = CryptoJS.AES.encrypt(plaintext, encryptionKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).ciphertext.toString(CryptoJS.enc.Hex);
  const authenticatedData = `${version}:${ivHex}:${ciphertext}`;
  const tag = CryptoJS.HmacSHA256(authenticatedData, macKey).toString(CryptoJS.enc.Hex);
  return `${authenticatedData}:${tag}`;
};

const decryptWithKey = (envelope: string, keyHex: string, version: string) => {
  const [actualVersion, ivHex, ciphertext, tag] = envelope.split(':');
  if (actualVersion !== version || !ivHex || !ciphertext || !tag) throw new Error('Invalid vault envelope');
  const encryptionKey = CryptoJS.enc.Hex.parse(keyHex.slice(0, 64));
  const macKey = CryptoJS.enc.Hex.parse(keyHex.slice(64));
  const authenticatedData = `${version}:${ivHex}:${ciphertext}`;
  const expectedTag = CryptoJS.HmacSHA256(authenticatedData, macKey).toString(CryptoJS.enc.Hex);
  if (!equalStrings(tag, expectedTag)) throw new Error('Vault authentication failed');
  const decrypted = CryptoJS.AES.decrypt({ ciphertext: CryptoJS.enc.Hex.parse(ciphertext) } as any, encryptionKey, {
    iv: CryptoJS.enc.Hex.parse(ivHex),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString(CryptoJS.enc.Utf8);
  if (!decrypted) throw new Error('Vault decryption failed');
  return decrypted;
};

export const createVaultKey = () => randomHex(64);

export const encryptVault = (vault: unknown, vaultKey: string) => encryptWithKey(JSON.stringify(vault), vaultKey, 'vault-v1');

export const decryptVault = <T>(envelope: string, vaultKey: string): T => JSON.parse(decryptWithKey(envelope, vaultKey, 'vault-v1')) as T;

export const wrapVaultKey = (vaultKey: string, passcode: string) => {
  const salt = randomHex(16);
  const wrappingKey = deriveWrappingKey(passcode, salt);
  return `${salt}.${encryptWithKey(vaultKey, wrappingKey, 'vault-key-v1')}`;
};

export const unwrapVaultKey = (wrappedKey: string, passcode: string) => {
  const separator = wrappedKey.indexOf('.');
  if (separator <= 0) throw new Error('Invalid wrapped vault key');
  const salt = wrappedKey.slice(0, separator);
  const envelope = wrappedKey.slice(separator + 1);
  const key = decryptWithKey(envelope, deriveWrappingKey(passcode, salt), 'vault-key-v1');
  if (!/^[a-f0-9]{128}$/i.test(key)) throw new Error('Invalid unwrapped vault key');
  return key;
};
