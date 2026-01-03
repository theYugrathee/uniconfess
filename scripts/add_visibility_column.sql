-- Add visibility column to confessions table
ALTER TABLE public.confessions 
ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'campus';

-- Update existing records to be 'campus' by default
UPDATE public.confessions 
SET visibility = 'campus' 
WHERE visibility IS NULL;

-- Create an index for faster filtering
CREATE INDEX IF NOT EXISTS idx_confessions_visibility ON public.confessions(visibility);
