/**
 * Password hashing.
 *
 * Uses scrypt from Node's own crypto module — a memory-hard KDF that OWASP
 * lists as an acceptable choice alongside Argon2id. Deliberately no third-party
 * dependency: argon2/bcrypt bindings need a native toolchain (painful on
 * Windows) and the workspace's `minimumReleaseAge` gate blocks fresh releases
 * for 24h. Built-in beats both.
 *
 * NEVER store or log a plaintext password. The only functions that should see
 * one are hashPassword and verifyPassword.
 */
import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * cost=2^16, blockSize=8, parallelism=1 needs ~64 MiB per hash
 * (128 * N * r bytes), so maxmem is raised well above Node's 32 MiB default.
 * Raising N increases both CPU and memory cost.
 */
const PARAMS = { N: 65536, r: 8, p: 1 } as const;
const MAXMEM = 192 * 1024 * 1024;
const KEY_LEN = 64;
const SALT_LEN = 16;

/** Digest format: scrypt$N$r$p$<salt base64>$<hash base64> */
function encode(salt: Buffer, hash: Buffer): string {
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

interface Decoded {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

function decode(digest: string): Decoded | null {
  const parts = digest.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;

  try {
    return {
      N,
      r,
      p,
      salt: Buffer.from(parts[4], "base64"),
      hash: Buffer.from(parts[5], "base64"),
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const hash = await scrypt(password, salt, KEY_LEN, { ...PARAMS, maxmem: MAXMEM });
  return encode(salt, hash);
}

/**
 * Constant-time verification. Returns false rather than throwing on a
 * malformed digest, so a corrupt row denies access instead of 500ing.
 */
export async function verifyPassword(password: string, digest: string): Promise<boolean> {
  const decoded = decode(digest);
  if (!decoded) return false;

  const { N, r, p, salt, hash } = decoded;

  // Guard against a hostile/corrupt row demanding absurd memory.
  if (128 * N * r > MAXMEM) return false;

  let candidate: Buffer;
  try {
    candidate = await scrypt(password, salt, hash.length, { N, r, p, maxmem: MAXMEM });
  } catch {
    return false;
  }

  if (candidate.length !== hash.length) return false;
  return timingSafeEqual(candidate, hash);
}

/** True when a stored digest used weaker params than we now use. */
export function needsRehash(digest: string): boolean {
  const decoded = decode(digest);
  if (!decoded) return true;
  return decoded.N < PARAMS.N || decoded.r < PARAMS.r || decoded.p < PARAMS.p;
}

/** Opaque, URL-safe session id with 256 bits of entropy. */
export function generateSessionId(): string {
  return randomBytes(32).toString("base64url");
}
