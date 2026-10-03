CREATE TABLE public.community_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL UNIQUE REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  subject text NOT NULL DEFAULT 'General',
  language text NOT NULL DEFAULT 'en',
  description text,
  author_name text NOT NULL DEFAULT 'learner',
  days integer NOT NULL DEFAULT 1,
  fork_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_publications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_publications TO authenticated;
GRANT ALL ON public.community_publications TO service_role;
ALTER TABLE public.community_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp_public_read ON public.community_publications FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY cp_insert_own ON public.community_publications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY cp_update_own ON public.community_publications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY cp_delete_own ON public.community_publications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.increment_fork(_pub uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.community_publications SET fork_count = fork_count + 1 WHERE id = _pub;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_fork(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.increment_fork(uuid) TO authenticated;