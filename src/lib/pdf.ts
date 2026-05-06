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
