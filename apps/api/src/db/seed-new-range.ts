import { rupees } from '@elegantsip/shared'

/* ────────────────────────────────────────────────────────────────────────────
 * The new range — six teas with finished pack photography, added Nov 2026.
 *
 * Prices are the LOW (single retail pack) column of the Elegant Sip pricing
 * sheet, excl. GST, and SKUs are the sheet's codes. Stock is a placeholder 20
 * per size until real inventory is entered.
 *
 * Copy describes the style of tea only. No estate, elevation or harvest is
 * claimed until those are confirmed, so `origin` and `garden` stay null.
 * ──────────────────────────────────────────────────────────────────────────── */

const SIZES = [
  ['100 g', 'S100'],
  ['250 g', 'S250'],
  ['500 g', 'S500'],
  ['1 kg', 'S1KG'],
] as const

/** Pricing-sheet product code + LOW prices in rupees for 100 g, 250 g, 500 g, 1 kg. */
const variants = (code: string, prices: [number, number, number, number]) =>
  SIZES.map(([size, sizeCode], i) => ({ size, sku: `${code}-${sizeCode}`, price: rupees(prices[i]), stock: 20 }))

const shared = {
  status: 'active' as const,
  harvestLabel: null,
  origin: null,
  flavorProfile: null,
  garden: null,
}

export const NEW_RANGE = [
  {
    ...shared,
    slug: 'first-flush',
    variants: variants('P001', [700, 1610, 3100, 6030]),
    name: 'First Flush',
    description: 'The first pluck of spring — a bright, floral Darjeeling with the light muscatel lift the season is known for.',
    longDescription:
      'First flush leaves are picked in the first weeks after winter, when the bush is full of stored aromatics. The cup brews pale gold rather than red, light in body and fragrant, and is best drunk plain so nothing stands between you and the spring.',
    imageSrc: '/products/first-flush.webp',
    category: 'Black Tea',
    tastingNotes: ['Floral', 'Muscatel', 'Bright'],
    bodyLevel: 2,
    brewingGuide: {
      temperature: '194°F / 90°C',
      time: '3–4 minutes',
      steeps: '2–3',
      leafAmount: '1 tsp per 8 oz',
      notes: 'Skip the milk — a slightly cooler pour keeps the bright spring aromatics intact.',
    },
  },
  {
    ...shared,
    slug: 'golden-needle',
    variants: variants('P023', [1110, 2640, 5150, 10120]),
    name: 'Golden Needle',
    description: 'Golden-tipped buds that brew a rounded, honeyed cup — the richest tea in the range.',
    longDescription:
      'Golden Needle is made from tender buds that turn a deep gold as they are rolled and oxidised. The cup is smooth and full, with a natural sweetness that holds up to a second and third steep.',
    imageSrc: '/products/golden-needle.webp',
    category: 'Black Tea',
    tastingNotes: ['Honeyed', 'Malty', 'Smooth'],
    bodyLevel: 4,
    brewingGuide: {
      temperature: '194°F / 90°C',
      time: '3–4 minutes',
      steeps: '2–3',
      leafAmount: '1 tsp per 8 oz',
      notes: 'Rich enough to take a splash of milk, but try the first cup plain.',
    },
  },
  {
    ...shared,
    slug: 'green-tea',
    variants: variants('P019', [390, 850, 1570, 2950]),
    name: 'Green Tea',
    description: 'Unoxidised Darjeeling leaf — fresh, grassy and gentle, for an everyday lighter cup.',
    longDescription:
      'Green tea is heated soon after plucking to stop oxidation, which keeps the leaf green and the cup fresh. Brew it cooler and shorter than black tea; boiling water draws out bitterness.',
    imageSrc: '/products/green-tea.webp',
    category: 'Green Tea',
    tastingNotes: ['Fresh', 'Grassy', 'Clean finish'],
    bodyLevel: 2,
    brewingGuide: {
      temperature: '176°F / 80°C',
      time: '2–3 minutes',
      steeps: '3',
      leafAmount: '1 tsp per 8 oz',
      notes: 'Let boiled water rest for a few minutes first — too hot and the cup turns bitter.',
    },
  },
  {
    ...shared,
    slug: 'pan-roasted',
    variants: variants('P020', [500, 1100, 2080, 3980]),
    name: 'Pan Roasted',
    description: 'Leaf fired in a hot pan by hand, giving a toasty, nutty green tea with a soft finish.',
    longDescription:
      'Instead of steaming, the leaf is tossed in a heated pan to stop oxidation. The fire adds a gentle toasted, nutty character on top of the fresh green notes.',
    imageSrc: '/products/pan-roasted.webp',
    category: 'Green Tea',
    tastingNotes: ['Toasty', 'Nutty', 'Soft'],
    bodyLevel: 3,
    brewingGuide: {
      temperature: '185°F / 85°C',
      time: '2–3 minutes',
      steeps: '3',
      leafAmount: '1 tsp per 8 oz',
      notes: 'A little hotter than other green teas brings out the roasted notes.',
    },
  },
  {
    ...shared,
    slug: 'silver-needle',
    variants: variants('P024', [1110, 2640, 5150, 10120]),
    name: 'Silver Needle',
    description: 'Downy silver buds, simply withered and dried — the most delicate cup we make.',
    longDescription:
      'Silver Needle uses only the unopened bud, covered in fine white hairs. It is barely processed, so the cup is pale, light and subtly sweet. Give it time: the buds open slowly.',
    imageSrc: '/products/silver-needle.webp',
    category: 'White Tea',
    tastingNotes: ['Delicate', 'Sweet', 'Light'],
    bodyLevel: 1,
    brewingGuide: {
      temperature: '176°F / 80°C',
      time: '4–5 minutes',
      steeps: '3–4',
      leafAmount: '2 tsp per 8 oz',
      notes: 'The buds are bulky, so use more by volume and a longer steep than you would for black tea.',
    },
  },
  {
    ...shared,
    slug: 'white-tea',
    variants: variants('P021', [910, 2130, 4130, 8080]),
    name: 'White Tea',
    description: 'Gently withered leaf and bud — soft, sweet and lightly floral.',
    longDescription:
      'White tea is withered and dried with as little handling as possible. It brews a pale, mellow cup with a soft sweetness, and rewards several short steeps.',
    imageSrc: '/products/white-tea.webp',
    category: 'White Tea',
    tastingNotes: ['Soft', 'Sweet', 'Floral'],
    bodyLevel: 1,
    brewingGuide: {
      temperature: '176°F / 80°C',
      time: '3–4 minutes',
      steeps: '3',
      leafAmount: '2 tsp per 8 oz',
      notes: 'Keep the water below boiling and do not rush it.',
    },
  },
]
