-- Allowlist de domínios de provedores reais (mantida em sync com src/lib/emailValidation.ts)
CREATE OR REPLACE FUNCTION public.is_allowed_email_domain(_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(split_part(_email, '@', 2)) IN (
    'gmail.com','googlemail.com',
    'outlook.com','outlook.com.br','hotmail.com','hotmail.com.br','live.com','msn.com',
    'icloud.com','me.com','mac.com',
    'yahoo.com','yahoo.com.br','ymail.com',
    'proton.me','protonmail.com',
    'zoho.com','yandex.com','gmx.com'
  );
$$;

-- Trigger de signup: valida domínio e cria profile/user_data. Roda como SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR NOT public.is_allowed_email_domain(NEW.email) THEN
    RAISE EXCEPTION 'Provedor de e-mail não permitido. Use Gmail, Outlook, iCloud, Yahoo, Proton ou similar.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_data (user_id, data)
  VALUES (NEW.id, '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END; $$;

-- Endurecer policies: restringir de public para authenticated
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS user_data_select_own ON public.user_data;
DROP POLICY IF EXISTS user_data_insert_own ON public.user_data;
DROP POLICY IF EXISTS user_data_update_own ON public.user_data;
DROP POLICY IF EXISTS user_data_delete_own ON public.user_data;

CREATE POLICY user_data_select_own ON public.user_data
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_data_insert_own ON public.user_data
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_data_update_own ON public.user_data
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_data_delete_own ON public.user_data
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Remover privilégios do role anon (defesa em profundidade)
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_data FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_data TO service_role;