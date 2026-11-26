import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const settings = vi.hoisted(() => ({ guarantee: { enabled: true, days: 30 } }))
vi.mock('../lib/storeSettings', () => ({ useStoreSettings: () => settings }))

import ProductFaq from './ProductFaq'

const questions = () => screen.getAllByRole('button').map((b) => b.textContent?.replace('+', '').trim())

describe('product page FAQ', () => {
  it('asks five questions from the shop FAQ, first one open, and links to the rest', () => {
    render(<ProductFaq />)
    expect(questions()).toEqual([
      'How fast is shipping, and is it really free?',
      'How fresh is the tea when it arrives?',
      "What's the best way to brew Darjeeling first flush?",
      'How many steeps can I get from one serving of leaves?',
      "What if I don't love a tea?",
    ])
    expect(screen.getAllByRole('button')[0].getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('link', { name: 'See all FAQs' }).getAttribute('href')).toBe('/faq')
  })

  it('opens one answer at a time', () => {
    render(<ProductFaq />)
    fireEvent.click(screen.getAllByRole('button')[2])
    const expanded = screen.getAllByRole('button').map((b) => b.getAttribute('aria-expanded'))
    expect(expanded).toEqual(['false', 'false', 'true', 'false', 'false'])
  })

  it('leaves the guarantee out while the shop has it switched off', () => {
    settings.guarantee = { enabled: false, days: 30 }
    render(<ProductFaq />)
    expect(questions()).toHaveLength(4)
    expect(questions()).not.toContain("What if I don't love a tea?")
    settings.guarantee = { enabled: true, days: 30 }
  })
})
