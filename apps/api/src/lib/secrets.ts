/**
 * Encrypts agency secrets (their email and payment API keys) before they reach the database,
 * so a leaked database dump or backup doesn't leak working keys.
 * AES-256-GCM; the key is derived from JWT_SECRET, so rotating that secret invalidates stored keys.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

async function key(secret: string) {
  const material = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("wepilo-secrets-v1"), info: enc.encode("tenant-secrets") },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecret(env: { JWT_SECRET: string }, plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(env.JWT_SECRET), enc.encode(plain)));
  return `v1.${b64(iv)}.${b64(cipher)}`;
}

/** Returns null when the value is malformed or was encrypted under a different secret. */
export async function decryptSecret(env: { JWT_SECRET: string }, stored: string) {
  try {
    const [version, iv, cipher] = stored.split(".");
    if (version !== "v1") return null;
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(env.JWT_SECRET), unb64(cipher));
    return dec.decode(plain);
  } catch {
    return null;
  }
}

/** "re_abc…wxyz": enough to recognise a key, not enough to use it. */
export function maskSecret(plain: string) {
  return plain.length <= 8 ? "••••" : `${plain.slice(0, 3)}…${plain.slice(-4)}`;
}
