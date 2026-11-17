import type { ImageUrl, Question, QuestionSet } from "../../src/question-set/model";

/** テスト専用。本番では parseQuestionSet だけが ImageUrl と QuestionSet を作る */
export function imageUrl(url: string): ImageUrl {
  return url as ImageUrl;
}

export function questionSet(...questions: readonly [Question, ...Question[]]): QuestionSet {
  return questions as QuestionSet;
}
