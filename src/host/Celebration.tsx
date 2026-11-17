import { useEffect, useRef, useSyncExternalStore } from "react";
import { palette } from "../styles/tokens.ts";

const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
const COLORS = [palette.red, palette.green, palette.pink];
/** canvas の 1 ドットが占める CSS ピクセル */
const DOT = 4;
const HEART_COUNT = 28;
const DURATION_MS = 4000;
const REDUCE = "(prefers-reduced-motion: reduce)";

function useReducedMotion(): boolean {
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
    const width = (canvas.width = Math.floor(canvas.clientWidth / DOT));
    const height = (canvas.height = Math.floor(canvas.clientHeight / DOT));
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
