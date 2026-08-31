import '../dev-defaults.js'
import { argv } from 'node:process'
import { pathToFileURL } from 'node:url'
import { rupees } from '@elegantsip/shared'
import { db, sql } from './client.js'
import { coupons, gardenProducts, gardens, journalPosts, productVariants, products } from './schema.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Seed — the real catalogue, migrated out of the storefront's TypeScript.
 *
 * Prices were whole rupees in the source data and are converted to paise here
 * with `rupees()`. Nothing is invented: this is the same six products, two
 * gardens and three journal posts the site shipped with.
 *
 * Idempotent — safe to re-run against a seeded database.
 * ──────────────────────────────────────────────────────────────────────────── */

const PRODUCTS = [
  {
    slug: 'first-flush-whole-leaf',
    name: 'First Flush Whole Leaf',
    status: 'active' as const,
    description:
      'The first pluck of spring, whole leaf — bright, floral, and carrying the muscatel character Darjeeling first flush is famous for. In three quality tiers.',
    longDescription:
      "The first flush is a race against the sun: leaves picked in the earliest weeks after winter dormancy, when the bush has stored a season's worth of aromatics. Grown above 3,500 ft in the Rungbong Valley, withered long and fired light, this is the grade that brews pale gold rather than red. Choose your tier — Basic, Classic, or Premium — each whole leaf, light in the cup, and best drunk without milk so nothing stands between you and the spring.",
    imageSrc: '/morningdew.webp',
    category: 'First Flush',
    tastingNotes: ['Floral', 'Muscatel', 'Bright finish'],
    bodyLevel: 2,
    harvestLabel: 'Spring 2026 Harvest',
    origin: {
      origin: 'Darjeeling, West Bengal, India',
      estate: 'Gopaldhara',
      elevation: '3,500–7,000 ft',
      harvest: 'First flush, spring 2026',
      cultivar: 'China bush (Camellia sinensis var. sinensis)',
    },
    flavorProfile: { strength: 2, astringency: 2, sweetness: 4, floral: 5, caffeine: 3 },
    brewingGuide: {
      temperature: '194°F / 90°C',
      time: '3–4 minutes',
      steeps: '2–3',
      leafAmount: '1 tsp per 8 oz',
      notes:
        'Skip the milk — first flush is prized for its bright muscatel aromatics, and a slightly cooler pour keeps them intact.',
    },
    garden: 'gopaldhara',
    variants: [
      { size: 'Basic · 100 g', price: rupees(600), stock: 20 },
      { size: 'Classic · 100 g', price: rupees(600), stock: 20 },
      { size: 'Premium · 100 g', price: rupees(1000), stock: 20 },
    ],
  },
  {
    slug: 'first-flush-broken-leaf',
    name: 'First Flush Broken Leaf',
    status: 'active' as const,
    description: 'Broken-leaf Darjeeling first flush — the same spring character with a quicker, stronger brew.',
    longDescription:
      'Same garden, same pluck, smaller cut. Breaking the leaf exposes more surface to the water, so a broken-leaf first flush gives up its colour and briskness in half the time a whole leaf takes. You keep the muscatel note and trade a little of the floral top end for body — the everyday Darjeeling for people who find whole leaf too delicate for a morning cup.',
    imageSrc: '/origin.webp',
    category: 'First Flush',
    tastingNotes: ['Muscatel', 'Brisk', 'Strong cup'],
    bodyLevel: 3,
    harvestLabel: 'Spring 2026 Harvest',
    origin: {
      origin: 'Darjeeling, West Bengal, India',
      estate: 'Gopaldhara',
      elevation: '3,500–7,000 ft',
      harvest: 'First flush, spring 2026',
      cultivar: 'China bush (Camellia sinensis var. sinensis)',
    },
    flavorProfile: { strength: 3, astringency: 3, sweetness: 3, floral: 3, caffeine: 4 },
    brewingGuide: {
      temperature: '203°F / 95°C',
      time: '2–3 minutes',
      steeps: '2',
      leafAmount: '1 tsp per 8 oz',
      notes: 'Broken leaf brews faster and stronger than whole leaf — shorten the steep rather than the leaf.',
    },
    garden: 'gopaldhara',
    variants: [
      { size: 'Basic · 100 g', price: rupees(500), stock: 20 },
      { size: 'Classic · 100 g', price: rupees(600), stock: 20 },
      { size: 'Premium · 100 g', price: rupees(700), stock: 20 },
    ],
  },
  {
    slug: 'first-flush-broken-mixed',
    name: 'First Flush Broken Mixed',
    status: 'active' as const,
    description:
      'A robust mixed broken grade from the Darjeeling spring harvest — strong, brisk, and happy to take milk.',
    longDescription:
      'From the warmer, lower slopes below Kurseong, where the bush wakes earlier and grows faster. That makes a bolder, maltier cup with more colour and less of the ethereal floral note you get at altitude — which is exactly what you want in a tea that has to stand up to milk and sugar. The most versatile grade we sell, and the best value per cup.',
    imageSrc: '/origin.webp',
    category: 'First Flush',
    tastingNotes: ['Malty', 'Strong', 'Milk-friendly'],
    bodyLevel: 4,
    harvestLabel: 'Spring 2026 Harvest',
    origin: {
      origin: 'Darjeeling, West Bengal, India',
      estate: 'Rohini',
      elevation: '1,500–4,500 ft',
      harvest: 'First flush, spring 2026',
      cultivar: 'Clonal (Camellia sinensis var. sinensis)',
    },
    flavorProfile: { strength: 4, astringency: 3, sweetness: 3, floral: 2, caffeine: 4 },
    brewingGuide: {
      temperature: '212°F / 100°C',
      time: '3–4 minutes',
      steeps: '2',
      leafAmount: '1 tsp per 8 oz',
      notes: 'A full boil and a longer steep bring out the malty depth — this grade takes milk happily.',
    },
    garden: 'rohini',
    variants: [
      { size: 'Basic · 100 g', price: rupees(150), stock: 20 },
      { size: 'Premium · 100 g', price: rupees(300), stock: 20 },
    ],
  },
  {
    slug: 'first-flush-fannings',
    name: 'First Flush Fannings',
    status: 'active' as const,
    description:
      'Fine Darjeeling first flush fannings — fast-brewing and full-strength. The working tea of the Darjeeling hills.',
    longDescription:
      'Fannings are the finest cut: the smallest particles sifted from the same first flush pluck. More surface area means near-instant extraction, a deep coppery colour, and a cup with real backbone. This is not a contemplative tea and does not pretend to be — it is the grade the hills actually drink every morning, and it makes the best masala chai in the catalogue.',
    imageSrc: '/origin.webp',
    category: 'First Flush',
    tastingNotes: ['Bold', 'Fast-brewing', 'Chai-ready'],
    bodyLevel: 5,
    harvestLabel: 'Spring 2026 Harvest',
    origin: {
      origin: 'Darjeeling, West Bengal, India',
      estate: 'Rohini',
      elevation: '1,500–4,500 ft',
      harvest: 'First flush, spring 2026',
      cultivar: 'Clonal (Camellia sinensis var. sinensis)',
    },
    flavorProfile: { strength: 5, astringency: 4, sweetness: 2, floral: 1, caffeine: 5 },
    brewingGuide: {
      temperature: '212°F / 100°C',
      time: '2–3 minutes',
      steeps: '1–2',
      leafAmount: '1 tsp per 8 oz',
      notes: 'Fannings brew fast and strong — watch the clock, or lean in and make masala chai.',
    },
    garden: 'rohini',
    variants: [
      { size: 'Basic · 100 g', price: rupees(100), stock: 20 },
      { size: 'Premium · 100 g', price: rupees(200), stock: 20 },
    ],
  },
  {
    slug: 'second-flush',
    name: 'Second Flush',
    status: 'coming-soon' as const,
    description:
      'The summer pluck brings the deeper, fruitier side of Darjeeling. The lots are still with the garden — arriving after the summer harvest.',
    longDescription: null,
    imageSrc: '/summerbreeze.webp',
    category: 'Second Flush',
    tastingNotes: ['Fruity', 'Muscatel', 'Deep'],
    bodyLevel: 4,
    harvestLabel: 'Summer 2026 Harvest',
    origin: null,
    flavorProfile: null,
    brewingGuide: null,
    garden: null,
    // Zero price AND zero stock: nothing can be bought, and the API reports
    // fromPrice as null rather than a misleading "₹0".
    variants: [{ size: '100 g', price: 0, stock: 0 }],
  },
  {
    slug: 'autumn-flush',
    name: 'Third Flush',
    status: 'coming-soon' as const,
    description:
      'The third pluck of the year rounds things out with a mellow, coppery cup. Arriving after the autumn harvest.',
    longDescription: null,
    imageSrc: '/origin.webp',
    category: 'Third Flush',
    tastingNotes: ['Mellow', 'Coppery', 'Smooth'],
    bodyLevel: 3,
    harvestLabel: 'Autumn 2026 Harvest',
    origin: null,
    flavorProfile: null,
    brewingGuide: null,
    garden: null,
    variants: [{ size: '100 g', price: 0, stock: 0 }],
  },
]

const GARDENS = [
  {
    slug: 'gopaldhara',
    name: 'Gopaldhara',
    region: 'Rungbong Valley, Mirik · Darjeeling',
    elevation: '3,500–7,000 ft',
    imageSrc: '/gopal-1024.webp',
    story: [
      'Gopaldhara sits in the Rungbong Valley above Mirik, and its upper sections are among the highest planted land in Darjeeling — rising past 7,000 feet. Altitude is the whole story here: at that height the bush grows slowly, the internodes shorten, and the leaf concentrates the aromatics that give Darjeeling first flush its muscatel signature.',
      'The first flush is a narrow window. After winter dormancy the bushes push a small quantity of tender two-leaves-and-a-bud, and the pluck runs for a few weeks in late February through April. That leaf is withered long and fired light, which is why a first flush brews pale gold rather than red, and why it should never meet milk.',
      "Our whole leaf and broken leaf grades come from this valley. The same day's pluck is sorted into grades rather than blended across gardens, so a broken leaf here is not a lesser tea — it is the same leaf, cut for a faster, stronger cup.",
    ],
  },
  {
    slug: 'rohini',
    name: 'Rohini',
    region: 'Kurseong Valley · Darjeeling',
    elevation: '1,500–4,500 ft',
    imageSrc: '/harvest.webp',
    story: [
      'Rohini lies lower down the hill, on the slopes below Kurseong where the Darjeeling foothills warm earlier in the season. Lower elevation means the bushes wake sooner, so Rohini is often among the first gardens in the district to send out a first flush at all.',
      'A warmer, faster-growing leaf makes a bolder cup — more body, more malt, less of the ethereal floral top note you get at 7,000 feet. That suits the broken mixed and fannings grades, which are built for strength: a fast brew, a full colour, and enough backbone to take milk or become masala chai.',
      'Nothing here is blended with leaf from outside the district. The grade changes; the garden and the harvest do not.',
    ],
  },
]

const JOURNAL = [
  {
    slug: 'art-of-first-flush',
    title: 'The Art of the First Flush',
    excerpt:
      'The first harvest of spring is a race against the sun. Why the earliest pluck of the year commands the highest prices — and the most patience.',
    category: 'Craft',
    author: 'The Elegant Sip Tasting Team',
    publishedAt: new Date('2026-03-12T08:00:00Z'),
    readTime: '4 min read',
    imageSrc: '/origin.webp',
    imageAlt: 'Highland tea terraces at first light',
  },
  {
    slug: 'field-guide-to-steeping',
    title: 'A Field Guide to Steeping',
    excerpt:
      'Temperature, time, leaf amount, and the often-misunderstood art of the re-steep. Everything you need to stop guessing and start tasting.',
    category: 'Brewing',
    author: 'The Elegant Sip Tasting Team',
    publishedAt: new Date('2026-01-28T08:00:00Z'),
    readTime: '5 min read',
    imageSrc: '/craft.webp',
    imageAlt: 'Tea leaves being hand-processed',
  },
  {
    slug: 'from-mist-to-cup',
    title: 'From Mist to Cup: Our Sourcing Journey',
    excerpt:
      'No auction houses, no middlemen, no anonymity. How we built direct relationships with the gardens that grow the leaves we sell.',
    category: 'Sourcing',
    author: 'The Elegant Sip Tasting Team',
    publishedAt: new Date('2025-11-05T08:00:00Z'),
    readTime: '6 min read',
    imageSrc: '/harvest.webp',
    imageAlt: 'Tea plantation at harvest',
  },
]

export async function seed() {
  console.log('seeding…')

  const gardenIds = new Map<string, string>()
  for (const [i, g] of GARDENS.entries()) {
    const [row] = await db
      .insert(gardens)
      .values({ ...g, sortOrder: i })
      .onConflictDoUpdate({ target: gardens.slug, set: { name: g.name, region: g.region, story: g.story, imageSrc: g.imageSrc } })
      .returning({ id: gardens.id })
    gardenIds.set(g.slug, row.id)
  }
  console.log(`  gardens      ${GARDENS.length}`)

  let variantCount = 0
  for (const [i, p] of PRODUCTS.entries()) {
    const { variants, garden, ...fields } = p
    const [row] = await db
      .insert(products)
      .values({ ...fields, sortOrder: i })
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          name: fields.name,
          status: fields.status,
          description: fields.description,
          longDescription: fields.longDescription,
          tastingNotes: fields.tastingNotes,
          origin: fields.origin,
          flavorProfile: fields.flavorProfile,
          brewingGuide: fields.brewingGuide,
          sortOrder: i,
          updatedAt: new Date(),
        },
      })
      .returning({ id: products.id })

    for (const [vi, v] of variants.entries()) {
      // SKU is derived, stable and unique: slug + tier.
      const tier = v.size.split(' · ')[0].toLowerCase().replace(/\s+/g, '-')
      await db
        .insert(productVariants)
        .values({ productId: row.id, size: v.size, sku: `${p.slug}--${tier}`, price: v.price, stock: v.stock, sortOrder: vi })
        .onConflictDoUpdate({
          target: [productVariants.productId, productVariants.size],
          set: { price: v.price, sortOrder: vi },
        })
      variantCount += 1
    }

    if (garden) {
      const gardenId = gardenIds.get(garden)
      if (gardenId) {
        await db.insert(gardenProducts).values({ gardenId, productId: row.id }).onConflictDoNothing()
      }
    }
  }
  console.log(`  products     ${PRODUCTS.length} (${variantCount} variants)`)

  for (const post of JOURNAL) {
    await db
      .insert(journalPosts)
      .values({ ...post, body: [] })
      .onConflictDoUpdate({ target: journalPosts.slug, set: { title: post.title, excerpt: post.excerpt } })
  }
  console.log(`  journal      ${JOURNAL.length}`)

  for (const c of [
    { code: 'SIP10', percentOff: 10 },
    { code: 'WELCOME10', percentOff: 10 },
  ]) {
    await db.insert(coupons).values(c).onConflictDoNothing()
  }
  console.log('  coupons      2')

  console.log('done')
}

/* Only when executed directly, so importing this does not end the shared pool. */
if (import.meta.url === pathToFileURL(argv[1] ?? '').href) {
  await seed()
  await sql.end()
}
