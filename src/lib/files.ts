import { parsePdf, type ParsedPage } from "@/lib/pdf";
import { callAi } from "@/lib/api";

export type { ParsedPage };

const ext = (name: string) => (name.split(".").pop() || "").toLowerCase();

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "xml", "html", "htm", "yml", "yaml",
  "js", "ts", "jsx", "tsx", "py", "java", "c", "h", "cpp", "cs", "go", "rb", "php",
  "sql", "sh", "css", "scss", "rtf", "log", "ini", "conf", "srt", "vtt",
]);

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "heic", "heif", "tif", "tiff"]);

/** Split a long plain-text document into ~2500-character "pages". */
function paginate(text: string, perPage = 2500): ParsedPage[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const paras = clean.split(/\n{2,}/);
  const pages: ParsedPage[] = [];
  let buf = "";
  for (const p of paras) {
    if (buf && buf.length + p.length > perPage) {
      pages.push({ page: pages.length + 1, text: buf.trim() });
      buf = "";
    }
    buf += (buf ? "\n\n" : "") + p;
  }
  if (buf.trim()) pages.push({ page: pages.length + 1, text: buf.trim() });
  return pages;
}

async function readDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const res = await (mammoth as any).extractRawText({ arrayBuffer: buf });
  return res.value as string;
}

async function readSheet(file: File): Promise<ParsedPage[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return wb.SheetNames.map((name, i) => ({
    page: i + 1,
    text: `## ${name}\n\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`,
  })).filter((p) => p.text.trim().length > 4);
}

async function readPptx(file: File): Promise<ParsedPage[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const pages: ParsedPage[] = [];
  for (const name of slides) {
    const xml = await zip.file(name)!.async("string");
    const text = (xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [])
      .map((t) => t.replace(/<[^>]+>/g, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push({ page: pages.length + 1, text });
  }
  return pages;
}

async function readImage(file: File): Promise<ParsedPage[]> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Could not read image"));
    r.readAsDataURL(file);
  });
  const out = await callAi("ocr_image", { imageDataUrl: dataUrl });
  const text = (out?.text || "").trim();
  return text ? [{ page: 1, text }] : [];
}

/**
 * Parse any supported study file into pages of text.
 * PDF, Word, PowerPoint, Excel/CSV, plain text/code, and images (via OCR).
 */
export async function parseAnyFile(file: File): Promise<ParsedPage[]> {
  const e = ext(file.name);
  const type = file.type || "";
  let pages: ParsedPage[] = [];

  if (e === "pdf" || type === "application/pdf") {
    pages = await parsePdf(file);
  } else if (e === "docx") {
    pages = paginate(await readDocx(file));
  } else if (e === "xlsx" || e === "xls") {
    pages = await readSheet(file);
  } else if (e === "pptx") {
    pages = await readPptx(file);
  } else if (IMAGE_EXT.has(e) || type.startsWith("image/")) {
    pages = await readImage(file);
  } else if (TEXT_EXT.has(e) || type.startsWith("text/")) {
    pages = paginate(await file.text());
  } else if (e === "doc" || e === "ppt") {
    throw new Error("Old .doc/.ppt files aren't supported — please save as .docx/.pptx or PDF.");
  } else {
    // Last resort: try reading as text.
    const text = await file.text().catch(() => "");
    if (!/[a-zA-Z]{3}/.test(text)) throw new Error(`Can't read "${file.name}". Try PDF, Word, PowerPoint, Excel, text, or an image.`);
    pages = paginate(text);
  }

  if (pages.length === 0) throw new Error(`No readable text found in "${file.name}".`);
  return pages;
}

/** Strip a known document extension for a default title. */
export function fileTitle(name: string) {
  return name.replace(/\.[a-z0-9]{1,5}$/i, "");
}
