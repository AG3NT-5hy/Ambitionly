-- Supabase setup script for user data table
-- Run this in your Supabase SQL editor

-- Create the user_data table
CREATE TABLE IF NOT EXISTS user_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  goal TEXT,
  timeline TEXT,
  time_commitment TEXT,
  answers JSONB,
  roadmap JSONB,
  completed_tasks JSONB,
  streak_data JSONB,
  task_timers JSONB,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON user_data(user_id);

-- Create an index on last_sync_at for sorting
CREATE INDEX IF NOT EXISTS idx_user_data_last_sync_at ON user_data(last_sync_at);

-- Enable Row Level Security (RLS)
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows users to only access their own data
-- This assumes you're using Supabase Auth and the user_id matches the auth.uid()
CREATE POLICY "Users can only access their own data" ON user_data
  FOR ALL USING (user_id = auth.uid()::text);

-- Alternative policy if you're using a different user identification method
-- Uncomment and modify as needed:
-- CREATE POLICY "Users can only access their own data by user_id" ON user_data
--   FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update updated_at
CREATE TRIGGER update_user_data_updated_at
  BEFORE UPDATE ON user_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
