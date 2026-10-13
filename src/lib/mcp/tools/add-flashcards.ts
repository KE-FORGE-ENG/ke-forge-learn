import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_flashcards",
  title: "Add flashcards",
  description: "Add flashcards (front/back) to one of the learner's study plans for spaced-repetition review.",
  inputSchema: {
    plan_id: z.string().uuid().describe("Study plan id."),
    cards: z.array(z.object({
      front: z.string().trim().min(1).max(500),
      back: z.string().trim().min(1).max(2000),
      day: z.number().int().min(1).max(30).optional(),
    })).min(1).max(50).describe("Flashcards to add."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ plan_id, cards }, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;
    const { data: plan } = await sb.from("learning_plans").select("id").eq("id", plan_id).eq("user_id", userId).maybeSingle();
    if (!plan) throw new ToolError("Study plan not found in your library.");
    const { error } = await sb.from("flashcards").insert(cards.map((c) => ({
      user_id: userId, plan_id, front: c.front, back: c.back, day: c.day ?? null,
    })));
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: `Added ${cards.length} flashcards. Review them at /flashcards/${plan_id}.` }],
      structuredContent: { added: cards.length, plan_id },
    };
  },
});
