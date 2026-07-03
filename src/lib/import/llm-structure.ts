import type { ParagraphFeatures } from "./paragraph-features";
import { compactForLlm } from "./paragraph-features";
import {
  auditStructure,
  buildRefineContextParagraphs,
  summarizeDraftHeadings,
  type StructureIssue,
} from "./structure-audit";

export interface StructureHeading {
  index: number;
  level: number;
}

export interface StructureClassification {
  headings: StructureHeading[];
  skip: number[];
  confidence: "high" | "medium" | "low";
  notes?: string;
}

const SYSTEM_PROMPT = `You classify paragraph roles in a school student handbook Word document.

You receive a JSON array of paragraphs with typography features (NOT reliable style names):
- i: paragraph index (use exactly in output)
- t: text preview
- w: word count
- fs: font size ratio vs body (1.0 = normal, >1.1 often heading)
- b: bold dominant (1/0)
- cap: all caps (1/0)
- ind: indent level
- lst: Word list level (null if none)
- ol: Word outline level (null if none)
- sb: space-before ratio vs body
- dot: ends with period (1/0)

Do NOT trust Word style names. Infer structure from typography, indent, list level, and semantics.

Rules:
- role "heading" for section/chapter titles: short lines, often bold and/or larger font, often no trailing period
- TOC lines: multiple section titles on one line, dot leaders, or numbered lists of titles only → add index to skip
- Cover page boilerplate before real content → skip
- Body paragraphs under a heading until the next heading
- level 1 = major part/chapter, 2 = section, 3 = subsection, 4 = sub-subsection
- Acronyms alone (PSAT, ACT) are usually subheadings under a parent topic, not level 1
- APPENDIX headings are level 1 or 2

Return JSON only:
{
  "headings": [{"index": 0, "level": 1}],
  "skip": [1, 2],
  "confidence": "high|medium|low",
  "notes": "optional brief note"
}`;

const CHUNK_SIZE = 200;
const CHUNK_OVERLAP = 8;

const REFINE_SYSTEM_PROMPT = `You review and correct a draft handbook outline produced by an automated first pass.

You receive:
- draft: proposed headings (index, level, title, word count) and skip list
- issues: programmatic flags on likely mistakes
- paragraphs: typography features near flagged paragraphs (i, t, w, fs, b, cap, ind, lst, ol, sb, dot)

Do NOT trust Word style names. Fix the outline using typography and semantics.

Correct common first-pass errors:
- Remove headings that are body prose (long sentences, 15+ words, ends with period)
- Demote or remove false level-1 splits (too many top-level parts)
- Nest acronyms (PSAT, ACT, CTP) under parent topics like Standardized Tests
- Merge duplicate section titles — keep the one with real policy content nearby
- Move TOC/cover lines to skip
- Fix wrong levels (subsection marked as chapter)

Return a COMPLETE corrected structure (not a diff). Use exact paragraph indices from input.

Return JSON only:
{
  "headings": [{"index": 0, "level": 1}],
  "skip": [1, 2],
  "confidence": "high|medium|low",
  "notes": "brief summary of corrections made"
}`;

function parseClassificationJson(raw: string): StructureClassification {
  const parsed = JSON.parse(raw) as StructureClassification;
  if (!Array.isArray(parsed.headings)) {
    throw new Error("Invalid LLM response: missing headings");
  }
  return {
    headings: parsed.headings
      .filter(
        (h) =>
          typeof h.index === "number" &&
          typeof h.level === "number" &&
          h.level >= 1 &&
          h.level <= 6
      )
      .map((h) => ({ index: h.index, level: h.level })),
    skip: Array.isArray(parsed.skip)
      ? parsed.skip.filter((n) => typeof n === "number")
      : [],
    confidence: parsed.confidence ?? "medium",
    notes: parsed.notes,
  };
}

async function callOpenAi(
  userContent: string,
  chunkLabel: string,
  systemPrompt: string = SYSTEM_PROMPT
): Promise<StructureClassification> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${chunkLabel}\n\nParagraphs:\n${userContent}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `OpenAI API error (${response.status}): ${errText.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");

  return parseClassificationJson(content);
}

function mergeChunkResults(
  results: StructureClassification[]
): StructureClassification {
  const headingMap = new Map<number, number>();
  const skipSet = new Set<number>();
  const notes: string[] = [];

  for (const r of results) {
    for (const h of r.headings) {
      if (!headingMap.has(h.index)) headingMap.set(h.index, h.level);
    }
    for (const s of r.skip) skipSet.add(s);
    if (r.notes) notes.push(r.notes);
  }

  const headings = [...headingMap.entries()]
    .map(([index, level]) => ({ index, level }))
    .sort((a, b) => a.index - b.index);

  const confidences = results.map((r) => r.confidence);
  const confidence = confidences.includes("low")
    ? "low"
    : confidences.includes("medium")
      ? "medium"
      : "high";

  return {
    headings,
    skip: [...skipSet],
    confidence,
    notes: notes.length > 0 ? notes.join("; ") : undefined,
  };
}

export async function classifyStructureWithLlm(
  features: ParagraphFeatures[]
): Promise<StructureClassification> {
  if (features.length === 0) {
    return { headings: [], skip: [], confidence: "low" };
  }

  if (features.length <= CHUNK_SIZE) {
    if (process.env.IMPORT_TRACE === "true") {
      console.log(`  pass1: single batch (${features.length} paragraphs)`);
    }
    return callOpenAi(
      compactForLlm(features),
      `Document has ${features.length} paragraphs (single batch). Indices are global.`
    );
  }

  const results: StructureClassification[] = [];
  let start = 0;
  let chunkNum = 0;

  while (start < features.length) {
    const end = Math.min(start + CHUNK_SIZE, features.length);
    const chunk = features.slice(start, end);
    const label = `Chunk ${chunkNum + 1}: paragraphs index ${chunk[0].index}–${chunk[chunk.length - 1].index} of ${features[features.length - 1].index + 1} total. Use global index field "i" in output.`;
    if (process.env.IMPORT_TRACE === "true") {
      const chunkStart = Date.now();
      console.log(
        `  pass1 chunk ${chunkNum + 1}: paragraphs ${chunk[0].index}–${chunk[chunk.length - 1].index} (${chunk.length} paras)...`
      );
      results.push(await callOpenAi(compactForLlm(chunk), label));
      console.log(
        `  pass1 chunk ${chunkNum + 1} done in ${((Date.now() - chunkStart) / 1000).toFixed(1)}s → ${results[results.length - 1].headings.length} headings`
      );
    } else {
      results.push(await callOpenAi(compactForLlm(chunk), label));
    }
    if (end >= features.length) break;
    start = end - CHUNK_OVERLAP;
    chunkNum++;
  }

  return mergeChunkResults(results);
}

export async function refineStructureWithLlm(
  features: ParagraphFeatures[],
  draft: StructureClassification,
  issues: StructureIssue[]
): Promise<StructureClassification> {
  if (draft.headings.length === 0) return draft;

  const payload = {
    paragraphCount: features.length,
    draft: {
      headings: summarizeDraftHeadings(draft.headings, features),
      skip: draft.skip,
      confidence: draft.confidence,
      notes: draft.notes,
    },
    issues,
    paragraphs: buildRefineContextParagraphs(features, issues).map((f) => ({
      i: f.index,
      t: f.text,
      w: f.wordCount,
      fs: f.fontSizeRatio,
      b: f.bold ? 1 : 0,
      cap: f.allCaps ? 1 : 0,
      ind: f.indentLevel,
      lst: f.listLevel,
      ol: f.outlineLevel,
      sb: f.spaceBeforeRatio,
      dot: f.endsWithPeriod ? 1 : 0,
    })),
  };

  if (process.env.IMPORT_TRACE === "true") {
    console.log(
      `  pass2: refining ${draft.headings.length} headings (${issues.length} issues)...`
    );
  }

  return callOpenAi(
    JSON.stringify(payload),
    `Refine draft outline (${draft.headings.length} headings, ${issues.length} flagged issues).`,
    REFINE_SYSTEM_PROMPT
  );
}

export async function classifyAndRefineStructureWithLlm(
  features: ParagraphFeatures[]
): Promise<{
  structure: StructureClassification;
  refined: boolean;
  issueCount: number;
}> {
  const draft = await classifyStructureWithLlm(features);

  if (process.env.OPENAI_SKIP_REFINE === "true") {
    return { structure: draft, refined: false, issueCount: 0 };
  }

  const issues = auditStructure(draft, features);

  const refined = await refineStructureWithLlm(features, draft, issues);

  return {
    structure: refined,
    refined: true,
    issueCount: issues.length,
  };
}
