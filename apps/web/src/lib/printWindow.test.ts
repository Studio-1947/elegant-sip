import { afterEach, describe, expect, it, vi } from 'vitest'
import { invoiceHtml } from './invoicePrint'
import { openPrintWindow, writePrintDocument } from './printWindow'
import type { InvoiceView } from './api'

const fakeWindow = () => {
  const written: string[] = []
  return {
    written,
    win: {
      opener: {} as unknown,
      close: vi.fn(),
      document: { open: vi.fn(() => written.splice(0)), write: vi.fn((html: string) => written.push(html)), close: vi.fn() },
    },
  }
}

afterEach(() => vi.restoreAllMocks())

describe('print windows', () => {
  it('opens a window it can write to (never with noopener, which returns null)', () => {
    const { win, written } = fakeWindow()
    const open = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    const popup = openPrintWindow()
    expect(popup).toBe(win)
    expect(open).toHaveBeenCalledWith('', '_blank', expect.not.stringContaining('noopener'))
    // The new window cannot reach back into the shop.
    expect(win.opener).toBeNull()
    expect(written.join('')).toContain('Loading')

    writePrintDocument(popup!, '<p>Invoice</p>')
    expect(written).toEqual(['<p>Invoice</p>'])
    expect(win.document.close).toHaveBeenCalled()
  })

  it('reports a blocked pop-up instead of failing silently', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    expect(openPrintWindow()).toBeNull()
  })
})

describe('invoice document', () => {
  const invoice: InvoiceView = {
    number: 'ES/2026-27/0001',
    issuedAt: '2026-11-10T06:00:00.000Z',
    isTaxInvoice: true,
    sellerGstin: '19ABCDE1234F1Z5',
    placeOfSupply: 'West Bengal',
    hsn: '0902',
    taxRatePercent: 5,
    lines: [{ description: 'First Flush (100 g)', quantity: 2, unitPrice: '₹430.50', lineTotal: '₹861.00' }],
    totals: { subtotal: '₹861.00', discount: '₹0.00', shipping: 'Free', cgst: '₹20.50', sgst: '₹20.50', igst: null, total: '₹861.00' },
    buyer: { name: '<img src=x onerror=alert(1)>', line1: '12 Mall Road', city: 'Darjeeling', postalCode: '734101', state: 'West Bengal' },
  }

  it('shows the invoice number, lines and split GST, and opens the print dialog', () => {
    const html = invoiceHtml(invoice)
    expect(html).toContain('Tax Invoice')
    expect(html).toContain('ES/2026-27/0001')
    expect(html).toContain('First Flush (100 g)')
    expect(html).toContain('Includes CGST (2.5%)')
    expect(html).not.toContain('IGST')
    expect(html).toContain('window.print()')
  })

  it('escapes customer-entered text', () => {
    const html = invoiceHtml(invoice)
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})
