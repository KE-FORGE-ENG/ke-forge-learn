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
${sourceText ? `SOURCE (Day ${day} excerpt):\n${String(sourceText).slice(0, 8000)}` : ""}`;

    const messages = [
      { role: "system", content: sys },
      ...history.slice(-8).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const reply = await callAI({ model: "google/gemini-2.5-flash", messages });
    const answer = reply.choices?.[0]?.message?.content ?? "…";

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

    return new Response(JSON.stringify({ answer }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "error";
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
