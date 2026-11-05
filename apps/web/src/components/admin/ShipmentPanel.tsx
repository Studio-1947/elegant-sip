import { useCallback, useEffect, useState } from 'react'
import { ApiClientError, api, type AdminOrderStatus, type AdminShipment, type CourierOption } from '../../lib/api'
import { formatINR } from '../../lib/currency'

const STATUS_LABELS: Record<string, string> = {
  created: 'Booking started',
  awb_assigned: 'AWB assigned',
  pickup_scheduled: 'Pickup scheduled',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  exception: 'Needs attention',
  rto: 'Returning to origin',
  cancelled: 'Cancelled',
}

const formatWhen = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

/**
 * Courier booking for one order: rates, booking (AWB + pickup + label),
 * tracking refresh and cancellation. The API does every courier call; this
 * panel only shows what came back.
 */
export default function ShipmentPanel({
  orderNumber,
  orderStatus,
  onChanged,
}: {
  orderNumber: string
  orderStatus: AdminOrderStatus
  onChanged: () => void
}) {
  const [provider, setProvider] = useState<string | null>(null)
  const [shipment, setShipment] = useState<AdminShipment | null>(null)
  const [phone, setPhone] = useState('')
  const [hasPhone, setHasPhone] = useState(false)
  const [couriers, setCouriers] = useState<CourierOption[] | null>(null)
  const [courierId, setCourierId] = useState<number | null>(null)
  const [weight, setWeight] = useState<number | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const run = useCallback(async (label: string, action: () => Promise<void>) => {
    setBusy(label)
    setMessage(null)
    try {
      await action()
    } catch (cause) {
      setMessage(cause instanceof ApiClientError ? cause.message : 'The courier request failed.')
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api.admin
      .shipment(orderNumber)
      .then((result) => {
        if (cancelled) return
        setProvider(result.provider)
        setShipment(result.shipment)
        setHasPhone(Boolean(result.phone))
        setPhone(result.phone ?? '')
      })
      .catch((cause) => {
        if (!cancelled) setMessage(cause instanceof ApiClientError ? cause.message : 'Shipment details could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [orderNumber])

  if (provider === null) return <p className="mt-6 text-xs text-[#4a584a]">{message ?? 'Loading shipment…'}</p>

  if (provider === 'manual') {
    return (
      <section className="mt-6 rounded-xl border border-[#1b261b]/10 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider">Courier</h3>
        <p className="mt-2 text-xs text-[#4a584a]">Shiprocket is not connected (SHIPPING_PROVIDER=manual). Use “Add tracking &amp; ship” in the queue.</p>
      </section>
    )
  }

  const active = shipment && shipment.status !== 'cancelled'
  const canBook = ['paid', 'packed'].includes(orderStatus) && (!active || !shipment.awb || !shipment.pickupScheduledAt)
  const canCancel = active && ['created', 'awb_assigned', 'pickup_scheduled'].includes(shipment.status)

  const loadRates = () =>
    run('rates', async () => {
      const result = await api.admin.courierRates(orderNumber)
      setCouriers(result.couriers)
      setWeight(result.weightGrams)
      setCourierId(result.recommendedCourierId ?? result.couriers[0]?.courierId ?? null)
    })

  const book = () =>
    run('book', async () => {
      const result = await api.admin.bookShipment(orderNumber, {
        ...(courierId ? { courierId } : {}),
        ...(!hasPhone || phone.trim() ? { phone: phone.trim() } : {}),
      })
      setShipment(result.shipment)
      setCouriers(null)
      setHasPhone(true)
      onChanged()
    })

  const sync = () =>
    run('sync', async () => {
      setShipment((await api.admin.syncShipment(orderNumber)).shipment)
      onChanged()
    })

  const cancel = () =>
    run('cancel', async () => {
      setShipment((await api.admin.cancelShipment(orderNumber)).shipment)
      onChanged()
    })

  const button = 'rounded-full px-3.5 py-2 text-[10px] font-mono font-bold uppercase tracking-wider disabled:opacity-50'

  return (
    <section className="mt-6 rounded-xl border border-[#1b261b]/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          Courier {provider === 'fake' && <span className="ml-1 font-mono text-[10px] text-amber-700">(test mode)</span>}
        </h3>
        {active && (
          <span className="rounded-full border border-[#1b261b]/15 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider">
            {STATUS_LABELS[shipment.status] ?? shipment.status}
          </span>
        )}
      </div>

      {active && (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <dt className="text-[#4a584a]">Courier</dt><dd className="font-bold">{shipment.courierName ?? '—'}</dd>
          <dt className="text-[#4a584a]">AWB</dt><dd className="font-mono">{shipment.awb ?? '—'}</dd>
          <dt className="text-[#4a584a]">Weight</dt><dd>{shipment.weightGrams} g</dd>
          <dt className="text-[#4a584a]">Pickup</dt><dd>{formatWhen(shipment.pickupScheduledAt)}</dd>
          <dt className="text-[#4a584a]">Expected delivery</dt><dd>{formatWhen(shipment.expectedDeliveryAt)}</dd>
          {shipment.providerStatus && <><dt className="text-[#4a584a]">Courier says</dt><dd>{shipment.providerStatus}</dd></>}
          <dt className="text-[#4a584a]">Last synced</dt><dd>{formatWhen(shipment.lastSyncedAt)}</dd>
        </dl>
      )}

      {active && shipment.lastError && (
        <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">Last step failed: {shipment.lastError}</p>
      )}

      {active && shipment.events.length > 0 && (
        <ol className="mt-4 max-h-48 space-y-2 overflow-y-auto border-l border-[#1b261b]/10 pl-4">
          {[...shipment.events].reverse().map((event) => (
            <li key={`${event.at}-${event.status}`} className="text-xs">
              <p className="font-bold">{event.status}{event.location ? ` · ${event.location}` : ''}</p>
              <p className="text-[#4a584a]">{formatWhen(event.at)}{event.detail && event.detail !== event.status ? ` — ${event.detail}` : ''}</p>
            </li>
          ))}
        </ol>
      )}

      {canBook && (
        <div className="mt-4 space-y-3 rounded-lg bg-[#f9faf7] p-3">
          {!hasPhone && (
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">
              Customer mobile (required by couriers)
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={16} placeholder="98300 12345" className="mt-1.5 block w-full rounded-lg border border-[#1b261b]/15 bg-white px-3 py-2 text-sm normal-case tracking-normal" />
            </label>
          )}
          {couriers === null ? (
            <button onClick={loadRates} disabled={busy !== null} className={`${button} border border-[#1b261b]/20 hover:border-[#8bb56e]`}>
              {busy === 'rates' ? 'Checking…' : 'Compare courier rates'}
            </button>
          ) : couriers.length === 0 ? (
            <p className="text-xs text-rose-700">No courier services this pincode.</p>
          ) : (
            <fieldset>
              <legend className="text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">Choose courier · parcel {weight} g</legend>
              <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
                {couriers.map((courier) => (
                  <label key={courier.courierId} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#1b261b]/10 bg-white px-3 py-2 text-xs">
                    <span className="flex items-center gap-2">
                      <input type="radio" name={`courier-${orderNumber}`} checked={courierId === courier.courierId} onChange={() => setCourierId(courier.courierId)} />
                      {courier.courierName}
                    </span>
                    <span className="text-right text-[#4a584a]">
                      <b className="text-[#1b261b]">{formatINR(courier.rate)}</b>
                      {courier.estimatedDays !== null && ` · ${courier.estimatedDays}d`}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <button
            onClick={book}
            disabled={busy !== null || (!hasPhone && !phone.trim())}
            className={`${button} bg-[#4a7333] text-white hover:bg-[#3b5c29]`}
          >
            {busy === 'book' ? 'Booking…' : active ? 'Retry booking' : couriers ? 'Book selected courier' : 'Book recommended courier'}
          </button>
        </div>
      )}

      {!canBook && !active && <p className="mt-3 text-xs text-[#4a584a]">Courier booking opens once the order is paid.</p>}

      {message && <p role="alert" className="mt-3 text-xs text-rose-700">{message}</p>}

      {active && (
        <div className="mt-4 flex flex-wrap gap-2">
          {shipment.labelUrl && <a href={shipment.labelUrl} target="_blank" rel="noreferrer" className={`${button} bg-[#1b261b] text-white hover:bg-[#4a7333]`}>Download label</a>}
          {shipment.trackingUrl && <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className={`${button} border border-[#1b261b]/20`}>Courier tracking</a>}
          {shipment.awb && <button onClick={sync} disabled={busy !== null} className={`${button} border border-[#1b261b]/20 hover:border-[#8bb56e]`}>{busy === 'sync' ? 'Syncing…' : 'Refresh tracking'}</button>}
          {canCancel && <button onClick={cancel} disabled={busy !== null} className={`${button} border border-rose-200 text-rose-700 hover:bg-rose-50`}>{busy === 'cancel' ? 'Cancelling…' : 'Cancel shipment'}</button>}
        </div>
      )}
    </section>
  )
}
