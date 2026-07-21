import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { verifySignature } from '../api/paddle-webhook'
import { cleanForTTS } from '../api/tts'
import { isAdminEmail } from '../api/_lib/auth.js'

// ─── Paddle webhook signature (the money path) ───────────────────────────────

function sign(body: string, secret: string, ts = '1700000000'): string {
  const h1 = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex')
  return `ts=${ts};h1=${h1}`
}

describe('paddle-webhook verifySignature', () => {
  const secret = 'whsec_test_secret'
  const body = JSON.stringify({ event_type: 'subscription.activated', data: { status: 'active' } })

  it('accepts a correctly signed payload', () => {
    expect(verifySignature(body, sign(body, secret), secret)).toBe(true)
  })

  it('rejects a tampered body', () => {
    const tampered = body.replace('activated', 'canceled')
    expect(verifySignature(tampered, sign(body, secret), secret)).toBe(false)
  })

  it('rejects a signature made with the wrong secret', () => {
    expect(verifySignature(body, sign(body, 'whsec_wrong'), secret)).toBe(false)
  })

  it('rejects malformed / missing signature headers', () => {
    expect(verifySignature(body, '', secret)).toBe(false)
    expect(verifySignature(body, 'ts=123', secret)).toBe(false)
    expect(verifySignature(body, 'h1=deadbeef', secret)).toBe(false)
    expect(verifySignature(body, 'ts=123;h1=nothex!', secret)).toBe(false)
  })
})

// ─── TTS text normalisation (regressed once already) ─────────────────────────

describe('cleanForTTS', () => {
  it('speaks architectural scales and ratios', () => {
    expect(cleanForTTS('drawn at 1/20')).toContain('1 to 20')
    expect(cleanForTTS('scale 1:100')).toContain('1 to 100')
  })

  it('speaks units and dimensions', () => {
    expect(cleanForTTS('an area of 450m²')).toContain('450 square meters')
    expect(cleanForTTS('a 6x6 grid')).toContain('6 by 6')
    expect(cleanForTTS('rotated 45°')).toContain('45 degrees')
  })

  it('speaks sqm, ranges, metre dimensions and signed levels', () => {
    expect(cleanForTTS('area of 4,500–5,000 sqm.')).toContain('4500 to 5000 square meters')
    expect(cleanForTTS('total of 4,800 sqm across four buildings')).toContain('4800 square meters')
    expect(cleanForTTS('the 300 sqm Swimming Pool (25m x 6m lap pool)')).toContain('300 square meters')
    expect(cleanForTTS('(25m x 6m lap pool)')).toContain('25 by 6 meters')
    expect(cleanForTTS('at the 0.00 and +4.00 levels')).toContain('plus 4.00')
    expect(cleanForTTS('1/100 plans and 1/200-equivalent drawings')).toContain('1 to 100')
  })

  it('strips markdown without losing the words', () => {
    const out = cleanForTTS('**Strong concept** with `code` and [a link](https://x.com)')
    expect(out).toContain('Strong concept')
    expect(out).toContain('a link')
    expect(out).not.toContain('**')
    expect(out).not.toContain('](')
  })
})

// ─── Admin allowlist helper ───────────────────────────────────────────────────

describe('isAdminEmail', () => {
  it('accepts the founder address case-insensitively', () => {
    expect(isAdminEmail('ibro12345@icloud.com')).toBe(true)
    expect(isAdminEmail('IBRO12345@ICLOUD.COM')).toBe(true)
  })

  it('rejects everyone else, including empty/null', () => {
    expect(isAdminEmail('attacker@evil.com')).toBe(false)
    expect(isAdminEmail('')).toBe(false)
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
  })
})
