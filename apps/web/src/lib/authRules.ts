import { EMAIL_PATTERN } from '../components/checkout/checkoutData'

/* Account field rules shared by sign-up and the account page. They mirror the
   API's own limits, so the browser and the server never disagree. */

export const AUTH_MAX = { name: 80, email: 254, password: 200 }
export const MIN_PASSWORD = 10

export function nameError(value: string): string | undefined {
  return value.trim().length < 2 ? 'Enter your full name.' : undefined
}

export function emailError(value: string): string | undefined {
  const email = value.trim()
  if (!email) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address, like name@example.com.'
  return undefined
}

/** For choosing a password, not for typing an existing one. */
export function newPasswordError(value: string): string | undefined {
  if (!value) return 'Choose a password.'
  if (value.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`
  return undefined
}
