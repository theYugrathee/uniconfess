
-- Run this in the Supabase SQL Editor to find and remove the problematic trigger

-- 1. First, let's see which triggers exist on the confessions table
SELECT 
    trigger_name
FROM 
    information_schema.triggers
WHERE 
    event_object_table = 'confessions';

-- 2. Once you see the trigger name (it might be something like 'webhook_trigger' or similar),
-- Run the following command (Replace TRIGGER_NAME_HERE with the actual name):

-- DROP TRIGGER IF EXISTS "TRIGGER_NAME_HERE" ON public.confessions;
