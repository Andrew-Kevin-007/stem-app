// Authenticated encryption for session payloads. AES-256-GCM provides both
// confidentiality (the GitHub token never travels in plaintext) and integrity
// (tampering fails decryption). Web Crypto only, so this runs unchanged in the
// Edge middleware runtime and the Node.js route runtime.

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function secret(): string {
  const configured = process.env.AUTH_ENCRYPTION_KEY || process.env.SESSION_SECRET
  if (configured) return configured
  // Fail closed in production: the dev fallback below is published in the
  // repo, so allowing it in prod would let anyone forge a session cookie and
  // impersonate any user. Marketing pages don't touch this path, so they
  // stay up; only auth-bearing requests error until the key is configured.
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_ENCRYPTION_KEY (or SESSION_SECRET) must be set in production")
  }
  return "stem-dev-insecure-key-set-AUTH_ENCRYPTION_KEY-in-prod"
}

let keyPromise: Promise<CryptoKey> | null = null
let keyForSecret: string | null = null

function getKey(): Promise<CryptoKey> {
  const s = secret()
  if (!keyPromise || keyForSecret !== s) {
    keyForSecret = s
    keyPromise = crypto.subtle
      .digest("SHA-256", encoder.encode(s))
      .then((digest) =>
        crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]),
      )
  }
  return keyPromise
}

function toB64Url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromB64Url(value: string): Uint8Array | null {
  try {
    const bin = atob(value.replace(/-/g, "+").replace(/_/g, "/"))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

// Web Crypto wants ArrayBuffer-backed sources; TS's Uint8Array<ArrayBufferLike>
// generic doesn't satisfy that on its own, so hand it a fresh ArrayBuffer copy.
function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/** Encrypt an arbitrary JSON-serializable value into an opaque token. */
export async function seal(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await getKey()
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, buf(encoder.encode(JSON.stringify(value)))),
  )
  return `${toB64Url(iv)}.${toB64Url(ct)}`
}

/** Decrypt a token produced by seal(). Returns null on any failure. */
export async function open<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null
  const [ivPart, ctPart] = token.split(".")
  const iv = ivPart && fromB64Url(ivPart)
  const ct = ctPart && fromB64Url(ctPart)
  if (!iv || !ct) return null
  try {
    const key = await getKey()
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(ct))
    return JSON.parse(decoder.decode(pt)) as T
  } catch {
    return null
  }
}
