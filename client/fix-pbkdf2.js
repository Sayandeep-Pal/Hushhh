const { pbkdf2 } = require('@noble/hashes/pbkdf2');
const { sha256 } = require('@noble/hashes/sha256');
try {
  pbkdf2(sha256, 'pwd', new Uint8Array(16), { iterations: 1, dkLen: 32 });
  console.log('Success with object');
} catch (e) {
  console.log('Fail with object:', e.message);
}
