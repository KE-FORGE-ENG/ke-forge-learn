// AI generation edge function for Etek Learning Hub
// Actions: generate_day, generate_quiz, generate_flashcards, generate_mindmap, ocr_image
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
  5: "Day 5 — INTENSE. Micro-topics, aggressive follow-ups, daily review, but NEVER overwhelming.",
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
        summary: { type: "string" },
        classification: { type: "array", items: { type: "string" } },
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
        followups: { type: "array", items: { type: "string" } },
        youtube_query: { type: "string" },
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
              type: { type: "string", enum: ["mcq", "tf", "fill", "theory"] },
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              answer: { type: "string", description: "For theory: a model answer / rubric used for grading." },
              keywords: { type: "array", items: { type: "string" }, description: "For theory/fill questions: required keywords used to grade the answer." },
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

const flashTool = {
  type: "function",
  function: {
    name: "emit_flashcards",
    description: "Emit study flashcards",
    parameters: {
      type: "object",
      properties: {
        cards: {
          type: "array",
          items: {
            type: "object",
            properties: {
              front: { type: "string", description: "Question or term" },
              back: { type: "string", description: "Concise answer or definition" },
            },
            required: ["front", "back"],
          },
        },
      },
      required: ["cards"],
    },
  },
};

const mindmapTool = {
  type: "function",
  function: {
    name: "emit_mindmap",
    description: "Emit a concept mind map",
    parameters: {
      type: "object",
      properties: {
        root: { type: "string", description: "Central topic" },
        branches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              children: { type: "array", items: { type: "string" } },
            },
            required: ["label", "children"],
          },
        },
      },
      required: ["root", "branches"],
    },
  },
};

const deepTool = {
  type: "function",
  function: {
    name: "emit_deep_lesson",
    description: "Emit a deep, exam-grade page lesson",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        deep_explanation: { type: "string", description: "Thorough multi-paragraph teaching of the page content. Walk the student through it as a lecturer would." },
        keywords: {
          type: "array",
          description: "Lecturer-style key terms — exact wording matters. Each with a precise definition.",
          items: {
            type: "object",
            properties: {
              term: { type: "string" },
              definition: { type: "string" },
              why_it_matters: { type: "string" },
            },
            required: ["term", "definition"],
          },
        },
        important_facts: { type: "array", items: { type: "string" }, description: "Specific facts, numbers, names, dates, formulas a lecturer is likely to test." },
        examples: { type: "array", items: { type: "string" } },
        likely_exam_questions: {
          type: "array",
          items: {
            type: "object",
            properties: { question: { type: "string" }, answer: { type: "string" } },
            required: ["question", "answer"],
          },
        },
        recap: { type: "string" },
        youtube_query: { type: "string" },
      },
      required: ["title", "deep_explanation", "keywords", "important_facts", "likely_exam_questions", "recap", "youtube_query"],
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
      } Use the source content provided. Be accurate, never invent facts.`;
      const data = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `SOURCE:\n\n${(sourceText || "").slice(0, 18000)}\n\nGenerate the day's content.` },
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
          { role: "system", content: `Create a CBT quiz of ${count} questions covering the source. Mix MCQ (4 options), True/False, and fill-in-blank. Provide concise explanations. Day: ${day || "review"}.` },
          { role: "user", content: `SOURCE:\n${(sourceText || "").slice(0, 18000)}` },
        ],
        tools: [quizTool],
        tool_choice: { type: "function", function: { name: "emit_quiz" } },
      });
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "generate_flashcards") {
      const { sourceText, dayContent, count = 10 } = payload;
      const ctx = dayContent
        ? `Lesson title: ${dayContent.title}\nSummary: ${dayContent.summary}\nConcepts: ${(dayContent.concepts || []).map((c: any) => `${c.name}: ${c.explanation}`).join("\n")}`
        : "";
      const data = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Create ${count} high-quality study flashcards. Front = a precise question or term. Back = a CONCISE answer (1-2 sentences max). Cover the most important, testable facts. No duplicates.` },
          { role: "user", content: `${ctx}\n\nSOURCE:\n${(sourceText || "").slice(0, 14000)}` },
        ],
        tools: [flashTool],
        tool_choice: { type: "function", function: { name: "emit_flashcards" } },
      });
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "generate_mindmap") {
      const { sourceText, docTitle } = payload;
      const data = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Create a concept mind map. Pick ONE central root topic, then 4-7 main branches, each with 2-5 child concepts. Keep labels short (1-4 words)." },
          { role: "user", content: `Document: ${docTitle || ""}\n\nSOURCE:\n${(sourceText || "").slice(0, 16000)}` },
        ],
        tools: [mindmapTool],
        tool_choice: { type: "function", function: { name: "emit_mindmap" } },
      });
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "deep_teach") {
      const { pageText, pageNumber, totalPages, topic, webContext, mode } = payload;
      const focus = mode === "topic"
        ? `The student is studying the TOPIC: "${topic}". Teach the topic in depth as a lecturer would, going beyond surface summary.`
        : mode === "notes"
          ? `The student uploaded LECTURE NOTES (extracted via OCR). Teach exactly what's there, expanding every line into clear lecture-style explanation.`
          : `The student is on PAGE ${pageNumber} of ${totalPages} of their PDF. Teach this page thoroughly — do NOT just summarize, walk through it as if lecturing.`;
      const sys = `You are a deep-learning tutor preparing a student for an exam. Lecturers test BOTH conceptual understanding AND specific keywords, definitions, names, dates, formulas, and exact wording. Your job:
1. Teach the content deeply (multi-paragraph, lecturer voice).
2. Pull out every important KEYWORD/term with a precise definition and why a lecturer would test it.
3. List specific FACTS likely to appear in exam questions (numbers, names, dates, formulas, exact phrases).
4. Give worked EXAMPLES.
5. Predict 4-6 likely EXAM QUESTIONS in the lecturer's style with model answers.
${focus}
${webContext ? "Use the WEB CONTEXT below to enrich and verify your teaching, citing useful additional facts not in the source." : "Use only the provided source."}
Be accurate. Never invent facts.`;
      const userMsg = `${mode === "topic" ? `TOPIC: ${topic}` : `SOURCE:\n${(pageText || "").slice(0, 14000)}`}${webContext ? `\n\nWEB CONTEXT:\n${webContext.slice(0, 8000)}` : ""}`;
      const data = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg },
        ],
        tools: [deepTool],
        tool_choice: { type: "function", function: { name: "emit_deep_lesson" } },
      });
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "ocr_image") {
      const { imageDataUrl } = payload;
      if (!imageDataUrl) throw new Error("imageDataUrl required");
      const data = await callAI({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "You are a high-accuracy OCR engine specialized in lecture notes, handwritten text, math, diagrams, and printed pages. Extract EVERY readable character precisely. Preserve line breaks, bullet points, indentation, equations, and structure. For unclear handwriting, give your best transcription — do not skip lines. For diagrams, transcribe labels and captions. Do NOT add commentary, headers, or markdown — return ONLY the raw extracted text exactly as it appears." },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all text from this image:" },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      });
      const text = data.choices[0].message.content || "";
      return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
