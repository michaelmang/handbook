import { describe, expect, it } from "vitest";
import { normalizeRect } from "./capture-region";

describe("capture-region", () => {
  it("normalizeRect handles inverted coordinates", () => {
    expect(normalizeRect({ x1: 100, y1: 80, x2: 20, y2: 10 })).toEqual({
      left: 20,
      top: 10,
      width: 80,
      height: 70,
    });
  });
});
