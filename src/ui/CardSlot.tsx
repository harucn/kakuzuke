import { useReducer, useRef, useState, type AnimationEvent, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "./Celebration.tsx";

type Face = "asking" | "revealed";

/**
 * 選択肢 1 枚分の置き場所。呼ぶ側が問題ごとに作り直し、正解発表では作り直さない。
 * 置いたあとで face が変わったら（その場で正解発表を見たときだけ）、今の面を表、新しい面を裏にした 1 枚のカードにしてめくる。
 * めくり終えたら裏だったものを表に置き直す（裏返しの裏返しなので見た目は変わらない）
 */
export function CardSlot({
  face,
  order = 0,
  onTurned,
  children,
}: {
  readonly face: Face;
  /** めくり始める順番（0 から） */
  readonly order?: number;
  /** めくり終えたとき */
  readonly onTurned?: () => void;
  readonly children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const front = useRef<{ face: Face; content: ReactNode }>({ face, content: children });
  const [, settle] = useReducer((n: number) => n + 1, 0);
  const turning = face !== front.current.face && !reduced;
  if (!turning) front.current = { face, content: children };

  const onAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.animationName !== "flip") return;
    front.current = { face, content: children };
    settle();
    onTurned?.();
  };

  return (
    <div className={`card-slot${turning ? " card-slot--turning" : ""}`} style={{ "--order": order } as CSSProperties} onAnimationEnd={onAnimationEnd}>
      <div className="card-face">{front.current.content}</div>
      {turning && <div className="card-face card-face--back">{children}</div>}
    </div>
  );
}

/**
 * この問題で正解発表前から見ていて、正解発表でカードをめくっている最中か。メッセージや紙吹雪をめくり終えるまで待たせる。
 * 呼ぶ側は問題ごとに key を変えて作り直す。正解発表中に開いたときと reduced motion ではめくらないので待たない
 */
export function useCardTurn(revealed: boolean): { readonly turning: boolean; readonly onTurned: () => void } {
  const reduced = useReducedMotion();
  const asked = useRef(false);
  if (!revealed) asked.current = true;
  const [turned, setTurned] = useState(false);
  return { turning: revealed && asked.current && !turned && !reduced, onTurned: () => setTurned(true) };
}
