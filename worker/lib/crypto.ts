const PASSWORD_ITERATIONS = 600_000;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;
const SESSION_TOKEN_BYTES = 32;

const encoder = new TextEncoder();

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array | null {
  if (value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) return null;

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBuffer,
      iterations,
    },
    passwordKey,
    PASSWORD_HASH_BYTES * 8,
  );

  return new Uint8Array(derived);
}

export interface PasswordDigest {
  hash: string;
  iterations: number;
  salt: string;
}

export async function hashPassword(password: string): Promise<PasswordDigest> {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);

  return {
    hash: bytesToHex(hash),
    iterations: PASSWORD_ITERATIONS,
    salt: bytesToHex(salt),
  };
}

export async function verifyPassword(
  password: string,
  digest: PasswordDigest,
): Promise<boolean> {
  const salt = hexToBytes(digest.salt);
  const expectedHash = hexToBytes(digest.hash);

  if (
    !salt ||
    salt.byteLength !== PASSWORD_SALT_BYTES ||
    !expectedHash ||
    expectedHash.byteLength !== PASSWORD_HASH_BYTES ||
    !Number.isInteger(digest.iterations) ||
    digest.iterations < 100_000 ||
    digest.iterations > 2_000_000
  ) {
    return false;
  }

  const candidateHash = await derivePassword(password, salt, digest.iterations);
  return crypto.subtle.timingSafeEqual(candidateHash, expectedHash);
}

export function createSessionToken(): string {
  return bytesToHex(randomBytes(SESSION_TOKEN_BYTES));
}

export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return bytesToHex(new Uint8Array(digest));
}
