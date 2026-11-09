// Lock the Anthropic API key with a family password (PBKDF2-SHA256 → AES-256-GCM), and open it again.
// Pure WebCrypto: the same file runs in Node (scripts/lock-key.mjs) and in the browser (src/vault.js).
const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();
export const MIN_PASSWORD = 20;
export const DEFAULT_ITERATIONS = 600000;

const toB64 = bytes => { let s = ""; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

async function aesKey(password, salt, iterations, usages) {
  const base = await subtle().importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, usages);
}

/* Encrypt the key; the result is safe to publish (only the password opens it). */
export async function lockKey(apiKey, password, { iterations = DEFAULT_ITERATIONS } = {}) {
  if (String(password || "").length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(password, salt, iterations, ["encrypt"]);
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, key, enc.encode(apiKey));
  return { v: 1, salt: toB64(salt), iv: toB64(iv), iterations, ciphertext: toB64(ct), createdAt: new Date().toISOString() };
}

/* The non-extractable AES key a password derives for this lock (what "remember on this device" stores). */
export function deriveKey(password, lock) { return aesKey(String(password || ""), fromB64(lock.salt), lock.iterations, ["decrypt"]); }

/* Decrypt with a derived key; a wrong password surfaces as Error("wrong-password"). */
export async function openLock(lock, cryptoKey) {
  try { const pt = await subtle().decrypt({ name: "AES-GCM", iv: fromB64(lock.iv) }, cryptoKey, fromB64(lock.ciphertext)); return dec.decode(pt); }
  catch (e) { throw new Error("wrong-password"); }
}

export async function unlockKey(lock, password) { return openLock(lock, await deriveKey(password, lock)); }
