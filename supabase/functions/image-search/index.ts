// Free image reference lookup — OpenVerse (CC-licensed) + Wikipedia thumbnails.
// No API key needed. Returns thumbnails + source page URLs so the client can
// display small reference images alongside a lesson.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Img = { url: string; thumbnail: string; title: string; source: string; author?: string };

async function openverse(q: string, limit: number): Promise<Img[]> {
  try {
    const r = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${limit}&license_type=all`,
      { headers: { Accept: "application/json" } },
    );
    if (!r.ok) return [];
    const d = await r.json();
    const results = (d.results ?? []) as any[];
    return results.map((it) => ({
      url: it.url,
      thumbnail: it.thumbnail || it.url,
      title: it.title || q,
      source: it.foreign_landing_url || it.url,
      author: it.creator,
    }));
  } catch { return []; }
}

async function wikimedia(q: string, limit: number): Promise<Img[]> {
  try {
    const r = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(q)}&gsrlimit=${limit}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400&origin=*`,
    );
    if (!r.ok) return [];
    const d = await r.json();
    const pages = d?.query?.pages ?? {};
    const out: Img[] = [];
    for (const k of Object.keys(pages)) {
      const p = pages[k];
      const info = (p.imageinfo ?? [])[0];
      if (!info) continue;
      const url = info.thumburl || info.url;
      if (!url) continue;
      out.push({
        url: info.url || url,
        thumbnail: url,
        title: p.title?.replace(/^File:/, "") ?? q,
        source: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
        author: info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "").trim(),
      });
    }
    return out;
  } catch { return []; }
}

const STOP = new Set([
  "the","a","an","and","or","of","to","in","on","for","with","from","by","is","are","was","were",
  "this","that","these","those","it","its","as","at","be","how","what","why","introduction","overview",
  "day","lesson","part","chapter","topic","basics","basic","concept","concepts","understanding","study",
]);

function tokenize(s: string): string[] {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w));
}

// Loose stem so "cells" matches "cell", "mitochondria" matches "mitochondrial"
function stem(w: string): string {
  return w.replace(/(ies|es|s|ing|ed|al|ic)$/, "");
}

function relevance(img: Img, terms: string[]): number {
  const hay = new Set(tokenize(`${img.title} ${img.author ?? ""} ${img.source}`).map(stem));
  if (!hay.size) return 0;
  let hits = 0;
  for (const t of terms) if (hay.has(t)) hits++;
  return terms.length ? hits / terms.length : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { q, queries, limit, context } = await req.json();
    const list: string[] = (queries?.length ? queries : [q]).filter(Boolean);
    const perQ = Math.max(1, Math.min(6, limit ?? 4));

    const perQueryResults = await Promise.all(list.map(async (query: string) => {
      const [a, b] = await Promise.all([openverse(query, perQ * 3), wikimedia(query, perQ * 3)]);
      // Interleave openverse + wikimedia so we get a mix
      const merged: Img[] = [];
      const max = Math.max(a.length, b.length);
      for (let i = 0; i < max; i++) {
        if (a[i]) merged.push(a[i]);
        if (b[i]) merged.push(b[i]);
      }

      // STRICT relevance gate: image metadata must overlap the query terms.
      const terms = Array.from(new Set(tokenize(query).map(stem)));
      const ctxTerms = Array.from(new Set(tokenize(context ?? "").map(stem)));
      const scored = merged
        .map((img) => {
          const primary = relevance(img, terms);
          const secondary = ctxTerms.length ? relevance(img, ctxTerms) : 0;
          return { img, score: primary + secondary * 0.35, primary };
        })
        // Must match the query itself, not just generic context.
        .filter((s) => (terms.length >= 2 ? s.primary >= 0.5 : s.primary >= 0.99))
        .sort((x, y) => y.score - x.score);

      return { query, images: scored.slice(0, perQ).map((s) => s.img) };
    }));

    // Deduplicate by thumbnail URL across all queries
    const seen = new Set<string>();
    const images: Img[] = [];
    for (const r of perQueryResults) {
      for (const img of r.images) {
        if (!img.thumbnail || seen.has(img.thumbnail)) continue;
        seen.add(img.thumbnail);
        images.push(img);
      }
    }
    const sources = Array.from(new Set(images.map((i) => i.source))).filter(Boolean);

    return new Response(JSON.stringify({ images, sources, results: perQueryResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return new Response(JSON.stringify({ error: msg, images: [], sources: [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

