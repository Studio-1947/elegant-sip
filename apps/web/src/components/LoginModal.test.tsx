import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const api = vi.hoisted(() => ({
  auth: { methods: vi.fn(), requestWhatsApp: vi.fn(), forgotPassword: vi.fn(), loginWithCode: vi.fn() },
}))
vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), api }))
const auth = vi.hoisted(() => ({ login: vi.fn(), loginWithWhatsApp: vi.fn(), register: vi.fn(), applyUser: vi.fn() }))
vi.mock('./AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../lib/analytics', () => ({ track: vi.fn() }))
vi.mock('./TeaDiscoveryQuizModal', () => ({ default: () => null }))
vi.mock('./CartDrawer', () => ({ default: () => null }))

import LoginModal from './LoginModal'
import { UiProvider, useUi } from './UiContext'
import { __resetAuthMethods } from '../lib/authMethods'
import { ApiClientError } from '../lib/api'

const whatsappOn = (on: boolean) => api.auth.methods.mockResolvedValue({ whatsapp: on })
const renderModal = () => render(<LoginModal isOpen onClose={vi.fn()} />)

beforeEach(() => {
  vi.clearAllMocks()
  __resetAuthMethods()
})

describe('login box: which form opens', () => {
  it('opens on email, with no WhatsApp option, while WhatsApp sign-in is off', async () => {
    whatsappOn(false)
    renderModal()
    await waitFor(() => expect(api.auth.methods).toHaveBeenCalled())
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.queryByLabelText('WhatsApp number')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Continue with WhatsApp' })).toBeNull()
  })

  it('opens on WhatsApp when the server can send codes', async () => {
    whatsappOn(true)
    renderModal()
    expect(await screen.findByLabelText('WhatsApp number')).toBeTruthy()
  })

  it('treats a failed check as WhatsApp off', async () => {
    api.auth.methods.mockRejectedValue(new Error('offline'))
    renderModal()
    await waitFor(() => expect(api.auth.methods).toHaveBeenCalled())
    expect(screen.getByLabelText('Email')).toBeTruthy()
  })
})

describe('login box: WhatsApp number', () => {
  it('keeps the right number when "+91" is typed by hand, and sends it in full', async () => {
    whatsappOn(true)
    api.auth.requestWhatsApp.mockResolvedValue({ ok: true, challengeId: '7e3c6a0e-0000-4000-8000-000000000001' })
    const user = userEvent.setup()
    renderModal()
    const input = (await screen.findByLabelText('WhatsApp number')) as HTMLInputElement
    await user.type(input, '+91 98765 43210')
    expect(input.value).toBe('9876543210')
    await user.click(screen.getByRole('button', { name: 'Send WhatsApp code' }))
    expect(api.auth.requestWhatsApp).toHaveBeenCalledWith('+919876543210')
    expect(await screen.findByText('+91 98765 43210')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change number' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Resend code in \d+s/ })).toHaveProperty('disabled', true)
  })

  it.each([
    ['58765', 'Enter a 10-digit mobile number.'],
    ['5876543210', 'Indian mobile numbers start with 6, 7, 8 or 9.'],
    ['', 'Enter your mobile number.'],
  ])('refuses %j with a clear message and never calls the API', async (typed, message) => {
    whatsappOn(true)
    const user = userEvent.setup()
    renderModal()
    const input = await screen.findByLabelText('WhatsApp number')
    if (typed) await user.type(input, typed)
    await user.click(screen.getByRole('button', { name: 'Send WhatsApp code' }))
    expect(await screen.findByText(message)).toBeTruthy()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(api.auth.requestWhatsApp).not.toHaveBeenCalled()
  })
})

describe('login box: email and password', () => {
  const submit = () => screen.getByRole('button', { name: 'Sign In' })

  it('shows an error under each empty field and does not call the API', async () => {
    whatsappOn(false)
    const user = userEvent.setup()
    renderModal()
    await user.click(submit())
    expect(await screen.findByText('Enter your email address.')).toBeTruthy()
    expect(screen.getByText('Enter your password.')).toBeTruthy()
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(screen.getByLabelText('Email'))
    expect(auth.login).not.toHaveBeenCalled()
  })

  it('explains an invalid email, and clears the error once it is fixed', async () => {
    whatsappOn(false)
    const user = userEvent.setup()
    renderModal()
    const email = screen.getByLabelText('Email')
    await user.type(email, 'name@')
    await user.type(screen.getByLabelText('Password'), 'secret-password')
    await user.click(submit())
    expect(await screen.findByText('Enter a valid email address, like name@example.com.')).toBeTruthy()
    await user.type(email, 'example.com')
    expect(screen.queryByText('Enter a valid email address, like name@example.com.')).toBeNull()
  })

  it('asks for 10+ characters when creating an account', async () => {
    whatsappOn(false)
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('tab', { name: 'Create Account' }))
    await user.type(screen.getByLabelText('Full Name'), 'Asha Rai')
    await user.type(screen.getByLabelText('Email'), 'asha@example.com')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))
    expect(await screen.findByText('Use at least 10 characters.')).toBeTruthy()
    expect(auth.register).not.toHaveBeenCalled()
  })

  it('signs in with valid details', async () => {
    whatsappOn(false)
    auth.login.mockResolvedValue({ user: { id: 'u1', email: 'asha@example.com', name: 'Asha', role: 'customer', emailVerified: true } })
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByLabelText('Email'), ' asha@example.com ')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(submit())
    expect(auth.login).toHaveBeenCalledWith('asha@example.com', 'correct-horse-battery')
  })
})

describe('login box: answers from the server', () => {
  it('shows a field error from the server under that field', async () => {
    whatsappOn(false)
    auth.login.mockRejectedValue(new ApiClientError(400, 'validation_error', 'Some fields need attention.', { email: ['Invalid email address'] }))
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByLabelText('Email'), 'asha@example.co')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByText('Invalid email address.')).toBeTruthy()
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true')
  })

  it('shows plain words when sign-in is rate limited', async () => {
    whatsappOn(false)
    auth.login.mockRejectedValue(new ApiClientError(429, 'rate_limited', 'Too many attempts. Please wait a minute and try again.'))
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByLabelText('Email'), 'asha@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Too many attempts. Please wait a minute and try again.')
  })

  it('marks the selected tab for screen readers', async () => {
    whatsappOn(false)
    const user = userEvent.setup()
    renderModal()
    expect(screen.getByRole('tab', { name: 'Sign In' }).getAttribute('aria-selected')).toBe('true')
    await user.click(screen.getByRole('tab', { name: 'Create Account' }))
    expect(screen.getByRole('tab', { name: 'Create Account' }).getAttribute('aria-selected')).toBe('true')
  })
})

describe('login box: shared computers', () => {
  function Opener() {
    const { openLogin } = useUi()
    return <button onClick={openLogin}>open login</button>
  }

  it('keeps nothing typed once the box is closed', async () => {
    whatsappOn(false)
    const user = userEvent.setup()
    render(
      <UiProvider>
        <Opener />
      </UiProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'open login' }))
    await user.type(screen.getByLabelText('Email'), 'asha@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByLabelText('Email')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'open login' }))
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')
  })
})

describe('login box: two-step sign-in', () => {
  const signInTo = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('Email'), 'staff@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
  }

  it('asks for the authenticator code after the password, then signs in', async () => {
    whatsappOn(false)
    auth.login.mockResolvedValue({ mfaRequired: true, challengeToken: 'challenge-token-123' })
    const session = { id: 'u1', email: 'staff@example.com', name: 'Staff', role: 'admin', emailVerified: true }
    api.auth.loginWithCode.mockResolvedValue({ user: session })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<LoginModal isOpen onClose={onClose} />)
    await signInTo(user)

    const code = await screen.findByLabelText('Authenticator code')
    expect(onClose).not.toHaveBeenCalled()
    await user.type(code, '12a34')
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }))
    expect(await screen.findByText('Enter the 6-digit code from your authenticator app.')).toBeTruthy()
    expect(api.auth.loginWithCode).not.toHaveBeenCalled()

    await user.type(code, '56')
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(api.auth.loginWithCode).toHaveBeenCalledWith('challenge-token-123', '123456')
    expect(auth.applyUser).toHaveBeenCalledWith(session)
  })

  it('accepts a recovery code instead', async () => {
    whatsappOn(false)
    auth.login.mockResolvedValue({ mfaRequired: true, challengeToken: 'challenge-token-123' })
    api.auth.loginWithCode.mockResolvedValue({ user: { id: 'u1', email: 'staff@example.com', name: 'Staff', role: 'admin', emailVerified: true } })
    const user = userEvent.setup()
    renderModal()
    await signInTo(user)
    await user.click(await screen.findByRole('button', { name: 'Use a recovery code' }))
    await user.type(screen.getByLabelText('Recovery code'), 'abcde-fghij')
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }))
    await waitFor(() => expect(api.auth.loginWithCode).toHaveBeenCalledWith('challenge-token-123', 'abcde-fghij'))
  })

  it('goes back to the password when the challenge has expired', async () => {
    whatsappOn(false)
    auth.login.mockResolvedValue({ mfaRequired: true, challengeToken: 'challenge-token-123' })
    api.auth.loginWithCode.mockRejectedValue(new ApiClientError(400, 'mfa_challenge_expired', 'That sign-in has expired. Enter your email and password again.'))
    const user = userEvent.setup()
    renderModal()
    await signInTo(user)
    await user.type(await screen.findByLabelText('Authenticator code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }))
    expect((await screen.findByRole('alert')).textContent).toBe('That sign-in has expired. Enter your email and password again.')
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.queryByLabelText('Authenticator code')).toBeNull()
  })
})
