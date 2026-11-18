import { createServerFn } from "@tanstack/react-start";
import type { HostQuestionSet } from "../question-set/model.ts";

/**
 * 正解入りの問題を返す唯一の経路。answers はサーバー環境でしか読めないので、handler の中で動的に import する。
 * QuestionSet のブランドは直列化の型検査を通らないので、ブランドのない形に広げて返す
 */
export const getHostQuestionSet = createServerFn({ method: "GET" }).handler(
  async (): Promise<HostQuestionSet> => (await import("virtual:kakuzuke/answers")).default,
);
