import fs from "fs";
import mammoth from "mammoth";
import { OfficeParser } from "officeparser";
import { htmlToMarkdown } from "../src/lib/import/turndown";

const DOCX =
  process.argv[2] ??
  "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx";

function countRe(text: string, re: RegExp): number {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  return [...text.matchAll(new RegExp(re.source, flags))].length;
}

function excerpt(text: string, needle: string, after = 700): string {
  const i = text.indexOf(needle);
  if (i < 0) return `[not found: ${needle}]`;
  return text.slice(i, i + after);
}

function metrics(label: string, md: string) {
  return {
    label,
    chars: md.length,
    lines: md.split("\n").length,
    orderedListLines: countRe(md, /^\s*\d+\.\s/m),
    bulletListLines: countRe(md, /^\s*[-*]\s/m),
    boldMarkers: countRe(md, /\*\*[^*]+\*\*/g),
    htmlDivs: countRe(md, /<div[^>]*>/g),
    tableRows: countRe(md, /^\|/m),
    gluedNumberLines: countRe(md, /^\d+\.\d+[^\s\d.]/m),
    hasMissionBody: md.includes("The mission of Faith Christian School"),
  };
}

async function main(): Promise<void> {
const buf = fs.readFileSync(DOCX);
const mammothHtml = (await mammoth.convertToHtml({ buffer: buf })).value;
const mammothMd = htmlToMarkdown(mammothHtml);

const ast = await OfficeParser.parseOffice(buf, {
  fileType: "docx",
  extractAttachments: false,
});
const officeMd = (await ast.to("md")).value;

const outDir =
  "spike-output/compare-mammoth-officeparser";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}/mammoth.md`, mammothMd);
fs.writeFileSync(`${outDir}/officeparser.md`, officeMd);
fs.writeFileSync(`${outDir}/mammoth.html`, mammothHtml);

const m = metrics("mammoth→turndown", mammothMd);
const o = metrics("officeParser", officeMd);

console.log("=== METRICS (FCS handbook) ===");
console.table([m, o]);

console.log("\n=== MISSION STATEMENT EXCERPT ===");
console.log("\n--- mammoth ---");
console.log(excerpt(mammothMd, "The mission of Faith Christian School"));
console.log("\n--- officeParser ---");
console.log(excerpt(officeMd, "The mission of Faith Christian School"));

console.log("\n=== HONOR AND CONDUCT (TOC area) ===");
console.log("\n--- mammoth ---");
console.log(excerpt(mammothMd, "Honor and Conduct", 1000));
console.log("\n--- officeParser ---");
console.log(excerpt(officeMd, "2. **Honor and Conduct**", 1000));

console.log("\n=== DISCIPLINE NESTING ===");
console.log("\n--- mammoth ---");
console.log(excerpt(mammothMd, "Classroom Discipline", 800));
console.log("\n--- officeParser ---");
console.log(excerpt(officeMd, "Classroom Discipline", 800));

console.log(`\nWrote ${outDir}/mammoth.md and officeparser.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
