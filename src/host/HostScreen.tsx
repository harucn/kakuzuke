import { useEffect, useReducer, type Dispatch } from "react";
import { preload } from "react-dom";
import { boundsOf, positionText } from "../deck/cursor.ts";
import type { Question } from "../question-set/model.ts";
import { OptionCard } from "../ui/OptionCard.tsx";
import { installHostKeys } from "./keymap.ts";
import { initialHostState, step, type HostEvent, type HostState } from "./machine.ts";
import { revealView } from "./reveal.ts";

/** /host の loader の値。ブランドは createServerFn の直列化を通らないので持たない（design の Risks 確定（3.2）） */
export type HostQuestionSet = readonly [Question, ...Question[]];

type ShownState = Exclude<HostState, { readonly phase: "booting" }>;

export function HostScreen({ set }: { readonly set: HostQuestionSet }) {
  const [state, dispatch] = useReducer((s: HostState, e: HostEvent) => step(s, e, set.length), initialHostState);
  useEffect(() => installHostKeys(window, dispatch), []);
  useEffect(() => dispatch({ type: "restore", index: null }), []);

  return (
    <main className="host-stage" aria-label="司会画面">
      <div className="host px">{state.phase !== "booting" && <Stage set={set} state={state} dispatch={dispatch} />}</div>
    </main>
  );
}

function Stage({
  set,
  state,
  dispatch,
}: {
  readonly set: HostQuestionSet;
  readonly state: ShownState;
  readonly dispatch: Dispatch<HostEvent>;
}) {
  const { index } = state;
  const question = set[index];
  const { canPrev, canNext } = boundsOf(index, set.length);
  for (const option of set[index + 1]?.options ?? []) preload(option.image, { as: "image" });

  const revealed = state.phase === "revealed" ? revealView(question) : null;
  const message =
    revealed === null
      ? { who: "Q.", text: question.description }
      : { who: revealed.headline, text: revealed.explanation };

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
        {question.options.map((o) => (
          <OptionCard key={o.label} size="host" label={o.label} image={o.image} />
        ))}
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
          <button type="button" className="btn btn-go px" disabled>
            正解発表
          </button>
          <button type="button" className="btn px" aria-label="次へ" disabled={!canNext} onClick={() => dispatch({ type: "next" })}>
            ▶
          </button>
        </div>
      </div>
    </>
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
