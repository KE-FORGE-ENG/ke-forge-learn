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
