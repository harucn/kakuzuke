import { useEffect, useRef, useSyncExternalStore } from "react";
import { palette } from "../styles/tokens.ts";

const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
const COLORS = [palette.red, palette.green, palette.pink];
/** canvas の 1 ドットが占める CSS ピクセルの下限。スマホ幅でもハートが小さくなりすぎないようにする */
const MIN_DOT = 4;
/** 画面の幅に並ぶドットの数。1280px 幅で 1 ドット 4px になり、画面が広いほどドットも大きくして、画面に対するハートの大きさを保つ */
const DOTS_ACROSS = 320;
const HEART_COUNT = 28;
const DURATION_MS = 4000;
const REDUCE = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia(REDUCE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => matchMedia(REDUCE).matches,
    () => true,
  );
}

/** ドットのハートの紙吹雪。再生し直すときは key を変えて作り直す。終わった後も要素は残し、絵だけ消す */
export function Celebration() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dot = Math.max(MIN_DOT, canvas.clientWidth / DOTS_ACROSS);
    const width = (canvas.width = Math.floor(canvas.clientWidth / dot));
    const height = (canvas.height = Math.floor(canvas.clientHeight / dot));
    const hearts = Array.from({ length: HEART_COUNT }, () => ({
      x: Math.round(Math.random() * width),
      y: -Math.random() * height * 0.6,
      dotsPerMs: (0.4 + Math.random() * 0.8) * 0.06,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    let start: number | null = null;
    let frame = requestAnimationFrame(function tick(now) {
      start ??= now;
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);
      if (elapsed >= DURATION_MS) return;
      for (const h of hearts) {
        ctx.fillStyle = h.color;
        const top = Math.round(h.y + h.dotsPerMs * elapsed);
        HEART.forEach((row, dy) => {
          for (let dx = 0; dx < row.length; dx++) if (row[dx] === "1") ctx.fillRect(h.x + dx, top + dy, 1, 1);
        });
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  if (reduced) return null;
  return <canvas ref={ref} className="celebration" data-testid="celebration" aria-hidden="true" />;
}
