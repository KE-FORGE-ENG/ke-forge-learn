// Adaptive tutor live-chat. Uses Lovable AI; updates user learning profile.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(body: any) {
  const r = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
  return await r.json();
}

const profileTool = {
  type: "function",
  function: {
    name: "update_profile",
    description: "Update the student's learning profile based on the latest exchange.",
    parameters: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
        pace: { type: "string", enum: ["slow", "moderate", "fast"] },
        prefers: { type: "string", description: "examples | analogies | formal | visual | step-by-step" },
        strengths: { type: "array", items: { type: "string" } },
        weaknesses: { type: "array", items: { type: "string" } },
        notes: { type: "string", description: "Short evolving notes (~200 chars max) about how to teach this user." },
      },
      required: ["level", "pace", "prefers", "strengths", "weaknesses", "notes"],
    },
  },
};

// Real tools the tutor can invoke during the chat
const chatTools = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the live web for up-to-date facts, definitions, current events, or things not covered by the source. Returns text summaries plus source URLs.",
      parameters: {
        type: "object",
        properties: {
          queries: { type: "array", items: { type: "string" }, description: "1-3 focused search queries." },
        },
        required: ["queries"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "youtube_search",
      description: "Find relevant YouTube videos to recommend to the student. Returns title, channel, and video id list.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Search query." },
        },
        required: ["q"],
      },
    },
  },
];

async function runTool(name: string, args: any, auth: string) {
  const base = Deno.env.get("SUPABASE_URL")!;
  const headers = { Authorization: auth || `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`, "Content-Type": "application/json" };
  try {
    if (name === "web_search") {
      const r = await fetch(`${base}/functions/v1/web-search`, {
        method: "POST", headers, body: JSON.stringify({ queries: args.queries ?? [args.q] }),
      });
      const d = await r.json();
      return { text: (d.text || "").slice(0, 6000), sources: d.sources ?? [] };
    }
    if (name === "youtube_search") {
      const r = await fetch(`${base}/functions/v1/youtube-search?q=${encodeURIComponent(args.q)}`, { headers });
      const d = await r.json();
      const items = (d.items ?? []).slice(0, 5).map((v: any) => ({ id: v.id, title: v.title, channel: v.channelTitle }));
      return { items };
    }
    return { error: `unknown tool ${name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "tool failed" };
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    const auth = req.headers.get("Authorization") ?? "";
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await supa.auth.getUser();
    if (!u.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { message, planId, day, sourceText, history = [] } = await req.json();

    // Load adaptive profile
    const { data: prof } = await supa.from("learning_profiles").select("profile").eq("user_id", u.user.id).maybeSingle();
    const profile = (prof?.profile ?? {}) as any;

    const sys = `You are an adaptive AI tutor in a live chat. Respond clearly, concisely, with markdown.
You adjust to this student's learning pattern.
CURRENT LEARNER PROFILE: ${JSON.stringify(profile)}
Adapt: if level=beginner or pace=slow, simplify, use analogies & step-by-step. If advanced/fast, push depth, ask probing questions.
Stick to the SOURCE when relevant; otherwise answer normally but truthfully.

You have real TOOLS available:
- web_search(queries) — use when the student asks for current facts, definitions, real-world examples, or things not in the source. Cite briefly.
- youtube_search(q) — use when the student asks for videos, visual explanations, or "show me a video".
Only call a tool when it genuinely helps. Never call the same tool twice with the same args. After tools return, weave the findings into a normal tutor answer.
${sourceText ? `SOURCE (Day ${day} excerpt):\n${String(sourceText).slice(0, 8000)}` : ""}`;

    const messages: any[] = [
      { role: "system", content: sys },
      ...history.slice(-8).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    // Real tool-call loop (max 3 rounds)
    let answer = "";
    const collectedSources: string[] = [];
    for (let round = 0; round < 3; round++) {
      const reply = await callAI({
        model: "google/gemini-2.5-flash",
        messages,
        tools: chatTools,
        tool_choice: "auto",
      });
      const msg = reply.choices?.[0]?.message;
      if (!msg) break;
      messages.push(msg);
      const calls = msg.tool_calls ?? [];
      if (!calls.length) { answer = msg.content ?? ""; break; }
      for (const c of calls) {
        let args: any = {};
        try { args = JSON.parse(c.function.arguments || "{}"); } catch { /* ignore */ }
        const result = await runTool(c.function.name, args, auth);
        if ((result as any)?.sources) collectedSources.push(...(result as any).sources);
        messages.push({
          role: "tool",
          tool_call_id: c.id,
          content: JSON.stringify(result).slice(0, 8000),
        });
      }
    }
    if (!answer) answer = "…";
    const sources = Array.from(new Set(collectedSources)).slice(0, 6);

    // Persist messages
    await supa.from("chat_messages").insert([
      { user_id: u.user.id, plan_id: planId ?? null, day: day ?? null, role: "user", content: message },
      { user_id: u.user.id, plan_id: planId ?? null, day: day ?? null, role: "assistant", content: answer },
    ]);

    // Update learning profile (deep-learning adaptive)
    try {
      const upd = await callAI({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: `Analyze the student message and update the rolling learner profile. Merge with previous: ${JSON.stringify(profile)}` },
          { role: "user", content: `Student said: "${message}"\nTutor replied: "${answer}"\nReturn an updated profile.` },
        ],
        tools: [profileTool],
        tool_choice: { type: "function", function: { name: "update_profile" } },
      });
      const args = JSON.parse(upd.choices[0].message.tool_calls[0].function.arguments);
      await supa.from("learning_profiles").upsert({ user_id: u.user.id, profile: args, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    } catch (e) { console.error("profile update failed", e); }

    return new Response(JSON.stringify({ answer, sources }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "error";
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
