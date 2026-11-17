export type Step = -1 | 1;

export function clampIndex(index: number, total: number): number {
  return Math.min(Math.max(index, 0), total - 1);
}

export function move(index: number, step: Step, total: number): number {
  return clampIndex(clampIndex(index, total) + step, total);
}

export function boundsOf(
  index: number,
  total: number,
): { readonly canPrev: boolean; readonly canNext: boolean } {
  const i = clampIndex(index, total);
  return { canPrev: i > 0, canNext: i < total - 1 };
}

export function positionText(index: number, total: number): string {
  return `${clampIndex(index, total) + 1} / ${total}`;
}
