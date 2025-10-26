import { serve } from '@hono/node-server'
import app from './backend/hono.ts'

const port = 3000
console.log(`🚀 Server is running on port ${port}`)
console.log(`📧 Email API available at: http://localhost:${port}/api/emails`)
console.log(`🔧 tRPC API available at: http://localhost:${port}/api/trpc`)

serve({
  fetch: app.fetch,
  port
})
