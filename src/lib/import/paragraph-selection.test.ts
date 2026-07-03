import { describe, expect, it } from "vitest";
import { selectParagraph } from "./paragraph-selection";

const visible = [0, 1, 2, 3, 4];

describe("selectParagraph", () => {
  it("plain click replaces selection", () => {
    const r = selectParagraph(2, { shift: false, meta: false }, visible, new Set([0, 1]), 0);
    expect([...r.selected]).toEqual([2]);
    expect(r.anchor).toBe(2);
  });

  it("shift click selects range from anchor", () => {
    const r = selectParagraph(3, { shift: true, meta: false }, visible, new Set([1]), 1);
    expect([...r.selected].sort()).toEqual([1, 2, 3]);
    expect(r.anchor).toBe(1);
  });

  it("meta click toggles item", () => {
    let selected = new Set([1, 2]);
    let r = selectParagraph(3, { shift: false, meta: true }, visible, selected, 1);
    expect([...r.selected].sort()).toEqual([1, 2, 3]);

    r = selectParagraph(2, { shift: false, meta: true }, visible, r.selected, 3);
    expect([...r.selected].sort()).toEqual([1, 3]);
  });
});
