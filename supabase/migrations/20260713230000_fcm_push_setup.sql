-- Push notifications (FCM): device tokens + dedup log + cron trigger.

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY fcm_tokens_select_own ON public.fcm_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY fcm_tokens_insert_own ON public.fcm_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY fcm_tokens_update_own ON public.fcm_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY fcm_tokens_delete_own ON public.fcm_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.fcm_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO authenticated;
GRANT ALL ON public.fcm_tokens TO service_role;

-- Dedup log: only the Edge Function (service_role) ever touches this table,
-- so there are deliberately no policies granting access to authenticated/anon.
CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  entity_id text NOT NULL,
  period_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, entity_id, period_key)
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notification_log FROM anon;
REVOKE ALL ON public.notification_log FROM authenticated;
GRANT ALL ON public.notification_log TO service_role;

-- Scheduled dispatch: invoke the send-notifications Edge Function every 5
-- minutes. Requires pg_cron + pg_net (enable both under Database > Extensions
-- if this migration fails on either CREATE EXTENSION statement — some
-- Supabase plans require enabling them from the dashboard instead of SQL).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- NOTE: this migration deliberately stops here. The cron.schedule() call
-- below needs the send-notifications Edge Function deployed AND the
-- service_role key stored in Vault first — do not hardcode the raw key into
-- a committed migration file. Run this manually (dashboard SQL editor or
-- psql) once both are ready, replacing <PROJECT_REF>:
--
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--
--   select cron.schedule(
--     'send-notifications-tick',
--     '*/5 * * * *',
--     $cron$
--     select net.http_post(
--       url := 'https://<PROJECT_REF>.functions.supabase.co/send-notifications',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || (
--           select decrypted_secret from vault.decrypted_secrets
--           where name = 'service_role_key'
--         ),
--         'Content-Type', 'application/json'
--       ),
--       body := '{}'::jsonb
--     );
--     $cron$
--   );
