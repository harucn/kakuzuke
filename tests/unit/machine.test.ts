import { describe, expect, it } from "vitest";
import { initialHostState, step, type HostEvent, type HostState } from "../../src/host/machine.ts";

const TOTAL = 3;

function run(events: readonly HostEvent[], from: HostState = initialHostState): HostState {
  return events.reduce((s, e) => step(s, e, TOTAL), from);
}

const next = { type: "next" } as const;
const prev = { type: "prev" } as const;
const reveal = { type: "reveal" } as const;
const restore = (index: number | null) => ({ type: "restore", index }) as const;

describe("booting", () => {
  it("初期状態は booting", () => {
    expect(initialHostState).toEqual({ phase: "booting" });
  });

  it("booting 中の next・prev・reveal は無視し、同じオブジェクトを返す", () => {
    for (const e of [next, prev, reveal]) {
      expect(step(initialHostState, e, TOTAL)).toBe(initialHostState);
    }
  });

  it("保存なしの restore で第 1 問を発表前の状態で表示する", () => {
    expect(run([restore(null)])).toEqual({ phase: "asking", index: 0 });
  });

  it("restore で保存された問題に発表前の状態で戻る", () => {
    expect(run([restore(2)])).toEqual({ phase: "asking", index: 2 });
  });

  it("restore は範囲外の番号を範囲内に丸める", () => {
    expect(run([restore(9)])).toEqual({ phase: "asking", index: TOTAL - 1 });
    expect(run([restore(-1)])).toEqual({ phase: "asking", index: 0 });
  });

  it("booting 以外での restore は無視する", () => {
    const asking = run([restore(1)]);
    expect(step(asking, restore(2), TOTAL)).toBe(asking);
    const revealed = step(asking, reveal, TOTAL);
    expect(step(revealed, restore(0), TOTAL)).toBe(revealed);
  });
});

describe("前後の問題への移動", () => {
  it("次へで次の問題を発表前の状態で表示する", () => {
    expect(run([restore(null), next])).toEqual({ phase: "asking", index: 1 });
  });

  it("前へで前の問題を発表前の状態で表示する", () => {
    expect(run([restore(1), prev])).toEqual({ phase: "asking", index: 0 });
  });

  it("第 1 問で前へを押しても第 1 問のままで、同じオブジェクトを返す", () => {
    const first = run([restore(0)]);
    expect(step(first, prev, TOTAL)).toBe(first);
  });

  it("最終問で次へを押しても最終問のままで、同じオブジェクトを返す", () => {
    const last = run([restore(TOTAL - 1)]);
    expect(step(last, next, TOTAL)).toBe(last);
  });

  it("正解発表後でも端での移動は何もせず、発表した状態のまま同じオブジェクトを返す", () => {
    const lastRevealed = run([restore(TOTAL - 1), reveal]);
    expect(step(lastRevealed, next, TOTAL)).toBe(lastRevealed);
    const firstRevealed = run([restore(0), reveal]);
    expect(step(firstRevealed, prev, TOTAL)).toBe(firstRevealed);
  });

  it("正解発表後に移動して戻ると発表前に戻る", () => {
    expect(run([restore(0), reveal, next, prev])).toEqual({ phase: "asking", index: 0 });
  });

  it("正解発表後の移動先は発表前の状態", () => {
    expect(run([restore(1), reveal, next])).toEqual({ phase: "asking", index: 2 });
    expect(run([restore(1), reveal, prev])).toEqual({ phase: "asking", index: 0 });
  });
});

describe("正解発表", () => {
  it("発表前に正解発表を押すと run 1 で発表する", () => {
    expect(run([restore(1), reveal])).toEqual({ phase: "revealed", index: 1, run: 1 });
  });

  it("正解発表をもう一度押すと run が 1 ずつ増え、問題は変わらない", () => {
    expect(run([restore(1), reveal, reveal])).toEqual({ phase: "revealed", index: 1, run: 2 });
    expect(run([restore(1), reveal, reveal, reveal])).toEqual({ phase: "revealed", index: 1, run: 3 });
  });
});
