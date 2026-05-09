
CREATE TABLE public.flashcards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID,
  day INTEGER,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  ease NUMERIC NOT NULL DEFAULT 2.5,
  interval_days NUMERIC NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY fc_all_own ON public.flashcards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_fc_due ON public.flashcards(user_id, due_at);
CREATE INDEX idx_fc_plan ON public.flashcards(plan_id, day);

CREATE TABLE public.reminder_settings (
  user_id UUID NOT NULL PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  time_of_day TEXT NOT NULL DEFAULT '18:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY rs_all_own ON public.reminder_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.mindmaps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, plan_id)
);
ALTER TABLE public.mindmaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY mm_all_own ON public.mindmaps FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
