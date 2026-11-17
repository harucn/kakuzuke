import { describe, expect, it } from "vitest";
import { formatIssues, parseQuestionSet, type ParseResult } from "../../src/question-set/parse";
import { imageUrl } from "./fixtures";

const images = new Map([
  ["テーブルワイン.jpg", imageUrl("/images/aaa.jpg")],
  ["ボルドー.jpg", imageUrl("/images/bbb.jpg")],
  ["A5.jpg", imageUrl("/images/ccc.jpg")],
  ["輸入牛.jpg", imageUrl("/images/ddd.jpg")],
  ["国産牛.jpg", imageUrl("/images/eee.jpg")],
]);

const table = { image: "テーブルワイン.jpg", rank: 2, name: "テーブルワイン", price: "1本 1,000円" };
const bordeaux = { image: "ボルドー.jpg", rank: 1, name: "ボルドーの赤", price: "1本 5万円" };
const wine = {
  mode: "pick",
  title: "ワイン",
  description: "高いワインはどちら？",
  explanation: "B は 1本 5万円のボルドー。A はスーパーで買えるテーブルワインでした。",
  options: [table, bordeaux],
};

const a5 = { image: "A5.jpg", rank: 1, name: "A5 和牛", price: "100g 5,000円" };
const imported = { image: "輸入牛.jpg", rank: 3, name: "輸入牛", price: "100g 300円" };
const domestic = { image: "国産牛.jpg", rank: 2, name: "国産牛", price: "100g 1,000円" };
const beef = {
  mode: "order",
  title: "牛肉",
  description: "高い順に並べよ",
  explanation: "A が A5 ランク。",
  options: [a5, imported, domestic],
};

function issuesOf(result: ParseResult) {
  if (result.ok) throw new Error("expected the question set to fail validation");
  return result.issues;
}

function codesAndPaths(result: ParseResult) {
  return issuesOf(result).map((issue) => [issue.code, issue.path]);
}

describe("問題セットのデータ形式", () => {
  it("正しい問題セットは検証を通る", () => {
    expect(parseQuestionSet({ questions: [wine, beef] }, images)).toStrictEqual({
      ok: true,
      set: [
        {
          mode: "pick",
          title: "ワイン",
          description: "高いワインはどちら？",
          explanation: "B は 1本 5万円のボルドー。A はスーパーで買えるテーブルワインでした。",
          options: [
            { label: "A", image: "/images/aaa.jpg", rank: 2, name: "テーブルワイン", price: "1本 1,000円" },
            { label: "B", image: "/images/bbb.jpg", rank: 1, name: "ボルドーの赤", price: "1本 5万円" },
          ],
        },
        {
          mode: "order",
          title: "牛肉",
          description: "高い順に並べよ",
          explanation: "A が A5 ランク。",
          options: [
            { label: "A", image: "/images/ccc.jpg", rank: 1, name: "A5 和牛", price: "100g 5,000円" },
            { label: "B", image: "/images/ddd.jpg", rank: 3, name: "輸入牛", price: "100g 300円" },
            { label: "C", image: "/images/eee.jpg", rank: 2, name: "国産牛", price: "100g 1,000円" },
          ],
        },
      ],
    });
  });

  it("問題が 0 件の問題セットは検証に失敗する", () => {
    expect(codesAndPaths(parseQuestionSet({ questions: [] }, images))).toStrictEqual([["shape", ["questions"]]]);
  });

  it("未知の mode は検証に失敗する", () => {
    const issues = issuesOf(parseQuestionSet({ questions: [wine, { ...beef, mode: "guess" }] }, images));
    expect(issues.map((i) => [i.code, i.path])).toStrictEqual([["shape", ["questions", 1, "mode"]]]);
    expect(issues[0]!.message).toContain("guess");
  });

  it.each([
    ["title", ""],
    ["description", "   "],
    ["explanation", ""],
    ["explanation", " \n "],
  ])("問題名・説明・解説が空の問題は検証に失敗する（%s: %j）", (field, value) => {
    const result = parseQuestionSet({ questions: [{ ...wine, [field]: value }] }, images);
    expect(codesAndPaths(result)).toStrictEqual([["shape", ["questions", 0, field]]]);
  });

  it.each([
    ["image", ""],
    ["image", "  "],
    ["name", ""],
    ["price", "　 "],
  ])("写真・銘柄・価格が空の選択肢は検証に失敗する（%s: %j）", (field, value) => {
    const result = parseQuestionSet({ questions: [{ ...wine, options: [table, { ...bordeaux, [field]: value }] }] }, images);
    expect(codesAndPaths(result)).toStrictEqual([["shape", ["questions", 0, "options", 1, field]]]);
  });

  it("複数の誤りはまとめて報告される", () => {
    const broken = {
      ...beef,
      explanation: "",
      options: [a5, { ...imported, rank: 1, image: "ない.jpg" }, domestic],
    };
    expect(codesAndPaths(parseQuestionSet({ questions: [wine, broken] }, images))).toStrictEqual([
      ["shape", ["questions", 1, "explanation"]],
      ["image-missing", ["questions", 1, "options", 1, "image"]],
      ["rank-permutation", ["questions", 1, "options"]],
    ]);
  });
});

describe("選択肢の数とラベル", () => {
  it("選択肢が 1 個の問題は検証に失敗する", () => {
    const result = parseQuestionSet({ questions: [{ ...wine, options: [{ ...bordeaux }] }] }, images);
    expect(codesAndPaths(result)).toStrictEqual([["shape", ["questions", 0, "options"]]]);
  });

  it("選択肢が 4 個の問題は検証に失敗する", () => {
    const fourth = { ...table, rank: 4 };
    const result = parseQuestionSet({ questions: [{ ...beef, options: [a5, imported, domestic, fourth] }] }, images);
    expect(codesAndPaths(result)).toStrictEqual([["shape", ["questions", 0, "options"]]]);
  });

  it("ラベルは並び順に A・B・C が付く", () => {
    const result = parseQuestionSet({ questions: [beef] }, images);
    if (!result.ok) throw new Error(formatIssues(result.issues));
    expect(result.set[0].options.map((o) => [o.label, o.name])).toStrictEqual([
      ["A", "A5 和牛"],
      ["B", "輸入牛"],
      ["C", "国産牛"],
    ]);
  });
});

describe("選択肢の順位", () => {
  it("rank 1 がない問題は検証に失敗する", () => {
    const result = parseQuestionSet({ questions: [{ ...wine, options: [table, { ...bordeaux, rank: 3 }] }] }, images);
    expect(issuesOf(result)).toStrictEqual([
      {
        code: "rank-permutation",
        path: ["questions", 0, "options"],
        message: "rank は 1〜2 を 1 回ずつ使ってください（2, 3）",
      },
    ]);
  });

  it("rank が重複する問題は検証に失敗する", () => {
    const result = parseQuestionSet({ questions: [{ ...beef, options: [a5, { ...imported, rank: 1 }, domestic] }] }, images);
    expect(issuesOf(result)).toStrictEqual([
      {
        code: "rank-permutation",
        path: ["questions", 0, "options"],
        message: "rank は 1〜3 を 1 回ずつ使ってください（1, 1, 2）",
      },
    ]);
  });
});

describe("写真の指定と公開名", () => {
  it("指定した写真がない選択肢は検証に失敗する", () => {
    const withoutBordeaux = new Map([...images].filter(([file]) => file !== "ボルドー.jpg"));
    const issues = issuesOf(parseQuestionSet({ questions: [wine] }, withoutBordeaux));
    expect(issues.map((i) => [i.code, i.path])).toStrictEqual([
      ["image-missing", ["questions", 0, "options", 1, "image"]],
    ]);
    expect(issues[0]!.message).toContain("ボルドー.jpg");
  });
});

describe("問題名と説明に正解情報を含めない", () => {
  it("説明に価格を含む問題は検証に失敗する", () => {
    const result = parseQuestionSet({ questions: [{ ...wine, description: "1本 5万円のワインと…" }] }, images);
    expect(issuesOf(result)).toStrictEqual([
      {
        code: "public-text-leak",
        path: ["questions", 0, "description"],
        message: "参加者に見える文に価格「1本 5万円」が含まれています",
      },
    ]);
  });

  it("問題名に銘柄を含む問題は検証に失敗する", () => {
    const result = parseQuestionSet({ questions: [wine, { ...beef, title: "ボルドーの赤に合う牛肉" }] }, images);
    expect(issuesOf(result)).toStrictEqual([
      {
        code: "public-text-leak",
        path: ["questions", 1, "title"],
        message: "参加者に見える文に銘柄「ボルドーの赤」が含まれています",
      },
    ]);
  });

  it("正解情報を含まない問題名と説明は検証を通る", () => {
    expect(parseQuestionSet({ questions: [wine, beef] }, images).ok).toBe(true);
  });
});

describe("formatIssues", () => {
  it("prints one line per issue with the YAML path, aligned on the longest path", () => {
    expect(
      formatIssues([
        { code: "image-missing", path: ["questions", 0, "options", 1, "image"], message: "写真 ボルドー.jpg が画像フォルダにありません" },
        { code: "rank-permutation", path: ["questions", 2, "options"], message: "rank は 1〜3 を 1 回ずつ使ってください（1, 1, 2）" },
        { code: "public-text-leak", path: ["questions", 0, "description"], message: "参加者に見える文に価格「1本 5万円」が含まれています" },
      ]),
    ).toBe(
      [
        "  questions[0].options[1].image  写真 ボルドー.jpg が画像フォルダにありません",
        "  questions[2].options           rank は 1〜3 を 1 回ずつ使ってください（1, 1, 2）",
        "  questions[0].description       参加者に見える文に価格「1本 5万円」が含まれています",
      ].join("\n"),
    );
  });

  it("reports input that is not a mapping as one issue for the whole file", () => {
    const issues = issuesOf(parseQuestionSet(null, images));
    expect(issues.map((i) => [i.code, i.path])).toStrictEqual([["shape", []]]);
    expect(formatIssues(issues)).toBe("  (ファイル全体)  questions: から始まる形で書いてください");
  });
});
