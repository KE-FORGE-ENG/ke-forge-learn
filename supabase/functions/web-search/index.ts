// Lightweight web context fetcher (no API key required)
// Combines DuckDuckGo Instant Answer + Wikipedia summary
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function ddg(q: string) {
  try {
    const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`);
    const d = await r.json();
    const parts: string[] = [];
    if (d.AbstractText) parts.push(d.AbstractText);
    const related = (d.RelatedTopics || []).slice(0, 6).map((t: any) => t.Text).filter(Boolean);
    if (related.length) parts.push(related.join("\n"));
    return { text: parts.join("\n\n"), source: d.AbstractURL || null };
  } catch { return { text: "", source: null }; }
}

async function wiki(q: string) {
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
    if (!r.ok) return { text: "", source: null };
    const d = await r.json();
    return { text: d.extract || "", source: d.content_urls?.desktop?.page || null };
  } catch { return { text: "", source: null }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { q, queries } = await req.json();
    const list: string[] = queries?.length ? queries : [q];
    const results = await Promise.all(list.map(async (query: string) => {
      const [a, b] = await Promise.all([ddg(query), wiki(query)]);
      const text = [a.text, b.text].filter(Boolean).join("\n\n");
      return { query, text, sources: [a.source, b.source].filter(Boolean) };
    }));
    const combined = results.map((r) => `### Web context for "${r.query}"\n${r.text}`).filter((s) => s.length > 30).join("\n\n");
    const sources = Array.from(new Set(results.flatMap((r) => r.sources)));
    return new Response(JSON.stringify({ text: combined, sources, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return new Response(JSON.stringify({ error: msg, text: "", sources: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
