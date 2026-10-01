import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Region = "global" | "nigerian";
export type Complexity = "simple" | "standard" | "scholar";
export type LearningPrefs = { region: Region; complexity: Complexity };

const RK = "ke-forge-region";
const CK = "ke-forge-complexity";
export const defaultPrefs: LearningPrefs = { region: "global", complexity: "standard" };

export function loadPrefs(): LearningPrefs {
  if (typeof window === "undefined") return defaultPrefs;
  const r = localStorage.getItem(RK);
  const c = localStorage.getItem(CK);
  return {
    region: r === "nigerian" ? "nigerian" : "global",
    complexity: c === "simple" || c === "scholar" ? c : "standard",
  };
}

export async function savePrefs(p: LearningPrefs) {
  localStorage.setItem(RK, p.region);
  localStorage.setItem(CK, p.complexity);
  window.dispatchEvent(new Event("ke-prefs"));
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.auth.updateUser({ data: { learning_region: p.region, learning_complexity: p.complexity } });
}

/** Pull saved account prefs into local storage after sign-in. */
export function syncPrefsFromUser(meta: any) {
  if (typeof window === "undefined" || !meta) return;
  if (meta.learning_region) localStorage.setItem(RK, meta.learning_region);
  if (meta.learning_complexity) localStorage.setItem(CK, meta.learning_complexity);
}

export function styleDirective(p: LearningPrefs = loadPrefs()): string {
  const parts: string[] = [];
  if (p.region === "nigerian") parts.push("Anchor examples and analogies in relatable Nigerian / West African everyday life (markets, danfo/keke transport, NEPA/inverter power, naira commerce, local food and culture) and WAEC/JAMB/NECO/university exam contexts. Use clear standard English; facts, formulas and terminology stay fully accurate.");
  if (p.complexity === "simple") parts.push("Use simple, clear plain English: short sentences, everyday words, intuitive analogies before any technical term, step-by-step.");
  if (p.complexity === "scholar") parts.push("Use elevated academic diction, formal scholarly exposition and precise scientific nomenclature.");
  return parts.length ? `LEARNER STYLE PREFERENCES: ${parts.join(" ")}` : "";
}

export function useLearningPreferences() {
  const [prefs, setPrefs] = useState<LearningPrefs>(defaultPrefs);
  useEffect(() => {
    const l = () => setPrefs(loadPrefs());
    l();
    window.addEventListener("ke-prefs", l);
    return () => window.removeEventListener("ke-prefs", l);
  }, []);
  const update = (patch: Partial<LearningPrefs>) => { const n = { ...prefs, ...patch }; setPrefs(n); void savePrefs(n); };
  return { prefs, update };
}
