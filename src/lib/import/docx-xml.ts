import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export interface DocxRunTypography {
  fontSizeHalfPts: number | null;
  bold: boolean;
  italic: boolean;
  allCaps: boolean;
}

export interface DocxParagraphRaw {
  index: number;
  text: string;
  markdown: string;
  styleId: string | null;
  outlineLevel: number | null;
  listLevel: number | null;
  listNumId: number | null;
  leftIndentTwips: number;
  firstLineIndentTwips: number;
  spaceBeforeTwips: number;
  spaceAfterTwips: number;
  runs: DocxRunTypography[];
  dominantFontSizeHalfPts: number | null;
  isBoldDominant: boolean;
  isAllCaps: boolean;
  /** Paragraph is part of a Word TOC field ({ TOC ... }). */
  inTocField: boolean;
  /** Contains an internal hyperlink anchor (common in TOC entries). */
  hasInternalHyperlink: boolean;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function attrVal(
  node: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!node) return null;
  const v = node[`@_${key}`];
  return v != null ? String(v) : null;
}

function intVal(
  node: Record<string, unknown> | undefined,
  key: string
): number | null {
  const s = attrVal(node, key);
  if (s == null) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function textFromWt(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textFromWt).join("");
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if ("#text" in obj) return String(obj["#text"] ?? "");
    if ("t" in obj) return textFromWt(obj.t);
  }
  return "";
}

function extractRunMarkdown(
  run: Record<string, unknown>,
  parts: string[]
): void {
  const textParts: string[] = [];
  if ("t" in run) textParts.push(textFromWt(run.t));
  if ("tab" in run) textParts.push("\t");
  if ("br" in run) textParts.push("\n");

  const text = textParts.join("");
  if (!text) return;

  const rPr = run.rPr as Record<string, unknown> | undefined;
  const bold = rPr != null && ("b" in rPr || "bCs" in rPr);
  const italic = rPr != null && ("i" in rPr || "iCs" in rPr);

  if (bold && italic) parts.push(`***${text}***`);
  else if (bold) parts.push(`**${text}**`);
  else if (italic) parts.push(`*${text}*`);
  else parts.push(text);
}

function plainTextFromRun(run: Record<string, unknown>): string {
  const parts: string[] = [];
  if ("t" in run) parts.push(textFromWt(run.t));
  if ("tab" in run) parts.push("\t");
  if ("br" in run) parts.push("\n");
  return parts.join("");
}

function parseRunTypography(run: Record<string, unknown>): DocxRunTypography {
  const rPr = run.rPr as Record<string, unknown> | undefined;
  const bold = rPr != null && ("b" in rPr || "bCs" in rPr);
  const italic = rPr != null && ("i" in rPr || "iCs" in rPr);
  const allCaps = rPr != null && ("caps" in rPr || "smallCaps" in rPr);
  const sz = rPr?.sz as Record<string, unknown> | undefined;
  const fontSizeHalfPts = intVal(sz, "val");

  return { fontSizeHalfPts, bold, italic, allCaps };
}

function walkXml(node: unknown, visit: (obj: Record<string, unknown>) => void): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const child of node) walkXml(child, visit);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  visit(obj);
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("@_")) continue;
    walkXml(value, visit);
  }
}

function paragraphHasTocField(p: Record<string, unknown>): boolean {
  let found = false;
  walkXml(p, (obj) => {
    if (found) return;
    if ("fldSimple" in obj) {
      for (const fld of asArray(obj.fldSimple)) {
        if (!fld || typeof fld !== "object") continue;
        const instr = attrVal(fld as Record<string, unknown>, "instr");
        if (instr && /\bTOC\b/i.test(instr)) found = true;
      }
    }
    if ("instrText" in obj) {
      for (const instr of asArray(obj.instrText)) {
        const text = textFromWt(instr);
        if (/\bTOC\b/i.test(text)) found = true;
      }
    }
  });
  return found;
}

function paragraphHasInternalHyperlink(p: Record<string, unknown>): boolean {
  let found = false;
  walkXml(p, (obj) => {
    if (found) return;
    if ("hyperlink" in obj) {
      for (const link of asArray(obj.hyperlink)) {
        if (!link || typeof link !== "object") continue;
        const anchor = attrVal(link as Record<string, unknown>, "anchor");
        if (anchor) found = true;
      }
    }
  });
  return found;
}

function parseParagraph(
  p: Record<string, unknown>,
  index: number
): DocxParagraphRaw {
  const textParts: string[] = [];
  const mdParts: string[] = [];

  for (const r of asArray(p.r)) {
    if (!r || typeof r !== "object") continue;
    const run = r as Record<string, unknown>;
    extractRunMarkdown(run, mdParts);
    textParts.push(plainTextFromRun(run));
  }

  const text = textParts.join("").replace(/\s+/g, " ").trim();
  const markdown = mdParts.join("").trim();

  const pPr = p.pPr as Record<string, unknown> | undefined;
  const pStyle = pPr?.pStyle as Record<string, unknown> | undefined;
  const styleId = attrVal(pStyle, "val");

  const outlineLvl = pPr?.outlineLvl as Record<string, unknown> | undefined;
  const outlineLevel = intVal(outlineLvl, "val");

  const numPr = pPr?.numPr as Record<string, unknown> | undefined;
  const ilvl = numPr?.ilvl as Record<string, unknown> | undefined;
  const numId = numPr?.numId as Record<string, unknown> | undefined;
  const listLevel = intVal(ilvl, "val");
  const listNumId = intVal(numId, "val");

  const ind = pPr?.ind as Record<string, unknown> | undefined;
  const leftIndentTwips = intVal(ind, "left") ?? 0;
  const firstLineIndentTwips = intVal(ind, "firstLine") ?? 0;

  const spacing = pPr?.spacing as Record<string, unknown> | undefined;
  const spaceBeforeTwips = intVal(spacing, "before") ?? 0;
  const spaceAfterTwips = intVal(spacing, "after") ?? 0;

  const runs: DocxRunTypography[] = [];
  for (const r of asArray(p.r)) {
    if (r && typeof r === "object") {
      runs.push(parseRunTypography(r as Record<string, unknown>));
    }
  }

  const sizes = runs
    .map((r) => r.fontSizeHalfPts)
    .filter((s): s is number => s != null);
  const dominantFontSizeHalfPts =
    sizes.length > 0 ? Math.max(...sizes) : null;

  const isBoldDominant =
    runs.length > 0 && runs.filter((r) => r.bold).length >= runs.length / 2;
  const letters = text.replace(/[^a-zA-Z]/g, "");
  const isAllCaps =
    letters.length >= 3 && letters === letters.toUpperCase();

  return {
    index,
    text,
    markdown,
    styleId,
    outlineLevel,
    listLevel,
    listNumId,
    leftIndentTwips,
    firstLineIndentTwips,
    spaceBeforeTwips,
    spaceAfterTwips,
    runs,
    dominantFontSizeHalfPts,
    isBoldDominant,
    isAllCaps,
    inTocField: paragraphHasTocField(p),
    hasInternalHyperlink: paragraphHasInternalHyperlink(p),
  };
}

/** Extract all body paragraphs from a .docx with typography metadata. */
export async function extractDocxParagraphs(
  buffer: Buffer
): Promise<DocxParagraphRaw[]> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    throw new Error("Invalid DOCX: missing word/document.xml");
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    isArray: (name) => ["p", "r"].includes(name),
  });

  const doc = parser.parse(documentXml) as Record<string, unknown>;
  const document = doc.document as Record<string, unknown> | undefined;
  if (!document) return [];

  const paragraphNodes: Record<string, unknown>[] = [];
  collectParagraphNodes(document, paragraphNodes);

  const paragraphs: DocxParagraphRaw[] = [];
  let index = 0;

  for (const p of paragraphNodes) {
    const parsed = parseParagraph(p, index);
    if (!parsed.text && !parsed.markdown) continue;
    paragraphs.push(parsed);
    index++;
  }

  return paragraphs;
}

/** Walk document XML in order and collect all w:p nodes (including inside tables). */
function collectParagraphNodes(
  node: unknown,
  out: Record<string, unknown>[]
): void {
  if (node == null) return;

  if (Array.isArray(node)) {
    for (const child of node) collectParagraphNodes(child, out);
    return;
  }

  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  if ("p" in obj) {
    for (const p of asArray(obj.p)) {
      if (p && typeof p === "object") {
        out.push(p as Record<string, unknown>);
      }
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key === "p" || key.startsWith("@_")) continue;
    collectParagraphNodes(value, out);
  }
}
