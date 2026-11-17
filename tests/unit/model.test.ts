import { describe, expect, expectTypeOf, it } from "vitest";
import {
  answerOf,
  PUBLIC_OPTION_KEYS,
  PUBLIC_QUESTION_KEYS,
  secretStrings,
  toPublic,
  type PublicOption,
  type PublicQuestion,
  type Question,
} from "../../src/question-set/model";
import { imageUrl, questionSet } from "./fixtures";

const wine: Question = {
  mode: "pick",
  title: "ワイン",
  description: "高いワインはどちら？",
  explanation: "B は 1本 5万円のボルドー。",
  options: [
    { label: "A", image: imageUrl("/images/aaa.jpg"), rank: 2, name: "テーブルワイン", price: "1本 1,000円" },
    { label: "B", image: imageUrl("/images/bbb.jpg"), rank: 1, name: "ボルドーの赤", price: "1本 5万円" },
  ],
};

const beef: Question = {
  mode: "order",
  title: "牛肉",
  description: "高い順に並べよ",
  explanation: "A が A5 ランク。",
  options: [
    { label: "A", image: imageUrl("/images/ccc.jpg"), rank: 1, name: "A5 和牛", price: "100g 5,000円" },
    { label: "B", image: imageUrl("/images/ddd.jpg"), rank: 3, name: "輸入牛", price: "100g 300円" },
    { label: "C", image: imageUrl("/images/eee.jpg"), rank: 2, name: "国産牛", price: "100g 1,000円" },
  ],
};

const water: Question = {
  mode: "pick",
  title: "水",
  description: "高い水はどちら？",
  explanation: "A は水道水。",
  options: [
    { label: "A", image: imageUrl("/images/fff.jpg"), rank: 2, name: "水道水", price: "1本 1,000円" },
    { label: "B", image: imageUrl("/images/ggg.jpg"), rank: 1, name: "輸入牛", price: "1本 3,000円" },
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
  const publicSet = toPublic(questionSet(wine, beef, water));

  it("公開形は rank・name・price を含まない", () => {
    for (const q of publicSet) {
      for (const o of q.options) {
        expect(o).not.toHaveProperty("rank");
        expect(o).not.toHaveProperty("name");
        expect(o).not.toHaveProperty("price");
      }
    }
  });

  it("公開形は解説を含まない", () => {
    for (const q of publicSet) {
      expect(q).not.toHaveProperty("explanation");
    }
  });

  it("公開形は出題順と表示項目を保つ", () => {
    expect(publicSet).toStrictEqual([
      {
        mode: "pick",
        title: "ワイン",
        description: "高いワインはどちら？",
        options: [
          { label: "A", image: "/images/aaa.jpg" },
          { label: "B", image: "/images/bbb.jpg" },
        ],
      },
      {
        mode: "order",
        title: "牛肉",
        description: "高い順に並べよ",
        options: [
          { label: "A", image: "/images/ccc.jpg" },
          { label: "B", image: "/images/ddd.jpg" },
          { label: "C", image: "/images/eee.jpg" },
        ],
      },
      {
        mode: "pick",
        title: "水",
        description: "高い水はどちら？",
        options: [
          { label: "A", image: "/images/fff.jpg" },
          { label: "B", image: "/images/ggg.jpg" },
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
    for (const q of toPublic(questionSet(wine, withExtra))) {
      expect(Object.keys(q).sort()).toStrictEqual([...PUBLIC_QUESTION_KEYS].sort());
      for (const o of q.options) {
        expect(Object.keys(o).sort()).toStrictEqual([...PUBLIC_OPTION_KEYS].sort());
      }
    }
  });

  it("allowlists name exactly the keys of the public types", () => {
    expectTypeOf<(typeof PUBLIC_QUESTION_KEYS)[number]>().toEqualTypeOf<keyof PublicQuestion>();
    expectTypeOf<(typeof PUBLIC_OPTION_KEYS)[number]>().toEqualTypeOf<keyof PublicOption>();
  });
});

describe("secretStrings", () => {
  it("returns every option name and price and every explanation, without duplicates", () => {
    expect(secretStrings(questionSet(wine, beef, water))).toStrictEqual([
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
      "水道水",
      "1本 3,000円",
      "A は水道水。",
    ]);
  });
});
