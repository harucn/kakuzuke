import { clampIndex, move } from "../deck/cursor.ts";

export type HostState =
  | { readonly phase: "booting" }
  | { readonly phase: "asking"; readonly index: number }
  | { readonly phase: "revealed"; readonly index: number; readonly run: number };

export type HostEvent =
  | { readonly type: "next" }
  | { readonly type: "prev" }
  | { readonly type: "reveal" }
  /** null は保存なし。第 1 問から始める */
  | { readonly type: "restore"; readonly index: number | null };

export const initialHostState: HostState = { phase: "booting" };

/** 状態が変わらないときは同じオブジェクトを返す（React が再描画しない） */
export function step(state: HostState, event: HostEvent, total: number): HostState {
  if (state.phase === "booting") {
    return event.type === "restore" ? { phase: "asking", index: clampIndex(event.index ?? 0, total) } : state;
  }
  switch (event.type) {
    case "next":
    case "prev": {
      const index = move(state.index, event.type === "next" ? 1 : -1, total);
      return index === state.index ? state : { phase: "asking", index };
    }
    case "reveal":
      return state.phase === "asking"
        ? { phase: "revealed", index: state.index, run: 1 }
        : { phase: "revealed", index: state.index, run: state.run + 1 };
    case "restore":
      return state;
  }
}
