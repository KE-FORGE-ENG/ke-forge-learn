import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiJson, AiError } from "./adaptive.server";

const wrap = async <T,>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> => {
  try { return { ok: true, data: await fn() }; }
  catch (e: any) { console.error("[adaptive]", e); return { ok: false, error: e instanceof AiError ? e.message : "Something went wrong. Please retry." }; }
};

export const analyzeMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(3).max(60000), style: z.string().max(1200).optional() }).parse(d))
  .handler(async ({ data }) => wrap(async () => {
    const res = await aiJson(
      `You analyze study material for an adaptive tutor. Return JSON:
{"topic":string,"summary":string (2-3 sentences),"complexity":"beginner"|"intermediate"|"advanced",
"prerequisites":[{"name":string,"why":string}] (3-5),
"keyConcepts":[{"id":string (short slug),"name":string,"description":string}] (5-10),
"dependencies":[{"from":concept id,"to":concept id}] (from must be learned before to)}
${data.style ?? ""}`,
      data.text.slice(0, 40000),
    );
    return {
      topic: String(res.topic ?? "Your topic"),
      summary: String(res.summary ?? ""),
      complexity: ["beginner", "intermediate", "advanced"].includes(res.complexity) ? res.complexity : "intermediate",
      prerequisites: Array.isArray(res.prerequisites) ? res.prerequisites.slice(0, 5) : [],
      keyConcepts: Array.isArray(res.keyConcepts) ? res.keyConcepts.slice(0, 12) : [],
      dependencies: Array.isArray(res.dependencies) ? res.dependencies : [],
    };
  }));

const MODE_RULES: Record<string, string> = {
  A: "Mode A (new learner): exactly ONE new idea, plain language, one everyday analogy, ~120-180 words. Visual must be SIMPLE (a small flowchart or a 3-5 bar chart). Check question is easy recall/understanding.",
  B: "Mode B (intermediate): 2-3 related ideas, ~220-320 words, include a 'goDeeper' and a 'whyItWorks' paragraph. Visual can be a mermaid diagram, comparison table (markdown in body) or chart. Check question is a synthesis question.",
  C: "Mode C (advanced): 3-5 ideas, dense, ~350-500 words, include edge cases and competing views, 'connections' to other fields. Visual can be layered mermaid or data chart. Check question must require reasoning.",
};

export const nextChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    sessionId: z.string().uuid(),
    conceptId: z.string().optional(),
    adjust: z.enum(["simpler", "same", "harder"]).default("same"),
    style: z.string().max(1200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => wrap(async () => {
    const { data: s, error } = await context.supabase.from("adaptive_sessions").select("*").eq("id", data.sessionId).maybeSingle();
    if (error || !s) throw new AiError("Session not found.", 404);
    const a: any = s.analysis ?? {};
    const chunks: any[] = Array.isArray(s.chunks) ? (s.chunks as any[]) : [];
    const done = new Set(chunks.map((c) => c.conceptId));
    const concepts: any[] = a.keyConcepts ?? [];
    const target = concepts.find((c) => c.id === data.conceptId) ?? concepts.find((c) => !done.has(c.id)) ?? concepts[0];
    const answers: any = s.answers ?? {};
    const res = await aiJson(
      `You are an adaptive tutor. ${MODE_RULES[s.mode] ?? MODE_RULES.A}
Learner prefs: ${JSON.stringify(answers)}. Pacing adjustment: ${data.adjust} (simpler = shorter, more analogies; harder = more depth).
Return JSON: {"title":string,"body":markdown string,"analogy":string|null,"goDeeper":string|null,"whyItWorks":string|null,"connections":string|null,
"visual":{"type":"mermaid"|"chart"|"none","code":string (mermaid source, only if mermaid),"chart":{"kind":"bar"|"line"|"pie","title":string,"data":[{"name":string,"value":number}]} (only if chart)},
"check":{"question":string,"options":[string,string,string,string],"answerIndex":number,"explanation":string},
"difficulty":"easy"|"medium"|"hard"}
Mermaid must be valid (use flowchart TD, quote labels with special chars).
${data.style ?? ""}`,
      `Topic: ${a.topic}\nConcept to teach: ${target?.name} — ${target?.description}\nAlready covered: ${chunks.map((c) => c.title).join("; ") || "nothing"}\nSource material excerpt:\n${String(s.source_text).slice(0, 15000)}`,
    );
    const chunk = { ...res, conceptId: target?.id ?? `c${chunks.length}`, mode: s.mode, createdAt: new Date().toISOString() };
    await context.supabase.from("adaptive_sessions").update({ chunks: [...chunks, chunk] as any }).eq("id", s.id);
    return chunk;
  }));

export const critiqueTeachBack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ concept: z.string().max(500), lesson: z.string().max(8000), explanation: z.string().min(10).max(4000), style: z.string().max(1200).optional() }).parse(d))
  .handler(async ({ data }) => wrap(async () => {
    const res = await aiJson(
      `You are a kind but rigorous tutor grading a learner's "teach it back" explanation. Return JSON: {"score":number 0-10,"strengths":[string],"gaps":[string],"misconceptions":[string],"betterVersion":string (short model explanation)}
${data.style ?? ""}`,
      `Concept: ${data.concept}\nLesson:\n${data.lesson}\n\nLearner's explanation:\n${data.explanation}`,
    );
    return {
      score: Math.max(0, Math.min(10, Number(res.score) || 0)),
      strengths: Array.isArray(res.strengths) ? res.strengths.map(String) : [],
      gaps: Array.isArray(res.gaps) ? res.gaps.map(String) : [],
      misconceptions: Array.isArray(res.misconceptions) ? res.misconceptions.map(String) : [],
      betterVersion: String(res.betterVersion ?? ""),
    };
  }));
