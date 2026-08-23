import * as pdfjs from "pdfjs-dist";
// Use bundled worker
// @ts-ignore
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export type ParsedPage = { page: number; text: string };

export async function parsePdf(file: File): Promise<ParsedPage[]> {
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
  if (!docCache.has(url)) {
    docCache.set(
      url,
      (async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to download PDF");
        const buf = await res.arrayBuffer();
        return pdfjs.getDocument({ data: buf }).promise;
      })(),
    );
  }
  return docCache.get(url)!;
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
// Weighs each page by how much real content it carries, then splits the document
// into day-chunks of roughly equal workload (instead of equal page counts).

const HEADING_RE = /(^|\n)\s*(chapter|section|unit|topic|part|lesson)\b/i;

export function pageWeight(text: string) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  const words = clean ? clean.split(" ").length : 0;
  // A near-empty page still costs a little (likely a diagram/figure page).
  return Math.max(words, 40);
}

export function suggestDays(pages: ParsedPage[], min = 1, max = 5) {
  const total = pages.reduce((s, p) => s + pageWeight(p.text), 0);
  // ~1200 words of study material per day feels like a solid session.
  const est = Math.round(total / 1200);
  return Math.min(max, Math.max(min, est || 1));
}

export function smartChunkPages(pages: ParsedPage[], days: number) {
  const n = pages.length;
  if (n === 0) return chunkPages(1, days);
  if (days >= n) return chunkPages(n, days);

  const weights = pages.map((p) => pageWeight(p.text));
  const total = weights.reduce((a, b) => a + b, 0);
  const target = total / days;

  const chunks: { day: number; startPage: number; endPage: number }[] = [];
  let start = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += weights[i];
    const remainingDays = days - chunks.length;
    const remainingPages = n - i - 1;
    const startsNewSection = i + 1 < n && HEADING_RE.test(pages[i + 1]?.text ?? "");
    const full = acc >= target * 0.85;
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
