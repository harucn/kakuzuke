import { describe, expect, it } from "vitest";
import { findSecrets, normalize } from "../leak";

const secret = "シャトー・マルゴー \"2015\" <限定> 1/2 & 'A' `$` 🍷";

const hex = (n: number) => n.toString(16).toUpperCase();
const codeUnits = (s: string) => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i));
const codePoints = (s: string) => [...s].map((c) => c.codePointAt(0)!);
const replaceEach = (s: string, table: Readonly<Record<string, string>>) => [...s].map((c) => table[c] ?? c).join("");

const encodings: readonly (readonly [string, (s: string) => string])[] = [
  ["そのまま（UTF-8）", (s) => s],
  ["\\uXXXX", (s) => codeUnits(s).map((u) => `\\u${hex(u).padStart(4, "0")}`).join("")],
  ["\\u{…}", (s) => codePoints(s).map((p) => `\\u{${hex(p)}}`).join("")],
  ["\\xNN（ASCII）と \\uXXXX", (s) => codeUnits(s).map((u) => (u < 0x100 ? `\\x${hex(u).padStart(2, "0")}` : `\\u${hex(u).padStart(4, "0")}`)).join("")],
  ["JSON の文字列（\\\"）", (s) => JSON.stringify(s).slice(1, -1)],
  ["埋め込みデータの形（\\\" と \\x3C）", (s) => JSON.stringify(s).slice(1, -1).replaceAll("<", "\\x3C")],
  ["記号の前に \\（\\/・\\'・\\`・\\$ など）", (s) => s.replace(/[^\p{L}\p{N}\s]/gu, (c) => `\\${c}`)],
  ["HTML の名前付き実体参照", (s) => replaceEach(s, { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })],
  ["React の属性値の形（&#x27;）", (s) => replaceEach(s, { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" })],
  ["HTML の 10 進の数値実体参照", (s) => codePoints(s).map((p) => `&#${p};`).join("")],
  ["HTML の 16 進の数値実体参照", (s) => codePoints(s).map((p) => `&#x${hex(p)};`).join("")],
];

describe("normalize と findSecrets", () => {
  it.each(encodings)("%s で書かれた秘密を復号して見つける", (_, encode) => {
    const text = `const x = "${encode(secret)}";`;
    expect(normalize(encode(secret))).toBe(secret);
    expect(findSecrets(text, [secret])).toEqual([expect.objectContaining({ secret })]);
  });

  it("秘密でない文字列は見つけない", () => {
    const text = JSON.stringify({ name: "シャトー・マルゴー 2016", price: "1本 8万円" });
    expect(findSecrets(text, ["シャトー・マルゴー 2015", "1本 9万円"])).toEqual([]);
  });

  it("\\ そのもののエスケープの後ろは復号しない", () => {
    expect(normalize(String.raw`"\\u6F0F"`)).toBe(String.raw`"\u6F0F"`);
    expect(findSecrets(String.raw`"\\u6F0F"`, ["漏"])).toEqual([]);
  });

  it.each([
    ["A&amp;B", "A&amp;B"],
    ["A&amp;B", "A&amp;amp;B"],
    ["C\\nD", "C\\nD"],
    ["C\\nD", JSON.stringify("C\\nD")],
  ])("実体参照やエスケープに見える並びを含む秘密 %s を、%s から見つける", (tricky, written) => {
    expect(findSecrets(written, [tricky])).toHaveLength(1);
  });

  it("濁点が分解された文字でも見つける", () => {
    expect(findSecrets("ボルドー.jpg".normalize("NFD"), ["ボルドー"])).toHaveLength(1);
  });

  it("範囲外の符号位置は復号せずに残す", () => {
    expect(normalize("\\u{110000}&#x110000;&#1114112;")).toBe("\\u{110000}&#x110000;&#1114112;");
  });

  it("見つけた位置と前後 20 文字を返す", () => {
    const before = "前".repeat(50);
    const after = "後".repeat(50);
    expect(findSecrets(`${before}${secret}${after}`, [secret])).toEqual([
      { secret, index: 50, context: `${"前".repeat(20)}${secret}${"後".repeat(20)}` },
    ]);
    expect(findSecrets(`${secret}${after}`, [secret])).toEqual([
      { secret, index: 0, context: `${secret}${"後".repeat(20)}` },
    ]);
  });
});
