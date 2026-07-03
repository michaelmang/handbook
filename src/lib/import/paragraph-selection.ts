/** Multi-select helpers (Finder-style shift range + cmd toggle). */

export function visibleParagraphIndices(
  paragraphs: { index: number; inToc: boolean }[],
  showToc: boolean
): number[] {
  const list = showToc ? paragraphs : paragraphs.filter((p) => !p.inToc);
  return list.map((p) => p.index);
}

export function selectParagraph(
  index: number,
  modifiers: { shift: boolean; meta: boolean },
  visibleIndices: number[],
  selected: Set<number>,
  anchor: number | null
): { selected: Set<number>; anchor: number | null } {
  if (modifiers.meta) {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return { selected: next, anchor: index };
  }

  if (modifiers.shift && anchor != null) {
    const anchorPos = visibleIndices.indexOf(anchor);
    const clickPos = visibleIndices.indexOf(index);
    if (anchorPos === -1 || clickPos === -1) {
      return { selected: new Set([index]), anchor: index };
    }
    const start = Math.min(anchorPos, clickPos);
    const end = Math.max(anchorPos, clickPos);
    return {
      selected: new Set(visibleIndices.slice(start, end + 1)),
      anchor,
    };
  }

  return { selected: new Set([index]), anchor: index };
}
