import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import type { Project } from "../types";
import { TEMPLATES } from "../templates";
import { organizeProject } from "../project-utils";
import { isContainerSection, headingLevelForDepth } from "../section-tree";
import { stripLeadingHeading } from "../markdown";

async function markdownToHtml(markdown: string): Promise<string> {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdown);
  return String(result);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getTemplateCss(project: Project): string {
  const template = TEMPLATES[project.templateId];
  const accent = project.branding.accentColor;
  const isCompact = project.templateId === "compact";

  return `
    @page {
      size: letter;
      margin: ${isCompact ? "0.75in" : "1in"};
      @bottom-center {
        content: counter(page);
        font-family: ${template.bodyFont};
        font-size: 10pt;
        color: #666;
      }
    }

    * { box-sizing: border-box; }

    body {
      font-family: ${template.bodyFont};
      font-size: ${isCompact ? "10.5pt" : "11pt"};
      line-height: ${isCompact ? "1.45" : "1.6"};
      color: #1a1a1a;
      margin: 0;
      padding: 0;
    }

    .cover-page {
      page-break-after: always;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: ${template.coverStyle === "centered" ? "center" : "flex-start"};
      text-align: ${template.coverStyle === "centered" ? "center" : "left"};
      padding: ${isCompact ? "1.5in 1in" : "2in 1.5in"};
    }

    .cover-page .logo {
      max-width: 180px;
      max-height: 120px;
      margin-bottom: 2rem;
      object-fit: contain;
    }

    .cover-page .school-name {
      font-family: ${template.headingFont};
      font-size: ${isCompact ? "24pt" : "28pt"};
      font-weight: 700;
      color: ${accent};
      margin: 0 0 0.5rem;
      line-height: 1.2;
    }

    .cover-page .handbook-title {
      font-family: ${template.headingFont};
      font-size: ${isCompact ? "18pt" : "20pt"};
      font-weight: 400;
      color: #333;
      margin: 0 0 1.5rem;
    }

    .cover-page .cover-text {
      font-size: 11pt;
      color: #555;
      max-width: 28em;
      line-height: 1.5;
    }

    .toc-page {
      page-break-after: always;
      padding: 0.5in 0;
    }

    .toc-page h2 {
      font-family: ${template.headingFont};
      font-size: 16pt;
      color: ${accent};
      border-bottom: 2px solid ${accent};
      padding-bottom: 0.5rem;
      margin: 0 0 1.5rem;
    }

    .toc-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .toc-list li {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 0.35rem 0;
      border-bottom: 1px dotted #ccc;
      font-size: 11pt;
    }

    .toc-list li.toc-container {
      font-weight: 600;
      color: ${accent};
    }

    .toc-number {
      font-family: monospace;
      font-size: 9pt;
      color: #888;
      margin-right: 0.5rem;
      min-width: 2.5rem;
    }

    .section-number {
      font-family: monospace;
      font-size: 10pt;
      color: #888;
      margin-right: 0.5rem;
      font-weight: 400;
    }

    .structural-header {
      page-break-before: always;
      margin: 1.5rem 0 1rem;
    }

    .structural-header.depth-0 {
      border-bottom: 3px solid ${accent};
      padding-bottom: 0.5rem;
    }

    .structural-header h1,
    .structural-header h2,
    .structural-header h3,
    .structural-header h4,
    .structural-header h5,
    .structural-header h6 {
      font-family: ${template.headingFont};
      color: ${accent};
      margin: 0;
      font-weight: 700;
    }

    .structural-header.depth-0 h1 { font-size: ${isCompact ? "18pt" : "22pt"}; }
    .structural-header.depth-1 h2 { font-size: ${isCompact ? "16pt" : "18pt"}; }
    .structural-header.depth-2 h3 { font-size: ${isCompact ? "14pt" : "16pt"}; }
    .structural-header.depth-3 h4 { font-size: 13pt; }
    .structural-header.depth-4 h5 { font-size: 12pt; }
    .structural-header.depth-5 h6 { font-size: 11pt; }

    .toc-dots {
      flex: 1;
      border-bottom: 1px dotted #aaa;
      margin: 0 0.5rem;
      min-width: 1rem;
    }

    .chapter-header {
      display: none;
    }

    .chapter-header h1 {
      display: none;
    }

    .section {
      page-break-before: always;
      margin-bottom: 2rem;
    }

    .section h2 {
      font-family: ${template.headingFont};
      font-size: ${isCompact ? "14pt" : "16pt"};
      color: ${accent};
      margin: 0 0 1rem;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid #ddd;
    }

    .section-content h1 { font-size: 14pt; color: ${accent}; margin: 1.25rem 0 0.5rem; }
    .section-content h2 { font-size: 13pt; color: #333; margin: 1rem 0 0.5rem; border: none; padding: 0; }
    .section-content h3 { font-size: 12pt; color: #444; margin: 0.75rem 0 0.35rem; }
    .section-content p { margin: 0 0 0.75rem; }
    .section-content ul, .section-content ol { margin: 0 0 0.75rem; padding-left: 1.5rem; }
    .section-content li { margin-bottom: 0.25rem; }
    .section-content table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 10pt; }
    .section-content th, .section-content td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; }
    .section-content th { background: #f5f5f5; font-weight: 600; }
    .section-content blockquote { border-left: 3px solid ${accent}; margin: 1rem 0; padding: 0.5rem 1rem; color: #555; background: #fafafa; }
    .section-content code { font-family: monospace; font-size: 0.9em; background: #f4f4f4; padding: 0.1em 0.3em; border-radius: 3px; }
    .section-content pre { background: #f4f4f4; padding: 1rem; overflow-x: auto; border-radius: 4px; font-size: 9pt; }
    .section-content pre code { background: none; padding: 0; }

    .page-header {
      position: running(header);
      font-size: 9pt;
      color: #888;
      border-bottom: 1px solid #ddd;
      padding-bottom: 0.25rem;
    }
  `;
}

export async function generateHandbookHtml(project: Project): Promise<string> {
  const items = organizeProject(project, { includedOnly: true });
  const { schoolName, logoDataUrl, coverPageText } = project.branding;

  const tocHtml = items
    .map((item) => {
      const isContainer = isContainerSection(item.section);
      const indent = item.depth * 1.25;
      return `
      <li class="toc-entry ${isContainer ? "toc-container" : ""}" style="padding-left: ${indent}rem;">
        <span class="toc-number">${escapeHtml(item.number)}</span>
        <span>${escapeHtml(item.section.title)}</span>
        <span class="toc-dots"></span>
      </li>`;
    })
    .join("");

  const bodyParts: string[] = [];

  for (const item of items) {
    const level = headingLevelForDepth(item.depth);
    const tag = `h${level}`;
    const isContainer = isContainerSection(item.section);

    if (isContainer) {
      bodyParts.push(`
        <div class="structural-header depth-${item.depth}">
          <${tag}><span class="section-number">${escapeHtml(item.number)}</span>${escapeHtml(item.section.title)}</${tag}>
        </div>
      `);
    } else {
      const content = stripLeadingHeading(item.section.markdownContent);
      const html = await markdownToHtml(content);
      bodyParts.push(`
        <div class="section">
          <${tag}><span class="section-number">${escapeHtml(item.number)}</span>${escapeHtml(item.section.title)}</${tag}>
          <div class="section-content">${html}</div>
        </div>
      `);
    }
  }

  const logoHtml = logoDataUrl
    ? `<img class="logo" src="${logoDataUrl}" alt="${escapeHtml(schoolName)} logo" />`
    : "";

  const coverTextHtml = coverPageText
    ? `<p class="cover-text">${escapeHtml(coverPageText)}</p>`
    : "";

  const displaySchoolName = schoolName || "School Name";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(project.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap" rel="stylesheet" />
  <style>${getTemplateCss(project)}</style>
</head>
<body>
  <div class="cover-page">
    ${logoHtml}
    <h1 class="school-name">${escapeHtml(displaySchoolName)}</h1>
    <h2 class="handbook-title">${escapeHtml(project.name)}</h2>
    ${coverTextHtml}
  </div>

  <div class="toc-page">
    <h2>Table of Contents</h2>
    <ul class="toc-list">${tocHtml}</ul>
  </div>

  ${bodyParts.join("\n")}
</body>
</html>`;
}

