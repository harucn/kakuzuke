import { createServerFn } from "@tanstack/react-start";
import type { Question } from "../question-set/model.ts";

/**
 * 正解入りの問題を返す唯一の経路。answers はサーバー環境でしか読めないので、handler の中で動的に import する。
 * QuestionSet のブランドは直列化の型検査を通らないので、ブランドのないタプルに広げて返す
 */
export const getHostQuestionSet = createServerFn({ method: "GET" }).handler(
  async (): Promise<readonly [Question, ...Question[]]> => (await import("virtual:kakuzuke/answers")).default,
);
