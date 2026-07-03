/**
 * Generates sample .docx fixtures in samples/ for import tests.
 * Run: npx tsx scripts/generate-sample-docx.ts
 */
import fs from "fs";
import path from "path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";

const samplesDir = path.join(process.cwd(), "samples");

async function writeDocx(filename: string, doc: Document) {
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(path.join(samplesDir, filename), buffer);
  console.log(`Wrote ${filename}`);
}

async function main() {
  // Word heading styles
  await writeDocx(
    "handbook-headings.docx",
    new Document({
      sections: [
        {
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun("Academic Policies")],
            }),
            new Paragraph({
              children: [
                new TextRun(
                  "This section covers all academic policies for the school year."
                ),
              ],
            }),
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun("Attendance")],
            }),
            new Paragraph({
              children: [
                new TextRun("Students are expected to attend all classes."),
              ],
            }),
            new Paragraph({
              heading: HeadingLevel.HEADING_3,
              children: [new TextRun("Tardiness")],
            }),
            new Paragraph({
              children: [
                new TextRun("Three tardies equal one unexcused absence."),
              ],
            }),
          ],
        },
      ],
    })
  );

  // Outline numbering in plain paragraphs (messy handbook)
  await writeDocx(
    "handbook-outline-numbers.docx",
    new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: "4 Academic Policies", bold: true })],
            }),
            new Paragraph({
              children: [new TextRun("Overview of academic expectations.")],
            }),
            new Paragraph({
              children: [new TextRun("4.1 Attendance Policy")],
            }),
            new Paragraph({
              children: [new TextRun("Regular attendance is required.")],
            }),
            new Paragraph({
              children: [new TextRun("4.1.3 Tardiness")],
            }),
            new Paragraph({
              children: [new TextRun("Tardy students must check in at the office.")],
            }),
          ],
        },
      ],
    })
  );

  // ALL CAPS + bold messy style
  await writeDocx(
    "handbook-messy.docx",
    new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: "DRESS CODE", bold: true })],
            }),
            new Paragraph({
              children: [new TextRun("Students must dress modestly.")],
            }),
            new Paragraph({
              children: [new TextRun({ text: "Uniform Standards", bold: true })],
            }),
            new Paragraph({
              children: [new TextRun("Navy polo and khaki pants are required.")],
            }),
          ],
        },
      ],
    })
  );
}

main().catch(console.error);
