import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "fork_community_plan",
  title: "Fork community plan",
  description: "Copy a Community Commons study plan (material and flashcards) into the learner's own library.",
  inputSchema: { publication_id: z.string().uuid().describe("Publication id from search_community_commons.") },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ publication_id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;
    const { data: pub } = await sb.from("community_publications").select("id,plan_id,title").eq("id", publication_id).maybeSingle();
    if (!pub) throw new ToolError("Publication not found.");
    const { data: plan } = await sb.from("learning_plans").select("document_id,days,page_chunks").eq("id", pub.plan_id).maybeSingle();
    if (!plan) throw new ToolError("This plan is no longer available.");
    const { data: doc } = await sb.from("documents").select("title,source_type,pages,page_count").eq("id", plan.document_id).maybeSingle();
    if (!doc) throw new ToolError("Source material unavailable.");
    const { data: newDoc, error: de } = await sb.from("documents").insert({ ...doc, user_id: userId, storage_path: null }).select("id").single();
    if (de) throw new ToolError(de.message);
    const { data: newPlan, error: pe } = await sb.from("learning_plans").insert({
      user_id: userId, document_id: newDoc.id, days: plan.days, page_chunks: plan.page_chunks,
    }).select("id").single();
    if (pe) throw new ToolError(pe.message);
    const { data: cards } = await sb.from("flashcards").select("front,back,day").eq("plan_id", pub.plan_id).limit(500);
    if (cards?.length) await sb.from("flashcards").insert(cards.map((c) => ({ ...c, user_id: userId, plan_id: newPlan.id })));
    await sb.rpc("increment_fork", { _pub: pub.id });
    return {
      content: [{ type: "text", text: `Forked "${pub.title}" into your library. Plan id: ${newPlan.id}.` }],
      structuredContent: { plan_id: newPlan.id, title: pub.title, flashcards_copied: cards?.length ?? 0 },
    };
  },
});
