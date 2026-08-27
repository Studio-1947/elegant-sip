import { writeFileSync } from 'node:fs'
import { buildApp } from './app.js'

/*
 * Writes the OpenAPI document to disk. CI runs this and fails if the result
 * differs from the committed openapi.json — so an API change without a docs
 * change is a red build, the same trick that keeps the sitemap honest.
 */
const app = await buildApp()
await app.ready()
const spec = app.swagger()
writeFileSync('openapi.json', JSON.stringify(spec, null, 2) + '\n')
console.log(`openapi.json written — ${Object.keys(spec.paths ?? {}).length} paths`)
await app.close()
process.exit(0)
