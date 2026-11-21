import { move, type Position } from "../deck/cursor.ts";
import type { Intent } from "./protocol.ts";

export type VenueState =
  | { readonly phase: "title" }
  | { readonly phase: "asking"; readonly index: number }
  /** run は正解発表を押した回数 */
  | { readonly phase: "revealed"; readonly index: number; readonly run: number };

export const TITLE: VenueState = { phase: "title" };

export function positionOf(state: VenueState): Position {
  return state.phase === "title" ? "title" : state.index;
}

function at(position: Position): VenueState {
  return position === "title" ? TITLE : { phase: "asking", index: position };
}

/** 状態が変わらないときは同じオブジェクトを返す（会場は保存も配信もしない） */
export function step(state: VenueState, intent: Intent, total: number): VenueState {
  switch (intent.type) {
    case "next":
    case "prev": {
      const from = positionOf(state);
      const to = move(from, intent.type === "next" ? 1 : -1, total);
      return to === from ? state : at(to);
    }
    case "reveal":
      // タイトル画面の Space・Enter はリモコンの連打で第 1 問の正解発表まで進まないよう無視する
      if (state.phase === "title") return state;
      return state.phase === "asking"
        ? { phase: "revealed", index: state.index, run: 1 }
        : { phase: "revealed", index: state.index, run: state.run + 1 };
  }
}
