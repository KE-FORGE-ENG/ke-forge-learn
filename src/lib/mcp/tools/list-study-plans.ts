import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_study_plans",
  title: "List study plans",
  description: "List the signed-in learner's study plans with title, progress day and total days.",
  inputSchema: { limit: z.number().int().min(1).max(50).optional().describe("Max plans to return (default 20).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("learning_plans")
      .select("id,days,current_day,created_at,is_public,documents(title,source_type)")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) throw new ToolError(error.message);
    const plans = (data ?? []).map((p) => {
      const doc = p.documents as { title: string; source_type: string } | null;
      return {
        id: p.id, title: doc?.title ?? "Untitled", source: doc?.source_type ?? "unknown",
        days: p.days, current_day: p.current_day, is_public: p.is_public, created_at: p.created_at,
      };
    });
    const text = plans.length
      ? plans.map((p) => `• ${p.title} — day ${p.current_day}/${p.days} (id ${p.id})`).join("\n")
      : "No study plans yet.";
    return { content: [{ type: "text", text }], structuredContent: { plans } };
  },
});
