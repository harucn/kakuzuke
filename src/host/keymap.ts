export type HostKeyAction = "next" | "prev" | "reveal";

export const HOST_KEYS = {
  ArrowRight: "next",
  PageDown: "next",
  ArrowLeft: "prev",
  PageUp: "prev",
  " ": "reveal",
  Enter: "reveal",
} as const satisfies Record<string, HostKeyAction>;

export type KeyLike = Pick<
  KeyboardEvent,
  "key" | "repeat" | "isComposing" | "altKey" | "ctrlKey" | "metaKey"
>;

// Shift は無視しない。リモコンは Shift を送らず、Shift+Space で発表できなくする理由もない。
export function keyToHostEvent(e: KeyLike): { type: HostKeyAction } | null {
  if (e.repeat || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return null;
  if (!Object.hasOwn(HOST_KEYS, e.key)) return null;
  return { type: HOST_KEYS[e.key as keyof typeof HOST_KEYS] };
}

type KeyTarget = Pick<Window, "addEventListener" | "removeEventListener">;

export function installHostKeys(
  target: KeyTarget,
  dispatch: (e: { type: HostKeyAction }) => void,
): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const event = keyToHostEvent(e);
    if (event === null) return;
    e.preventDefault();
    dispatch(event);
  };
  // フォーカス中のボタンは Space の keyup で押されるので、keyup も止める。
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === " ") e.preventDefault();
  };
  target.addEventListener("keydown", onKeyDown, { capture: true });
  target.addEventListener("keyup", onKeyUp, { capture: true });
  return () => {
    target.removeEventListener("keydown", onKeyDown, { capture: true });
    target.removeEventListener("keyup", onKeyUp, { capture: true });
  };
}
