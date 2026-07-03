import { OfficeParser, type OfficeParserAST } from "officeparser";

export interface OfficeParseResult {
  ast: OfficeParserAST;
  markdown: string;
  warnings: string[];
}

/** Parse a DOCX buffer with officeParser and emit full-document markdown. */
export async function parseDocxWithOfficeParser(
  buffer: Buffer
): Promise<OfficeParseResult> {
  const ast = await OfficeParser.parseOffice(buffer, {
    fileType: "docx",
    extractAttachments: false,
  });

  const generated = await ast.to("md");
  const markdown = generated.value.trim();
  const warnings = (ast.warnings ?? []).map(
    (w) => (typeof w === "string" ? w : w.message) ?? String(w)
  );

  return { ast, markdown, warnings };
}
