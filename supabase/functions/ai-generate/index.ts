// AI generation edge function for LearnPath
// Handles: day plan generation, simpler re-explanation, quiz generation, quiz grading suggestions
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const INTENSITY: Record<number, string> = {
  1: "Day 1 — FOUNDATIONAL. Summarize, categorise, classify the content. Explain main concepts plainly. Goal: solid understanding within 24h. Keep it digestible.",
  2: "Day 2 — EXTEND. Build on Day 1 with more examples, edge cases, and slightly deeper detail.",
  3: "Day 3 — DEEPER + CONNECTIONS. Cross-topic links, deeper follow-up questions, comparisons.",
  4: "Day 4 — REVIEW + DEEPER. AI summary, classification recap, deeper questions, more follow-ups.",
  5: "Day 5 — INTENSE. Micro-topics, aggressive follow-ups, daily review, but NEVER overwhelming. Adaptive based on user pattern.",
};

async function callAI(body: any) {
  const r = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI error ${r.status}: ${t}`);
  }
  return await r.json();
}

const dayTool = {
  type: "function",
  function: {
    name: "emit_day",
    description: "Emit structured daily learning content",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string", description: "Concise day summary, markdown allowed" },
        classification: { type: "array", items: { type: "string" }, description: "Topics/categories covered" },
        concepts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              explanation: { type: "string" },
              example: { type: "string" },
            },
            required: ["name", "explanation"],
          },
        },
        followups: { type: "array", items: { type: "string" }, description: "Open-ended follow-up questions" },
        youtube_query: { type: "string", description: "Best YouTube search query for this day" },
      },
      required: ["title", "summary", "classification", "concepts", "followups", "youtube_query"],
    },
  },
};

const quizTool = {
  type: "function",
  function: {
    name: "emit_quiz",
    description: "Emit a quiz",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["mcq", "tf", "fill"] },
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              answer: { type: "string" },
              explanation: { type: "string" },
            },
            required: ["type", "question", "answer", "explanation"],
          },
        },
      },
      required: ["questions"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    const { action, payload } = await req.json();

    if (action === "generate_day") {
      const { day, days, sourceText, lostCount = 0, simplified = false } = payload;
      const adaptive =
        lostCount > 2
          ? "User has clicked 'I'm lost' multiple times. Slow down, repeat key ideas, use simpler language and analogies."
          : "User is following well; you may push depth slightly more.";
      const sys = `You are an expert tutor building a ${days}-day learning plan. ${INTENSITY[day]} ${adaptive}${
        simplified ? " Use ELI5 tone — analogies, stories, very simple wording." : ""
      } Use the source content provided. Be accurate, be concise, never invent facts not supported by the source.`;
      const user = `SOURCE CONTENT (covering this day's pages/scope):\n\n${sourceText.slice(0, 18000)}\n\nGenerate the day's learning content.`;
      const data = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        tools: [dayTool],
        tool_choice: { type: "function", function: { name: "emit_day" } },
      });
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "generate_quiz") {
      const { sourceText, day, count = 6 } = payload;
      const data = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Create a CBT quiz of ${count} questions covering the source. Mix MCQ (4 options), True/False, and fill-in-blank. Provide concise explanations. Day context: ${day || "review"}.` },
          { role: "user", content: `SOURCE:\n${sourceText.slice(0, 18000)}` },
        ],
        tools: [quizTool],
        tool_choice: { type: "function", function: { name: "emit_quiz" } },
      });
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
