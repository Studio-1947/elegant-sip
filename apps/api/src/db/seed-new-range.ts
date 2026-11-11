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
    longDescription: [
      'First flush is the first picking of the year, taken in the weeks after the tea bushes wake from winter. The new shoots are small and tender, and they carry the aromatics the plant has stored through the cold months. That is why a first flush Darjeeling tastes so unlike other black teas: lighter, greener and more fragrant.',
      'It brews a pale gold rather than a deep red. The aroma is fresh and floral, the body is light, and the finish carries the gentle muscatel lift (a bright, grape-like note) that Darjeeling spring teas are known for. There is a little briskness at the edges, but nothing heavy.',
      'Drink it plain, without milk or sugar, so the delicate notes come through. It suits a slow morning or a mid-afternoon cup, and goes well with light food such as butter biscuits, fruit or a plain sponge. The leaf gives a good second steep; add about 30 seconds to the time.',
    ].join('\n\n'),
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
    longDescription: [
      'Golden Needle is made almost entirely from young buds. As they are rolled and oxidised, the fine hairs on the buds turn a deep gold, which gives the tea its name and its look: slender, twisted golden tips.',
      'Because buds are rich and tender, this is the fullest cup in our range. It brews a clear amber with an aroma of honey and baked bread. The taste is smooth and rounded, with a malty depth and a natural sweetness that needs no sugar. There is very little bitterness, even if you steep it a little long.',
      'Try the first cup plain to taste the honeyed character; it is sturdy enough for a splash of milk if you prefer. It holds up well to a second and third steep, so a little leaf goes a long way. A fine choice for a special occasion, or as a gift for someone who loves black tea.',
    ].join('\n\n'),
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
    longDescription: [
      'Green tea is the least changed form of the tea leaf. Soon after picking, the leaves are heated to stop oxidation, the natural process that turns leaves dark and gives black tea its colour and strength. The leaf stays green, and the cup keeps the fresh character of the plant.',
      'It brews a pale yellow-green cup with a clean, grassy aroma. The taste is fresh and gentle, with a soft vegetal sweetness and a clean finish. It is lighter in body and less astringent than our black teas, which makes it an easy cup to drink through the day.',
      'Temperature matters most with green tea. Water straight off the boil scorches the leaf and draws out bitterness, so let the kettle rest for a few minutes first. Drink it plain, without milk. It pairs well with light meals, and the leaf can be steeped three times; the later cups are softer and sweeter.',
    ].join('\n\n'),
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
    longDescription: [
      'Pan Roasted is a green tea finished over fire. Instead of being steamed, the freshly picked leaf is tossed in a hot pan to stop oxidation. The heat dries the leaf and gives it a warm, toasted character you will not find in a steamed green tea.',
      'The cup is golden-green, with a nutty aroma like lightly toasted grain or chestnut. Beneath the roast the fresh green notes are still there, and the finish is soft and rounded rather than grassy. It is gentler than most green teas, with very little bitterness.',
      'Brew it a few degrees hotter than other green teas, around 85°C, to bring out the roasted notes, and drink it plain. Its warmth makes it a good green tea for cooler evenings and for anyone who finds regular green tea too grassy. It pairs well with savoury food.',
    ].join('\n\n'),
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
    longDescription: [
      'Silver Needle is made only from the unopened leaf bud, picked before it unfurls. Each bud is covered in fine silver-white down. The buds are simply withered and dried, with no rolling and almost no processing, so what you brew is very close to the bud as it grew on the bush.',
      'The cup is very pale, almost clear, with a delicate aroma of fresh hay and soft flowers. The taste is light, smooth and subtly sweet, with no bitterness. It is the most delicate tea we make, and its flavour builds slowly over a long steep and several infusions.',
      'Give it time and cooler water. The buds are light and bulky, so use about 2 teaspoons per cup and steep for 4–5 minutes at around 80°C. Drink it plain. It rewards a quiet moment and a clean palate, and the buds can be steeped three or four times.',
    ].join('\n\n'),
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
    longDescription: [
      'White tea is handled as little as possible. The leaf and bud are left to wither naturally and are then dried, without the rolling and oxidation that make black tea. The result keeps much of the freshness and sweetness of the living leaf.',
      'It brews a pale golden cup with a soft floral aroma. The taste is mellow and gently sweet, with a light body and a smooth, clean finish. Because it includes leaf as well as bud, it has a little more body than Silver Needle while staying delicate.',
      'Keep the water below boiling, around 80°C, and do not rush the steep. Drink it plain. It is a calm, light cup for the afternoon or evening, and it rewards several short steeps, each one a little different from the last.',
    ].join('\n\n'),
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
    longDescription: [
      'This is first flush Darjeeling with the leaf left whole. The leaves are picked by hand and kept intact through withering, rolling and drying, rather than broken into smaller pieces. Whole leaves release their flavour slowly, so the cup has more layers than a broken grade.',
      'It brews a bright, pale gold. The aroma is fresh and floral, and the taste opens with spring flowers, moves into the muscatel note Darjeeling is known for, and ends with a long, clean finish. It is light in body but full of flavour, with a gentle briskness.',
      'Use a little more leaf by volume than usual, as whole leaves are bulky, and watch them unfurl in the pot. Drink it plain. This is the cup to choose when you want to taste a first flush at its best, and the leaf gives a fine second steep.',
    ].join('\n\n'),
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
    longDescription: [
      'Second flush is the summer picking, taken in early summer once the spring growth has passed. The leaves are larger and more mature than in spring, and the warmer weather gives them a deeper, fuller flavour.',
      'The cup is a rich amber. The aroma is fruity, and the taste brings ripe fruit and the muscatel character (a grape-like sweetness) that made second flush Darjeeling famous. It has more body and strength than a first flush, with a smooth, lingering finish.',
      'Try the first cup plain to taste the muscatel; it is sturdy enough to take a splash of milk if you prefer. A good all-day black tea, and a fine match for breakfast or an afternoon snack.',
    ].join('\n\n'),
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
    longDescription: [
      'Third flush, also called autumn flush, is picked after the monsoon as the growing season winds down. The bushes grow more slowly in the cooler weather, and the leaf develops a softer, rounder character than the summer teas.',
      'It brews a coppery, reddish cup. The aroma is warm and gentle, and the taste is mellow and smooth, with a light natural sweetness and low astringency. It is easy to drink and forgiving, even if you steep it a little long.',
      'Drink it plain or with milk; it takes both well. It makes a dependable everyday cup, morning or afternoon, and is a good introduction to Darjeeling for anyone used to stronger tea.',
    ].join('\n\n'),
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
    longDescription: [
      'Whole Leaf 2nd Flush is our summer Darjeeling with the leaf kept whole. The leaves are left intact through rolling and drying, so they open fully in the pot and release their flavour slowly.',
      'Expect a rich amber cup with ripe fruit and the muscatel sweetness that second flush is known for, with more body and a longer finish than the broken grade. Drink it plain, or with a splash of milk.',
    ].join('\n\n'),
    imageSrc: '/products/whole-leaf-second-flush.webp',
    category: 'Black Tea',
    tastingNotes: ['Muscatel', 'Fruity', 'Rich'],
    bodyLevel: 4,
    brewingGuide: {
      temperature: '95°C / 203°F',
      time: '3–4 minutes',
      steeps: '2–3',
      leafAmount: '1½ tsp per 8 oz',
      notes: 'Whole leaves are bulky, so use a little more by volume. Try the first cup plain.',
    },
  },
  {
    ...shared,
    status: 'coming-soon' as const,
    slug: 'whole-leaf-autumn-flush',
    variants: comingSoon('WLAF'),
    name: 'Whole Leaf Autumn Flush',
    description: 'Unbroken autumn leaves for a smooth, coppery, gently sweet cup. Arriving soon.',
    longDescription: [
      'Whole Leaf Autumn Flush is our autumn Darjeeling with the leaf kept whole. Picked as the growing season winds down, the leaves stay intact so they unfurl fully and give a smooth, layered cup.',
      'Expect a coppery cup that is mellow and gently sweet, with low astringency and a soft, rounded finish. It is easy to drink plain and takes milk well.',
    ].join('\n\n'),
    imageSrc: '/products/whole-leaf-autumn-flush.webp',
    category: 'Black Tea',
    tastingNotes: ['Mellow', 'Coppery', 'Sweet'],
    bodyLevel: 3,
    brewingGuide: {
      temperature: '95°C / 203°F',
      time: '3–4 minutes',
      steeps: '2–3',
      leafAmount: '1½ tsp per 8 oz',
      notes: 'Forgiving and mellow, and takes milk well.',
    },
  },
  {
    ...shared,
    status: 'coming-soon' as const,
    slug: 'chamomile',
    variants: comingSoon('CHAM'),
    name: 'Chamomile',
    description: 'Whole chamomile flowers for a calm, honeyed, caffeine-free cup. Arriving soon.',
    longDescription: [
      'Our Chamomile is made from whole dried chamomile flowers rather than broken pieces or dust. Whole flowers keep more of their natural oils, which gives a fuller flavour and aroma.',
      'It brews a clear golden cup with a sweet, floral aroma and a hint of apple. The taste is soft and honeyed, with no bitterness. Chamomile is naturally caffeine-free, which makes it a popular choice for the evening.',
      'Pour water just off the boil and steep for about 5 minutes, or longer for a stronger cup. Drink it plain or with a little honey.',
    ].join('\n\n'),
    imageSrc: '/products/chamomile.webp',
    category: 'Herbal Tea',
    tastingNotes: ['Floral', 'Honeyed', 'Calming'],
    bodyLevel: 1,
    brewingGuide: {
      temperature: '100°C / 212°F',
      time: '5–7 minutes',
      steeps: '1',
      leafAmount: '2 tsp per 8 oz',
      notes: 'Cover the cup while it steeps to keep the aroma in.',
    },
  },
]
