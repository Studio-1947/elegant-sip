import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from '../AuthContext'

const api = vi.hoisted(() => ({
  auth: { updateName: vi.fn(), changePassword: vi.fn(), changeEmail: vi.fn(), resendVerification: vi.fn() },
}))
const mfaApi = vi.hoisted(() => ({ status: vi.fn(), setup: vi.fn(), confirm: vi.fn(), disable: vi.fn() }))
const credentialsApi = vi.hoisted(() => ({ requestCode: vi.fn(), add: vi.fn() }))
vi.mock('../../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/api')>()), api, mfaApi, credentialsApi }))
const methods = vi.hoisted(() => ({ whatsapp: false }))
vi.mock('../../lib/authMethods', () => ({ cachedAuthMethods: () => ({ ...methods }), loadAuthMethods: async () => ({ ...methods }) }))
const auth = vi.hoisted(() => ({
  state: {
    user: null as User | null,
    applyUser: vi.fn(),
    logoutEverywhere: vi.fn(),
    refresh: vi.fn(),
  },
}))
vi.mock('../AuthContext', () => ({ useAuth: () => auth.state }))

import AccountSettingsSection from './AccountSettingsSection'
import { ApiClientError } from '../../lib/api'

const emailUser: User = {
  id: '7e3c6a0e-0000-4000-8000-000000000001',
  name: 'Asha Rai',
  email: 'asha@example.com',
  role: 'customer',
  emailVerified: true,
  emailIsPlaceholder: false,
  nameIsPlaceholder: false,
  phone: null,
}

const whatsappUser: User = {
  ...emailUser,
  name: 'Tea Lover',
  email: 'whatsapp-9876543210@whatsapp.elegantsip.invalid',
  emailVerified: false,
  emailIsPlaceholder: true,
  nameIsPlaceholder: true,
  phone: '+919876543210',
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.state.user = emailUser
  methods.whatsapp = false
})

describe('account settings: name', () => {
  it('saves the name and hands the new user to the auth state', async () => {
    const updated = { ...emailUser, name: 'Asha R. Rai' }
    api.auth.updateName.mockResolvedValue({ user: updated })
    const user = userEvent.setup()
    render(<AccountSettingsSection />)
    const input = screen.getByLabelText('Full name')
    await user.clear(input)
    await user.type(input, '  Asha R. Rai ')
    await user.click(screen.getByRole('button', { name: 'Save name' }))
    expect(api.auth.updateName).toHaveBeenCalledWith('Asha R. Rai')
    expect(auth.state.applyUser).toHaveBeenCalledWith(updated)
    expect(await screen.findByText('Your name has been saved.')).toBeTruthy()
  })

  it('refuses a one-letter name without calling the API', async () => {
    const user = userEvent.setup()
    render(<AccountSettingsSection />)
    const input = screen.getByLabelText('Full name')
    await user.clear(input)
    await user.type(input, 'A')
    await user.click(screen.getByRole('button', { name: 'Save name' }))
    expect(await screen.findByText('Enter your full name.')).toBeTruthy()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(api.auth.updateName).not.toHaveBeenCalled()
  })
})

describe('account settings: password', () => {
  it('applies the sign-up length rule before calling the API', async () => {
    const user = userEvent.setup()
    render(<AccountSettingsSection />)
    await user.type(screen.getAllByLabelText('Current password')[1], 'old-password-123')
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Use at least 10 characters.')).toBeTruthy()
    expect(api.auth.changePassword).not.toHaveBeenCalled()
  })

  it("shows the API's reason verbatim when the current password is wrong", async () => {
    api.auth.changePassword.mockRejectedValue(new ApiClientError(401, 'invalid_credentials', 'That is not your current password.'))
    const user = userEvent.setup()
    render(<AccountSettingsSection />)
    await user.type(screen.getAllByLabelText('Current password')[1], 'wrong-password-1')
    await user.type(screen.getByLabelText('New password'), 'a-much-longer-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('That is not your current password.')).toBeTruthy()
    expect(api.auth.changePassword).toHaveBeenCalledWith({ currentPassword: 'wrong-password-1', newPassword: 'a-much-longer-password' })
    expect(auth.state.refresh).not.toHaveBeenCalled()
  })

  it('mentions the notice email only as far as it went out', async () => {
    const user = userEvent.setup()
    render(<AccountSettingsSection />)
    const change = async (delivered: boolean) => {
      api.auth.changePassword.mockResolvedValueOnce({ ok: true, delivered })
      await user.type(screen.getAllByLabelText('Current password')[1], 'old-password-123')
      await user.type(screen.getByLabelText('New password'), 'a-much-longer-password')
      await user.click(screen.getByRole('button', { name: 'Change password' }))
      return screen.findByText(/Password changed/)
    }
    expect((await change(false)).textContent).toMatch(/could not email you/)
    expect((await change(true)).textContent).toMatch(/We emailed you a note/)
  })
})

describe('account settings: email', () => {
  const changeTo = async (newEmail: string) => {
    const user = userEvent.setup()
    render(<AccountSettingsSection />)
    await user.type(screen.getByLabelText('New email'), newEmail)
    await user.type(screen.getAllByLabelText('Current password')[0], 'my-password-123')
    await user.click(screen.getByRole('button', { name: 'Change email' }))
    return screen.findByText(new RegExp(`Your account email is now ${newEmail.replace(/\./g, '\\.')}`))
  }

  it('changes the address and says the confirmation was sent when it was', async () => {
    const updated = { ...emailUser, email: 'asha.rai@example.com', emailVerified: false }
    api.auth.changeEmail.mockResolvedValue({ user: updated, delivered: true })
    const message = await changeTo('asha.rai@example.com')
    expect(api.auth.changeEmail).toHaveBeenCalledWith({ newEmail: 'asha.rai@example.com', currentPassword: 'my-password-123' })
    expect(auth.state.applyUser).toHaveBeenCalledWith(updated)
    expect(message.textContent).toMatch(/We sent a confirmation link/)
  })

  it('does not claim the confirmation was sent when the API says it was not', async () => {
    api.auth.changeEmail.mockResolvedValue({ user: { ...emailUser, email: 'asha.rai@example.com', emailVerified: false }, delivered: false })
    const message = await changeTo('asha.rai@example.com')
    expect(message.textContent).toMatch(/could not be sent right now/)
    expect(message.textContent).not.toMatch(/We sent/)
  })

  it('offers a new confirmation link only while the address is unconfirmed', async () => {
    api.auth.resendVerification.mockResolvedValue({ ok: true, delivered: true })
    const { rerender } = render(<AccountSettingsSection />)
    expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).toBeNull()

    auth.state.user = { ...emailUser, emailVerified: false }
    rerender(<AccountSettingsSection />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
    expect(api.auth.resendVerification).toHaveBeenCalled()
    expect(await screen.findByText(/We sent a new confirmation link to asha@example\.com/)).toBeTruthy()
  })

  it('says so when the new link could not be sent', async () => {
    api.auth.resendVerification.mockResolvedValue({ ok: true, delivered: false })
    auth.state.user = { ...emailUser, emailVerified: false }
    const user = userEvent.setup()
    render(<AccountSettingsSection />)
    await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
    const message = await screen.findByText(/could not be sent right now/)
    expect(message.textContent).toMatch(/try again/)
    expect(screen.queryByText(/We sent/)).toBeNull()
  })
})

describe('account settings: WhatsApp-only accounts', () => {
  it('hides the email and password forms, which need a password this account never set', () => {
    auth.state.user = whatsappUser
    render(<AccountSettingsSection />)
    expect(screen.queryByLabelText('New email')).toBeNull()
    expect(screen.queryByLabelText('New password')).toBeNull()
    expect(screen.queryByLabelText('Current password')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).toBeNull()
    // Without WhatsApp codes they cannot be added here, and the card says so.
    expect(screen.getByText(/no email address or password yet/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send WhatsApp code' })).toBeNull()
    // The stand-in name is not prefilled as if it were theirs.
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('')
    expect(screen.getAllByText('+91 98765 43210').length).toBeGreaterThan(0)
  })

  it('adds an email and password after a WhatsApp code, and reports the confirmation honestly', async () => {
    methods.whatsapp = true
    auth.state.user = whatsappUser
    credentialsApi.requestCode.mockResolvedValue({ ok: true, challengeId: '7e3c6a0e-0000-4000-8000-0000000000aa' })
    const updated = { ...whatsappUser, email: 'asha@example.com', emailIsPlaceholder: false }
    credentialsApi.add.mockResolvedValue({ user: updated, delivered: false })
    const user = userEvent.setup()
    const { rerender } = render(<AccountSettingsSection />)

    await user.type(screen.getByLabelText('Email'), 'asha@example.com')
    await user.type(screen.getByLabelText('Choose a password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Send WhatsApp code' }))
    expect(await screen.findByText('Use at least 10 characters.')).toBeTruthy()
    expect(credentialsApi.requestCode).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Choose a password'), '-but-longer-now')
    await user.click(screen.getByRole('button', { name: 'Send WhatsApp code' }))
    expect(await screen.findByText(/We sent a 6-digit code to \+91 98765 43210/)).toBeTruthy()
    await user.type(screen.getByLabelText('6-digit WhatsApp code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Add email and password' }))

    await waitFor(() => expect(auth.state.applyUser).toHaveBeenCalledWith(updated))
    expect(credentialsApi.add).toHaveBeenCalledWith({
      challengeId: '7e3c6a0e-0000-4000-8000-0000000000aa',
      code: '123456',
      email: 'asha@example.com',
      password: 'short-but-longer-now',
    })
    // The notice outlives the card, which gives way to the normal email card.
    auth.state.user = { ...updated, emailVerified: false }
    rerender(<AccountSettingsSection />)
    const notice = await screen.findByText(/Email and password added/)
    expect(notice.textContent).toMatch(/could not be sent right now/)
    expect(screen.getByLabelText('New email')).toBeTruthy()
  })
})

describe('account settings: two-step sign-in (staff)', () => {
  const staff: User = { ...emailUser, role: 'admin' }

  it('is not offered to customers', () => {
    render(<AccountSettingsSection />)
    expect(screen.queryByText('Two-step sign-in')).toBeNull()
    expect(mfaApi.status).not.toHaveBeenCalled()
  })

  it('enrols: password, key, code, then recovery codes shown once with a copy button', async () => {
    auth.state.user = staff
    mfaApi.status.mockResolvedValue({ available: true, enabled: false, recoveryCodesLeft: 0 })
    mfaApi.setup.mockResolvedValue({ secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/Elegant%20Sip:a?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' })
    const codes = Array.from({ length: 10 }, (_, i) => `abcd${i}-fghij`)
    mfaApi.confirm.mockResolvedValue({ recoveryCodes: codes })
    const user = userEvent.setup()
    render(<AccountSettingsSection />)

    await user.click(await screen.findByRole('button', { name: 'Set up two-step sign-in' }))
    expect(await screen.findByText('Enter your current password.')).toBeTruthy()
    expect(mfaApi.setup).not.toHaveBeenCalled()

    await user.type(screen.getAllByLabelText('Current password')[2], 'my-password-123')
    await user.click(screen.getByRole('button', { name: 'Set up two-step sign-in' }))
    expect(mfaApi.setup).toHaveBeenCalledWith('my-password-123')
    expect(await screen.findByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Open it in your authenticator app/ }).getAttribute('href')).toMatch(/^otpauth:\/\//)

    await user.type(screen.getByLabelText('6-digit code'), '654321')
    await user.click(screen.getByRole('button', { name: 'Turn on' }))
    expect(mfaApi.confirm).toHaveBeenCalledWith('654321')
    const list = await screen.findByRole('list', { name: 'Recovery codes' })
    expect(list.textContent).toContain('abcd0-fghij')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(screen.getByRole('button', { name: 'Copy codes' }))
    expect(writeText).toHaveBeenCalledWith(codes.join('\n'))

    await user.click(screen.getByRole('button', { name: 'I have saved them' }))
    expect(screen.queryByRole('list', { name: 'Recovery codes' })).toBeNull()
    expect(screen.getByText(/10 recovery codes left/)).toBeTruthy()
  })

  it('turns off with the password and a code', async () => {
    auth.state.user = staff
    mfaApi.status.mockResolvedValue({ available: true, enabled: true, recoveryCodesLeft: 7 })
    mfaApi.disable.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<AccountSettingsSection />)
    expect(await screen.findByText(/7 recovery codes left/)).toBeTruthy()
    await user.type(screen.getAllByLabelText('Current password')[2], 'my-password-123')
    await user.type(screen.getByLabelText('Authenticator or recovery code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Turn off two-step sign-in' }))
    expect(mfaApi.disable).toHaveBeenCalledWith({ currentPassword: 'my-password-123', code: '123456' })
    expect(await screen.findByText(/Two-step sign-in is off/)).toBeTruthy()
  })

  it('explains when the server cannot store secrets yet', async () => {
    auth.state.user = staff
    mfaApi.status.mockResolvedValue({ available: false, enabled: false, recoveryCodesLeft: 0 })
    render(<AccountSettingsSection />)
    expect(await screen.findByText(/MFA_ENCRYPTION_KEY/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Set up two-step sign-in' })).toBeNull()
  })
})

describe('account settings: sign out everywhere', () => {
  it('asks in the page first, and can be cancelled', async () => {
    const user = userEvent.setup()
    render(<AccountSettingsSection />)
    await user.click(screen.getByRole('button', { name: 'Sign out of all devices' }))
    expect(screen.getByText(/including this one/)).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(auth.state.logoutEverywhere).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sign out of all devices' }))
  })

  it('signs out through the auth state once confirmed', async () => {
    auth.state.logoutEverywhere.mockResolvedValue(undefined)
    const onSignedOut = vi.fn()
    const user = userEvent.setup()
    render(<AccountSettingsSection onSignedOutEverywhere={onSignedOut} />)
    await user.click(screen.getByRole('button', { name: 'Sign out of all devices' }))
    await user.click(screen.getByRole('button', { name: 'Sign out everywhere' }))
    await waitFor(() => expect(onSignedOut).toHaveBeenCalled())
    expect(auth.state.logoutEverywhere).toHaveBeenCalled()
  })

  it('reports a refusal instead of pretending it worked', async () => {
    auth.state.logoutEverywhere.mockRejectedValue(new ApiClientError(500, 'internal_error', 'Something went wrong on our side.'))
    const onSignedOut = vi.fn()
    const user = userEvent.setup()
    render(<AccountSettingsSection onSignedOutEverywhere={onSignedOut} />)
    await user.click(screen.getByRole('button', { name: 'Sign out of all devices' }))
    await user.click(screen.getByRole('button', { name: 'Sign out everywhere' }))
    expect(await screen.findByText('Something went wrong on our side.')).toBeTruthy()
    expect(onSignedOut).not.toHaveBeenCalled()
  })
})
