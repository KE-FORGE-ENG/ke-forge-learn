export type ParsedPage = { page: number; text: string };

type PdfJs = typeof import("pdfjs-dist");

let pdfJsPromise: Promise<PdfJs> | undefined;

// pdfjs-dist reads browser-only globals such as DOMMatrix while its module is
// evaluated. Loading it lazily keeps those globals out of TanStack Start SSR.
async function getPdfJs(): Promise<PdfJs> {
  if (typeof window === "undefined") {
    throw new Error("PDF processing is only available in the browser");
  }

  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }

  return pdfJsPromise;
}

export async function parsePdf(file: File): Promise<ParsedPage[]> {
  const pdfjs = await getPdfJs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: ParsedPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(" ");
    pages.push({ page: i, text });
  }
  return pages;
}

// Cache loaded PDF documents by source URL/key to avoid re-downloading.
const docCache = new Map<string, Promise<any>>();

export async function loadPdfFromUrl(url: string) {
  const cached = docCache.get(url);
  if (cached) return cached;

  const loading = (async () => {
    const pdfjs = await getPdfJs();
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to download PDF");
    const buf = await res.arrayBuffer();
    return pdfjs.getDocument({ data: buf }).promise;
  })();
  docCache.set(url, loading);
  try {
    return await loading;
  } catch (error) {
    docCache.delete(url);
    throw error;
  }
}

// Render a single PDF page to a PNG data URL.
export async function renderPdfPageImage(url: string, pageNumber: number, scale = 1.6): Promise<string> {
  const doc = await loadPdfFromUrl(url);
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/png");
}

// Detect whether a PDF page contains any raster/inline images.
export async function pageHasImages(url: string, pageNumber: number): Promise<boolean> {
  try {
    const pdfjs = await getPdfJs();
    const doc = await loadPdfFromUrl(url);
    const page = await doc.getPage(pageNumber);
    const ops = await page.getOperatorList();
    const OPS: any = (pdfjs as any).OPS ?? {};
    const imageOps = new Set<number>(
      [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintJpegXObject]
        .filter((v) => typeof v === "number"),
    );
    return (ops.fnArray as number[]).some((fn) => imageOps.has(fn));
  } catch {
    return false;
  }
}

export function chunkPages(totalPages: number, days: number) {
  const per = Math.ceil(totalPages / days);
  const chunks: { day: number; startPage: number; endPage: number }[] = [];
  for (let d = 1; d <= days; d++) {
    const start = (d - 1) * per + 1;
    const end = Math.min(d * per, totalPages);
    if (start > totalPages) {
      chunks.push({ day: d, startPage: totalPages, endPage: totalPages });
    } else {
      chunks.push({ day: d, startPage: start, endPage: end });
    }
  }
  return chunks;
}

// --- Smart content splitting -------------------------------------------------
// Weighs each page by how much real *study effort* it carries (text, formulas,
// tables, figures), then splits the document into day-chunks of roughly equal
// workload. An AI pass (see planSplitWithAi) can refine this using the outline.

const HEADING_KEYWORDS = /^(chapter|section|unit|topic|part|lesson|module|appendix|introduction|conclusion|summary|exercises?|references)\b/i;
const NUMBERED_HEADING = /^\d+(\.\d+)*\s+\S/;
const TOC_RE = /(table of contents|^contents$)/i;

export type PageFeatures = {
  page: number;
  words: number;
  formulas: number;
  tableRows: number;
  heading: string | null;
  isToc: boolean;
  sparse: boolean;
};

function lines(text: string) {
  return (text || "")
    .split(/\r?\n|(?<=\.)\s{3,}/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function detectHeading(text: string): string | null {
  for (const line of lines(text).slice(0, 6)) {
    if (line.length > 90) continue;
    const words = line.split(" ").length;
    if (HEADING_KEYWORDS.test(line)) return line;
    if (NUMBERED_HEADING.test(line) && words <= 12) return line;
    // Short standalone ALL-CAPS or Title Case line = very likely a heading.
    if (words <= 10 && /[A-Za-z]/.test(line) && line === line.toUpperCase()) return line;
  }
  return null;
}

export function pageFeatures(p: ParsedPage): PageFeatures {
  const text = p.text || "";
  const clean = text.replace(/\s+/g, " ").trim();
  const words = clean ? clean.split(" ").length : 0;
  // Math / formula density: operators, sub/superscripts, greek letters, equations.
  const formulas = (text.match(/[=±×÷∑∫√∞≈≠≤≥∂ΔΩαβγθλμσπ]|\^\d|_\{?\d/g) || []).length;
  // Rough table detection: lines with 3+ numeric/short columns separated by gaps.
  const tableRows = lines(text).filter((l) => (l.match(/\s{2,}|\t/g) || []).length >= 2 && /\d/.test(l)).length;
  return {
    page: p.page,
    words,
    formulas,
    tableRows,
    heading: detectHeading(text),
    isToc: TOC_RE.test(clean.slice(0, 200)),
    sparse: words < 40,
  };
}

// Effort in "word equivalents": formulas and tables cost far more than prose,
// and a near-empty page is usually a diagram that still needs studying.
export function pageWeight(textOrPage: string | ParsedPage) {
  const p: ParsedPage = typeof textOrPage === "string" ? { page: 0, text: textOrPage } : textOrPage;
  const f = pageFeatures(p);
  if (f.isToc) return 20; // contents/index pages carry almost no study load
  const base = f.words + f.formulas * 25 + f.tableRows * 18;
  // Diagram-heavy / sparse page: still a real chunk of study time.
  return Math.max(base, f.sparse ? 120 : 60);
}

// Reading + processing time estimate, in minutes.
export function estimateMinutes(pages: ParsedPage[]) {
  const total = pages.reduce((s, p) => s + pageWeight(p), 0);
  return total / 160; // ~160 effort-words per minute of active study
}

// Day cap scales with the document instead of a hard 5.
export function maxDaysFor(pages: ParsedPage[]) {
  return Math.min(30, Math.max(5, Math.ceil(pages.length / 3)));
}

export function suggestDays(pages: ParsedPage[], minutesPerDay = 45, min = 1, max?: number) {
  const cap = max ?? maxDaysFor(pages);
  const est = Math.round(estimateMinutes(pages) / minutesPerDay);
  return Math.min(cap, Math.max(min, est || 1));
}

export function smartChunkPages(pages: ParsedPage[], days: number) {
  const n = pages.length;
  if (n === 0) return chunkPages(1, days);
  if (days >= n) return chunkPages(n, days);

  const weights = pages.map((p) => pageWeight(p));
  const total = weights.reduce((a, b) => a + b, 0);
  const target = total / days;

  const chunks: { day: number; startPage: number; endPage: number }[] = [];
  let start = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += weights[i];
    const remainingDays = days - chunks.length;
    const remainingPages = n - i - 1;
    const startsNewSection = i + 1 < n && !!detectHeading(pages[i + 1]?.text ?? "");
    const full = acc >= target * 0.75;
    const mustClose = remainingPages < remainingDays; // keep at least 1 page per remaining day

    if (
      chunks.length < days - 1 &&
      (mustClose || (full && (startsNewSection || acc >= target)))
    ) {
      chunks.push({ day: chunks.length + 1, startPage: start + 1, endPage: i + 1 });
      start = i + 1;
      acc = 0;
    }
  }
  chunks.push({ day: chunks.length + 1, startPage: start + 1, endPage: n });

  // Pad in the unlikely case we produced fewer chunks than days.
  while (chunks.length < days) {
    chunks.push({ day: chunks.length + 1, startPage: n, endPage: n });
  }
  return chunks;
}

// Compact per-page outline sent to the AI planner (keeps tokens small).
export function buildOutline(pages: ParsedPage[]) {
  return pages.map((p) => {
    const f = pageFeatures(p);
    return {
      page: p.page,
      words: f.words,
      formulas: f.formulas,
      tables: f.tableRows,
      toc: f.isToc,
      heading: f.heading ?? undefined,
      snippet: (p.text || "").replace(/\s+/g, " ").trim().slice(0, 180),
    };
  });
}

