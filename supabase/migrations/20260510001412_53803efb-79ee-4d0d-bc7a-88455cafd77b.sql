
CREATE TABLE public.deep_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid,
  mode text NOT NULL DEFAULT 'pdf',
  topic text,
  notes_text text,
  position integer NOT NULL DEFAULT 1,
  web_search boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deep_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dp_all_own" ON public.deep_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_deep_progress_user_plan ON public.deep_progress(user_id, plan_id);
