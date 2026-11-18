import { clampIndex, move, type Position } from "../deck/cursor.ts";

export type HostState =
  | { readonly phase: "booting" }
  | { readonly phase: "title" }
  | { readonly phase: "asking"; readonly index: number }
  | { readonly phase: "revealed"; readonly index: number; readonly run: number };

export type HostEvent =
  | { readonly type: "next" }
  | { readonly type: "prev" }
  | { readonly type: "reveal" }
  /** null は保存なし。タイトル画面から始める */
  | { readonly type: "restore"; readonly index: number | null };

export const initialHostState: HostState = { phase: "booting" };

export type ShownState = Exclude<HostState, { readonly phase: "booting" }>;

export function positionOf(state: ShownState): Position {
  return state.phase === "title" ? "title" : state.index;
}

function at(position: Position): ShownState {
  return position === "title" ? { phase: "title" } : { phase: "asking", index: position };
}

/** 状態が変わらないときは同じオブジェクトを返す（React が再描画しない） */
export function step(state: HostState, event: HostEvent, total: number): HostState {
  if (state.phase === "booting") {
    return event.type === "restore" ? at(event.index === null ? "title" : clampIndex(event.index, total)) : state;
  }
  switch (event.type) {
    case "next":
    case "prev": {
      const from = positionOf(state);
      const to = move(from, event.type === "next" ? 1 : -1, total);
      return to === from ? state : at(to);
    }
    case "reveal":
      // タイトル画面の Space・Enter はリモコンの連打で第 1 問の正解発表まで進まないよう無視する
      if (state.phase === "title") return state;
      return state.phase === "asking"
        ? { phase: "revealed", index: state.index, run: 1 }
        : { phase: "revealed", index: state.index, run: state.run + 1 };
    case "restore":
      return state;
  }
}
