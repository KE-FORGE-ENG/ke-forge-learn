CREATE TABLE public.group_shared_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  days integer NOT NULL DEFAULT 1,
  author_name text NOT NULL DEFAULT 'learner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, plan_id)
);
GRANT SELECT, INSERT, DELETE ON public.group_shared_plans TO authenticated;
GRANT ALL ON public.group_shared_plans TO service_role;
ALTER TABLE public.group_shared_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY gsp_select ON public.group_shared_plans FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY gsp_insert ON public.group_shared_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY gsp_delete ON public.group_shared_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);