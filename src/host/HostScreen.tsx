import { useEffect, useRef } from "react";
import { preload } from "react-dom";
import { boundsOf, type Position } from "../deck/cursor.ts";
import type { PublicQuestionSet } from "../question-set/model.ts";
import { CardSlot, useCardTurn } from "../ui/CardSlot.tsx";
import { Celebration } from "../ui/Celebration.tsx";
import { OptionCard } from "../ui/OptionCard.tsx";
import { RevealedCard } from "../ui/RevealedCard.tsx";
import { positionOf } from "../venue/machine.ts";
import type { Intent, VenueView } from "../venue/protocol.ts";
import { useVenue } from "../venue/useVenue.ts";
import { toggleFullscreen, useIsFullscreen } from "./fullscreen.ts";
import { installHostKeys } from "./keymap.ts";
import { QrCode } from "./QrCode.tsx";

type Operate = ((intent: Intent) => void) | null;

export function HostScreen({ set }: { readonly set: PublicQuestionSet }) {
  const { view, connection, celebration, operate } = useVenue("host");
  useEffect(() => installHostKeys(window, (intent) => operate?.(intent)), [operate]);
  const position = view === null ? null : positionOf(view);
  const upcoming = position === null ? null : position === "title" ? 0 : position + 1;
  for (const option of upcoming === null ? [] : (set.questions[upcoming]?.options ?? [])) preload(option.image, { as: "image" });
  // 全画面にするのは枠ではなくページ全体。枠の 16:9 の寸法計算をそのまま使えて、画面の比が 16:9 でなくても崩れない
  const stage = useRef<HTMLElement>(null);
  const onFullscreen = () => void toggleFullscreen(stage.current!);

  return (
    <main ref={stage} className="host-stage" aria-label="司会画面">
      <p role="status" className="venue-status">
        {connection === "lost" ? "再接続中" : null}
      </p>
      {view !== null && (
        <div className={`host${view.phase === "title" ? " host--title" : ""}`}>
          {view.phase === "title" ? (
            <TitleStage set={set} operate={operate} onFullscreen={onFullscreen} />
          ) : (
            <Stage key={view.index} set={set} view={view} celebration={celebration} operate={operate} onFullscreen={onFullscreen} />
          )}
        </div>
      )}
    </main>
  );
}

function TitleStage({
  set,
  operate,
  onFullscreen,
}: {
  readonly set: PublicQuestionSet;
  readonly operate: Operate;
  readonly onFullscreen: () => void;
}) {
  // 会場の状態は接続後にしか届かないので、ここは必ずクライアントで動く。origin は本番とプレビューで違うのでビルド時には決められない
  const guestUrl = new URL("/", window.location.origin).href;
  return (
    <>
      <div className="host-cover">
        <div className="host-cover__text">
          <h1 className="host-cover__title">{set.title}</h1>
        </div>
        <QrCode value={guestUrl} label="参加者画面の QR コード" />
      </div>
      <div className="host-foot host-foot--title">
        <Controls position="title" total={set.questions.length} operate={operate} onFullscreen={onFullscreen} />
      </div>
    </>
  );
}

function Stage({
  set,
  view,
  celebration,
  operate,
  onFullscreen,
}: {
  readonly set: PublicQuestionSet;
  readonly view: Exclude<VenueView, { readonly phase: "title" }>;
  readonly celebration: string | null;
  readonly operate: Operate;
  readonly onFullscreen: () => void;
}) {
  const { index } = view;
  const { questions } = set;
  const question = questions[index];
  const reveal = view.phase === "revealed" ? view.reveal : null;
  const { turning, onTurned } = useCardTurn(reveal !== null);
  // めくり終えるまでは問題の説明のまま。最後の 1 枚がめくれてから正解と解説を打ち始める
  const message = reveal === null || turning ? { who: "Q.", text: question.description } : { who: `${reveal.headline}！`, text: reveal.explanation };
  const last = question.options.length - 1;

  return (
    <>
      <h1 className="host-title">
        <small>STAGE {index + 1}</small>
        {question.title}
      </h1>
      <div className="host-opts">
        {question.options.map((o, i) => (
          <CardSlot key={i} face={reveal === null ? "asking" : "revealed"} order={i} onTurned={i === last ? onTurned : undefined}>
            {reveal === null ? (
              <OptionCard size="host" image={o.image} note={o.note} />
            ) : (
              <RevealedCard size="host" option={o} revealed={reveal.options[i]} mode={question.mode} celebration={celebration} />
            )}
          </CardSlot>
        ))}
      </div>
      <div className="host-foot">
        <div className="msg px" aria-live="polite">
          <span className="who">{message.who}</span>
          <Typed key={message.text} text={message.text} />
          <span className="caret" aria-hidden="true" />
        </div>
        <Controls position={index} total={questions.length} operate={operate} onFullscreen={onFullscreen} />
      </div>
      {celebration !== null && !turning && <Celebration key={celebration} />}
    </>
  );
}

/** タイトル画面には正解発表ボタンを出さない（状態機械もタイトル画面の正解発表を無視する）。会場につながっていない間は全画面以外を押せない */
function Controls({
  position,
  total,
  operate,
  onFullscreen,
}: {
  readonly position: Position;
  readonly total: number;
  readonly operate: Operate;
  readonly onFullscreen: () => void;
}) {
  const fullscreen = useIsFullscreen();
  const { canPrev, canNext } = boundsOf(position, total);
  return (
    <div className="host-btns">
      <button type="button" className="btn px" aria-label="前へ" disabled={operate === null || !canPrev} onClick={() => operate?.({ type: "prev" })}>
        ◀
      </button>
      {position !== "title" && (
        <button type="button" className="btn btn-go px" disabled={operate === null} onClick={() => operate?.({ type: "reveal" })}>
          正解発表
        </button>
      )}
      <button type="button" className="btn px" aria-label="次へ" disabled={operate === null || !canNext} onClick={() => operate?.({ type: "next" })}>
        ▶
      </button>
      <button type="button" className="btn btn-sq px" aria-label="全画面" aria-pressed={fullscreen} onClick={onFullscreen}>
        ⛶
      </button>
    </div>
  );
}

/** 全文を最初から DOM に置き、1 文字ずつ現れる見た目だけを CSS で付ける（reduced motion では止まる） */
function Typed({ text }: { readonly text: string }) {
  return (
    <span className="typed">
      {Array.from(text, (char, i) => (
        <span key={i} style={{ animationDelay: `${i * 45}ms` }}>
          {char}
        </span>
      ))}
    </span>
  );
}
