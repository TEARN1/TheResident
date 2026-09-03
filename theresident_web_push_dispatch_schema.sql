-- theresident_web_push_dispatch_schema.sql
--
-- Phase E of docs/OFFICIAL-BROADCAST-STRATEGY.md: make an urgent area notice
-- actually reach a phone with the app closed.
--
-- THE GAP THIS CLOSES. Everything through Phase D lands in the notifications
-- rail, which the app reads when it is opened. For a bin-day reminder that is
-- fine. For "gas leak on Main Road, evacuate now" it is close to not
-- delivering at all. This calls the web-push-send edge function so the
-- resident's device wakes up.
--
-- IT MUST NEVER BLOCK THE SEND. Push is a mirror of a notification that has
-- already been written, not the delivery itself. If the VAPID secrets are
-- missing, the key is wrong, or the push service is down, the broadcast still
-- succeeded and the notice is still in the rail — so every failure here is
-- swallowed deliberately and the send commits regardless. The alternative,
-- rolling back a delivered evacuation notice because a push gateway
-- misbehaved, is plainly worse.
--
-- WHY ONLY urgent AND critical. Anything quieter does not justify vibrating a
-- phone; that is the same line res_fanout_broadcast already draws for the bell.
--
-- SETUP REQUIRED BEFORE THIS DOES ANYTHING (see the panel in the profile page
-- and the README section):
--   1. Supabase Dashboard → Edge Functions → Secrets:
--        VAPID_PRIVATE_KEY, VAPID_SUBJECT
--   2. Vault → new secret named 'service_role_key' holding the project's
--      service role key, so this function can authenticate to its own edge
--      function. Vault is used rather than a hardcoded value because a service
--      role key in a schema file is a service role key in git.
--
-- Paste into the Supabase SQL editor. Additive only.

create or replace function public.res_push_area_broadcast(p_broadcast uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row res_area_broadcasts;
  v_unit_name text;
  v_recipients uuid[];
  v_key text;
  v_url text;
begin
  select * into v_row from res_area_broadcasts where id = p_broadcast;
  if v_row.id is null then return 0; end if;
  if v_row.priority not in ('urgent', 'critical') then return 0; end if;

  select name into v_unit_name from res_org_units where id = v_row.unit_id;

  -- The audience is read back from the notifications already written, not
  -- re-resolved. Re-resolving could reach someone who was not notified, which
  -- would mean a push with nothing behind it in the app.
  select array_agg(n.recipient_id) into v_recipients
  from notifications n
  where n.type = 'res_area_broadcast'
    and (n.data ->> 'area_broadcast_id')::uuid = p_broadcast;

  if v_recipients is null or array_length(v_recipients, 1) is null then return 0; end if;

  begin
    select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key';
  exception when others then
    -- Vault not set up yet. Not an error worth failing a broadcast over.
    return 0;
  end;
  if v_key is null then return 0; end if;

  v_url := current_setting('app.settings.supabase_url', true);
  if v_url is null then
    select 'https://' || current_setting('request.headers', true)::json ->> 'host' into v_url;
  end if;
  -- Fall back to the project's known function host if neither is set.
  if v_url is null or v_url = 'https://' then
    v_url := 'https://feevvddvrjmfbhffccbf.supabase.co';
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/web-push-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'userIds', to_jsonb(v_recipients),
      'title', coalesce(v_unit_name, 'Notice') || ': ' || v_row.title,
      'body', v_row.body,
      'url', '/dashboard/community?tab=notices&area=' || v_row.id::text,
      -- Collapse repeats of the same notice rather than stacking them.
      'tag', 'area-' || v_row.id::text,
      -- An emergency stays on screen until the resident deals with it, the
      -- same rule the in-app urgent banner follows.
      'requireInteraction', v_row.priority = 'critical'
    )
  );

  return array_length(v_recipients, 1);
exception when others then
  -- Deliberate catch-all. See the header: a push failure must never undo a
  -- broadcast that has already been delivered in-app.
  return 0;
end;
$$;

revoke all on function public.res_push_area_broadcast(uuid) from public, anon, authenticated;
grant execute on function public.res_push_area_broadcast(uuid) to service_role;
