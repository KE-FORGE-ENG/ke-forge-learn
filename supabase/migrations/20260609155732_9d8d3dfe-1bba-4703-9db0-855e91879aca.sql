
-- Bookmarks for PDF pages
CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  note TEXT,
  color TEXT NOT NULL DEFAULT 'yellow',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_all_own" ON public.bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_bookmarks_user ON public.bookmarks(user_id, document_id, page);

-- Study groups
CREATE TABLE public.study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  join_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_groups TO authenticated;
GRANT ALL ON public.study_groups TO service_role;
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member?
CREATE OR REPLACE FUNCTION public.is_group_member(_group UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user)
$$;

CREATE POLICY "sg_select_member" ON public.study_groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "sg_insert_owner" ON public.study_groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "sg_update_owner" ON public.study_groups FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "sg_delete_owner" ON public.study_groups FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "gm_select_member" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "gm_insert_self" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gm_update_self" ON public.group_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "gm_delete_self" ON public.group_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Add share token + public flag to learning_plans for shared decks
ALTER TABLE public.learning_plans
  ADD COLUMN share_token TEXT UNIQUE,
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Allow public read of flashcards when the plan is shared
GRANT SELECT ON public.learning_plans TO anon;
GRANT SELECT ON public.flashcards TO anon;
GRANT SELECT ON public.documents TO anon;

CREATE POLICY "plans_public_read" ON public.learning_plans FOR SELECT TO anon, authenticated
  USING (is_public = true AND share_token IS NOT NULL);
CREATE POLICY "fc_public_read" ON public.flashcards FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.learning_plans p WHERE p.id = flashcards.plan_id AND p.is_public = true));
CREATE POLICY "doc_public_read" ON public.documents FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.learning_plans p WHERE p.document_id = documents.id AND p.is_public = true));
