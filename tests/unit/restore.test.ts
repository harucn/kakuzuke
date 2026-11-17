import { afterEach, describe, expect, it, vi } from "vitest";
import { loadIndex, readStoredIndex, saveIndex, STORAGE_KEY } from "../../src/host/restore.ts";

describe("readStoredIndex", () => {
  it("範囲内の整数はそのまま返す", () => {
    expect(readStoredIndex("0", 5)).toBe(0);
    expect(readStoredIndex("2", 5)).toBe(2);
    expect(readStoredIndex("4", 5)).toBe(4);
  });

  it("問題数が減った後の再読み込みでは範囲内の問題を表示する", () => {
    expect(readStoredIndex("4", 3)).toBe(2);
    expect(readStoredIndex("3", 3)).toBe(2);
    expect(readStoredIndex("99999999999999999999", 3)).toBe(2);
  });

  it.each([
    ["保存なし", null],
    ["空", ""],
    ["小数", "1.5"],
    ["文字列", "abc"],
    ["負の値", "-1"],
    ["負のゼロ", "-0"],
    ["空白付き", " 1"],
    ["指数表記", "1e2"],
    ["Infinity", "Infinity"],
  ])("%s は null", (_, raw) => {
    expect(readStoredIndex(raw, 5)).toBeNull();
  });
});

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
  };
}

const throwingStorage: Pick<Storage, "getItem" | "setItem"> = {
  getItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("full", "QuotaExceededError");
  },
};

describe("loadIndex / saveIndex", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("保存した番号を読み戻せる", () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    saveIndex(2);
    expect(globalThis.sessionStorage.getItem(STORAGE_KEY)).toBe("2");
    expect(loadIndex(5)).toBe(2);
  });

  it("保存がなければ null", () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    expect(loadIndex(5)).toBeNull();
  });

  it("読み戻すときに問題数に合わせて丸める", () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    saveIndex(4);
    expect(loadIndex(3)).toBe(2);
  });

  it("sessionStorage が例外を投げても、読みは null・書きは何もしない", () => {
    vi.stubGlobal("sessionStorage", throwingStorage);
    expect(loadIndex(5)).toBeNull();
    expect(() => saveIndex(1)).not.toThrow();
  });

  it("sessionStorage がない環境でも、読みは null・書きは何もしない", () => {
    vi.stubGlobal("sessionStorage", undefined);
    expect(loadIndex(5)).toBeNull();
    expect(() => saveIndex(1)).not.toThrow();
  });
});
