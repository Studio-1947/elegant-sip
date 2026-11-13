import { useCallback, useEffect, useState } from 'react'
import { api, type AdminOrderDetail } from '../../lib/api'
import { adminApi } from '../../lib/adminApi'
import { formatDateTime } from '../../lib/dates'
import { invoiceHtml } from '../../lib/invoicePrint'
import { escapeHtml, openPrintWindow, POPUP_BLOCKED_MESSAGE, writePrintDocument } from '../../lib/printWindow'
import RefundPanel from './RefundPanel'
import ShipmentPanel from './ShipmentPanel'
import { StatusPill } from './OrdersPanel'
import { AddressLines, Card, DeliveryCard, MoneyCard, PaymentCard, StaffNotes } from './OrderDetailSections'
import { errorText, primaryButton, quietButton } from './adminUi'
import { useFeedback } from './ui/Feedback'
import Modal from './ui/Modal'
import { Spinner } from './ui/controls'

/**
 * The full order: who, where, what and for how much, payment, any request,
 * staff notes, then courier and refunds. Loads by number, so Orders, Returns
 * and Customers can all open it.
 */
export default function OrderDetailModal({
  number,
  onClose,
  onChanged,
}: {
  number: string | null
  onClose: () => void
  /** Something on the order changed (status, refund, shipment). */
  onChanged: () => void
}) {
  const { toast } = useFeedback()
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null)
  const [resending, setResending] = useState(false)

  const load = useCallback(
    (which: string) =>
      api.admin
        .getOrder(which)
        .then(setDetail)
        .catch((cause) => {
          toast({ tone: 'error', text: errorText(cause, 'Order detail could not be loaded.') })
          onClose()
        }),
    [toast, onClose],
  )

  useEffect(() => {
    if (number) void load(number)
  }, [number, load])

  const reload = () => {
    if (number) void load(number)
  }
  const changed = () => {
    reload()
    onChanged()
  }
  const close = () => {
    setDetail(null)
    onClose()
  }

  const printSlip = () => {
    if (!detail) return
    const popup = openPrintWindow()
    if (!popup) return toast({ tone: 'error', text: POPUP_BLOCKED_MESSAGE })
    const safe = escapeHtml
    const s = detail.shipping
    // eslint-disable-next-line no-useless-escape -- preserves a literal closing script tag in generated print HTML.
    writePrintDocument(popup, `<!doctype html><title>Packing slip ${safe(detail.number)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#182518}h1{font-size:24px}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}.muted{color:#526052;font-size:12px}</style><h1>Elegant Sip — Packing Slip</h1><p><b>${safe(detail.number)}</b><br><span class="muted">Placed ${safe(formatDateTime(detail.placedAt))}</span></p><h2>Deliver to</h2><p>${safe(s.name)}<br>${safe(s.line1)}<br>${safe(s.city)}, ${safe(s.state ?? '')} ${safe(s.postalCode)}<br>${safe(s.country)}${detail.phone ? `<br>${safe(detail.phone)}` : ''}</p><h2>Items</h2><table><thead><tr><th>Tea</th><th>Pack</th><th>Qty</th></tr></thead><tbody>${detail.items.map((item) => `<tr><td>${safe(item.productName)}</td><td>${safe(item.variantSize)}</td><td>${item.quantity}</td></tr>`).join('')}</tbody></table>${detail.notes ? `<p><b>Customer note:</b> ${safe(detail.notes)}</p>` : ''}<script>window.onload=()=>window.print()<\/script>`)
  }

  const printInvoice = async () => {
    if (!detail) return
    const popup = openPrintWindow()
    if (!popup) return toast({ tone: 'error', text: POPUP_BLOCKED_MESSAGE })
    try {
      const { invoice } = await adminApi.invoice(detail.number)
      writePrintDocument(popup, invoiceHtml(invoice))
    } catch (cause) {
      popup.close()
      toast({ tone: 'error', text: errorText(cause, 'The invoice could not be loaded.') })
    }
  }

  const resend = async () => {
    if (!detail) return
    setResending(true)
    try {
      const { delivered } = await adminApi.resendConfirmation(detail.number)
      toast({ tone: delivered ? 'ok' : 'info', text: delivered ? `Confirmation sent to ${detail.email}.` : 'The email could not be sent now; it is queued for a retry (see Settings → Email outbox).' })
    } catch (cause) {
      toast({ tone: 'error', text: errorText(cause, 'The confirmation could not be sent.') })
    } finally {
      setResending(false)
    }
  }

  const paid = detail && ['paid', 'packed', 'shipped', 'delivered'].includes(detail.status)
  const request = detail?.returnRequest
  return (
    <Modal
      open={number !== null}
      onClose={close}
      size="xl"
      eyebrow="Order"
      title={<span className="font-mono">{number}</span>}
      footer={
        detail && (
          <div className="flex w-full flex-wrap justify-end gap-2">
            {paid && (
              <button onClick={() => void resend()} disabled={resending} className={quietButton}>
                {resending ? <Spinner className="h-3.5 w-3.5" /> : '✉'} Resend confirmation
              </button>
            )}
            {detail.invoiceNumber && (
              <button onClick={() => void printInvoice()} className={quietButton}>
                🧾 Print invoice
              </button>
            )}
            <button onClick={printSlip} className={primaryButton}>
              🖨 Packing slip
            </button>
          </div>
        )
      }
    >
      {!detail || detail.number !== number ? (
        <div className="grid h-40 place-items-center text-[#4a7333]">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="adm-rise">
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#4a584a]">
            <StatusPill status={detail.status} />
            <span>Placed {formatDateTime(detail.placedAt)}</span>
            {detail.paidAt && <span>Paid {formatDateTime(detail.paidAt)}</span>}
            {detail.shippedAt && <span>Shipped {formatDateTime(detail.shippedAt)}</span>}
            {detail.cancelledAt && <span className="text-rose-700">Cancelled {formatDateTime(detail.cancelledAt)}</span>}
          </div>

          {request && (
            <div className={`mb-4 rounded-2xl p-4 text-sm ring-1 ${request.status === 'requested' ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-[#f4f6f1] text-[#1b261b] ring-[#1b261b]/10'}`}>
              <b className="capitalize">{request.type} request · {request.status}</b> <span className="text-xs opacity-75">({formatDateTime(request.requestedAt)})</span>
              <p className="mt-1">“{request.reason}”</p>
              {request.staffNote && <p className="mt-1 text-xs">Our note: {request.staffNote}</p>}
              {request.status === 'requested' && <p className="mt-1 text-xs">Decide it in the Returns tab.</p>}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Card title="Customer">
              {detail.customer ? <b>{detail.customer.name}</b> : <span className="text-[#4a584a]">Guest checkout</span>}
              <br />
              <a href={`mailto:${detail.email}?subject=${encodeURIComponent(`Your order ${detail.number}`)}`} className="break-all text-[#4a7333] hover:underline">
                {detail.email}
              </a>
              <br />
              {detail.phone ? <a href={`tel:${detail.phone}`} className="hover:underline">{detail.phone}</a> : <span className="text-[#4a584a]">No phone</span>}
            </Card>
            <DeliveryCard key={JSON.stringify(detail.shipping) + detail.phone} detail={detail} onSaved={reload} />
            <PaymentCard detail={detail} />
          </div>

          {JSON.stringify(detail.billing) !== JSON.stringify(detail.shipping) && (
            <Card title="Bill to" className="mt-4">
              <AddressLines address={detail.billing} />
            </Card>
          )}

          <MoneyCard detail={detail} />

          {detail.notes && (
            <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
              <b>Customer note:</b> {detail.notes}
            </p>
          )}
          <StaffNotes key={detail.staffNotes ?? ''} detail={detail} onSaved={reload} />

          <ShipmentPanel orderNumber={detail.number} orderStatus={detail.status} onChanged={changed} />
          <RefundPanel orderNumber={detail.number} onChanged={changed} />
        </div>
      )}
    </Modal>
  )
}
