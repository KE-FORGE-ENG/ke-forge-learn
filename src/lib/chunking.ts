// Stage 1 + 2 of the RAG pipeline: structure-aware normalisation and
// recursive character splitting with overlap. Pure functions, no I/O, so the
// same code runs on the client (preview) and inside server functions.

export const CHUNK_CHARS = 2000; // ~512 tokens
export const OVERLAP_CHARS = 200; // ~10% overlap

const HEADING_KEYWORDS =
  /^(chapter|section|unit|topic|part|lesson|module|appendix|introduction|conclusion|summary|exercises?|references)\b/i;
const NUMBERED_HEADING = /^\d+(\.\d+)*\s+\S/;

export type SourcePage = { page: number; text: string };
export type BuiltChunk = {
  page_number: number;
  section_title: string | null;
  chunk_index: number;
  content: string;
};

function splitLines(text: string) {
  return (text || "")
    .split(/\r?\n|(?<=\.)\s{3,}/)
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

export function detectHeadingLine(text: string): string | null {
  for (const line of splitLines(text).slice(0, 4)) {
    if (line.length > 90) continue;
    const words = line.split(" ").length;
    if (HEADING_KEYWORDS.test(line)) return line;
    if (NUMBERED_HEADING.test(line) && words <= 12) return line;
    if (words <= 10 && /[A-Za-z]/.test(line) && line === line.toUpperCase()) return line;
  }
  return null;
}

// Raw page text -> markdown-ish blocks (headings kept as `## ...`).
export function toBlocks(text: string): string[] {
  const raw = (text || "").replace(/\r/g, "");
  const paras = raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const source = paras.length > 1 ? paras : splitLines(raw);
  return source.map((p) => {
    const h = detectHeadingLine(p);
    return h && p.length <= 100 ? `## ${p}` : p;
  });
}

// Recursive character splitter: paragraph -> line -> sentence -> word -> hard.
export function recursiveSplit(text: string, size = CHUNK_CHARS): string[] {
  if (text.length <= size) return [text];
  for (const sep of ["\n\n", "\n", ". ", " "]) {
    const parts = text.split(sep);
    if (parts.length < 2) continue;
    const out: string[] = [];
    let buf = "";
    for (const part of parts) {
      const candidate = buf ? buf + sep + part : part;
      if (candidate.length > size && buf) {
        out.push(buf);
        buf = part;
      } else {
        buf = candidate;
      }
    }
    if (buf) out.push(buf);
    return out.flatMap((c) => (c.length > size ? recursiveSplit(c, size) : [c]));
  }
  const hard: string[] = [];
  for (let i = 0; i < text.length; i += size) hard.push(text.slice(i, i + size));
  return hard;
}

// Build embeddable chunks with parent-section header injection.
export function buildChunks(pages: SourcePage[], docTitle: string): BuiltChunk[] {
  const chunks: BuiltChunk[] = [];
  let currentSection: string | null = null;
  let index = 0;

  for (const p of pages) {
    const blocks = toBlocks(p.text || "");
    if (blocks.length === 0) continue;
    let buf = "";

    const flush = () => {
      const body = buf.trim();
      buf = "";
      if (!body) return;
      for (const piece of recursiveSplit(body)) {
        const clean = piece.trim();
        if (clean.length < 20) continue;
        const header = `[Context: ${docTitle}${currentSection ? ` > ${currentSection}` : ""} > Page ${p.page}]`;
        chunks.push({
          page_number: p.page,
          section_title: currentSection,
          chunk_index: index++,
          content: `${header}\n${clean}`,
        });
      }
    };

    for (const block of blocks) {
      if (block.startsWith("## ")) {
        flush();
        currentSection = block.slice(3).trim();
      }
      const next = buf ? `${buf}\n\n${block}` : block;
      if (next.length > CHUNK_CHARS) {
        const tail = buf.slice(-OVERLAP_CHARS);
        flush();
        buf = tail ? `${tail}\n\n${block}` : block;
        if (buf.length > CHUNK_CHARS) flush();
      } else {
        buf = next;
      }
    }
    flush();
  }
  return chunks;
}
