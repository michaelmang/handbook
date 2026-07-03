import type { ParagraphFeatures } from "./paragraph-features";
import { compactForLlm } from "./paragraph-features";
import type { ImportProgressReporter } from "./import-progress";
import { noopProgress } from "./import-progress";
import type { FlatBoundaryIssue } from "./flat-section-audit";
import {
  buildRefineBoundaryContext,
  summarizeBoundaries,
} from "./flat-section-audit";

export interface FlatSectionClassification {
  boundaries: number[];
  confidence: "high" | "medium" | "low";
  notes?: string;
}

const PASS_A_PROMPT = `You identify SECTION START boundaries in a school student handbook Word document.

Return a FLAT list of paragraph indices where a new logical section begins. Do NOT assign nesting levels — the user will organize hierarchy manually later.

Paragraph features (typography-first; style names are unreliable):
- i: paragraph index (use exactly in output)
- t: text preview, w: word count, fs: font size ratio vs body
- b: bold, cap: all caps, ind: indent, lst: list level, ol: outline level
- sb: space-before ratio, dot: ends with period

Rules:
- A section start is a short structural line (often bold/larger) followed by policy prose
- Include major parts AND subsections as separate flat boundaries (user will nest later)
- Maximize recall: prefer catching real policy sections over missing one
- Do NOT use paragraph indices that are body prose (long sentences, 15+ words, ends with period)
- Do NOT mark body paragraphs — only section-start lines belong in boundaries
- Omit table-of-contents / cover lines (short title-only runs before real content) rather than listing them
- Acronyms like PSAT, ACT are valid section starts when they head a policy block

Return JSON only:
{
  "boundaries": [0, 15, 42],
  "confidence": "high|medium|low",
  "notes": "optional"
}`;

const PASS_B_PROMPT = `You review and correct a FLAT list of section boundary indices from a handbook import first pass.

You receive draft boundaries, audit issues, and typography context near flagged paragraphs.

Fix:
- Remove false boundaries (body prose, long sentences, TOC title-only lines)
- Add missed section starts (short bold structural lines in gaps)
- Remove duplicate boundaries for the same title (keep the one followed by real policy prose)
- Merge back-to-back boundaries that left a section with no body

Return a COMPLETE corrected flat boundary list (not a diff). Use exact paragraph indices. Boundaries only — do not skip or exclude body paragraphs.

Return JSON only:
{
  "boundaries": [0, 15, 42],
  "confidence": "high|medium|low",
  "notes": "brief summary of corrections"
}`;

const CHUNK_SIZE = 200;
const CHUNK_OVERLAP = 8;

function parseFlatJson(raw: string): FlatSectionClassification {
  const parsed = JSON.parse(raw) as FlatSectionClassification;
  if (!Array.isArray(parsed.boundaries)) {
    throw new Error("Invalid LLM response: missing boundaries");
  }
  return {
    boundaries: parsed.boundaries
      .filter((n) => typeof n === "number" && n >= 0)
      .sort((a, b) => a - b),
    confidence: parsed.confidence ?? "medium",
    notes: parsed.notes,
  };
}

async function callOpenAi(
  userContent: string,
  label: string,
  systemPrompt: string
): Promise<FlatSectionClassification> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

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
        { role: "user", content: `${label}\n\n${userContent}` },
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
  return parseFlatJson(content);
}

function mergeChunkBoundaries(
  results: FlatSectionClassification[]
): FlatSectionClassification {
  const boundarySet = new Set<number>();
  const notes: string[] = [];

  for (const r of results) {
    for (const b of r.boundaries) boundarySet.add(b);
    if (r.notes) notes.push(r.notes);
  }

  const confidences = results.map((r) => r.confidence);
  const confidence = confidences.includes("low")
    ? "low"
    : confidences.includes("medium")
      ? "medium"
      : "high";

  return {
    boundaries: [...boundarySet].sort((a, b) => a - b),
    confidence,
    notes: notes.length > 0 ? notes.join("; ") : undefined,
  };
}

export async function classifyFlatBoundariesPassA(
  features: ParagraphFeatures[],
  onProgress: ImportProgressReporter = noopProgress
): Promise<FlatSectionClassification> {
  if (features.length === 0) {
    return { boundaries: [], confidence: "low" };
  }

  if (features.length <= CHUNK_SIZE) {
    onProgress({
      phase: "pass_a",
      status: "progress",
      message: "Identifying section boundaries",
      detail: `Analyzing ${features.length} paragraphs`,
      current: 1,
      total: 1,
    });
    const result = await callOpenAi(
      compactForLlm(features),
      `Document has ${features.length} paragraphs. Indices are global.`,
      PASS_A_PROMPT
    );
    onProgress({
      phase: "pass_a",
      status: "complete",
      message: "Section boundaries identified",
      detail: `${result.boundaries.length} sections found`,
    });
    return result;
  }

  const results: FlatSectionClassification[] = [];
  let start = 0;
  let chunkNum = 0;
  const totalChunks = Math.ceil(
    (features.length - CHUNK_OVERLAP) / (CHUNK_SIZE - CHUNK_OVERLAP)
  );

  while (start < features.length) {
    const end = Math.min(start + CHUNK_SIZE, features.length);
    const chunk = features.slice(start, end);
    chunkNum++;

    onProgress({
      phase: "pass_a",
      status: "progress",
      message: "Identifying section boundaries",
      detail: `Paragraphs ${chunk[0].index}–${chunk[chunk.length - 1].index}`,
      current: chunkNum,
      total: totalChunks,
    });

    const label = `Chunk ${chunkNum}/${totalChunks}: paragraphs ${chunk[0].index}–${chunk[chunk.length - 1].index}. Use global index "i".`;
    results.push(await callOpenAi(compactForLlm(chunk), label, PASS_A_PROMPT));

    if (end >= features.length) break;
    start = end - CHUNK_OVERLAP;
  }

  const merged = mergeChunkBoundaries(results);
  onProgress({
    phase: "pass_a",
    status: "complete",
    message: "Section boundaries identified",
    detail: `${merged.boundaries.length} sections found`,
  });
  return merged;
}

export async function refineFlatBoundariesPassB(
  features: ParagraphFeatures[],
  draft: FlatSectionClassification,
  issues: FlatBoundaryIssue[],
  onProgress: ImportProgressReporter = noopProgress
): Promise<FlatSectionClassification> {
  onProgress({
    phase: "pass_b",
    status: "start",
    message: "Refining section list",
    detail: `${issues.length} issues to review`,
  });

  const payload = {
    paragraphCount: features.length,
    draft: {
      boundaries: summarizeBoundaries(draft.boundaries, features),
      confidence: draft.confidence,
      notes: draft.notes,
    },
    issues,
    paragraphs: buildRefineBoundaryContext(features, issues).map((f) => ({
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

  const result = await callOpenAi(
    JSON.stringify(payload),
    `Refine flat boundaries (${draft.boundaries.length} draft, ${issues.length} issues).`,
    PASS_B_PROMPT
  );

  onProgress({
    phase: "pass_b",
    status: "complete",
    message: "Section list refined",
    detail: `${result.boundaries.length} sections after review`,
  });

  return result;
}

export async function classifyFlatSectionsWithRetry(
  features: ParagraphFeatures[],
  onProgress: ImportProgressReporter = noopProgress
): Promise<{
  classification: FlatSectionClassification;
  audited: boolean;
  refined: boolean;
  issueCount: number;
}> {
  const draft = await classifyFlatBoundariesPassA(features, onProgress);

  const { auditFlatBoundaries } = await import("./flat-section-audit");
  onProgress({
    phase: "audit",
    status: "start",
    message: "Auditing section boundaries",
  });
  const issues = auditFlatBoundaries(draft, features);
  onProgress({
    phase: "audit",
    status: "complete",
    message: "Audit complete",
    detail:
      issues.length === 0
        ? "No issues flagged"
        : `${issues.length} issue${issues.length === 1 ? "" : "s"} flagged`,
  });

  if (process.env.OPENAI_SKIP_REFINE === "true") {
    return {
      classification: draft,
      audited: true,
      refined: false,
      issueCount: issues.length,
    };
  }

  const refined = await refineFlatBoundariesPassB(
    features,
    draft,
    issues,
    onProgress
  );

  return {
    classification: refined,
    audited: true,
    refined: true,
    issueCount: issues.length,
  };
}
