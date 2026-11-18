-- Reapply after restoring a project: frontend switches do not protect Data API.
-- Preserve rows while replacing stale/permissive policies and broad grants.
DO $$
DECLARE
  target text;
  old_policy record;
BEGIN
  FOREACH target IN ARRAY ARRAY['favorites', 'medical_profiles', 'visit_history', 'reviews']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
    FOR old_policy IN SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', old_policy.policyname, target);
    END LOOP;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', target);
    EXECUTE format('GRANT SELECT, INSERT, DELETE ON TABLE public.%I TO authenticated', target);

    IF target = 'reviews' THEN
      -- Reviews are deliberately public in the existing product/schema. Only
      -- authenticated owners may create, change, or delete them.
      EXECUTE 'GRANT SELECT ON TABLE public.reviews TO anon';
      EXECUTE 'CREATE POLICY review_public_read ON public.reviews FOR SELECT TO anon, authenticated USING (true)';
    ELSE
      EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))', target);
    END IF;
    EXECUTE format('CREATE POLICY owner_create ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()))', target);
    EXECUTE format('CREATE POLICY owner_delete ON public.%I FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()))', target);
    IF target <> 'favorites' THEN
      EXECUTE format('GRANT UPDATE ON TABLE public.%I TO authenticated', target);
      EXECUTE format('CREATE POLICY owner_update ON public.%I FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))', target);
    END IF;
  END LOOP;
END $$;

-- Public reference data is read-only for browser roles. Keep the crawler's
-- explicit service_role grants; RLS alone does not guard TRUNCATE privileges.
ALTER TABLE public.hospital_specialties ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE old_policy record;
BEGIN
  FOR old_policy IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hospital_specialties'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.hospital_specialties', old_policy.policyname);
  END LOOP;
END $$;
REVOKE ALL ON TABLE public.hospital_specialties FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.hospital_specialties TO anon, authenticated;
CREATE POLICY reference_public_read ON public.hospital_specialties
  FOR SELECT TO anon, authenticated USING (true);
