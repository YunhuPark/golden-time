-- Apply as the database owner before enabling emergency QR sharing.
CREATE TABLE IF NOT EXISTS public.emergency_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  medical_data jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_shares ENABLE ROW LEVEL SECURITY;
-- Remove *all* prior policies, including permissive copies from setup guides.
DO $$ DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'emergency_shares'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.emergency_shares', p.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.emergency_shares FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.emergency_shares TO authenticated;
CREATE POLICY emergency_owner_read ON public.emergency_shares FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY emergency_owner_create ON public.emergency_shares FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND view_count = 0
    AND expires_at > now() AND expires_at <= now() + interval '24 hours'
    AND share_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE POLICY emergency_owner_delete ON public.emergency_shares FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Table owner executes this small, fixed-search-path capability lookup. No
-- dynamic SQL, user id input or unrestricted table result is exposed.
CREATE OR REPLACE FUNCTION public.read_emergency_share(p_token text)
RETURNS TABLE(id uuid, medical_data jsonb, expires_at timestamptz,
  view_count integer, created_at timestamptz)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  UPDATE public.emergency_shares AS s
    SET view_count = LEAST(COALESCE(s.view_count, 0)::bigint + 1, 2147483647)::integer
    WHERE s.share_token = p_token AND s.expires_at > now()
      AND p_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    RETURNING s.id, s.medical_data, s.expires_at, s.view_count, s.created_at;
$$;
REVOKE ALL ON FUNCTION public.read_emergency_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_emergency_share(text) TO anon, authenticated;
