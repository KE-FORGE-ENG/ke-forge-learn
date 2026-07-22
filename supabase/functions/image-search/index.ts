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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { q, queries, limit } = await req.json();
    const list: string[] = (queries?.length ? queries : [q]).filter(Boolean);
    const perQ = Math.max(1, Math.min(6, limit ?? 4));

    const perQueryResults = await Promise.all(list.map(async (query: string) => {
      const [a, b] = await Promise.all([openverse(query, perQ), wikimedia(query, perQ)]);
      // Interleave openverse + wikimedia so we get a mix
      const merged: Img[] = [];
      const max = Math.max(a.length, b.length);
      for (let i = 0; i < max; i++) {
        if (a[i]) merged.push(a[i]);
        if (b[i]) merged.push(b[i]);
      }
      return { query, images: merged.slice(0, perQ * 2) };
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
