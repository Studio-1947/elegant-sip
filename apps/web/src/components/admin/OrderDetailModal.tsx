import type { AdminOrderDetail } from '../../lib/api'
import { formatDateTime } from '../../lib/dates'
import { escapeHtml, openPrintWindow, POPUP_BLOCKED_MESSAGE, writePrintDocument } from '../../lib/printWindow'
import RefundPanel from './RefundPanel'
import ShipmentPanel from './ShipmentPanel'
import { primaryButton } from './adminUi'
import { useFeedback } from './ui/Feedback'
import Modal from './ui/Modal'

/** Fulfilment detail for one order: delivery, customer, pack list, shipment, refund, packing slip. */
export default function OrderDetailModal({
  detail,
  onClose,
  onChanged,
}: {
  detail: AdminOrderDetail | null
  onClose: () => void
  onChanged: () => void
}) {
  const { toast } = useFeedback()
  const printSlip = () => {
    if (!detail) return
    const popup = openPrintWindow()
    if (!popup) {
      toast({ tone: 'error', text: POPUP_BLOCKED_MESSAGE })
      return
    }
    const safe = escapeHtml
    // eslint-disable-next-line no-useless-escape -- preserves a literal closing script tag in generated print HTML.
    writePrintDocument(popup, `<!doctype html><title>Packing slip ${safe(detail.number)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#182518}h1{font-size:24px}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}.muted{color:#526052;font-size:12px}</style><h1>Elegant Sip — Packing Slip</h1><p><b>${safe(detail.number)}</b><br><span class="muted">Placed ${safe(formatDateTime(detail.placedAt))}</span></p><h2>Deliver to</h2><p>${safe(detail.shipping.name)}<br>${safe(detail.shipping.line1)}<br>${safe(detail.shipping.city)}, ${safe(detail.shipping.state ?? '')} ${safe(detail.shipping.postalCode)}<br>${safe(detail.shipping.country)}${detail.phone ? `<br>${safe(detail.phone)}` : ''}</p><h2>Items</h2><table><thead><tr><th>Tea</th><th>Pack</th><th>Qty</th></tr></thead><tbody>${detail.items.map((item) => `<tr><td>${safe(item.productName)}</td><td>${safe(item.variantSize)}</td><td>${item.quantity}</td></tr>`).join('')}</tbody></table>${detail.notes ? `<p><b>Customer note:</b> ${safe(detail.notes)}</p>` : ''}<script>window.onload=()=>window.print()<\/script>`)
  }

  return (
    <Modal
      open={detail !== null}
      onClose={onClose}
      size="lg"
      eyebrow="Fulfilment detail"
      title={<span className="font-mono">{detail?.number}</span>}
      footer={
        <button onClick={printSlip} className={primaryButton}>
          🖨 Print packing slip
        </button>
      }
    >
      {detail && (
        <div className="adm-rise">
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#1b261b]/[0.07]">
              <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#4a7333]">Deliver to</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1b261b]">
                <b>{detail.shipping.name}</b>
                <br />
                {detail.shipping.line1}
                <br />
                {detail.shipping.city}
                {detail.shipping.state ? `, ${detail.shipping.state}` : ''} {detail.shipping.postalCode}
                <br />
                <span className="text-[#4a584a]">{detail.shipping.country}</span>
              </p>
            </section>
            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#1b261b]/[0.07]">
              <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#4a7333]">Customer</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1b261b]">
                {detail.email}
                <br />
                {detail.phone ?? <span className="text-[#4a584a]">No phone supplied</span>}
                <br />
                <span className="text-[#4a584a]">Placed {formatDateTime(detail.placedAt)}</span>
              </p>
            </section>
          </div>
          <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#1b261b]/[0.07]">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#4a7333]">Pack list</h3>
            <ul className="mt-2 divide-y divide-[#1b261b]/[0.07]">
              {detail.items.map((item, index) => (
                <li key={`${item.productName}-${index}`} className="flex justify-between gap-4 py-2.5 text-sm">
                  <span>
                    {item.productName} <span className="text-[#4a584a]">· {item.variantSize}</span>
                  </span>
                  <b className="rounded-lg bg-[#8bb56e]/15 px-2 font-mono text-[#315b26]">×{item.quantity}</b>
                </li>
              ))}
            </ul>
          </section>
          {detail.notes && (
            <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
              <b>Customer note:</b> {detail.notes}
            </p>
          )}
          <ShipmentPanel orderNumber={detail.number} orderStatus={detail.status} onChanged={onChanged} />
          <RefundPanel orderNumber={detail.number} onChanged={onChanged} />
        </div>
      )}
    </Modal>
  )
}
