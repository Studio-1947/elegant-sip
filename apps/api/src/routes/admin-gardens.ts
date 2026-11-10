import { asc, eq, inArray, sql } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema, slugSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { gardenProducts, gardens, products } from '../db/schema.js'
import { ApiError } from '../lib/problem.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — the gardens.
 *
 * The Gardens page and the "From <garden>" line on product pages read these.
 * The boot seed creates the default gardens once and never rewrites them, so
 * edits here survive deploys. Registered inside admin.ts, so the admin auth
 * hook covers every route.
 * ──────────────────────────────────────────────────────────────────────────── */

// No uploads: the image must be a file already shipped in the storefront's public folder.
const imagePathSchema = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9/_.-]*\.webp$/, 'Use a path like /gardens/name.webp')

const storySchema = z.array(z.string().trim().min(1).max(2000)).max(12)

const editableFields = {
  name: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(120),
  elevation: z.string().trim().max(60),
  imageSrc: imagePathSchema,
  story: storySchema,
  productSlugs: z.array(slugSchema).max(50).describe('Replaces the garden’s product links'),
}

const adminGardenSchema = z.object({
  id: z.string().uuid(),
  slug: slugSchema,
  name: z.string(),
  region: z.string(),
  elevation: z.string(),
  imageSrc: z.string(),
  story: z.array(z.string()),
  sortOrder: z.number().int(),
  products: z.array(z.object({ slug: slugSchema, name: z.string(), archived: z.boolean() })),
})

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function findGarden(slug: string) {
  const row = await db.query.gardens.findFirst({
    where: eq(gardens.slug, slug),
    with: { productLinks: { with: { product: { columns: { slug: true, name: true, archivedAt: true } } } } },
  })
  if (!row) throw ApiError.notFound(`Garden "${slug}"`)
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    region: row.region,
    elevation: row.elevation,
    imageSrc: row.imageSrc,
    story: row.story ?? [],
    sortOrder: row.sortOrder,
    products: row.productLinks
      .map((l) => ({ slug: l.product.slug, name: l.product.name, archived: l.product.archivedAt !== null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/** Replaces a garden's links. Every slug must be a real product, or nothing changes. */
async function setLinks(tx: Tx, gardenId: string, slugs: string[]) {
  const wanted = [...new Set(slugs)]
  const found = wanted.length
    ? await tx.select({ id: products.id, slug: products.slug }).from(products).where(inArray(products.slug, wanted))
    : []
  const missing = wanted.filter((s) => !found.some((p) => p.slug === s))
  if (missing.length) {
    throw ApiError.badRequest(`No product with the slug ${missing.map((s) => `"${s}"`).join(', ')}.`, {
      productSlugs: missing.map((s) => `Unknown product "${s}"`),
    })
  }
  await tx.delete(gardenProducts).where(eq(gardenProducts.gardenId, gardenId))
  if (found.length) await tx.insert(gardenProducts).values(found.map((p) => ({ gardenId, productId: p.id })))
}

export const adminGardenRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/gardens',
    {
      schema: {
        tags: ['Admin'],
        summary: 'The gardens, with their linked products',
        description: 'Includes links to retired (archived) products, which the public list leaves out.',
        response: { 200: z.object({ gardens: z.array(adminGardenSchema) }), 401: problemSchema, 403: problemSchema },
      },
    },
    async () => {
      const rows = await db.select({ slug: gardens.slug }).from(gardens).orderBy(asc(gardens.sortOrder), asc(gardens.name))
      return { gardens: await Promise.all(rows.map((r) => findGarden(r.slug))) }
    },
  )

  app.post(
    '/admin/gardens',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Add a garden',
        body: z.object({
          slug: slugSchema,
          ...editableFields,
          story: storySchema.default([]),
          productSlugs: editableFields.productSlugs.default([]),
        }),
        response: { 201: adminGardenSchema, 400: problemSchema, 409: problemSchema },
      },
    },
    async (request, reply) => {
      const { productSlugs, ...fields } = request.body
      const clash = await db.query.gardens.findFirst({ where: eq(gardens.slug, fields.slug), columns: { id: true } })
      if (clash) throw ApiError.conflict('slug_taken', `A garden with the slug "${fields.slug}" already exists.`)

      await db.transaction(async (tx) => {
        const [{ max }] = await tx.select({ max: sql<number>`COALESCE(MAX(${gardens.sortOrder}), -1)` }).from(gardens)
        const [row] = await tx
          .insert(gardens)
          .values({ ...fields, sortOrder: Number(max) + 1 })
          .returning({ id: gardens.id })
        await setLinks(tx, row.id, productSlugs)
      })
      reply.code(201)
      return findGarden(fields.slug)
    },
  )

  app.patch(
    '/admin/gardens/:slug',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Edit a garden',
        description: 'Send only the fields to change. `productSlugs` replaces the whole set of links.',
        params: z.object({ slug: slugSchema }),
        body: z.object({ ...editableFields, sortOrder: z.number().int().min(0).max(1000) }).partial(),
        response: { 200: adminGardenSchema, 400: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const { productSlugs, ...fields } = request.body
      const existing = await db.query.gardens.findFirst({ where: eq(gardens.slug, request.params.slug), columns: { id: true } })
      if (!existing) throw ApiError.notFound(`Garden "${request.params.slug}"`)

      await db.transaction(async (tx) => {
        if (Object.keys(fields).length) await tx.update(gardens).set(fields).where(eq(gardens.id, existing.id))
        if (productSlugs) await setLinks(tx, existing.id, productSlugs)
      })
      return findGarden(request.params.slug)
    },
  )

  app.delete(
    '/admin/gardens/:slug',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Delete a garden',
        description: 'Removes the garden and its product links; the products themselves are untouched. The boot seed does not recreate it.',
        params: z.object({ slug: slugSchema }),
        response: { 200: z.object({ ok: z.literal(true) }), 404: problemSchema },
      },
    },
    async (request) => {
      // garden_products cascades on delete.
      const rows = await db.delete(gardens).where(eq(gardens.slug, request.params.slug)).returning({ id: gardens.id })
      if (rows.length === 0) throw ApiError.notFound(`Garden "${request.params.slug}"`)
      return { ok: true as const }
    },
  )
}
