import { supabase } from "@/integrations/supabase/client";

export const SUBJECTS = ["General", "Science", "Mathematics", "Medicine", "Engineering", "Technology", "Business", "Law", "Humanities", "Languages", "Exam prep (JAMB/WAEC/SAT)"];

export type Publication = {
  id: string; plan_id: string; user_id: string; title: string; subject: string; language: string;
  description: string | null; author_name: string; days: number; fork_count: number; created_at: string;
};

export async function publishPlan(opts: { planId: string; userId: string; title: string; subject: string; language: string; description: string; author: string; days: number }) {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const { data: plan } = await supabase.from("learning_plans").select("share_token").eq("id", opts.planId).maybeSingle();
  const { error: e1 } = await supabase.from("learning_plans").update({ is_public: true, share_token: plan?.share_token ?? token }).eq("id", opts.planId);
  if (e1) throw e1;
  const { error } = await supabase.from("community_publications").upsert({
    plan_id: opts.planId, user_id: opts.userId, title: opts.title, subject: opts.subject, language: opts.language,
    description: opts.description || null, author_name: opts.author, days: opts.days,
  }, { onConflict: "plan_id" });
  if (error) throw error;
}

export async function unpublishPlan(planId: string) {
  await supabase.from("community_publications").delete().eq("plan_id", planId);
}

export async function forkPublication(pub: Publication, userId: string): Promise<string> {
  const { data: plan, error: pe } = await supabase.from("learning_plans").select("document_id,days,page_chunks").eq("id", pub.plan_id).maybeSingle();
  if (pe || !plan) throw new Error("This plan is no longer available");
  const { data: doc } = await supabase.from("documents").select("title,source_type,pages,page_count").eq("id", plan.document_id).maybeSingle();
  if (!doc) throw new Error("Source material unavailable");
  const { data: newDoc, error: de } = await supabase.from("documents").insert({ ...doc, user_id: userId, storage_path: null }).select("id").single();
  if (de) throw de;
  const { data: newPlan, error: npe } = await supabase.from("learning_plans").insert({ user_id: userId, document_id: newDoc.id, days: plan.days, page_chunks: plan.page_chunks }).select("id").single();
  if (npe) throw npe;
  const { data: cards } = await supabase.from("flashcards").select("front,back,day").eq("plan_id", pub.plan_id).limit(500);
  if (cards?.length) await supabase.from("flashcards").insert(cards.map((c) => ({ ...c, user_id: userId, plan_id: newPlan.id })));
  await supabase.rpc("increment_fork", { _pub: pub.id });
  return newPlan.id;
}
