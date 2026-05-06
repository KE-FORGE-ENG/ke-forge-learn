
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  source_type text not null check (source_type in ('pdf','topic')),
  storage_path text,
  pages jsonb not null default '[]'::jsonb, -- array of {page, text}
  page_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create policy "doc_all_own" on public.documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Learning plans
create table public.learning_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  document_id uuid not null references public.documents on delete cascade,
  days int not null check (days between 1 and 5),
  current_day int not null default 1,
  page_chunks jsonb not null default '[]'::jsonb, -- array of {day, startPage, endPage}
  created_at timestamptz not null default now()
);
alter table public.learning_plans enable row level security;
create policy "plans_all_own" on public.learning_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Daily sessions (cached AI output)
create table public.daily_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.learning_plans on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  day int not null,
  content jsonb,           -- {summary, classification, concepts[], followups[], youtubeQuery}
  simplified jsonb,        -- "explain like I'm 5" version
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(plan_id, day)
);
alter table public.daily_sessions enable row level security;
create policy "sessions_all_own" on public.daily_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Interactions
create table public.user_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plan_id uuid references public.learning_plans on delete cascade,
  day int,
  kind text not null, -- 'lost', 'complete', 'view', 'quiz_score'
  payload jsonb,
  created_at timestamptz not null default now()
);
alter table public.user_interactions enable row level security;
create policy "inter_all_own" on public.user_interactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Quizzes
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plan_id uuid not null references public.learning_plans on delete cascade,
  day int,
  questions jsonb not null, -- [{type,question,options?,answer,explanation}]
  answers jsonb,            -- user answers
  score numeric,
  weak_areas jsonb,
  created_at timestamptz not null default now()
);
alter table public.quizzes enable row level security;
create policy "quiz_all_own" on public.quizzes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket for PDFs
insert into storage.buckets (id, name, public) values ('pdfs', 'pdfs', false)
on conflict (id) do nothing;

create policy "pdf_read_own" on storage.objects for select
  using (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "pdf_insert_own" on storage.objects for insert
  with check (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "pdf_delete_own" on storage.objects for delete
  using (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
