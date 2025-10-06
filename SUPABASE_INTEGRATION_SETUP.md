# Supabase Integration Setup Guide

This guide will help you set up Supabase integration for persistent user goal/roadmap data storage.

## Prerequisites

1. A Supabase account and project
2. PostgreSQL database (can be Supabase's built-in PostgreSQL)

## Setup Steps

### 1. Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/ambitionly"

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Supabase Service Role Key (for server-side operations)
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
```

### 2. Supabase Database Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL script from `supabase-setup.sql` to create the `user_data` table

### 3. Update Supabase Client Configuration

The Supabase client is already configured in `lib/supabase.ts`. Make sure your environment variables are properly set.

### 4. Database Migration

Since we changed from SQLite to PostgreSQL, you'll need to:

1. Update your `DATABASE_URL` to point to your PostgreSQL database
2. Run the following commands:

```bash
# Generate Prisma client
npx prisma generate

# Push the schema to the database
npx prisma db push

# Optional: Seed the database
npx prisma db seed
```

### 5. Test the Integration

You can test the integration by:

1. Starting your development server
2. Creating a new user account
3. Setting up a goal/roadmap
4. Logging out and logging back in
5. Verifying that your data persists

## How It Works

### Data Flow

1. **User Registration**: 
   - User data is stored in both Prisma (PostgreSQL) and Supabase
   - Prisma handles authentication
   - Supabase handles user goal/roadmap data

2. **User Login**:
   - Authentication is verified through Prisma
   - User data is automatically loaded from Supabase
   - Data is returned in the login response

3. **Data Sync**:
   - All user goal/roadmap data is stored in Supabase
   - Data is automatically synced when users make changes
   - Data persists across sessions and devices

### Key Files Modified

- `prisma/schema.prisma` - Updated to use PostgreSQL and include Supabase ID
- `lib/supabase-user-data.ts` - New service for Supabase data operations
- `backend/trpc/routes/user/sync/route.ts` - Updated to use Supabase instead of in-memory storage
- `backend/trpc/routes/auth/login/route.ts` - Updated to load user data on login
- `backend/trpc/routes/auth/signup/route.ts` - Updated to create Supabase users

### Database Schema

The `user_data` table in Supabase contains:
- `user_id` - Links to the Prisma user ID
- `goal` - User's goal text
- `timeline` - Goal timeline
- `time_commitment` - Time commitment
- `answers` - JSON array of user answers
- `roadmap` - JSON object containing the roadmap
- `completed_tasks` - JSON array of completed tasks
- `streak_data` - JSON object with streak information
- `task_timers` - JSON array of task timers
- `last_sync_at` - Timestamp of last sync
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   - Ensure your `.env` file is in the project root
   - Restart your development server after adding environment variables

2. **Supabase Connection Issues**
   - Verify your Supabase URL and API keys
   - Check that your Supabase project is active

3. **Database Connection Issues**
   - Verify your `DATABASE_URL` is correct
   - Ensure your PostgreSQL database is running

4. **Permission Issues**
   - Check that your Supabase RLS policies are correctly configured
   - Verify that your service role key has the necessary permissions

### Testing Database Connection

You can test the database connection using the existing test function in `lib/test-database.ts`:

```typescript
import { testDatabaseConnection } from '@/lib/test-database';

// Test the connection
testDatabaseConnection();
```

## Security Notes

- The Supabase table uses Row Level Security (RLS) to ensure users can only access their own data
- All user data operations are authenticated through the tRPC context
- Sensitive operations use the Supabase service role key
- User passwords are hashed using SHA-256 (consider upgrading to bcrypt for production)

## Next Steps

1. Set up your Supabase project and run the SQL script
2. Configure your environment variables
3. Test the integration
4. Deploy to production with proper security measures
