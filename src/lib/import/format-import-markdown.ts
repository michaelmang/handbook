/**
 * Turn plain Word-import lines into markdown lists where patterns are obvious.
 * Safe to run without LLM (also used before/after AI structuring).
 */

const ORDERED_SIMPLE = /^(\d+)\.\s+(.+)$/;
/** Word outline labels like "2.1 Attendance" (no extra dot after the number). */
const ORDERED_OUTLINE = /^(\d+(?:\.\d+)+)\s+(.+)$/;
const ORDERED_PAREN = /^(\d+)\)\s+(.+)$/;
const LETTERED = /^([a-z])[.)]\s+(.+)$/i;
const BULLET_CHAR = /^[-•●◦▪*+]\s+(.+)$/;

function matchOrderedLine(
  plain: string
): { label: string; body: string; depth: number } | null {
  let m = plain.match(ORDERED_SIMPLE);
  if (m) {
    return { label: m[1], body: m[2], depth: 0 };
  }
  m = plain.match(ORDERED_OUTLINE);
  if (m) {
    const parts = m[1].split(".");
    return {
      label: parts[parts.length - 1],
      body: m[2],
      depth: parts.length - 1,
    };
  }
  return null;
}

function stripBoldWrapper(text: string): string {
  return text.replace(/^\*\*|\*\*$/g, "").trim();
}

export function isExplicitListLine(line: string): boolean {
  const t = stripBoldWrapper(line.trim());
  if (!t) return false;
  return (
    matchOrderedLine(t) != null ||
    ORDERED_PAREN.test(t) ||
    LETTERED.test(t) ||
    BULLET_CHAR.test(t)
  );
}

/** Short standalone line that often represents a list item in Word imports. */
export function isLikelyListItemLine(line: string): boolean {
  const t = stripBoldWrapper(line.trim());
  if (!t) return false;
  if (isExplicitListLine(t)) return true;
  if (t.length > 120) return false;
  if (t.endsWith(":")) return false;
  if (t.endsWith(".") && t.length > 50) return false;
  const words = t.split(/\s+/).filter(Boolean).length;
  return words <= 14 && t.length <= 90;
}

export function formatAsListItem(line: string, orderedIndex?: number): string {
  const raw = line.trim();
  const plain = stripBoldWrapper(raw);

  const ordered = matchOrderedLine(plain);
  if (ordered) {
    const indent = "  ".repeat(ordered.depth);
    const body = restoreInlineBold(raw, ordered.body);
    if (ordered.depth > 0) {
      return `${indent}${ordered.label}. ${body}`;
    }
    const n = orderedIndex ?? parseInt(ordered.label, 10);
    return `${n}. ${body}`;
  }

  let m = plain.match(ORDERED_PAREN);
  if (m) {
    const n = orderedIndex ?? parseInt(m[1], 10);
    return `${n}. ${restoreInlineBold(raw, m[2])}`;
  }

  m = plain.match(LETTERED);
  if (m) {
    return `- ${restoreInlineBold(raw, m[2])}`;
  }

  m = plain.match(BULLET_CHAR);
  if (m) {
    return `- ${restoreInlineBold(raw, m[1])}`;
  }

  if (orderedIndex != null) {
    return `${orderedIndex}. ${raw}`;
  }

  return `- ${raw}`;
}

function restoreInlineBold(raw: string, plainBody: string): string {
  if (raw.includes("**")) {
    return (
      raw
        .replace(
          /^(\d+(?:\.\d+)*[.)]?\s+|\d+(?:\.\d+)+\s+|\d+\)\s+|[a-z][.)]\s+|[-•●◦▪*+]\s+)/i,
          ""
        )
        .trim() || plainBody
    );
  }
  return plainBody;
}

function tryFormatListRun(
  lines: string[],
  start: number
): { lines: string[]; nextIndex: number } | null {
  const run: string[] = [];
  let j = start;
  let orderedCounter = 0;
  let sawExplicit = false;

  while (j < lines.length) {
    const trimmed = lines[j].trim();

    if (!trimmed) {
      let k = j + 1;
      while (k < lines.length && !lines[k].trim()) k++;
      if (k < lines.length && isLikelyListItemLine(lines[k])) {
        j = k;
        continue;
      }
      break;
    }

    if (!isLikelyListItemLine(lines[j])) break;

    if (isExplicitListLine(trimmed)) sawExplicit = true;

    const plain = stripBoldWrapper(trimmed);
    const orderedMatch = matchOrderedLine(plain);
    if (orderedMatch && orderedMatch.depth > 0) {
      run.push(formatAsListItem(trimmed));
    } else if (orderedMatch || ORDERED_PAREN.test(plain)) {
      orderedCounter++;
      run.push(formatAsListItem(trimmed, orderedCounter));
    } else {
      run.push(formatAsListItem(trimmed));
    }

    j++;
  }

  const minRun = sawExplicit ? 2 : 3;
  if (run.length < minRun) return null;

  return { lines: run, nextIndex: j };
}

function collapseListBlanks(text: string): string {
  return text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(\n- .+\n)\n+(- )/g, "$1$2")
    .replace(/(\n\d+\. .+\n)\n+(\d+\. )/g, "$1$2")
    .trim();
}

/** Format consecutive short lines and numbered rows as markdown lists. */
export function formatLikelyListsInMarkdown(content: string): string {
  if (!content.trim()) return content;

  const lines = content.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const run = tryFormatListRun(lines, i);
    if (run) {
      if (out.length > 0 && out[out.length - 1].trim()) out.push("");
      out.push(...run.lines);
      i = run.nextIndex;
      while (i < lines.length && !lines[i].trim()) i++;
      continue;
    }

    const trimmed = lines[i].trim();
    if (!trimmed) {
      out.push(lines[i]);
      i++;
      continue;
    }

    if (isExplicitListLine(trimmed)) {
      out.push(formatAsListItem(trimmed));
    } else {
      out.push(lines[i]);
    }
    i++;
  }

  return collapseListBlanks(out.join("\n"));
}

export function formatSectionMarkdown(content: string): string {
  return formatLikelyListsInMarkdown(content);
}
