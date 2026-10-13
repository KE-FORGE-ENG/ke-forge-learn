import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_study_plan",
  title: "Create study plan",
  description: "Create a new day-by-day study plan in the learner's KE-FORGE library from a topic and optional daily outlines.",
  inputSchema: {
    title: z.string().trim().min(1).max(120).describe("Plan title, e.g. 'Organic Chemistry basics'."),
    topic: z.string().trim().min(3).max(4000).describe("What the plan should teach."),
    days: z.number().int().min(1).max(30).describe("Number of study days."),
    day_outlines: z.array(z.string().trim().min(1).max(4000)).max(30).optional()
      .describe("Optional study notes per day; length should equal days."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, topic, days, day_outlines }, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;
    const outlines = day_outlines?.length ? day_outlines.slice(0, days) : null;
    const pages = outlines
      ? outlines.map((text, i) => ({ page: i + 1, text: i === 0 ? `${topic}\n\n${text}` : text }))
      : [{ page: 1, text: topic }];
    const n = pages.length;
    const chunks = Array.from({ length: days }, (_, i) => {
      const p = Math.min(i + 1, n);
      return { day: i + 1, startPage: outlines ? p : 1, endPage: outlines ? p : 1 };
    });
    const { data: doc, error: de } = await sb.from("documents").insert({
      user_id: userId, title, source_type: "topic", pages, page_count: n,
    }).select("id").single();
    if (de) throw new ToolError(de.message);
    const { data: plan, error: pe } = await sb.from("learning_plans").insert({
      user_id: userId, document_id: doc.id, days, page_chunks: chunks,
    }).select("id").single();
    if (pe) throw new ToolError(pe.message);
    return {
      content: [{ type: "text", text: `Created "${title}" (${days} days). Plan id: ${plan.id}. Open it in KE-FORGE LEARN at /learn/${plan.id}.` }],
      structuredContent: { plan_id: plan.id, title, days, path: `/learn/${plan.id}` },
    };
  },
});
