import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TEXT_PAIRS, palette } from "../../src/styles/tokens";

/** WCAG 2.x の相対輝度 */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("contrast", () => {
  it("WCAG の基準値と一致する", () => {
    expect(contrast("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
    expect(contrast("#FFFFFF", "#777777")).toBeCloseTo(4.48, 2);
  });
});

describe("TEXT_PAIRS", () => {
  it("1 組以上ある", () => {
    expect(TEXT_PAIRS.length).toBeGreaterThan(0);
  });

  for (const { text, bg, use } of TEXT_PAIRS) {
    it(`${text} on ${bg}（${use}）は 4.5:1 以上`, () => {
      const ratio = contrast(palette[text], palette[bg]);
      expect(ratio, `${text} on ${bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("theme.css", () => {
  const css = readFileSync(path.resolve(import.meta.dirname, "../../src/styles/theme.css"), "utf8");

  it("色の値を直接書かない", () => {
    expect(css.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(/gi)).toBeNull();
  });

  it("参照するカスタムプロパティは配色トークンか theme.css で定義したものだけ", () => {
    const declared = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const tokens = new Set(Object.keys(palette).map((name) => `--${name}`));
    const unknown = [...css.matchAll(/var\(\s*(--[\w-]+)/g)]
      .map((m) => m[1])
      .filter((name) => !tokens.has(name) && !declared.has(name));
    expect(unknown).toEqual([]);
  });
});
