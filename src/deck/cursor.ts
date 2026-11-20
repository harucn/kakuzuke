export type Step = -1 | 1;

/** 画面の位置。"title" は第 1 問の前のタイトル画面、数値は問題の添字 */
export type Position = "title" | number;

export function clampIndex(index: number, total: number): number {
  return Math.min(Math.max(index, 0), total - 1);
}

/** タイトル画面の次は第 1 問、第 1 問の前はタイトル画面。最終問の次は最終問のまま */
export function move(position: Position, step: Step, total: number): Position {
  if (position === "title") return step === 1 ? 0 : "title";
  const index = clampIndex(position, total);
  if (index === 0 && step === -1) return "title";
  return clampIndex(index + step, total);
}

export function boundsOf(
  position: Position,
  total: number,
): { readonly canPrev: boolean; readonly canNext: boolean } {
  if (position === "title") return { canPrev: false, canNext: true };
  return { canPrev: true, canNext: clampIndex(position, total) < total - 1 };
}
