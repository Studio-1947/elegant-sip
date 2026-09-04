import './dev-defaults.js'
import { readFileSync } from 'node:fs'
import { buildApp } from './app.js'
import { redis } from './lib/sessions.js'

const app = await buildApp()
await app.ready()
const generated = JSON.stringify(app.swagger(), null, 2) + '\n'
const committed = readFileSync('openapi.json', 'utf8')
await app.close()
await redis.quit()

if (generated !== committed) {
  console.error('openapi.json is stale. Run: npm run openapi:emit --workspace @elegantsip/api')
  process.exit(1)
}
console.log('openapi.json is current')
