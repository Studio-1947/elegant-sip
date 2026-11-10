import type { OrderView } from './api'
import { formatDayMonth } from './dates'

/** Customer-facing wording for courier shipment states. */
export const SHIPMENT_LABELS: Record<string, string> = {
  awb_assigned: 'Preparing to ship',
  pickup_scheduled: 'Awaiting courier pickup',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  exception: 'Delivery delayed',
  rto: 'Returning to us',
}

export const shipmentLabel = (status: string) => SHIPMENT_LABELS[status] ?? status.replaceAll('_', ' ')

/** States where something has gone wrong and the customer may want to get in touch. */
export const isShipmentProblem = (status: string) => status === 'exception' || status === 'rto'

/**
 * One short line for an order list: where the parcel is now, plus when it is
 * expected. Null when there is no live courier shipment, or once delivered
 * (the order badge already says so).
 */
export function shipmentSummary(order: Pick<OrderView, 'status' | 'shipment'>): string | null {
  const shipment = order.shipment
  if (!shipment || shipment.status === 'delivered' || ['delivered', 'cancelled', 'refunded'].includes(order.status)) return null
  const expected =
    shipment.expectedDeliveryAt && !isShipmentProblem(shipment.status)
      ? ` · expected ${formatDayMonth(shipment.expectedDeliveryAt)}`
      : ''
  return `${shipmentLabel(shipment.status)}${expected}`
}
