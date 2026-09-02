create extension if not exists vector;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_number int not null default 1,
  section_title text,
  chunk_index int not null default 0,
  content text not null,
  token_estimate int not null default 0,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chunks_own_all" ON public.document_chunks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

create index if not exists document_chunks_embedding_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists document_chunks_doc_idx on public.document_chunks (document_id, page_number);

create index if not exists document_chunks_fts_idx
  on public.document_chunks using gin (to_tsvector('english', content));

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  target_document_id uuid,
  query_text text default '',
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  page_number int,
  section_title text,
  similarity float,
  keyword_rank float
)
language sql
stable
security invoker
set search_path = public
as $$
  with vec as (
    select c.id, c.content, c.page_number, c.section_title,
           1 - (c.embedding <=> query_embedding) as similarity,
           0::float as keyword_rank
    from public.document_chunks c
    where c.document_id = target_document_id
      and c.embedding is not null
      and 1 - (c.embedding <=> query_embedding) > match_threshold
    order by c.embedding <=> query_embedding
    limit match_count * 2
  ),
  kw as (
    select c.id, c.content, c.page_number, c.section_title,
           0::float as similarity,
           ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text))::float as keyword_rank
    from public.document_chunks c
    where c.document_id = target_document_id
      and coalesce(query_text, '') <> ''
      and to_tsvector('english', c.content) @@ plainto_tsquery('english', query_text)
    order by keyword_rank desc
    limit match_count
  ),
  merged as (
    select * from vec
    union all
    select * from kw
  )
  select m.id, max(m.content) as content, max(m.page_number) as page_number,
         max(m.section_title) as section_title,
         max(m.similarity) as similarity, max(m.keyword_rank) as keyword_rank
  from merged m
  group by m.id
  order by (max(m.similarity) + max(m.keyword_rank) * 0.5) desc
  limit match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, text, float, int) TO authenticated;