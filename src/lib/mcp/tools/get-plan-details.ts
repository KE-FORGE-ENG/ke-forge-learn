import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

type Chunk = { day: number; startPage: number; endPage: number };
type Page = { page: number; text: string };

export default defineTool({
  name: "get_plan_details",
  title: "Get study plan details",
  description: "Get a study plan's day-by-day material, progress and flashcard count.",
  inputSchema: { plan_id: z.string().uuid().describe("Study plan id from list_study_plans.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ plan_id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data: plan, error } = await sb
      .from("learning_plans").select("id,days,current_day,page_chunks,document_id").eq("id", plan_id).maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!plan) throw new ToolError("Study plan not found.");
    const { data: doc } = await sb.from("documents").select("title,pages").eq("id", plan.document_id).maybeSingle();
    const pages = ((doc?.pages ?? []) as Page[]) || [];
    const chunks = (plan.page_chunks ?? []) as Chunk[];
    const { count } = await sb.from("flashcards").select("id", { count: "exact", head: true }).eq("plan_id", plan_id);
    const days = chunks.map((c) => ({
      day: c.day,
      start_page: c.startPage,
      end_page: c.endPage,
      material: pages.filter((p) => p.page >= c.startPage && p.page <= c.endPage)
        .map((p) => p.text).join("\n\n").slice(0, 4000),
    }));
    const title = doc?.title ?? "Untitled";
    const text = `${title} — day ${plan.current_day}/${plan.days}, ${count ?? 0} flashcards\n\n` +
      days.map((d) => `Day ${d.day}: ${d.material.slice(0, 300)}`).join("\n\n");
    return {
      content: [{ type: "text", text }],
      structuredContent: { plan: { id: plan.id, title, days: plan.days, current_day: plan.current_day, flashcards: count ?? 0, schedule: days } },
    };
  },
});
