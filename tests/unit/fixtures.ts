import type { ImageUrl, Question, QuestionSet } from "../../src/question-set/model";

/** テスト専用。本番では ImageUrl は問題コンパイラ、QuestionSet は parseQuestionSet だけが作る */
export function imageUrl(url: string): ImageUrl {
  return url as ImageUrl;
}

export function questionSet(title: string, ...questions: readonly [Question, ...Question[]]): QuestionSet {
  return { title, questions } as QuestionSet;
}
