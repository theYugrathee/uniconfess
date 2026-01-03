
-- TRIGGER: Notify users internally when a confession is posted
-- This ensures the "Notifications" tab and "Sound" works in the app.

create or replace function public.notify_users_of_new_confession()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.visibility != 'campus' then
    return NEW;
  end if;

  -- Insert a notification for every user in the same college
  insert into public.notifications (
    id,
    "userId", 
    type, 
    "actorId", 
    "actorName", 
    "actorAvatar", 
    "entityId", 
    content, 
    timestamp,
    read
  )
  select 
    gen_random_uuid()::text, -- Generate ID
    id, 
    'system', 
    'system', 
    'New Confession', 
    '', 
    NEW.id, 
    'Someone posted a new confession', 
    (extract(epoch from now()) * 1000)::bigint,
    false
  from public.users
  where "collegeId" = NEW."collegeId" 
    and id != NEW."userId"; -- Don't notify the author
  
  return NEW;
end;
$$;

-- Create the trigger
drop trigger if exists on_confession_created_internal on public.confessions;

create trigger on_confession_created_internal
after insert on public.confessions
for each row
execute function public.notify_users_of_new_confession();
