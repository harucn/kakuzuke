import { describe, expect, it } from "vitest";
import { boundsOf, clampIndex, move, positionText } from "../../src/deck/cursor.ts";

describe("move", () => {
  it("steps within range", () => {
    expect(move(0, 1, 3)).toBe(1);
    expect(move(2, -1, 3)).toBe(1);
  });

  it("returns the same index at either end", () => {
    expect(move(0, -1, 3)).toBe(0);
    expect(move(2, 1, 3)).toBe(2);
    expect(move(0, 1, 1)).toBe(0);
    expect(move(0, -1, 1)).toBe(0);
  });

  it("clamps an out-of-range index before stepping", () => {
    expect(move(-5, 1, 3)).toBe(1);
    expect(move(9, -1, 3)).toBe(1);
    expect(move(9, 1, 3)).toBe(2);
  });
});

describe("boundsOf", () => {
  it("disables prev on the first and next on the last", () => {
    expect(boundsOf(0, 3)).toEqual({ canPrev: false, canNext: true });
    expect(boundsOf(1, 3)).toEqual({ canPrev: true, canNext: true });
    expect(boundsOf(2, 3)).toEqual({ canPrev: true, canNext: false });
    expect(boundsOf(0, 1)).toEqual({ canPrev: false, canNext: false });
  });

  it("agrees with move: a disabled direction leaves the index unchanged", () => {
    for (let i = 0; i < 3; i++) {
      const { canPrev, canNext } = boundsOf(i, 3);
      expect(move(i, -1, 3) !== i).toBe(canPrev);
      expect(move(i, 1, 3) !== i).toBe(canNext);
    }
  });
});

describe("positionText", () => {
  it("is 1-based", () => {
    expect(positionText(0, 3)).toBe("1 / 3");
    expect(positionText(2, 3)).toBe("3 / 3");
  });

  it("clamps an out-of-range index", () => {
    expect(positionText(7, 3)).toBe("3 / 3");
  });
});

describe("clampIndex", () => {
  it("keeps in-range values and clamps the rest", () => {
    expect(clampIndex(1, 3)).toBe(1);
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(3, 3)).toBe(2);
  });
});
