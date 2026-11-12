import { env } from '../env.js'
import { sendEmail } from './email.js'

/**
 * A heads-up to the shop inbox for something a person has to act on: a
 * parcel coming back, a courier problem, money that must be refunded.
 *
 * Never throws. The alert is about work that has already happened, and
 * failing to send it must not undo or fail that work.
 */
export async function alertStaff(alert: { subject: string; body: string[]; facts?: [string, string][] }): Promise<void> {
  if (!env.CONTACT_INBOX) return
  try {
    await sendEmail({ to: env.CONTACT_INBOX, subject: `[Staff] ${alert.subject}`, heading: alert.subject, body: alert.body, facts: alert.facts })
  } catch (error) {
    console.error('[alert] staff alert failed', { subject: alert.subject, error })
  }
}
