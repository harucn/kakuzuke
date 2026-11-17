import { useSyncExternalStore } from "react";

/** 拒否（ユーザー操作の外・権限ポリシー）と API 欠如は握りつぶす。全画面にならなくても進行は続ける */
export async function toggleFullscreen(el: HTMLElement): Promise<void> {
  try {
    if (document.fullscreenElement == null) await el.requestFullscreen?.();
    else await document.exitFullscreen?.();
  } catch {
    // 通常表示のまま続ける
  }
}

export function useIsFullscreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener("fullscreenchange", onChange);
      return () => document.removeEventListener("fullscreenchange", onChange);
    },
    () => document.fullscreenElement != null,
    () => false,
  );
}
