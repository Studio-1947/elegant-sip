import { describe, expect, it } from 'vitest'
import { DEFAULT_MAIL_FROM, emailConfigIssues } from './env.js'

/* Missing email config is shouted about at boot in production, never fatal. */

const prod = { NODE_ENV: 'production', PAYMENT_PROVIDER: 'razorpay', SMTP_URL: 'smtp://mail.example:587' } as const
const FROM = 'Elegant Sip <orders@mail.elegantsip.in>'

describe('emailConfigIssues', () => {
  it('is quiet when production email is configured, and outside production', () => {
    expect(emailConfigIssues(prod, FROM)).toEqual([])
    expect(emailConfigIssues({ ...prod, NODE_ENV: 'development', SMTP_URL: undefined }, undefined)).toEqual([])
  })

  it('logs one EMAIL NOT CONFIGURED error when taking real payments without SMTP', () => {
    for (const SMTP_URL of [undefined, '', '  ']) {
      const issues = emailConfigIssues({ ...prod, SMTP_URL }, FROM)
      expect(issues).toHaveLength(1)
      expect(issues[0].level).toBe('error')
      expect(issues[0].message).toMatch(/^EMAIL NOT CONFIGURED/)
    }
    // A read-only catalogue sends nothing that matters.
    expect(emailConfigIssues({ ...prod, PAYMENT_PROVIDER: 'disabled', SMTP_URL: '' }, FROM)).toEqual([])
  })

  it('warns about DMARC when MAIL_FROM is unset or left at the default', () => {
    for (const from of [undefined, '', DEFAULT_MAIL_FROM]) {
      const issues = emailConfigIssues(prod, from)
      expect(issues).toEqual([{ level: 'warn', message: expect.stringMatching(/MAIL_FROM.*DMARC/) }])
    }
  })
})
