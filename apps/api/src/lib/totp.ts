import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/* ────────────────────────────────────────────────────────────────────────────
 * Time-based one-time passwords (RFC 6238 over RFC 4226), the codes every
 * authenticator app shows. SHA-1, 6 digits, 30-second steps: the only
 * combination all of them support, which is why it is the one used here.
 *
 * Pure functions, no I/O, so the RFC test vectors can check them directly.
 * ──────────────────────────────────────────────────────────────────────────── */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const TOTP_STEP_SECONDS = 30
export const TOTP_DIGITS = 6

/** RFC 4648 base32, unpadded — the form authenticator apps expect. */
export function base32Encode(bytes: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31]
  return out
}

/** Accepts the secret as people copy it: any case, spaces and padding ignored. */
export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of clean) {
    const index = BASE32.indexOf(char)
    if (index === -1) throw new Error('Invalid base32 character')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** 160 bits, the key length RFC 4226 recommends for HMAC-SHA-1. */
export const generateTotpSecret = () => base32Encode(randomBytes(20))

export function hotp(key: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const mac = createHmac('sha1', key).update(message).digest()
  // Dynamic truncation, RFC 4226 §5.3.
  const offset = mac[mac.length - 1]! & 0x0f
  const binary = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits
  return String(binary).padStart(digits, '0')
}

export const totpCounter = (timeMs: number) => Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS)

export function totp(key: Buffer, timeMs = Date.now(), digits = TOTP_DIGITS): string {
  return hotp(key, totpCounter(timeMs), digits)
}

/**
 * The time step a code belongs to, or null. One step either side is accepted,
 * so a phone clock a little off, or a code typed as it rolls over, still works.
 * The step is returned so the caller can refuse the same code twice.
 */
export function verifyTotp(key: Buffer, code: string, timeMs = Date.now(), window = 1): number | null {
  if (!/^\d{6}$/.test(code)) return null
  const now = totpCounter(timeMs)
  const given = Buffer.from(code)
  for (let drift = -window; drift <= window; drift++) {
    const counter = now + drift
    if (counter < 0) continue
    if (timingSafeEqual(Buffer.from(hotp(key, counter)), given)) return counter
  }
  return null
}

/** The link an authenticator app opens (Key Uri Format). */
export function otpauthUri({ secret, account, issuer }: { secret: string; account: string; issuer: string }): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
  // Built by hand: URLSearchParams writes spaces as "+", which some apps show literally.
  const query = `secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`
  return `otpauth://totp/${label}?${query}`
}
