// Accessibility settings: persisted in localStorage, applied as classes/CSS vars on <html>
export type A11ySettings = {
  fontScale: number;    // 0.85 .. 1.5
  dyslexiaFont: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
};

const KEY = "a11y-settings";

export const defaultA11y: A11ySettings = {
  fontScale: 1,
  dyslexiaFont: false,
  highContrast: false,
  reduceMotion: false,
};

export function loadA11y(): A11ySettings {
  if (typeof window === "undefined") return defaultA11y;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultA11y;
    return { ...defaultA11y, ...JSON.parse(raw) };
  } catch {
    return defaultA11y;
  }
}

export function saveA11y(s: A11ySettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  applyA11y(s);
}

export function applyA11y(s: A11ySettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--a11y-font-scale", String(s.fontScale));
  root.classList.toggle("a11y-dyslexia", s.dyslexiaFont);
  root.classList.toggle("a11y-contrast", s.highContrast);
  root.classList.toggle("a11y-reduce-motion", s.reduceMotion);
}
