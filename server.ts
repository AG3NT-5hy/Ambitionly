import { serve } from '@hono/node-server'
import app from './backend/hono'
import { config } from './config'

// Railway and other platforms provide PORT env variable
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000
const host = process.env.HOST || '0.0.0.0'
const baseUrl = config.API_URL.replace(/\/+$/, '')

console.log(`🚀 Server is running on port ${port}`)
console.log(`📧 Email API available at: ${baseUrl}/api/emails`)
console.log(`🔧 tRPC API available at: ${baseUrl}/api/trpc`)

serve({
  fetch: app.fetch,
  port,
  hostname: host
})
