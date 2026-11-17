import { useEffect, useReducer, useRef, type Dispatch } from "react";
import { preload } from "react-dom";
import { boundsOf, positionText } from "../deck/cursor.ts";
import type { Question } from "../question-set/model.ts";
import { OptionCard } from "../ui/OptionCard.tsx";
import { Celebration } from "./Celebration.tsx";
import { toggleFullscreen, useIsFullscreen } from "./fullscreen.ts";
import { installHostKeys } from "./keymap.ts";
import { initialHostState, step, type HostEvent, type HostState } from "./machine.ts";
import { loadIndex, saveIndex } from "./restore.ts";
import { revealView, type RevealedOption } from "./reveal.ts";

/** /host の loader の値。ブランドは createServerFn の直列化を通らないので持たない（design の Risks 確定（3.2）） */
export type HostQuestionSet = readonly [Question, ...Question[]];

type ShownState = Exclude<HostState, { readonly phase: "booting" }>;

export function HostScreen({ set }: { readonly set: HostQuestionSet }) {
  const [state, dispatch] = useReducer((s: HostState, e: HostEvent) => step(s, e, set.length), initialHostState);
  useEffect(() => installHostKeys(window, dispatch), []);
  useEffect(() => dispatch({ type: "restore", index: loadIndex(set.length) }), [set.length]);
  const index = state.phase === "booting" ? null : state.index;
  useEffect(() => {
    if (index !== null) saveIndex(index);
  }, [index]);
  // 全画面にするのは枠ではなくページ全体。枠の 16:9 の寸法計算をそのまま使えて、画面の比が 16:9 でなくても崩れない
  const stage = useRef<HTMLElement>(null);
  const onFullscreen = () => void toggleFullscreen(stage.current!);

  return (
    <main ref={stage} className="host-stage" aria-label="司会画面">
      <div className="host px">
        {state.phase !== "booting" && <Stage set={set} state={state} dispatch={dispatch} onFullscreen={onFullscreen} />}
      </div>
    </main>
  );
}

function Stage({
  set,
  state,
  dispatch,
  onFullscreen,
}: {
  readonly set: HostQuestionSet;
  readonly state: ShownState;
  readonly dispatch: Dispatch<HostEvent>;
  readonly onFullscreen: () => void;
}) {
  const fullscreen = useIsFullscreen();
  const { index } = state;
  const question = set[index];
  const { canPrev, canNext } = boundsOf(index, set.length);
  for (const option of set[index + 1]?.options ?? []) preload(option.image, { as: "image" });

  const revealed = state.phase === "revealed" ? { view: revealView(question), run: state.run } : null;
  const message =
    revealed === null
      ? { who: "Q.", text: question.description }
      : { who: `${revealed.view.headline}！`, text: revealed.view.explanation };

  return (
    <>
      <div className="host-bar">
        <span>STAGE {positionText(index, set.length)}</span>
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
        <div className="host-btns">
          <button type="button" className="btn px" aria-label="前へ" disabled={!canPrev} onClick={() => dispatch({ type: "prev" })}>
            ◀
          </button>
          <button type="button" className="btn btn-go px" onClick={() => dispatch({ type: "reveal" })}>
            正解発表
          </button>
          <button type="button" className="btn px" aria-label="次へ" disabled={!canNext} onClick={() => dispatch({ type: "next" })}>
            ▶
          </button>
          <button type="button" className="btn btn-sq px" aria-label="全画面" aria-pressed={fullscreen} onClick={onFullscreen}>
            ⛶
          </button>
        </div>
      </div>
      {revealed !== null && <Celebration key={revealed.run} />}
    </>
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
