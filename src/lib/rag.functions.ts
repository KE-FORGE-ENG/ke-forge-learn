// Stage 3 + 4 of the RAG pipeline: embedding + storage in pgvector, and
// hybrid (vector + keyword) retrieval with page citations.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildChunks, type SourcePage } from "./chunking";

const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims

async function embed(inputs: string[]): Promise<number[][]> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += 64) {
    const batch = inputs.slice(i, i + 64).map((t) => t.slice(0, 8000));
    let lastErr = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(EMBED_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
      });
      if (r.ok) {
        const d: any = await r.json();
        out.push(
          ...d.data.sort((a: any, b: any) => a.index - b.index).map((e: any) => e.embedding as number[]),
        );
        lastErr = "";
        break;
      }
      lastErr = `Embedding ${r.status}: ${(await r.text()).slice(0, 300)}`;
      if (r.status === 429 || r.status >= 500) {
        await new Promise((res) => setTimeout(res, 700 * (attempt + 1)));
        continue;
      }
      break;
    }
    if (lastErr) throw new Error(lastErr);
  }
  return out;
}

const pageSchema = z.object({ page: z.number(), text: z.string() });

export const ingestDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ documentId: z.string().uuid(), pages: z.array(pageSchema).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc, error: dErr } = await supabase
      .from("documents")
      .select("id, title, pages")
      .eq("id", data.documentId)
      .maybeSingle();
    if (dErr || !doc) return { inserted: 0, error: "Document not found" };

    const pages = (data.pages ?? (doc.pages as unknown as SourcePage[]) ?? []) as SourcePage[];
    const chunks = buildChunks(pages, doc.title ?? "Document");
    if (chunks.length === 0) return { inserted: 0 };

    try {
      const vectors = await embed(chunks.map((c) => c.content));
      await supabase.from("document_chunks").delete().eq("document_id", data.documentId);

      const rows = chunks.map((c, i) => ({
        document_id: data.documentId,
        user_id: userId,
        page_number: c.page_number,
        section_title: c.section_title,
        chunk_index: c.chunk_index,
        content: c.content,
        token_estimate: Math.ceil(c.content.length / 4),
        embedding: JSON.stringify(vectors[i]),
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from("document_chunks").insert(rows.slice(i, i + 100) as any);
        if (error) throw new Error(error.message);
      }
      return { inserted: rows.length };
    } catch (e) {
      return { inserted: 0, error: e instanceof Error ? e.message : "Indexing failed" };
    }
  });

export type RagMatch = {
  id: string;
  content: string;
  page_number: number;
  section_title: string | null;
  similarity: number;
  keyword_rank: number;
};

async function runSearch(
  supabase: any,
  documentId: string,
  query: string,
  matchCount: number,
  threshold: number,
): Promise<RagMatch[]> {
  const [qv] = await embed([query]);
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: JSON.stringify(qv),
    target_document_id: documentId,
    query_text: query,
    match_threshold: threshold,
    match_count: matchCount,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as RagMatch[];
}

export const searchDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        documentId: z.string().uuid().optional(),
        planId: z.string().uuid().optional(),
        query: z.string().min(1).max(4000),
        matchCount: z.number().min(1).max(10).optional(),
        threshold: z.number().min(0).max(1).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let documentId = data.documentId;
    if (!documentId && data.planId) {
      const { data: plan } = await supabase
        .from("learning_plans")
        .select("document_id")
        .eq("id", data.planId)
        .maybeSingle();
      documentId = plan?.document_id ?? undefined;
    }
    if (!documentId) return { matches: [] as RagMatch[], documentId: null };

    try {
      const matches = await runSearch(
        supabase,
        documentId,
        data.query,
        data.matchCount ?? 5,
        data.threshold ?? 0.35,
      );
      return { matches, documentId };
    } catch (e) {
      console.error("[rag] search failed", e);
      return { matches: [] as RagMatch[], documentId, error: e instanceof Error ? e.message : "search failed" };
    }
  });

export const documentIndexStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ documentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", data.documentId);
    return { chunks: count ?? 0 };
  });
