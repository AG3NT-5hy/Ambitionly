# Deployment Instructions

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

