DROP POLICY IF EXISTS gsp_insert ON public.group_shared_plans;
CREATE POLICY gsp_insert ON public.group_shared_plans FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_group_member(group_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.learning_plans p
    WHERE p.id = plan_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY plans_group_shared_read ON public.learning_plans FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_shared_plans gsp
    WHERE gsp.plan_id = learning_plans.id
      AND public.is_group_member(gsp.group_id, auth.uid())
  )
);

CREATE POLICY docs_group_shared_read ON public.documents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.learning_plans lp
    JOIN public.group_shared_plans gsp ON gsp.plan_id = lp.id
    WHERE lp.document_id = documents.id
      AND public.is_group_member(gsp.group_id, auth.uid())
  )
);

CREATE POLICY flashcards_group_shared_read ON public.flashcards FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_shared_plans gsp
    WHERE gsp.plan_id = flashcards.plan_id
      AND public.is_group_member(gsp.group_id, auth.uid())
  )
);

CREATE TABLE public.group_challenge_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  plan_title text NOT NULL,
  score_pct integer NOT NULL CHECK (score_pct BETWEEN 0 AND 100),
  correct_count integer NOT NULL CHECK (correct_count >= 0),
  question_count integer NOT NULL CHECK (question_count > 0 AND correct_count <= question_count),
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.group_challenge_scores TO authenticated;
GRANT ALL ON public.group_challenge_scores TO service_role;
ALTER TABLE public.group_challenge_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY gcs_select_member ON public.group_challenge_scores FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY gcs_insert_self ON public.group_challenge_scores FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()));