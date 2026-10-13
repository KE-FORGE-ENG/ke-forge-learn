import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_community_commons",
  title: "Search Community Commons",
  description: "Search study plans published to the KE-FORGE Community Commons by keyword or subject.",
  inputSchema: {
    query: z.string().trim().max(100).optional().describe("Keyword in the title or description."),
    subject: z.string().trim().max(60).optional().describe("Subject filter, e.g. Science, Mathematics, Medicine."),
    limit: z.number().int().min(1).max(30).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, subject, limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb.from("community_publications")
      .select("id,title,subject,language,description,author_name,days,fork_count")
      .order("fork_count", { ascending: false }).limit(limit ?? 15);
    if (subject) q = q.ilike("subject", `%${subject}%`);
    if (query) {
      const safe = query.replace(/[%,()]/g, " ");
      q = q.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
    }
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const results = (data ?? []).map((p) => ({ ...p, description: p.description ?? "" }));
    const text = results.length
      ? results.map((p) => `• ${p.title} [${p.subject}] — ${p.days} days, forked ${p.fork_count}× by learners (id ${p.id})`).join("\n")
      : "No matching community plans.";
    return { content: [{ type: "text", text }], structuredContent: { results } };
  },
});
