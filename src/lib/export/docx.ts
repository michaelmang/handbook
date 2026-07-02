import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  ImageRun,
} from "docx";
import type { Project } from "../types";
import { organizeProject } from "../project-utils";
import { isContainerSection, headingLevelForDepth } from "../section-tree";
import { stripLeadingHeading } from "../markdown";

function parseInlineMarkdown(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g);

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
    } else {
      runs.push(new TextRun({ text: part }));
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}

function markdownToParagraphs(markdown: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: parseInlineMarkdown(line.slice(4)),
        })
      );
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: parseInlineMarkdown(line.slice(3)),
        })
      );
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: parseInlineMarkdown(line.slice(2)),
        })
      );
      i++;
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      for (const item of items) {
        paragraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            children: parseInlineMarkdown(item),
          })
        );
      }
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      for (const item of items) {
        paragraphs.push(
          new Paragraph({
            numbering: { reference: "default-numbering", level: 0 },
            children: parseInlineMarkdown(item),
          })
        );
      }
      continue;
    }

    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines
        .filter((l) => !l.match(/^\|[\s-|]+\|$/))
        .map((l) =>
          l
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim())
        );
      if (rows.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: rows.map((r) => r.join(" | ")).join("\n") })],
          })
        );
      }
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      paragraphs.push(
        new Paragraph({
          indent: { left: 720 },
          children: parseInlineMarkdown(quoteLines.join(" ")),
        })
      );
      continue;
    }

    const paraLines: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^#{1,3}\s/.test(lines[i]) && !lines[i].startsWith("- ") && !lines[i].startsWith("* ") && !/^\d+\.\s/.test(lines[i]) && !lines[i].startsWith("|") && !lines[i].startsWith("> ")) {
      paraLines.push(lines[i]);
      i++;
    }
    paragraphs.push(
      new Paragraph({
        children: parseInlineMarkdown(paraLines.join(" ")),
        spacing: { after: 200 },
      })
    );
  }

  return paragraphs;
}

async function logoToImageRun(dataUrl: string): Promise<ImageRun | null> {
  try {
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return null;
    const buffer = Buffer.from(match[2], "base64");
    return new ImageRun({
      data: buffer,
      transformation: { width: 150, height: 100 },
      type: match[1] === "png" ? "png" : "jpg",
    });
  } catch {
    return null;
  }
}

const DOCX_HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

export async function generateDocx(project: Project): Promise<Buffer> {
  const items = organizeProject(project, { includedOnly: true });
  const { schoolName, logoDataUrl, coverPageText } = project.branding;
  const children: Paragraph[] = [];

  if (logoDataUrl) {
    const image = await logoToImageRun(logoDataUrl);
    if (image) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [image],
          spacing: { after: 400 },
        })
      );
    }
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: schoolName || "School Name", bold: true, size: 48 })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: project.name, size: 32 })],
      spacing: { after: 400 },
    })
  );

  if (coverPageText) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: coverPageText, size: 22 })],
        spacing: { after: 200 },
      })
    );
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Table of Contents", bold: true })],
      spacing: { after: 300 },
    })
  );

  for (const item of items) {
    const isContainer = isContainerSection(item.section);
    const indent = item.depth * 360;
    children.push(
      new Paragraph({
        indent: { left: indent },
        children: [
          new TextRun({
            text: `${item.number}  ${item.section.title}`,
            bold: isContainer,
            size: isContainer ? 24 : 22,
          }),
        ],
        spacing: { after: 80 },
      })
    );
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));

  for (const item of items) {
    const level = headingLevelForDepth(item.depth);
    const headingLevel =
      DOCX_HEADING_LEVELS[Math.min(level - 1, DOCX_HEADING_LEVELS.length - 1)];
    const isContainer = isContainerSection(item.section);

    children.push(
      new Paragraph({
        heading: headingLevel,
        children: [
          new TextRun({
            text: `${item.number}  ${item.section.title}`,
            bold: true,
          }),
        ],
        pageBreakBefore: true,
        spacing: { after: isContainer ? 200 : 200 },
      })
    );

    if (!isContainer) {
      const content = stripLeadingHeading(item.section.markdownContent);
      children.push(...markdownToParagraphs(content));
    }
  }

  const doc = new Document({
    sections: [{ children }],
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
  });

  return Packer.toBuffer(doc);
}
