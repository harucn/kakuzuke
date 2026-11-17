import { clampIndex } from "../deck/cursor.ts";

export const STORAGE_KEY = "kakuzuke:host:index";

/** 保存値を読む。整数でない・負・空なら null。total 以上は total-1 に丸める */
export function readStoredIndex(raw: string | null, total: number): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  return clampIndex(Number(raw), total);
}

/** sessionStorage が使えない環境（無効化・プライベートモード・SSR）では null */
export function loadIndex(total: number): number | null {
  try {
    return readStoredIndex(globalThis.sessionStorage.getItem(STORAGE_KEY), total);
  } catch {
    return null;
  }
}

export function saveIndex(index: number): void {
  try {
    globalThis.sessionStorage.setItem(STORAGE_KEY, String(index));
  } catch {
    // 保存できなくても進行は続ける。再読み込みで第 1 問に戻るだけ
  }
}
