/*
 * Field encryption expected by the Asian Paints warranty/OTP services.
 * Same scheme as the site's AesUtil(128, 1000).ltyEncrypt (CryptoJS), rebuilt on Web Crypto so
 * no library is needed:
 *   key  = PBKDF2-SHA1(passphrase, salt, 1000 iterations, 128 bits)
 *   data = AES-128-CBC with PKCS#7 padding
 *   out  = hex(salt) + hex(iv) + base64(ciphertext), with a random 16-byte salt and IV per call
 * The passphrase is not stored in code; it is supplied through page metadata.
 * Shared by the warranty registration and site-visit lead forms. This copy sits in the
 * warranty-container block folder so the block can be copied to another project on its own; keep
 * it identical to scripts/asianpaints-crypto.js.
 */
const encoder = new TextEncoder();
const keyCache = new Map();

const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const toBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));

async function baseKey(passphrase) {
  if (!keyCache.has(passphrase)) {
    keyCache.set(passphrase, crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']));
  }
  return keyCache.get(passphrase);
}

/**
 * Encrypts one value. Empty values return undefined, like the original helper, so
 * JSON.stringify leaves those fields out of the payload.
 * @param {string} value Plain text
 * @param {string} passphrase Shared passphrase
 * @returns {Promise<string|undefined>}
 */
export default async function encryptField(value, passphrase) {
  if (!value) return undefined;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2', hash: 'SHA-1', salt, iterations: 1000,
    },
    await baseKey(passphrase),
    { name: 'AES-CBC', length: 128 },
    false,
    ['encrypt'],
  );
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, encoder.encode(value));
  return `${toHex(salt)}${toHex(iv)}${toBase64(ciphertext)}`;
}
