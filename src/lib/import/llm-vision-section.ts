export interface VisionSectionResult {
  title: string;
  content: string;
  confidence: "high" | "medium" | "low";
  notes?: string;
}

const SYSTEM_PROMPT = `You extract handbook policy text from a screenshot the user took of a Word document.

The user dragged a rectangle over part of a student/staff handbook. Your job:
1. Read ALL visible text in the image faithfully — do not invent or omit content
2. Identify the section title (usually the first short bold/larger heading line)
3. Convert the section body to clean markdown (lists, numbering, bold, tables)
4. Put the title in the "title" field only — do not repeat it as # heading in content

You MUST return a JSON object with these exact keys:
{
  "title": "Section title (required, non-empty string)",
  "content": "markdown body without the title (string, use empty string if only a heading is visible)",
  "confidence": "high",
  "notes": ""
}`;

const VISION_CAPABLE_MODELS = new Set([
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4-vision-preview",
  "chatgpt-4o-latest",
]);

function coerceString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

/** Split markdown that starts with a heading into title + body. */
export function splitTitleFromMarkdown(markdown: string): {
  title: string;
  content: string;
} {
  const text = markdown.trim();
  if (!text) {
    return { title: "Imported section", content: "" };
  }

  const lines = text.split("\n");
  const first = lines[0]?.trim() ?? "";

  const h1 = first.match(/^#\s+(.+)$/);
  if (h1) {
    return {
      title: h1[1].trim(),
      content: lines.slice(1).join("\n").trim(),
    };
  }

  const bold = first.match(/^\*\*(.+)\*\*$/);
  if (bold) {
    return {
      title: bold[1].trim(),
      content: lines.slice(1).join("\n").trim(),
    };
  }

  if (first && first.length <= 120 && !first.endsWith(".")) {
    return { title: first, content: lines.slice(1).join("\n").trim() };
  }

  const snippet = first.slice(0, 80).trim();
  return {
    title: snippet || "Imported section",
    content: text,
  };
}

function stripTitleFromContent(title: string, content: string): string {
  const t = title.trim();
  let c = content.trim();
  if (!c || !t) return c;

  const patterns = [
    new RegExp(`^#\\s+${escapeRegExp(t)}\\s*\\n+`, "i"),
    new RegExp(`^\\*\\*${escapeRegExp(t)}\\*\\*\\s*\\n+`, "i"),
    new RegExp(`^${escapeRegExp(t)}\\s*\\n+`, "i"),
  ];

  for (const re of patterns) {
    if (re.test(c)) {
      c = c.replace(re, "").trim();
      break;
    }
  }

  return c;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseJsonLoose(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();

  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match) return JSON.parse(match[1]) as Record<string, unknown>;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  }

  return JSON.parse(trimmed) as Record<string, unknown>;
}

export function parseVisionResponse(raw: string): VisionSectionResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Invalid vision response: empty");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonLoose(trimmed);
  } catch {
    const { title, content } = splitTitleFromMarkdown(trimmed);
    return {
      title,
      content,
      confidence: "medium",
      notes: "Parsed as markdown",
    };
  }

  let title = coerceString(
    parsed.title ??
      parsed.section_title ??
      parsed.sectionTitle ??
      parsed.heading ??
      parsed.name
  );

  let content = coerceString(
    parsed.content ??
      parsed.markdown ??
      parsed.body ??
      parsed.text ??
      parsed.markdown_content ??
      parsed.markdownContent
  );

  const notes = coerceString(parsed.notes) || undefined;
  const confidence =
    parsed.confidence === "high" ||
    parsed.confidence === "medium" ||
    parsed.confidence === "low"
      ? parsed.confidence
      : "medium";

  if (!title && content) {
    const split = splitTitleFromMarkdown(
      content.startsWith("#") ? content : `# ${content}`
    );
    title = split.title;
    content = split.content || content;
  }

  if (!title && !content) {
    throw new Error("Invalid vision response: missing title or content");
  }

  if (!title) {
    title = "Imported section";
  }

  content = stripTitleFromContent(title, content);

  return {
    title,
    content,
    confidence,
    notes,
  };
}

/** Strip data URL prefix if present. */
export function normalizeImageData(imageBase64: string): string {
  const match = imageBase64.match(/^data:image\/\w+;base64,(.+)$/);
  return match ? match[1] : imageBase64;
}

export function resolveVisionModel(): string {
  const explicit = process.env.OPENAI_VISION_MODEL?.trim();
  if (explicit) return explicit;

  const shared = process.env.OPENAI_MODEL?.trim();
  if (shared && VISION_CAPABLE_MODELS.has(shared)) return shared;

  return "gpt-4o";
}

interface ChatCompletionResponse {
  error?: { message?: string; type?: string };
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | Array<{ type?: string; text?: string }> | null;
      refusal?: string | null;
      parsed?: VisionSectionResult;
    };
  }>;
}

function toImageUrl(input: string): string {
  if (input.startsWith("data:image/")) return input;
  return `data:image/png;base64,${normalizeImageData(input)}`;
}

interface VisionMessage {
  content?: string | Array<{ type?: string; text?: string }> | null;
  refusal?: string | null;
  parsed?: VisionSectionResult;
}

function extractMessageContent(message: VisionMessage | undefined): string | null {
  if (!message) return null;

  if (message.refusal?.trim()) {
    throw new Error(`Vision model refused: ${message.refusal}`);
  }

  if (message.parsed) {
    try {
      return JSON.stringify(normalizeParsedObject(message.parsed));
    } catch {
      /* fall through */
    }
  }

  const content = message.content;
  if (typeof content === "string" && content.trim()) return content;

  if (Array.isArray(content)) {
    const text = content
      .map((part) => (part?.type === "text" ? part.text ?? "" : ""))
      .join("")
      .trim();
    if (text) return text;
  }

  return null;
}

function normalizeParsedObject(parsed: VisionSectionResult): VisionSectionResult {
  return parseVisionResponse(JSON.stringify(parsed));
}

function visionErrorFromResponse(
  data: ChatCompletionResponse,
  model: string
): string {
  if (data.error?.message) {
    return `Vision API error: ${data.error.message}`;
  }

  const choice = data.choices?.[0];
  const finish = choice?.finish_reason ?? "unknown";

  if (finish === "content_filter") {
    return "Vision API blocked the image (content filter). Try a different selection.";
  }

  if (!data.choices?.length) {
    return `Vision API returned no choices (model: ${model}). Set OPENAI_VISION_MODEL=gpt-4o in .env.local`;
  }

  if (choice?.message?.refusal) {
    return `Vision model refused: ${choice.message.refusal}`;
  }

  return `Empty vision API response (model: ${model}, finish_reason: ${finish}). Try OPENAI_VISION_MODEL=gpt-4o`;
}

function shouldRetryVision(message: string): boolean {
  return (
    message.includes("Empty vision API") ||
    message.includes("Invalid vision response") ||
    message.includes("response_format") ||
    message.includes("json_object") ||
    message.includes("JSON")
  );
}

async function callVisionApi(
  model: string,
  imageUrl: string,
  useJsonMode: boolean
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured — vision extraction requires an API key"
    );
  }

  const imageData = normalizeImageData(imageUrl);
  if (!imageData || imageData.length < 100) {
    throw new Error("Captured image is empty — try selecting a larger area");
  }

  const body: Record<string, unknown> = {
    model,
    temperature: 0.1,
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract the handbook section from this screenshot. Return JSON with title and content keys.",
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl.startsWith("data:")
                ? imageUrl
                : `data:image/png;base64,${imageData}`,
              detail: "high",
            },
          },
        ],
      },
    ],
  };

  if (useJsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let data: ChatCompletionResponse;
  try {
    data = JSON.parse(rawText) as ChatCompletionResponse;
  } catch {
    throw new Error(
      `Vision API returned non-JSON (${response.status}): ${rawText.slice(0, 200)}`
    );
  }

  if (!response.ok) {
    const msg = data.error?.message ?? rawText.slice(0, 300);
    throw new Error(`Vision API error (${response.status}): ${msg}`);
  }

  const content = extractMessageContent(data.choices?.[0]?.message);
  if (!content) {
    throw new Error(visionErrorFromResponse(data, model));
  }

  return content;
}

export async function extractSectionFromImage(
  imageBase64: string
): Promise<VisionSectionResult> {
  const model = resolveVisionModel();
  const imageUrl = toImageUrl(imageBase64);

  let lastError: Error | null = null;

  for (const useJsonMode of [true, false]) {
    try {
      const content = await callVisionApi(model, imageUrl, useJsonMode);
      return parseVisionResponse(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(message);
      if (!shouldRetryVision(message)) throw lastError;
    }
  }

  throw lastError ?? new Error("Vision extraction failed");
}
