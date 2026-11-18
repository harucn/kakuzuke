import { useEffect, useReducer, useRef, type Dispatch } from "react";
import { preload } from "react-dom";
import { boundsOf, positionText, type Position } from "../deck/cursor.ts";
import type { HostQuestionSet } from "../question-set/model.ts";
import { OptionCard } from "../ui/OptionCard.tsx";
import { Celebration } from "./Celebration.tsx";
import { toggleFullscreen, useIsFullscreen } from "./fullscreen.ts";
import { installHostKeys } from "./keymap.ts";
import { initialHostState, positionOf, step, type HostEvent, type HostState, type ShownState } from "./machine.ts";
import { QrCode } from "./QrCode.tsx";
import { loadIndex, savePosition } from "./restore.ts";
import { revealView, type RevealedOption } from "./reveal.ts";

export function HostScreen({ set }: { readonly set: HostQuestionSet }) {
  const total = set.questions.length;
  const [state, dispatch] = useReducer((s: HostState, e: HostEvent) => step(s, e, total), initialHostState);
  useEffect(() => installHostKeys(window, dispatch), []);
  useEffect(() => dispatch({ type: "restore", index: loadIndex(total) }), [total]);
  // booting の間は保存も削除もしない。復元する前に保存値を消さないため
  const position = state.phase === "booting" ? null : positionOf(state);
  useEffect(() => {
    if (position !== null) savePosition(position);
  }, [position]);
  const upcoming = position === null ? null : position === "title" ? 0 : position + 1;
  for (const option of upcoming === null ? [] : (set.questions[upcoming]?.options ?? [])) preload(option.image, { as: "image" });
  // 全画面にするのは枠ではなくページ全体。枠の 16:9 の寸法計算をそのまま使えて、画面の比が 16:9 でなくても崩れない
  const stage = useRef<HTMLElement>(null);
  const onFullscreen = () => void toggleFullscreen(stage.current!);

  return (
    <main ref={stage} className="host-stage" aria-label="司会画面">
      <div className={`host px${state.phase === "title" ? " host--title" : ""}`}>
        {state.phase === "title" ? (
          <TitleStage set={set} dispatch={dispatch} onFullscreen={onFullscreen} />
        ) : (
          state.phase !== "booting" && <Stage set={set} state={state} dispatch={dispatch} onFullscreen={onFullscreen} />
        )}
      </div>
    </main>
  );
}

function TitleStage({
  set,
  dispatch,
  onFullscreen,
}: {
  readonly set: HostQuestionSet;
  readonly dispatch: Dispatch<HostEvent>;
  readonly onFullscreen: () => void;
}) {
  // booting の間は描画しないので、ここは必ずクライアントで動く。origin は本番とプレビューで違うのでビルド時には決められない
  const guestUrl = new URL("/", window.location.origin).href;
  return (
    <>
      <div className="host-bar">
        <span>KAKUZUKE</span>
        <span className="hearts" aria-hidden="true">
          ♥ ♥ ♥
        </span>
      </div>
      <div className="host-cover">
        <div className="host-cover__text">
          <h1 className="host-cover__title">{set.title}</h1>
          <p className="host-cover__count">全 {set.questions.length} 問</p>
        </div>
        <figure className="host-qr">
          <QrCode value={guestUrl} label="参加者画面の QR コード" />
          <figcaption className="host-qr__url">{guestUrl}</figcaption>
        </figure>
      </div>
      <div className="host-foot host-foot--title">
        <Controls position="title" total={set.questions.length} dispatch={dispatch} onFullscreen={onFullscreen} />
      </div>
    </>
  );
}

function Stage({
  set,
  state,
  dispatch,
  onFullscreen,
}: {
  readonly set: HostQuestionSet;
  readonly state: Exclude<ShownState, { readonly phase: "title" }>;
  readonly dispatch: Dispatch<HostEvent>;
  readonly onFullscreen: () => void;
}) {
  const { index } = state;
  const { questions } = set;
  const question = questions[index];

  const revealed = state.phase === "revealed" ? { view: revealView(question), run: state.run } : null;
  const message =
    revealed === null
      ? { who: "Q.", text: question.description }
      : { who: `${revealed.view.headline}！`, text: revealed.view.explanation };

  return (
    <>
      <div className="host-bar">
        <span>STAGE {positionText(index, questions.length)}</span>
        <span className="hearts" aria-hidden="true">
          ♥ ♥ ♥
        </span>
      </div>
      <h1 className="host-title">
        <small>STAGE {index + 1}</small>
        {question.title}
      </h1>
      <div className="host-opts">
        {question.options.map((o) => {
          if (revealed === null) return <OptionCard key={o.label} size="host" label={o.label} image={o.image} />;
          const shown = revealed.view.options.find((r) => r.label === o.label)!;
          // pick は外れを薄くする。order は全選択肢の順位を読ませたいので薄くしない
          const tone = shown.correct ? "correct" : question.mode === "pick" ? "dim" : undefined;
          return (
            <OptionCard key={o.label} size="host" label={o.label} image={o.image} tone={tone}>
              <Tag option={shown} />
              {shown.correct && <Stamp key={revealed.run} />}
            </OptionCard>
          );
        })}
      </div>
      <div className="host-foot">
        <div className="msg px" aria-live="polite">
          <span className="who">{message.who}</span>
          <Typed key={`${index}:${state.phase}`} text={message.text} />
          <span className="caret" aria-hidden="true" />
        </div>
        <Controls position={index} total={questions.length} dispatch={dispatch} onFullscreen={onFullscreen} />
      </div>
      {revealed !== null && <Celebration key={revealed.run} />}
    </>
  );
}

/** タイトル画面には正解発表ボタンを出さない（状態機械もタイトル画面の正解発表を無視する） */
function Controls({
  position,
  total,
  dispatch,
  onFullscreen,
}: {
  readonly position: Position;
  readonly total: number;
  readonly dispatch: Dispatch<HostEvent>;
  readonly onFullscreen: () => void;
}) {
  const fullscreen = useIsFullscreen();
  const { canPrev, canNext } = boundsOf(position, total);
  return (
    <div className="host-btns">
      <button type="button" className="btn px" aria-label="前へ" disabled={!canPrev} onClick={() => dispatch({ type: "prev" })}>
        ◀
      </button>
      {position !== "title" && (
        <button type="button" className="btn btn-go px" onClick={() => dispatch({ type: "reveal" })}>
          正解発表
        </button>
      )}
      <button type="button" className="btn px" aria-label="次へ" disabled={!canNext} onClick={() => dispatch({ type: "next" })}>
        ▶
      </button>
      <button type="button" className="btn btn-sq px" aria-label="全画面" aria-pressed={fullscreen} onClick={onFullscreen}>
        ⛶
      </button>
    </div>
  );
}

function Tag({ option }: { readonly option: RevealedOption }) {
  return (
    <div className="tag">
      {option.rank !== null && <b>{option.rank}位</b>}
      {option.name}
      <br />
      {option.price}
    </div>
  );
}

/** 点滅は CSS（reduced motion では止まる）。key={run} で作り直すと最初から点滅する */
function Stamp() {
  return (
    <div className="stamp" data-testid="stamp">
      正解！
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
