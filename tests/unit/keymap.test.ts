import { describe, expect, it, vi } from "vitest";
import { installHostKeys, keyToHostEvent, type KeyLike } from "../../src/host/keymap.ts";

const press = (key: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  key,
  repeat: false,
  isComposing: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...extra,
});

describe("keyToHostEvent", () => {
  it.each([
    ["→ キーで次の問題へ進む", "ArrowRight", "next"],
    ["PageDown キーで次の問題へ進む", "PageDown", "next"],
    ["← キーで前の問題へ戻る", "ArrowLeft", "prev"],
    ["PageUp キーで前の問題へ戻る", "PageUp", "prev"],
    ["Space キーで正解発表する", " ", "reveal"],
    ["Enter キーで正解発表する", "Enter", "reveal"],
  ])("%s", (_, key, type) => {
    expect(keyToHostEvent(press(key))).toEqual({ type });
  });

  it("ignores keys outside the table, including prototype names", () => {
    for (const key of ["a", "ArrowUp", "Escape", "toString", "constructor"]) {
      expect(keyToHostEvent(press(key))).toBeNull();
    }
  });

  it("ignores auto-repeat from a held key", () => {
    expect(keyToHostEvent(press("ArrowRight", { repeat: true }))).toBeNull();
  });

  it("ignores keys during IME composition", () => {
    expect(keyToHostEvent(press("Enter", { isComposing: true }))).toBeNull();
  });

  it.each(["altKey", "ctrlKey", "metaKey"] as const)("ignores keys with %s", (mod) => {
    expect(keyToHostEvent(press("ArrowLeft", { [mod]: true }))).toBeNull();
  });

  it("allows Shift", () => {
    expect(keyToHostEvent({ ...press(" "), shiftKey: true } as KeyLike)).toEqual({
      type: "reveal",
    });
  });
});

type Listener = (e: KeyboardEvent) => void;

function fakeWindow() {
  const listeners = new Map<string, Set<Listener>>();
  const captures: boolean[] = [];
  const target = {
    addEventListener(type: string, fn: Listener, opts?: AddEventListenerOptions) {
      captures.push(opts?.capture === true);
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners.get(type)?.delete(fn);
    },
  };
  const fire = (type: "keydown" | "keyup", key: KeyLike) => {
    const e = { ...key, defaultPrevented: false, preventDefault() { e.defaultPrevented = true; } };
    for (const fn of listeners.get(type) ?? []) fn(e as unknown as KeyboardEvent);
    return e.defaultPrevented;
  };
  const count = () => [...listeners.values()].reduce((n, s) => n + s.size, 0);
  return { target: target as unknown as Window, fire, count, captures };
}

describe("installHostKeys", () => {
  it("prevents the default and dispatches a mapped keydown in the capture phase", () => {
    const w = fakeWindow();
    const dispatch = vi.fn();
    installHostKeys(w.target, dispatch);

    expect(w.captures).toEqual([true, true]);
    expect(w.fire("keydown", press("PageDown"))).toBe(true);
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: "next" });
  });

  it("leaves unmapped and ignored keys alone", () => {
    const w = fakeWindow();
    const dispatch = vi.fn();
    installHostKeys(w.target, dispatch);

    expect(w.fire("keydown", press("Tab"))).toBe(false);
    expect(w.fire("keydown", press("ArrowRight", { repeat: true }))).toBe(false);
    expect(w.fire("keydown", press("r", { metaKey: true }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("prevents the Space keyup so a focused button is not pressed", () => {
    const w = fakeWindow();
    installHostKeys(w.target, vi.fn());

    expect(w.fire("keyup", press(" "))).toBe(true);
    expect(w.fire("keyup", press("Enter"))).toBe(false);
  });

  it("removes both listeners on cleanup", () => {
    const w = fakeWindow();
    const dispatch = vi.fn();
    const cleanup = installHostKeys(w.target, dispatch);
    expect(w.count()).toBe(2);

    cleanup();
    expect(w.count()).toBe(0);
    w.fire("keydown", press("Enter"));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
