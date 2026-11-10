import { describe, expect, it, vi } from 'vitest'

// A development server (fake payments) with a real token and no test code.
vi.hoisted(() => {
  process.env.NODE_ENV = 'development'
  process.env.META_CAPI_ACCESS_TOKEN = 'EAAtest-token-not-real-0123456789'
  delete process.env.META_CAPI_TEST_EVENT_CODE
})

import { metaCapiMode } from './meta-capi.js'

describe('Meta Conversions API on a development server', () => {
  it('stays off without a test events code, so local fake purchases never reach the live pixel', () => {
    expect(metaCapiMode()).toBe('off')
  })
})
