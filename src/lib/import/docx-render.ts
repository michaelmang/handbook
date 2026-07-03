import mammoth from "mammoth";

export const MAMMOTH_STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='heading 1'] => h1:fresh",
  "p[style-name='heading 2'] => h2:fresh",
  "p[style-name='heading 3'] => h3:fresh",
  "p[style-name='heading 4'] => h4:fresh",
  "p[style-name='heading 5'] => h5:fresh",
  "p[style-name='heading 6'] => h6:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "r[style-name='Strong'] => strong",
  "b => strong",
  "i => em",
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface DocxHtmlResult {
  html: string;
  warnings: string[];
}

export async function convertDocxToHtml(buffer: Buffer): Promise<DocxHtmlResult> {
  const warnings: string[] = [];

  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("File exceeds 10MB limit");
  }

  const result = await mammoth.convertToHtml(
    { buffer },
    { styleMap: MAMMOTH_STYLE_MAP }
  );

  for (const msg of result.messages) {
    if (msg.type === "warning") warnings.push(msg.message);
  }

  if (!result.value.trim()) {
    throw new Error("Document appears empty");
  }

  return { html: result.value, warnings };
}
