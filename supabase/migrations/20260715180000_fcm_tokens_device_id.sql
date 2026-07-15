-- fcm_tokens was deduped by (user_id, token), but FCM rotates a device's
-- token over time (and did on every SW re-registration during earlier
-- scope migrations). Each rotation inserted a NEW row instead of replacing
-- the old one, so a single physical device accumulated multiple still-valid
-- tokens — and send-notifications pushed to all of them, showing up to the
-- user as duplicate notifications for the same event.
--
-- Fix: identify the *device* (a client-generated UUID persisted in
-- localStorage, stable across token rotations) and dedupe on
-- (user_id, device_id) instead — a rotated token now overwrites its
-- device's row rather than adding a new one.

alter table public.fcm_tokens add column if not exists device_id text;

-- Backfill existing rows with a synthetic per-row device_id (their own id)
-- so the new unique constraint can be created without collisions; these
-- will naturally consolidate as each device re-registers with its real
-- persisted device_id going forward.
update public.fcm_tokens set device_id = id::text where device_id is null;

alter table public.fcm_tokens alter column device_id set not null;

create unique index if not exists fcm_tokens_user_device_key
  on public.fcm_tokens (user_id, device_id);

-- Manual cleanup for the one known affected user: collapse today's 4
-- accumulated iOS tokens down to the most recently seen one.
delete from public.fcm_tokens
where user_id = '7764b48a-ba1b-41a5-a1c0-a5bc3491ffe8'
  and id <> (
    select id from public.fcm_tokens
    where user_id = '7764b48a-ba1b-41a5-a1c0-a5bc3491ffe8'
    order by last_seen_at desc
    limit 1
  );
