// YouTube search proxy (mocked when no API key). Real call structure included.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YT_KEY = Deno.env.get("YOUTUBE_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    if (!q) return new Response(JSON.stringify({ items: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (YT_KEY) {
      const params = new URLSearchParams({
        part: "snippet",
        type: "video",
        maxResults: "5",
        q: `${q} tutorial explained`,
        relevanceLanguage: "en",
        videoEmbeddable: "true",
        safeSearch: "moderate",
        order: "relevance",
        key: YT_KEY,
      });
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const d = await r.json();
      const items = (d.items || []).map((it: any) => ({
        id: it.id.videoId,
        title: it.snippet.title,
        channel: it.snippet.channelTitle,
        thumbnail: it.snippet.thumbnails?.medium?.url,
        description: it.snippet.description,
      }));
      return new Response(JSON.stringify({ items }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mock fallback
    const mock = [
      { id: "dQw4w9WgXcQ", title: `${q} — overview`, channel: "Demo", thumbnail: "" },
      { id: "kJQP7kiw5Fk", title: `${q} — deep dive`, channel: "Demo", thumbnail: "" },
    ];
    return new Response(JSON.stringify({ items: mock, mock: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
