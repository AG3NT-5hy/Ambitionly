# Deployment Instructions

## ⚠️ Security: Environment Variables

**IMPORTANT:** Never commit sensitive keys (JWT tokens, database URLs, API keys) to the repository.

### Setting Environment Variables on Render

All sensitive environment variables must be set in the Render Dashboard, NOT in `render.yaml`:

1. **Go to Render Dashboard:**
   - Navigate to your service (ambitionly-backend)
   - Click on "Environment" in the left sidebar
   - Click "Add Environment Variable"

2. **Required Environment Variables:**
   - `DATABASE_URL` - PostgreSQL connection string (KEEP SECRET!)
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role JWT (KEEP SECRET!)
   - `API_URL` - Your API URL (e.g., https://ambitionly.onrender.com)
   - `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
   - `PORT` - Server port (default: 3000)
   - `NODE_ENV` - Environment (production)

3. **After Adding Variables:**
   - Click "Save Changes"
   - Render will automatically redeploy your service

### Rotating Exposed Keys

If secrets were previously committed to git:
1. **Rotate the exposed keys immediately:**
   - Generate new Supabase service role key in Supabase Dashboard
   - Update database password if DATABASE_URL was exposed
   - Update the new keys in Render Dashboard environment variables

2. **Remove from Git History (Advanced):**
   - Use `git-filter-repo` or BFG Repo-Cleaner to remove secrets from history
   - Force push (⚠️ coordinate with team first)

## Prisma Database Migrations

This project uses Prisma for database management. Migrations are automatically run during the build process on Render.

### Automatic Migration (Recommended)

Migrations are automatically applied during the build process via the `buildCommand` in `render.yaml`:

```bash
npm install && npx prisma generate && npx prisma migrate deploy || npx prisma db push
```

This will:
1. Install dependencies
2. Generate Prisma Client
3. Run pending migrations (`prisma migrate deploy`)
4. Fallback to `prisma db push` if migrations fail (for schema sync)

### Manual Migration on Render

If you need to run migrations manually on Render:

1. **Access Render Shell:**
   - Go to your Render dashboard
   - Select your service (ambitionly-backend)
   - Click on "Shell" tab
   - This opens a terminal connected to your Render instance

2. **Run Migration Command:**
   ```bash
   npx prisma migrate deploy
   ```

3. **If Migration Fails (Fallback):**
   ```bash
   npx prisma db push
   ```
   ⚠️ **Note:** `db push` syncs the schema directly without migration history. Use only if `migrate deploy` fails.

### Available Migration Scripts

- `npm run db:migrate` - Create and apply a new migration (development)
- `npm run db:migrate:deploy` - Apply pending migrations (production)
- `npm run db:push` - Push schema changes directly (fallback)
- `npm run db:generate` - Generate Prisma Client
- `npm run db:setup` - Generate client and push schema

### Troubleshooting

**Error: "Table does not exist"**
- Run `npx prisma migrate deploy` in Render shell
- If that fails, use `npx prisma db push` as fallback

**Error: "Migration history out of sync"**
- Use `npx prisma db push` to sync schema directly
- Or reset migration history (⚠️ destructive)

**Error: "Can't reach database server"**
- Verify `DATABASE_URL` environment variable is set correctly
- Check database connection string format
- Ensure database is accessible from Render

### Migration Files

Migrations are stored in `prisma/migrations/` directory. Each migration includes:
- Migration SQL file
- Migration metadata

**Current Migrations:**
- `20251115202816_init_all_models` - Initial migration for users and email_records tables

