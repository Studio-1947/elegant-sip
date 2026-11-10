import { rupees } from '@elegantsip/shared'

/* ────────────────────────────────────────────────────────────────────────────
 * The new range — teas with finished pack photography, added Nov 2026.
 *
 * Prices come from the Elegant Sip pricing sheet (Nov 2026), per 100 g pack,
 * GST-inclusive and rounded to whole rupees. `compareAtPrice` is the sheet's
 * "Final price"; `price` is its "25% off" column, which is what customers pay
 * during the launch offer. Only 100 g is sold until larger-pack prices are set.
 * SKUs are the sheet's codes. Stock is a placeholder 20 until real inventory
 * is entered.
 *
 * Copy describes the style of tea only. No estate, elevation or harvest is
 * claimed until those are confirmed, so `origin` and `garden` stay null.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Pricing-sheet product code + 100 g prices in rupees: [regular, offer]. */
const variants = (code: string, [compareAt, price]: [number, number]) => [
  { size: '100 g', sku: `${code}-S100`, price: rupees(price), compareAtPrice: rupees(compareAt), stock: 20 },
]

/**
 * A product with a photo but no price yet. Zero price AND zero stock, so it
 * cannot be bought and the API reports `fromPrice` as null, never "₹0".
 */
const comingSoon = (code: string) => [{ size: '100 g', sku: `${code}-S100`, price: 0, stock: 0 }]

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
    variants: variants('P001', [1148, 861]),
    name: 'First Flush',
    description: 'The first pluck of spring — a bright, floral Darjeeling with the light muscatel lift the season is known for.',
    longDescription:
      'First flush leaves are picked in the first weeks after winter, when the bush is full of stored aromatics. The cup brews pale gold rather than red, light in body and fragrant, and is best drunk plain so nothing stands between you and the spring.',
    imageSrc: '/products/first-flush.webp',
    category: 'Black Tea',
    tastingNotes: ['Floral', 'Muscatel', 'Bright'],
    bodyLevel: 2,
    brewingGuide: {
      temperature: '90°C / 194°F',
      time: '3–4 minutes',
      steeps: '2–3',
      leafAmount: '1 tsp per 8 oz',
      notes: 'Skip the milk — a slightly cooler pour keeps the bright spring aromatics intact.',
    },
  },
  {
    ...shared,
    slug: 'golden-needle',
    variants: variants('P023', [4209, 3157]),
    name: 'Golden Needle',
    description: 'Golden-tipped buds that brew a rounded, honeyed cup — the richest tea in the range.',
    longDescription:
      'Golden Needle is made from tender buds that turn a deep gold as they are rolled and oxidised. The cup is smooth and full, with a natural sweetness that holds up to a second and third steep.',
    imageSrc: '/products/golden-needle.webp',
    category: 'Black Tea',
    tastingNotes: ['Honeyed', 'Malty', 'Smooth'],
    bodyLevel: 4,
    brewingGuide: {
      temperature: '90°C / 194°F',
      time: '3–4 minutes',
      steeps: '2–3',
      leafAmount: '1 tsp per 8 oz',
      notes: 'Rich enough to take a splash of milk, but try the first cup plain.',
    },
  },
  {
    ...shared,
    slug: 'green-tea',
    variants: variants('P019', [781, 585]),
    name: 'Green Tea',
    description: 'Unoxidised Darjeeling leaf — fresh, grassy and gentle, for an everyday lighter cup.',
    longDescription:
      'Green tea is heated soon after plucking to stop oxidation, which keeps the leaf green and the cup fresh. Brew it cooler and shorter than black tea; boiling water draws out bitterness.',
    imageSrc: '/products/green-tea.webp',
    category: 'Green Tea',
    tastingNotes: ['Fresh', 'Grassy', 'Clean finish'],
    bodyLevel: 2,
    brewingGuide: {
      temperature: '80°C / 176°F',
      time: '2–3 minutes',
      steeps: '3',
      leafAmount: '1 tsp per 8 oz',
      notes: 'Let boiled water rest for a few minutes first — too hot and the cup turns bitter.',
    },
  },
  {
    ...shared,
    slug: 'pan-roasted',
    variants: variants('P020', [811, 608]),
    name: 'Pan Roasted',
    description: 'Leaf fired in a hot pan by hand, giving a toasty, nutty green tea with a soft finish.',
    longDescription:
      'Instead of steaming, the leaf is tossed in a heated pan to stop oxidation. The fire adds a gentle toasted, nutty character on top of the fresh green notes.',
    imageSrc: '/products/pan-roasted.webp',
    category: 'Green Tea',
    tastingNotes: ['Toasty', 'Nutty', 'Soft'],
    bodyLevel: 3,
    brewingGuide: {
      temperature: '85°C / 185°F',
      time: '2–3 minutes',
      steeps: '3',
      leafAmount: '1 tsp per 8 oz',
      notes: 'A little hotter than other green teas brings out the roasted notes.',
    },
  },
  {
    ...shared,
    slug: 'silver-needle',
    variants: variants('P024', [4209, 3157]),
    name: 'Silver Needle',
    description: 'Downy silver buds, simply withered and dried — the most delicate cup we make.',
    longDescription:
      'Silver Needle uses only the unopened bud, covered in fine white hairs. It is barely processed, so the cup is pale, light and subtly sweet. Give it time: the buds open slowly.',
    imageSrc: '/products/silver-needle.webp',
    category: 'White Tea',
    tastingNotes: ['Delicate', 'Sweet', 'Light'],
    bodyLevel: 1,
    brewingGuide: {
      temperature: '80°C / 176°F',
      time: '4–5 minutes',
      steeps: '3–4',
      leafAmount: '2 tsp per 8 oz',
      notes: 'The buds are bulky, so use more by volume and a longer steep than you would for black tea.',
    },
  },
  {
    ...shared,
    slug: 'white-tea',
    variants: variants('P021', [1760, 1320]),
    name: 'White Tea',
    description: 'Gently withered leaf and bud — soft, sweet and lightly floral.',
    longDescription:
      'White tea is withered and dried with as little handling as possible. It brews a pale, mellow cup with a soft sweetness, and rewards several short steeps.',
    imageSrc: '/products/white-tea.webp',
    category: 'White Tea',
    tastingNotes: ['Soft', 'Sweet', 'Floral'],
    bodyLevel: 1,
    brewingGuide: {
      temperature: '80°C / 176°F',
      time: '3–4 minutes',
      steeps: '3',
      leafAmount: '2 tsp per 8 oz',
      notes: 'Keep the water below boiling and do not rush it.',
    },
  },

  /* ── Added Nov 2026 with pack photography ──────────────────────────────────
   * 2nd Flush and 3rd Flush take over the slugs of the old photo-less
   * "coming soon" placeholders. 2nd Flush is priced as the sheet's "Second
   * Flush", 3rd Flush as its "Autumn Flush", and Whole Leaf 1st Flush as its
   * "First Flush Premium". The sheet has no product codes for these, so SKUs
   * are descriptive placeholders.
   * ──────────────────────────────────────────────────────────────────────── */
  {
    ...shared,
    slug: 'whole-leaf-first-flush',
    variants: variants('WL1F', [2372, 1779]),
    name: 'Whole Leaf 1st Flush',
    description: 'Unbroken spring leaves, picked by hand — the fullest expression of a Darjeeling first flush.',
    longDescription:
      'Whole leaf means the leaves are left intact through rolling and drying, so they unfurl fully in the pot. The cup is bright and floral with the muscatel lift of spring, with more depth and a longer finish than broken grades.',
    imageSrc: '/products/whole-leaf-first-flush.webp',
    category: 'Black Tea',
    tastingNotes: ['Floral', 'Muscatel', 'Layered'],
    bodyLevel: 2,
    brewingGuide: {
      temperature: '90°C / 194°F',
      time: '3–4 minutes',
      steeps: '2–3',
      leafAmount: '1½ tsp per 8 oz',
      notes: 'Whole leaves are bulky — use a little more by volume, and drink it plain.',
    },
  },
  {
    ...shared,
    slug: 'second-flush',
    variants: variants('2F', [995, 746]),
    name: '2nd Flush',
    description: 'The summer pluck — a deeper, fruitier Darjeeling with the classic muscatel character.',
    longDescription:
      'Second flush leaves are picked in early summer, after the spring growth. The cup brews amber, fuller in body than first flush, with ripe fruit and the muscatel note Darjeeling is known for.',
    imageSrc: '/products/second-flush.webp',
    category: 'Black Tea',
    tastingNotes: ['Muscatel', 'Fruity', 'Full'],
    bodyLevel: 4,
    brewingGuide: {
      temperature: '95°C / 203°F',
      time: '3–4 minutes',
      steeps: '2',
      leafAmount: '1 tsp per 8 oz',
      notes: 'Sturdy enough for a splash of milk, but try the first cup plain.',
    },
  },
  {
    ...shared,
    slug: 'autumn-flush',
    variants: variants('3F', [842, 631]),
    name: '3rd Flush',
    description: 'The autumn pluck — a mellow, rounded cup with a coppery colour and a gentle sweetness.',
    longDescription:
      'The third flush is picked as the growing season winds down. The leaf brews a coppery, smooth cup, softer and rounder than the summer teas — an easy everyday Darjeeling.',
    imageSrc: '/products/third-flush.webp',
    category: 'Black Tea',
    tastingNotes: ['Mellow', 'Coppery', 'Smooth'],
    bodyLevel: 3,
    brewingGuide: {
      temperature: '95°C / 203°F',
      time: '3–4 minutes',
      steeps: '2',
      leafAmount: '1 tsp per 8 oz',
      notes: 'Takes milk well, and holds up to a slightly longer steep.',
    },
  },
  {
    ...shared,
    status: 'coming-soon' as const,
    slug: 'whole-leaf-second-flush',
    variants: comingSoon('WL2F'),
    name: 'Whole Leaf 2nd Flush',
    description: 'Unbroken summer leaves for a fuller, fruitier muscatel cup. Arriving soon.',
    longDescription: null,
    imageSrc: '/products/whole-leaf-second-flush.webp',
    category: 'Black Tea',
    tastingNotes: ['Muscatel', 'Fruity', 'Rich'],
    bodyLevel: 4,
    brewingGuide: null,
  },
  {
    ...shared,
    status: 'coming-soon' as const,
    slug: 'whole-leaf-autumn-flush',
    variants: comingSoon('WLAF'),
    name: 'Whole Leaf Autumn Flush',
    description: 'Unbroken autumn leaves for a smooth, coppery, gently sweet cup. Arriving soon.',
    longDescription: null,
    imageSrc: '/products/whole-leaf-autumn-flush.webp',
    category: 'Black Tea',
    tastingNotes: ['Mellow', 'Coppery', 'Sweet'],
    bodyLevel: 3,
    brewingGuide: null,
  },
  {
    ...shared,
    status: 'coming-soon' as const,
    slug: 'chamomile',
    variants: comingSoon('CHAM'),
    name: 'Chamomile',
    description: 'Whole chamomile flowers for a calm, honeyed, caffeine-free cup. Arriving soon.',
    longDescription: null,
    imageSrc: '/products/chamomile.webp',
    category: 'Herbal Tea',
    tastingNotes: ['Floral', 'Honeyed', 'Calming'],
    bodyLevel: 1,
    brewingGuide: null,
  },
]
