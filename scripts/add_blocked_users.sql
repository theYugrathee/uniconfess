-- Add blockedUsers column to users table if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS "blockedUsers" text[] DEFAULT '{}'::text[];

-- Force schema cache reload (optional but good practice)
NOTIFY pgrst, 'reload config';
