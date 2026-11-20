import { useState, useSyncExternalStore } from "react";
import { preload } from "react-dom";
import { boundsOf, move, type Position, type Step } from "../deck/cursor.ts";
import type { PublicQuestionSet } from "../question-set/model.ts";
import { OptionCard } from "../ui/OptionCard.tsx";
import { LEAK_CANARY } from "./leak-canary.ts";

const subscribeNothing = () => () => {};

/** 事前レンダリングの HTML と hydration 中は false。押しても動かないボタンを押せる見た目で出さないために使う */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

export function GuestScreen({ set }: { readonly set: PublicQuestionSet }) {
  const [position, setPosition] = useState<Position>("title");
  const hydrated = useHydrated();
  const { questions } = set;
  const upcoming = position === "title" ? 0 : position + 1;
  for (const option of questions[upcoming]?.options ?? []) preload(option.image, { as: "image" });

  const go = (step: Step) => {
    setPosition(move(position, step, questions.length));
    window.scrollTo(0, 0);
  };

  return (
    <main className="guest" aria-label="参加者画面" data-leak-canary={LEAK_CANARY}>
      {position === "title" ? (
        <>
          <div className="guest-cover">
            <h1 className="guest-cover__title">{set.title}</h1>
          </div>
          <nav className="guest-nav guest-nav--start" aria-label="問題の移動">
            <button type="button" className="btn btn-go px" disabled={!hydrated} onClick={() => go(1)}>
              はじめる<span aria-hidden="true"> ▶</span>
            </button>
          </nav>
        </>
      ) : (
        <QuestionView set={set} index={position} hydrated={hydrated} go={go} />
      )}
    </main>
  );
}

function QuestionView({
  set,
  index,
  hydrated,
  go,
}: {
  readonly set: PublicQuestionSet;
  readonly index: number;
  readonly hydrated: boolean;
  readonly go: (step: Step) => void;
}) {
  const { questions } = set;
  const question = questions[index];
  const { canPrev, canNext } = boundsOf(index, questions.length);
  return (
    <>
      <h1 className="guest-title">
        <small>STAGE {index + 1}</small>
        {question.title}
      </h1>
      <p className="guest-desc">{question.description}</p>
      <div className="guest-opts">
        {question.options.map((o, i) => (
          <OptionCard key={i} image={o.image} note={o.note} />
        ))}
      </div>
      <nav className="guest-nav" aria-label="問題の移動">
        <button type="button" className="btn px" disabled={!hydrated || !canPrev} onClick={() => go(-1)}>
          <span aria-hidden="true">◀ </span>前へ
        </button>
        <button type="button" className="btn px" disabled={!hydrated || !canNext} onClick={() => go(1)}>
          次へ<span aria-hidden="true"> ▶</span>
        </button>
      </nav>
    </>
  );
}
