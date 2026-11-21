import { describe, expect, it } from "vitest";
import { step, TITLE, type VenueState } from "../../src/venue/machine.ts";
import type { Intent } from "../../src/venue/protocol.ts";

const TOTAL = 3;

function run(intents: readonly Intent[], from: VenueState = TITLE): VenueState {
  return intents.reduce((s, i) => step(s, i, TOTAL), from);
}

const next = { type: "next" } as const;
const prev = { type: "prev" } as const;
const reveal = { type: "reveal" } as const;
const asking = (index: number): VenueState => ({ phase: "asking", index });

describe("前後の画面への移動", () => {
  it("タイトル画面で次へを押すと第 1 問を発表前の状態で表示する", () => {
    expect(run([next])).toEqual({ phase: "asking", index: 0 });
  });

  it("第 1 問で前へを押すとタイトル画面に戻る", () => {
    expect(run([prev], asking(0))).toEqual({ phase: "title" });
    expect(run([reveal, prev], asking(0))).toEqual({ phase: "title" });
  });

  it("タイトル画面で前へを押してもタイトル画面のままで、同じオブジェクトを返す", () => {
    expect(step(TITLE, prev, TOTAL)).toBe(TITLE);
  });

  it("次へで次の問題を発表前の状態で表示する", () => {
    expect(run([next], asking(0))).toEqual({ phase: "asking", index: 1 });
  });

  it("前へで前の問題を発表前の状態で表示する", () => {
    expect(run([prev], asking(1))).toEqual({ phase: "asking", index: 0 });
  });

  it("最終問で次へを押しても最終問のままで、同じオブジェクトを返す", () => {
    const last = asking(TOTAL - 1);
    expect(step(last, next, TOTAL)).toBe(last);
  });

  it("正解発表後でも最終問での次へは何もせず、発表した状態のまま同じオブジェクトを返す", () => {
    const lastRevealed = run([reveal], asking(TOTAL - 1));
    expect(step(lastRevealed, next, TOTAL)).toBe(lastRevealed);
  });

  it("正解発表後に移動して戻ると発表前に戻る", () => {
    expect(run([reveal, next, prev], asking(0))).toEqual({ phase: "asking", index: 0 });
  });

  it("正解発表後の移動先は発表前の状態", () => {
    expect(run([reveal, next], asking(1))).toEqual({ phase: "asking", index: 2 });
    expect(run([reveal, prev], asking(1))).toEqual({ phase: "asking", index: 0 });
  });
});

describe("正解発表", () => {
  it("タイトル画面での正解発表は無視し、同じオブジェクトを返す", () => {
    expect(step(TITLE, reveal, TOTAL)).toBe(TITLE);
  });

  it("発表前に正解発表を押すと run 1 で発表する", () => {
    expect(run([reveal], asking(1))).toEqual({ phase: "revealed", index: 1, run: 1 });
  });

  it("正解発表をもう一度押すと run が 1 ずつ増え、問題は変わらない", () => {
    expect(run([reveal, reveal], asking(1))).toEqual({ phase: "revealed", index: 1, run: 2 });
    expect(run([reveal, reveal, reveal], asking(1))).toEqual({ phase: "revealed", index: 1, run: 3 });
  });
});
