import { API_BASE, ApiClientError, orderParams, request, type AdminOrderQuery, type AdminOrderStatus, type StockReason } from './api'

/* ────────────────────────────────────────────────────────────────────────────
 * Staff page: inventory, customers, reports, inboxes and order tools.
 * Kept apart from api.ts so the storefront bundle does not carry it.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface InventoryRow {
  productSlug: string
  productName: string
  productStatus: 'active' | 'coming-soon'
  retired: boolean
  size: string
  sku: string
  price: number
  /** What can still be sold. */
  stock: number
  /** Held by unpaid checkouts (already taken off `stock`). */
  held: number
  weightGrams: number
  weightIsSet: boolean
  low: boolean
}

export interface LedgerEntry {
  id: string
  at: string
  productSlug: string
  productName: string
  size: string
  delta: number
  reason: StockReason | 'seed' | 'order_reserved' | 'order_released' | 'order_fulfilled'
  note: string | null
  orderNumber: string | null
}

export interface AdminCustomer {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'customer' | 'admin'
  emailVerified: boolean
  mfaEnabled: boolean
  createdAt: string
  orderCount: number
  totalSpent: number
  lastOrderAt: string | null
}

export interface AdminCustomerDetail extends AdminCustomer {
  addresses: { label: string; name: string; line1: string; city: string; postalCode: string; state: string | null; phone: string | null }[]
  orders: { number: string; status: AdminOrderStatus; placedAt: string; total: number }[]
}

export interface ContactMessage {
  id: string
  reference: string
  name: string
  email: string
  subject: string
  message: string
  createdAt: string
  hasAccount: boolean
}

export interface SalesReport {
  from: string
  to: string
  orders: number
  units: number
  gross: number
  subtotal: number
  discount: number
  shipping: number
  tax: number
  refunds: number
  net: number
  averageOrder: number
  gst: { invoices: number; cgst: number; sgst: number; igst: number }
  byDay: { day: string; orders: number; gross: number }[]
  topProducts: { productSlug: string; productName: string; units: number; revenue: number }[]
}

const qs = (query: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v))
  const text = params.toString()
  return text ? `?${text}` : ''
}
const send = <T>(method: 'POST' | 'PUT' | 'PATCH', path: string, payload: unknown) => request<T>(path, { method, body: JSON.stringify(payload) })

export const adminApi = {
  inventory: () => request<{ threshold: number; variants: InventoryRow[] }>('/v1/admin/inventory'),
  ledger: (query: { productSlug?: string; size?: string; reason?: string; limit?: number; offset?: number } = {}) =>
    request<{ entries: LedgerEntry[]; hasMore: boolean }>(`/v1/admin/stock/ledger${qs(query)}`),

  staffNotes: (number: string, staffNotes: string) =>
    send<{ staffNotes: string | null }>('PUT', `/v1/admin/orders/${encodeURIComponent(number)}/staff-notes`, { staffNotes }),
  updateAddress: (
    number: string,
    change: Partial<{ name: string; line1: string; city: string; postalCode: string; state: string | null; phone: string | null }>,
  ) => send<{ ok: true }>('PATCH', `/v1/admin/orders/${encodeURIComponent(number)}/address`, change),
  resendConfirmation: (number: string) => send<{ delivered: boolean }>('POST', `/v1/admin/orders/${encodeURIComponent(number)}/resend-confirmation`, {}),
  /** The staff copy of an order's GST invoice (same shape the customer gets). */
  invoice: (number: string) => request<{ invoice: import('./api').InvoiceView }>(`/v1/admin/orders/${encodeURIComponent(number)}/invoice`),

  customers: (query: { q?: string; role?: 'customer' | 'admin'; limit?: number; offset?: number } = {}) =>
    request<{ customers: AdminCustomer[]; total: number }>(`/v1/admin/customers${qs(query)}`),
  customer: (id: string) => request<AdminCustomerDetail>(`/v1/admin/customers/${encodeURIComponent(id)}`),
  setRole: (id: string, role: 'customer' | 'admin') => send<{ id: string; role: 'customer' | 'admin' }>('PATCH', `/v1/admin/customers/${encodeURIComponent(id)}/role`, { role }),

  contactMessages: (query: { q?: string; limit?: number; offset?: number } = {}) =>
    request<{ messages: ContactMessage[]; total: number }>(`/v1/admin/contact-messages${qs(query)}`),
  newsletter: () =>
    request<{ subscribers: { email: string; subscribedAt: string; unsubscribedAt: string | null }[]; total: number; active: number }>(
      '/v1/admin/newsletter-subscribers?limit=5000',
    ),

  sales: (query: { from?: string; to?: string } = {}) => request<SalesReport>(`/v1/admin/reports/sales${qs(query)}`),
}

/** Downloads the order CSV with the current filters (the session cookie authorises it). */
export async function downloadOrdersCsv(query: Omit<AdminOrderQuery, 'limit' | 'offset'>): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/v1/admin/orders/export.csv?${orderParams(query)}`, { credentials: 'include' })
  } catch {
    throw new ApiClientError(0, 'network_error', 'Could not reach the shop to export orders.')
  }
  if (!response.ok) throw new ApiClientError(response.status, 'export_failed', 'The export could not be created.')
  saveBlob(await response.blob(), `elegant-sip-orders-${today()}.csv`)
}

/** A CSV built in the browser (inventory, newsletter) saved as a file. */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]): void {
  const cell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value)
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
    return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
  }
  const body = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
  saveBlob(new Blob([String.fromCharCode(0xfeff), body, '\r\n'], { type: 'text/csv;charset=utf-8' }), filename)
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Today in India, YYYY-MM-DD. */
export const today = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10)
