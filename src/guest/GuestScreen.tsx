import { useEffect } from "react";
import { preload } from "react-dom";
import type { PublicQuestionSet } from "../question-set/model.ts";
import { CardSlot, useCardTurn } from "../ui/CardSlot.tsx";
import { Celebration } from "../ui/Celebration.tsx";
import { OptionCard } from "../ui/OptionCard.tsx";
import { RevealedCard } from "../ui/RevealedCard.tsx";
import type { VenueView } from "../venue/protocol.ts";
import { useVenue } from "../venue/useVenue.ts";
import { LEAK_CANARY } from "./leak-canary.ts";

type QuestionPhase = Exclude<VenueView, { readonly phase: "title" }>;

export function GuestScreen({ set }: { readonly set: PublicQuestionSet }) {
  const { view, connection, celebration } = useVenue("guest");
  // 届いた問題番号が手元の問題セットにないときもタイトル画面にする
  const shown: QuestionPhase | null = view !== null && view.phase !== "title" && set.questions[view.index] !== undefined ? view : null;
  const index = shown?.index ?? null;
  const upcoming = index === null ? 0 : index + 1;
  for (const option of set.questions[upcoming]?.options ?? []) preload(option.image, { as: "image" });

  // 正解発表では写真の位置を動かさないよう、問題が変わったときだけ戻す。scrollTo は Promise を返すブラウザがあるので、片付け関数と取り違えないよう値を返さない
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [index]);

  return (
    <main className="guest" aria-label="参加者画面" data-leak-canary={LEAK_CANARY}>
      <p role="status" className="venue-status">
        {connection === "lost" ? "再接続中" : null}
      </p>
      {shown === null ? (
        <div className="guest-cover">
          <h1 className="guest-cover__title">{set.title}</h1>
        </div>
      ) : (
        <QuestionView key={shown.index} set={set} view={shown} celebration={celebration} />
      )}
    </main>
  );
}

function QuestionView({
  set,
  view,
  celebration,
}: {
  readonly set: PublicQuestionSet;
  readonly view: QuestionPhase;
  readonly celebration: string | null;
}) {
  const { index } = view;
  const question = set.questions[index];
  const reveal = view.phase === "revealed" ? view.reveal : null;
  const { turning, onTurned } = useCardTurn(reveal !== null);
  const last = question.options.length - 1;
  return (
    <>
      <h1 className="guest-title">
        <small>STAGE {index + 1}</small>
        {question.title}
      </h1>
      <p className="guest-desc">{question.description}</p>
      <div className="guest-opts">
        {question.options.map((o, i) => (
          <CardSlot key={i} face={reveal === null ? "asking" : "revealed"} order={i} onTurned={i === last ? onTurned : undefined}>
            {reveal === null ? (
              <OptionCard image={o.image} note={o.note} />
            ) : (
              <RevealedCard size="guest" option={o} revealed={reveal.options[i]} mode={question.mode} celebration={celebration} />
            )}
          </CardSlot>
        ))}
      </div>
      {reveal !== null && !turning && (
        <div className="guest-reveal px">
          <p className="guest-reveal__headline">{reveal.headline}！</p>
          <p className="guest-reveal__text">{reveal.explanation}</p>
        </div>
      )}
      {celebration !== null && !turning && <Celebration key={celebration} />}
    </>
  );
}
