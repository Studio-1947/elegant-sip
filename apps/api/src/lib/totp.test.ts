import { describe, expect, it } from 'vitest'
import { base32Decode, base32Encode, hotp, otpauthUri, totp, verifyTotp } from './totp.js'

/* The RFC test vectors, so the codes match every authenticator app. */

const RFC_KEY = Buffer.from('12345678901234567890')

describe('HOTP (RFC 4226 appendix D)', () => {
  it('produces the published codes', () => {
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489']
    expected.forEach((code, counter) => expect(hotp(RFC_KEY, counter)).toBe(code))
  })
})

describe('TOTP (RFC 6238 appendix B, SHA-1)', () => {
  const vectors: [number, string][] = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ]

  it('produces the published 8-digit codes', () => {
    for (const [seconds, code] of vectors) expect(totp(RFC_KEY, seconds * 1000, 8)).toBe(code)
  })

  it('6-digit codes are the last six of those', () => {
    for (const [seconds, code] of vectors) expect(totp(RFC_KEY, seconds * 1000)).toBe(code.slice(2))
  })
})

describe('verifyTotp', () => {
  const now = 1111111111 * 1000

  it('accepts the current step and one either side, and says which', () => {
    const step = Math.floor(now / 30_000)
    expect(verifyTotp(RFC_KEY, totp(RFC_KEY, now), now)).toBe(step)
    expect(verifyTotp(RFC_KEY, totp(RFC_KEY, now - 30_000), now)).toBe(step - 1)
    expect(verifyTotp(RFC_KEY, totp(RFC_KEY, now + 30_000), now)).toBe(step + 1)
  })

  it('refuses codes two steps away, wrong codes and malformed input', () => {
    expect(verifyTotp(RFC_KEY, totp(RFC_KEY, now - 60_000), now)).toBeNull()
    expect(verifyTotp(RFC_KEY, totp(RFC_KEY, now + 60_000), now)).toBeNull()
    const wrong = String((Number(totp(RFC_KEY, now)) + 1) % 1_000_000).padStart(6, '0')
    expect(verifyTotp(RFC_KEY, wrong, now)).toBeNull()
    expect(verifyTotp(RFC_KEY, '12345', now)).toBeNull()
    expect(verifyTotp(RFC_KEY, 'abcdef', now)).toBeNull()
  })
})

describe('base32 and otpauth links', () => {
  it('round-trips, and reads secrets as people copy them', () => {
    // RFC 4648 §10.
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI')
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar')
    expect(base32Decode('mzxw 6ytb oi======').toString()).toBe('foobar')
    expect(base32Encode(RFC_KEY)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  })

  it('builds a link authenticator apps understand', () => {
    const uri = otpauthUri({ secret: 'JBSWY3DPEHPK3PXP', account: 'staff@elegantsip.in', issuer: 'Elegant Sip' })
    expect(uri).toBe(
      'otpauth://totp/Elegant%20Sip:staff%40elegantsip.in?secret=JBSWY3DPEHPK3PXP&issuer=Elegant%20Sip&algorithm=SHA1&digits=6&period=30',
    )
  })
})
