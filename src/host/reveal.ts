import { answerOf, type Label, type Question, type Rank } from "../question-set/model.ts";

export interface RevealedOption {
  readonly label: Label;
  readonly name: string;
  readonly price: string;
  /** order だけ表示する。pick では null */
  readonly rank: Rank | null;
  readonly correct: boolean;
}

export interface RevealView {
  readonly headline: string;
  readonly explanation: string;
  /** 表示順 */
  readonly options: readonly RevealedOption[];
}

export function revealView(q: Question): RevealView {
  const answer = answerOf(q);
  const order = answer.mode === "pick" ? [answer.winner] : answer.sequence;
  return {
    headline: `正解は ${order.join(" → ")}`,
    explanation: q.explanation,
    options: q.options.map((o) => ({
      label: o.label,
      name: o.name,
      price: o.price,
      rank: answer.mode === "order" ? o.rank : null,
      correct: o.label === order[0],
    })),
  };
}
