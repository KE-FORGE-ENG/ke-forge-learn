import { supabase } from "@/integrations/supabase/client";

export async function callAi(action: string, payload: any) {
  const { data, error } = await supabase.functions.invoke("ai-generate", {
    body: { action, payload },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export async function youtubeSearch(q: string) {
  const { data, error } = await supabase.functions.invoke("youtube-search", {
    body: {},
    method: "GET" as any,
  });
  // invoke doesn't pass query; use direct fetch instead
  if (error) {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-search?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    });
    return await r.json();
  }
  return data;
}

export async function youtubeSearchDirect(q: string, ctx?: Record<string, any>) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-search`;
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (ctx) {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ q, ...ctx }),
    });
    return await r.json();
  }
  const r = await fetch(`${url}?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await r.json();
}
