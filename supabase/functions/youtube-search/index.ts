// Semantic YouTube search: builds optimized queries from PDF/day context using
// Lovable AI, fetches candidates from YouTube, then re-ranks them by relevance.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YT_KEY = Deno.env.get("YOUTUBE_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type DayCtx = {
  q?: string;
  title?: string;
  summary?: string;
  classification?: string[];
  concepts?: { name: string; explanation?: string }[];
  docTitle?: string;
  sourceExcerpt?: string;
};

async function callAI(messages: any[], tool?: any) {
  const body: any = {
    model: "google/gemini-2.5-flash-lite",
    messages,
  };
  if (tool) {
    body.tools = [tool];
    body.tool_choice = { type: "function", function: { name: tool.function.name } };
  }
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`AI ${r.status}`);
  const d = await r.json();
  if (tool) {
    const args = d.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return args ? JSON.parse(args) : null;
  }
  return d.choices?.[0]?.message?.content;
}

async function ytSearch(query: string, max = 8) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: String(max),
    q: query,
    relevanceLanguage: "en",
    videoEmbeddable: "true",
    safeSearch: "moderate",
    order: "relevance",
    key: YT_KEY!,
  });
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  const d = await r.json();
  return (d.items || []).map((it: any) => ({
    id: it.id.videoId,
    title: it.snippet.title,
    channel: it.snippet.channelTitle,
    thumbnail: it.snippet.thumbnails?.medium?.url,
    description: it.snippet.description,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let ctx: DayCtx = {};
    if (req.method === "POST") {
      ctx = await req.json().catch(() => ({}));
    } else {
      const url = new URL(req.url);
      ctx.q = url.searchParams.get("q") || "";
    }

    const baseQ = (ctx.q || ctx.title || ctx.docTitle || "").slice(0, 200);
    if (!baseQ && !ctx.summary) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!YT_KEY) {
      return new Response(JSON.stringify({
        items: [
          { id: "dQw4w9WgXcQ", title: `${baseQ} — overview`, channel: "Demo", thumbnail: "" },
          { id: "kJQP7kiw5Fk", title: `${baseQ} — deep dive`, channel: "Demo", thumbnail: "" },
        ],
        mock: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 1: Generate 2-3 optimized search queries from the day context
    let queries: string[] = [baseQ];
    if (LOVABLE_API_KEY && (ctx.summary || ctx.concepts?.length)) {
      try {
        const conceptList = (ctx.concepts || []).slice(0, 6).map((c) => c.name).join(", ");
        const tags = (ctx.classification || []).join(", ");
        const excerpt = (ctx.sourceExcerpt || "").slice(0, 1500);
        const out = await callAI(
          [
            {
              role: "system",
              content:
                "You craft YouTube search queries that surface high-quality educational tutorial videos closely matching a student's lesson. Output 3 short, distinct queries (5-10 words each) targeting the core concepts. Avoid generic words; include subject-specific terms.",
            },
            {
              role: "user",
              content: `Document: ${ctx.docTitle || ""}\nLesson title: ${ctx.title || ""}\nTopics: ${tags}\nKey concepts: ${conceptList}\nSummary: ${(ctx.summary || "").slice(0, 600)}\nExcerpt: ${excerpt}`,
            },
          ],
          {
            type: "function",
            function: {
              name: "queries",
              description: "Return optimized YouTube search queries.",
              parameters: {
                type: "object",
                properties: {
                  queries: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
                },
                required: ["queries"],
                additionalProperties: false,
              },
            },
          },
        );
        if (out?.queries?.length) queries = out.queries.slice(0, 3);
      } catch (e) {
        console.error("query gen failed", e);
      }
    }

    // Step 2: Fetch candidates for each query, dedupe by video id
    const seen = new Map<string, any>();
    for (const q of queries) {
      const items = await ytSearch(q, 6);
      for (const it of items) if (!seen.has(it.id)) seen.set(it.id, it);
      if (seen.size >= 18) break;
    }
    let candidates = Array.from(seen.values());

    // Step 3: Semantic re-rank against lesson context
    if (LOVABLE_API_KEY && candidates.length > 2 && (ctx.summary || ctx.title)) {
      try {
        const ranked = await callAI(
          [
            {
              role: "system",
              content:
                "You rank YouTube videos by how closely they help a student learn the given lesson. Score 0-100 (semantic relevance, depth, educational quality). Return the top videos sorted by score.",
            },
            {
              role: "user",
              content: `LESSON\nTitle: ${ctx.title || ""}\nTopics: ${(ctx.classification || []).join(", ")}\nConcepts: ${(ctx.concepts || []).map((c) => c.name).join(", ")}\nSummary: ${(ctx.summary || "").slice(0, 500)}\n\nVIDEOS\n${candidates
                .map((c, i) => `[${i}] ${c.title} — ${c.channel}\n${(c.description || "").slice(0, 180)}`)
                .join("\n\n")}`,
            },
          ],
          {
            type: "function",
            function: {
              name: "rank",
              description: "Return ranked indices with scores.",
              parameters: {
                type: "object",
                properties: {
                  ranking: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number" },
                        score: { type: "number" },
                        reason: { type: "string" },
                      },
                      required: ["index", "score"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["ranking"],
                additionalProperties: false,
              },
            },
          },
        );
        if (ranked?.ranking?.length) {
          const sorted = [...ranked.ranking].sort((a: any, b: any) => b.score - a.score);
          candidates = sorted
            .map((r: any) => candidates[r.index] && { ...candidates[r.index], score: r.score, reason: r.reason })
            .filter(Boolean);
        }
      } catch (e) {
        console.error("rerank failed", e);
      }
    }

    return new Response(JSON.stringify({ items: candidates.slice(0, 6), queries }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
