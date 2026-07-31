-- Lets a logged-in user delete their own account from the client (no
-- service_role key exposed client-side). SECURITY DEFINER runs as the
-- function owner (which has access to auth.users), but `auth.uid()` is
-- read from the caller's own JWT, so a user can only ever delete themself.
-- profiles/user_data both reference auth.users(id) ON DELETE CASCADE, so
-- deleting the auth user cleans up all of their app data in one shot.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC (incl. anon) by default; auth.uid()
-- is null for anon so it'd already be a no-op, but revoke explicitly anyway.
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
