import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listStudyPlans from "./tools/list-study-plans";
import getPlanDetails from "./tools/get-plan-details";
import createStudyPlan from "./tools/create-study-plan";
import addFlashcards from "./tools/add-flashcards";
import searchCommunity from "./tools/search-community";
import forkCommunityPlan from "./tools/fork-community-plan";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "enochtech-learning-hub",
  title: "EnochTech learning hub",
  version: "0.1.0",
  instructions:
    "KE-FORGE LEARN tools. List and inspect the learner's study plans, create new day-by-day plans from a topic, add flashcards to a plan, and search or fork plans from the Community Commons. All actions run as the signed-in learner.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: true,
  }),
  tools: [listStudyPlans, getPlanDetails, createStudyPlan, addFlashcards, searchCommunity, forkCommunityPlan],
});
