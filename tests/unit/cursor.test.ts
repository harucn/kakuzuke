import { describe, expect, it } from "vitest";
import { boundsOf, clampIndex, move, type Position } from "../../src/deck/cursor.ts";

const positions: readonly Position[] = ["title", 0, 1, 2];

describe("move", () => {
  it("タイトル画面の次は第 1 問、第 1 問の前はタイトル画面", () => {
    expect(move("title", 1, 3)).toBe(0);
    expect(move(0, -1, 3)).toBe("title");
  });

  it("steps within range", () => {
    expect(move(0, 1, 3)).toBe(1);
    expect(move(2, -1, 3)).toBe(1);
  });

  it("returns the same position at either end", () => {
    expect(move("title", -1, 3)).toBe("title");
    expect(move(2, 1, 3)).toBe(2);
    expect(move(0, 1, 1)).toBe(0);
  });

  it("clamps an out-of-range index before stepping", () => {
    expect(move(-5, 1, 3)).toBe(1);
    expect(move(-5, -1, 3)).toBe("title");
    expect(move(9, -1, 3)).toBe(1);
    expect(move(9, 1, 3)).toBe(2);
  });
});

describe("boundsOf", () => {
  it("disables prev on the title and next on the last question", () => {
    expect(boundsOf("title", 3)).toEqual({ canPrev: false, canNext: true });
    expect(boundsOf(0, 3)).toEqual({ canPrev: true, canNext: true });
    expect(boundsOf(2, 3)).toEqual({ canPrev: true, canNext: false });
    expect(boundsOf("title", 1)).toEqual({ canPrev: false, canNext: true });
    expect(boundsOf(0, 1)).toEqual({ canPrev: true, canNext: false });
  });

  it("agrees with move: a disabled direction leaves the position unchanged", () => {
    for (const p of positions) {
      const { canPrev, canNext } = boundsOf(p, 3);
      expect(move(p, -1, 3) !== p).toBe(canPrev);
      expect(move(p, 1, 3) !== p).toBe(canNext);
    }
  });
});

describe("clampIndex", () => {
  it("keeps in-range values and clamps the rest", () => {
    expect(clampIndex(1, 3)).toBe(1);
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(3, 3)).toBe(2);
  });
});
