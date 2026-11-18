import { useState, useSyncExternalStore } from "react";
import { preload } from "react-dom";
import { boundsOf, move, positionText, type Step } from "../deck/cursor.ts";
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
  const [index, setIndex] = useState(0);
  const hydrated = useHydrated();
  const { questions } = set;
  const question = questions[index];
  const { canPrev, canNext } = boundsOf(index, questions.length);
  for (const option of questions[index + 1]?.options ?? []) preload(option.image, { as: "image" });

  const go = (step: Step) => {
    setIndex(move(index, step, questions.length));
    window.scrollTo(0, 0);
  };

  return (
    <main className="guest" aria-label="参加者画面" data-leak-canary={LEAK_CANARY}>
      <div className="guest-bar">
        <span>STAGE {positionText(index, questions.length)}</span>
        <span>KAKUZUKE</span>
      </div>
      <h1 className="guest-title">
        <small>STAGE {index + 1}</small>
        {question.title}
      </h1>
      <p className="guest-desc">{question.description}</p>
      <div className="guest-opts">
        {question.options.map((o) => (
          <OptionCard key={o.label} label={o.label} image={o.image} />
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
    </main>
  );
}
