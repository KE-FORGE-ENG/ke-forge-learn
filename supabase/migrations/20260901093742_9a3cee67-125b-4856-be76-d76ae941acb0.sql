CREATE TABLE IF NOT EXISTS public.youtube_studies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id TEXT NOT NULL,
  video_url TEXT,
  title TEXT NOT NULL,
  channel TEXT,
  context_text TEXT,
  keypoints JSONB NOT NULL,
  lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_studies TO authenticated;
GRANT ALL ON public.youtube_studies TO service_role;
ALTER TABLE public.youtube_studies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own youtube studies" ON public.youtube_studies;
CREATE POLICY "Users manage their own youtube studies" ON public.youtube_studies FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS youtube_studies_user_created_idx ON public.youtube_studies (user_id, created_at DESC);