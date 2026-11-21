declare module "virtual:kakuzuke/public" {
  const set: import("./question-set/model").PublicQuestionSet;
  export default set;
  export const version: string;
}

/** サーバー環境でしか読み込めない。ほかの環境から import するとビルドエラーになる */
declare module "virtual:kakuzuke/answers" {
  const set: import("./question-set/model").QuestionSet;
  export default set;
  /** 正解込みの版。サーバーの外へ出さない */
  export const version: string;
}
