import { describe, expect, expectTypeOf, it } from "vitest";
import {
  answerOf,
  PUBLIC_OPTION_KEYS,
  PUBLIC_QUESTION_KEYS,
  PUBLIC_SET_KEYS,
  secretStrings,
  toPublic,
  type PublicOption,
  type PublicQuestion,
  type PublicQuestionSet,
  type Question,
  type QuestionSet,
} from "../../src/question-set/model";
import { imageUrl, questionSet } from "./fixtures";

const wine: Question = {
  mode: "pick",
  title: "ワイン",
  description: "高いワインはどちら？",
  explanation: "B は 1本 5万円のボルドー。",
  options: [
    { label: "A", image: imageUrl("/images/aaa.jpg"), note: "チリ産の赤ワイン", rank: 2, name: "テーブルワイン", price: "1本 1,000円" },
    { label: "B", image: imageUrl("/images/bbb.jpg"), note: "フランス産の赤ワイン", rank: 1, name: "ボルドーの赤", price: "1本 5万円" },
  ],
};

const beef: Question = {
  mode: "order",
  title: "牛肉",
  description: "高い順に並べよ",
  explanation: "A が A5 ランク。",
  options: [
    { label: "A", image: imageUrl("/images/ccc.jpg"), note: "霜降りの牛肉", rank: 1, name: "A5 和牛", price: "100g 5,000円" },
    { label: "B", image: imageUrl("/images/ddd.jpg"), note: "赤身の牛肉", rank: 3, name: "輸入牛", price: "100g 300円" },
    { label: "C", image: imageUrl("/images/eee.jpg"), note: "脂の多い牛肉", rank: 2, name: "国産牛", price: "100g 1,000円" },
  ],
};

// 表示順がラベル順と別でも公開形が表示順を保つことを確かめるため、B・A の順に書く
const water: Question = {
  mode: "pick",
  title: "水",
  description: "高い水はどちら？",
  explanation: "A は水道水。",
  options: [
    { label: "B", image: imageUrl("/images/ggg.jpg"), note: "海外の水", rank: 1, name: "輸入牛", price: "1本 3,000円" },
    { label: "A", image: imageUrl("/images/fff.jpg"), note: "国内の水", rank: 2, name: "水道水", price: "1本 1,000円" },
  ],
};

describe("answerOf", () => {
  it("pick の正解は rank 1 の選択肢になる", () => {
    expect(answerOf(wine)).toStrictEqual({ mode: "pick", winner: "B" });
  });

  it("order の正解は rank の昇順のラベル列になる", () => {
    expect(answerOf(beef)).toStrictEqual({ mode: "order", sequence: ["A", "C", "B"] });
  });
});

describe("toPublic", () => {
  const publicSet = toPublic(questionSet("2026 忘年会 格付けチェック", wine, beef, water));

  it("公開形は rank・name・price を含まない", () => {
    for (const q of publicSet.questions) {
      for (const o of q.options) {
        expect(o).not.toHaveProperty("rank");
        expect(o).not.toHaveProperty("name");
        expect(o).not.toHaveProperty("price");
      }
    }
  });

  it("公開形はラベルを含まない", () => {
    for (const q of publicSet.questions) {
      for (const o of q.options) {
        expect(o).not.toHaveProperty("label");
      }
    }
  });

  it("公開形は解説を含まない", () => {
    for (const q of publicSet.questions) {
      expect(q).not.toHaveProperty("explanation");
    }
  });

  it("公開形は出題順と表示項目を保つ", () => {
    expect(publicSet.title).toBe("2026 忘年会 格付けチェック");
    expect(publicSet.questions).toStrictEqual([
      {
        mode: "pick",
        title: "ワイン",
        description: "高いワインはどちら？",
        options: [
          { image: "/images/aaa.jpg", note: "チリ産の赤ワイン" },
          { image: "/images/bbb.jpg", note: "フランス産の赤ワイン" },
        ],
      },
      {
        mode: "order",
        title: "牛肉",
        description: "高い順に並べよ",
        options: [
          { image: "/images/ccc.jpg", note: "霜降りの牛肉" },
          { image: "/images/ddd.jpg", note: "赤身の牛肉" },
          { image: "/images/eee.jpg", note: "脂の多い牛肉" },
        ],
      },
      {
        mode: "pick",
        title: "水",
        description: "高い水はどちら？",
        options: [
          { image: "/images/ggg.jpg", note: "海外の水" },
          { image: "/images/fff.jpg", note: "国内の水" },
        ],
      },
    ]);
  });

  it("each public object has exactly the allowlisted keys, even when the source has extra fields", () => {
    const withExtra = {
      ...beef,
      internalNote: "秘密のメモ",
      options: beef.options.map((o) => ({ ...o, supplier: "秘密の仕入れ先" })),
    } as unknown as Question;
    const withExtraSet = { ...questionSet("会", wine, withExtra), organizerMemo: "秘密のメモ" } as QuestionSet;
    const projected = toPublic(withExtraSet);
    expect(Object.keys(projected).sort()).toStrictEqual([...PUBLIC_SET_KEYS].sort());
    for (const q of projected.questions) {
      expect(Object.keys(q).sort()).toStrictEqual([...PUBLIC_QUESTION_KEYS].sort());
      for (const o of q.options) {
        expect(Object.keys(o).sort()).toStrictEqual([...PUBLIC_OPTION_KEYS].sort());
      }
    }
  });

  it("allowlists name exactly the keys of the public types", () => {
    expectTypeOf<(typeof PUBLIC_SET_KEYS)[number]>().toEqualTypeOf<keyof PublicQuestionSet>();
    expectTypeOf<(typeof PUBLIC_QUESTION_KEYS)[number]>().toEqualTypeOf<keyof PublicQuestion>();
    expectTypeOf<(typeof PUBLIC_OPTION_KEYS)[number]>().toEqualTypeOf<keyof PublicOption>();
  });
});

describe("secretStrings", () => {
  it("returns every option name and price and every explanation, without duplicates", () => {
    expect(secretStrings(questionSet("会", wine, beef, water))).toStrictEqual([
      "テーブルワイン",
      "1本 1,000円",
      "ボルドーの赤",
      "1本 5万円",
      "B は 1本 5万円のボルドー。",
      "A5 和牛",
      "100g 5,000円",
      "輸入牛",
      "100g 300円",
      "国産牛",
      "100g 1,000円",
      "A が A5 ランク。",
      "1本 3,000円",
      "水道水",
      "A は水道水。",
    ]);
  });
});
