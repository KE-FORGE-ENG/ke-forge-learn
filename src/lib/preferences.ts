import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Region = "global" | "nigerian";
export type Complexity = "simple" | "standard" | "scholar";
export type Language = "en" | "en-us" | "en-ca" | "en-ng" | "pcm" | "yo" | "ig" | "ha" | "fr" | "fr-ca" | "es" | "es-us" | "tr" | "ja";
export type LearningPrefs = { region: Region; complexity: Complexity; language: Language };

export const LANGUAGE_GROUPS: { country: string; flag: string; langs: { id: Language; label: string; native: string; ai: string }[] }[] = [
  { country: "Nigeria", flag: "🇳🇬", langs: [
    { id: "en-ng", label: "Nigerian English", native: "Nigerian English", ai: "Nigerian English (clear standard English as used in Nigerian schools)" },
    { id: "pcm", label: "Nigerian Pidgin", native: "Naijá", ai: "Nigerian Pidgin English (Naijá)" },
    { id: "yo", label: "Yoruba", native: "Èdè Yorùbá", ai: "Yoruba (Èdè Yorùbá) with correct tone marks" },
    { id: "ig", label: "Igbo", native: "Asụsụ Igbo", ai: "Igbo (Asụsụ Igbo)" },
    { id: "ha", label: "Hausa", native: "Harshen Hausa", ai: "Hausa (Harshen Hausa)" },
  ]},
  { country: "United States / America", flag: "🇺🇸", langs: [
    { id: "en-us", label: "American English", native: "English (US)", ai: "American English" },
    { id: "es-us", label: "Spanish (Americas)", native: "Español latinoamericano", ai: "Latin American Spanish" },
  ]},
  { country: "Canada", flag: "🇨🇦", langs: [
    { id: "en-ca", label: "Canadian English", native: "English (CA)", ai: "Canadian English" },
    { id: "fr-ca", label: "Canadian French", native: "Français canadien", ai: "Canadian French (Québécois standard)" },
  ]},
  { country: "Spain", flag: "🇪🇸", langs: [{ id: "es", label: "Spanish", native: "Español", ai: "Spanish (Spain)" }] },
  { country: "France", flag: "🇫🇷", langs: [{ id: "fr", label: "French", native: "Français", ai: "French" }] },
  { country: "Turkey", flag: "🇹🇷", langs: [{ id: "tr", label: "Turkish", native: "Türkçe", ai: "Turkish" }] },
  { country: "Japan", flag: "🇯🇵", langs: [{ id: "ja", label: "Japanese", native: "日本語", ai: "Japanese" }] },
  { country: "International", flag: "🌐", langs: [{ id: "en", label: "English", native: "English", ai: "English" }] },
];
const ALL_LANGS = LANGUAGE_GROUPS.flatMap((g) => g.langs);
export const languageInfo = (id: Language) => ALL_LANGS.find((l) => l.id === id) ?? ALL_LANGS[ALL_LANGS.length - 1];

const RK = "ke-forge-region";
const CK = "ke-forge-complexity";
const LK = "ke-forge-language";
export const defaultPrefs: LearningPrefs = { region: "global", complexity: "standard", language: "en" };

export function loadPrefs(): LearningPrefs {
  if (typeof window === "undefined") return defaultPrefs;
  const r = localStorage.getItem(RK);
  const c = localStorage.getItem(CK);
  const l = localStorage.getItem(LK) as Language | null;
  return {
    region: r === "nigerian" ? "nigerian" : "global",
    complexity: c === "simple" || c === "scholar" ? c : "standard",
    language: l && ALL_LANGS.some((x) => x.id === l) ? l : "en",
  };
}

export async function savePrefs(p: LearningPrefs) {
  localStorage.setItem(RK, p.region);
  localStorage.setItem(CK, p.complexity);
  localStorage.setItem(LK, p.language);
  window.dispatchEvent(new Event("ke-prefs"));
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.auth.updateUser({ data: { learning_region: p.region, learning_complexity: p.complexity, learning_language: p.language } });
}

/** Pull saved account prefs into local storage after sign-in. */
export function syncPrefsFromUser(meta: any) {
  if (typeof window === "undefined" || !meta) return;
  if (meta.learning_region) localStorage.setItem(RK, meta.learning_region);
  if (meta.learning_complexity) localStorage.setItem(CK, meta.learning_complexity);
  if (meta.learning_language) localStorage.setItem(LK, meta.learning_language);
}

export function styleDirective(p: LearningPrefs = loadPrefs()): string {
  const parts: string[] = [];
  if (p.language && p.language !== "en") {
    parts.push(`LANGUAGE: Write ALL explanations, lessons, quiz questions, options, feedback and chat replies in ${languageInfo(p.language).ai}. Keep formulas, equations, code, units and chemical symbols in standard notation; you may add the English technical term in brackets the first time it appears. Keep any JSON keys in English exactly as required.`);
  }
  if (p.region === "nigerian") parts.push("Anchor examples and analogies in relatable Nigerian / West African everyday life (markets, danfo/keke transport, NEPA/inverter power, naira commerce, local food and culture) and WAEC/JAMB/NECO/university exam contexts. Facts, formulas and terminology stay fully accurate.");
  if (p.complexity === "simple") parts.push("Use simple, clear plain language: short sentences, everyday words, intuitive analogies before any technical term, step-by-step.");
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

// Per-document language tags (stored locally; untagged docs fall back to current preference)
const DLK = "ke-forge-doc-langs";
export const langFlag = (id: Language) => LANGUAGE_GROUPS.find((g) => g.langs.some((l) => l.id === id))?.flag ?? "🌐";
export function tagDocLang(docId: string) {
  if (typeof window === "undefined") return;
  try { const m = JSON.parse(localStorage.getItem(DLK) || "{}"); m[docId] = loadPrefs().language; localStorage.setItem(DLK, JSON.stringify(m)); } catch {}
}
export function docLang(docId?: string | null): Language {
  if (typeof window === "undefined") return defaultPrefs.language;
  try { const m = JSON.parse(localStorage.getItem(DLK) || "{}"); return (docId && m[docId]) || loadPrefs().language; } catch { return loadPrefs().language; }
}
