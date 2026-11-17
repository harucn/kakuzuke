import path from "node:path";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { kakuzukeQuestions } from "../../src/question-set/vite-plugin";

const root = path.resolve(import.meta.dirname, "../fixtures/plugin");
const validContent = path.join(root, "content");
const brokenContent = path.resolve(import.meta.dirname, "../fixtures/broken");

/** プラグインだけを読み込んだクライアント環境のビルド。出力は書き出さない */
function buildClient(entry: string, contentDir = validContent) {
  return build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [kakuzukeQuestions({ contentDir })],
    build: { write: false, rolldownOptions: { input: path.join(root, entry) } },
  });
}

describe("問題コンパイラの壁", () => {
  beforeAll(async () => {
    // E2E のビルドが設定する環境変数がフィクスチャの指定を上書きしないようにする
    vi.stubEnv("KAKUZUKE_CONTENT_DIR", undefined);
    await expect(buildClient("public.js"), "公開形だけを読むクライアントはビルドできる").resolves.toBeDefined();
  });
  afterAll(() => vi.unstubAllEnvs());

  it("誤りを 3 種含む問題ファイルではビルドが全件を列挙して失敗する", async () => {
    const error = await buildClient("public.js", brokenContent).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    const lines = (error as Error).message.split("\n").map((line) => line.trim().replace(/\s+/g, " "));
    expect(lines).toEqual(
      expect.arrayContaining([
        "questions[0].explanation 空にはできません",
        "questions[0].options rank は 1〜3 を 1 回ずつ使ってください（1, 1, 2）",
        "questions[1].options[1].image 写真 ない.png が画像フォルダにありません",
      ]),
    );
  });

  it("クライアントから正解入りのモジュールを import するとビルドが失敗する", async () => {
    await expect(buildClient("answers.js")).rejects.toThrow("virtual:kakuzuke/answers はサーバー側でしか読み込めません");
  });

  it("クライアントから問題ファイルを直接 import するとビルドが失敗する", async () => {
    const message = "content/questions.yaml はサーバー側でしか読み込めません";
    await expect(buildClient("questions.js")).rejects.toThrow(message);
    await expect(buildClient("questions-raw.js")).rejects.toThrow(message);
  });
});
