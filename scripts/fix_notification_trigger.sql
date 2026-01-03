
-- Corrected Notification Trigger Function
-- Fixes: Casts headers and body to jsonb, which is what net.http_post expects

create or replace function public.notify_on_confession()
returns trigger
language plpgsql
security definer -- execute as owner to ensure access to net schema
as $$
begin
  if NEW.visibility != 'campus' then
    return NEW;
  end if;

  perform
    net.http_post(
      url := 'https://qstizfuimenznizfhpkk.functions.supabase.co/notify-college',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := json_build_object(
        'type', 'INSERT',
        'table', 'confessions',
        'record', row_to_json(NEW),
        'schema', 'public'
      )::jsonb
    );
  return NEW;
end;
$$;
