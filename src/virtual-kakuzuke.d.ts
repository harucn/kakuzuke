declare module "virtual:kakuzuke/public" {
  const set: import("./question-set/model").PublicQuestionSet;
  export default set;
}

/** サーバー環境でしか読み込めない。ほかの環境から import するとビルドエラーになる */
declare module "virtual:kakuzuke/answers" {
  const set: import("./question-set/model").QuestionSet;
  export default set;
}
