- Adaptive Learning Studio (new, additive)

Everything lives on a new page, "Adaptive Learn", linked from the dashboard and menu. Existing plans, Deep Learning, quizzes and chat stay unchanged.

## Phase 1 — Upload, analysis, onboarding

- Upload PDF / DOCX / TXT / MD, or type a topic.
- AI returns: topic, complexity level, prerequisites, key concepts, dependency map.
- "Here's what I found in your material" summary card.
- 4 tappable questions, one at a time with progress bar (familiarity, goal, time, style).
- Recommended mode (A / B / C) with override.

## Phase 2 — Mode A (New to the topic)

- 3–5 prerequisite cards first.
- One idea per screen, plain language, analogy, one simple visual.
- Tap-to-answer check question; "Continue" only when ready.
- "Big picture" concept map that fills in as chunks are completed.

## Phase 3 — Rich rendering

- Mermaid diagrams, sanitized SVG (zoom + download), charts from JSON, responsive tables.
- Failed diagram falls back to text with Retry.
- Also available in the existing live chat (only with your approval — it changes existing behavior).

## Phase 4 — Modes B and C

- B: clickable concept map to choose branches, 2–3 ideas per block, "Go deeper" / "Why does this work?", synthesis question.
- C: bigger chunks, layered visuals, edge cases, competing theories, challenge questions, "Connect to other fields", "Teach it back" with AI critique.

## Phase 5 — Cognitive load balancing

- Tracks time per chunk, accuracy, "I'm lost" / "Too easy", back-navigation.
- Load meter (light / balanced / heavy), auto pace/depth adjustment, break/recap prompt.
- Concept caps per screen: A=1, B=2–3, C=3–5.
- "Switch mode" always visible.

## Progress

- Saved per topic: mode, completed chunks, quiz results, concept map state, load history.

## Technical details

- New table `adaptive_sessions` (user-scoped RLS + grants) storing analysis, answers, mode, chunks JSON, progress.
- New server functions (TanStack `createServerFn`, not new edge functions): `analyzeMaterial`, `nextChunk`, `critiqueTeachBack`, using the Lovable AI gateway with structured JSON output (lesson chunk, visual {type, spec}, check question, difficulty signal).
- DOCX text via `mammoth` (browser build); PDF via existing parser.
- Rendering: `mermaid` (client-only, lazy), `dompurify` for SVG, `recharts` for charts, `react-markdown` + `remark-gfm` for tables.
- Route `/adaptive` (list + new) and `/adaptive/$sessionId` (lesson player).

I'll build Phase 1–2 first, then continue through the phases in order.