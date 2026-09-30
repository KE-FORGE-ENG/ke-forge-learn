CREATE TABLE public.adaptive_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_text text NOT NULL DEFAULT '',
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  mode text NOT NULL DEFAULT 'A',
  chunks jsonb NOT NULL DEFAULT '[]'::jsonb,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adaptive_sessions TO authenticated;
GRANT ALL ON public.adaptive_sessions TO service_role;
ALTER TABLE public.adaptive_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY as_all_own ON public.adaptive_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER adaptive_sessions_touch BEFORE UPDATE ON public.adaptive_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();