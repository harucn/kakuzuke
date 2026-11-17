# Tasks

各タスクは「実装 → 検証コマンドが通る → コミット」で閉じる。検証が通るまで次のタスクに進まない。テストの名前は spec の Scenario 名に合わせる。スクリプトの定義は design の Decisions 1 と 10 に従う（`pnpm e2e` は必ずビルドしてから流す）。

## 1. 雛形

- [x] 1.1 TanStack Start + Cloudflare Workers の雛形を pnpm で作る（`vite.config.ts` のプラグイン順は design の Context、`wrangler.jsonc` は `main: "@tanstack/react-start/server-entry"` と `assets.html_handling: "drop-trailing-slash"`、`prerender.enabled: true`）。`/` と `/host` に仮の文字だけのルートを置く。`package.json` に `test`（`vitest run --project unit`）・`build`・`e2e`（`pnpm build && playwright test`）・`deploy` を定義し、Vitest は `unit` と `build` の 2 プロジェクト（`passWithNoTests`）、Playwright は `webServer: vite preview`（`BASE_URL` があるときは使わない）にする。仮の E2E で `GET /host` が転送なしで 200 の HTML を返すことを確かめる。検証: `pnpm test && pnpm e2e && pnpm exec wrangler deploy --dry-run` が通り、`dist/client/index.html` と `dist/client/host/index.html` が存在する。design の Risks のうち `pages` の位置と `/host` の 200 を確定させ、結果を design.md に追記する

## 2. 問題データのドメインモデルと検証

- [x] 2.1 `src/question-set/model.ts` に型と `PUBLIC_*_KEYS`（design の Decisions 2）、`toPublic`、`answerOf`、`secretStrings` を実装する。`tests/unit/model.test.ts` に、question-set spec の「選択肢の順位」の正解判定 2 件と「参加者向けの公開形」3 件の Scenario、`toPublic` の各オブジェクトのキーが許可リストと完全一致すること、`secretStrings` が全選択肢の name と price・全問題の explanation を重複なく返すことを書く。検証: `pnpm test` が通る
- [x] 2.2 `src/question-set/parse.ts` に `parseQuestionSet` と `formatIssues` を実装する（IssueCode は design の Decisions 3。ラベルは並び順から決め、`image` は対応表で公開 URL に置き換える）。`tests/unit/parse.test.ts` に question-set spec の検証の Scenario（データ形式 6、選択肢の数とラベル 3、rank 2、写真の欠落 1、問題名と説明 3）を書く。検証: `pnpm test` が通る
- [x] 2.3 `src/deck/cursor.ts` に `move` / `boundsOf` / `positionText` を実装し、両端での据え置き・同一値の返却・範囲外 index の丸めを `tests/unit/cursor.test.ts` で確かめる。検証: `pnpm test` が通る

## 3. 問題コンパイラと正解の壁

- [x] 3.1 `src/question-set/vite-plugin.ts` に `kakuzukeQuestions()` と `loadQuestionSet()` を実装する（design の Decisions 4。dev では誤りを `load` で投げる）。`virtual:kakuzuke/*` の型宣言を置き、写真は `content/images/` から、指定されたものだけをハッシュ名で出力する（dev は対応表から配信）。`content/questions.yaml` に例の問題 3 問（pick 2 問・order 1 問、説明に価格を含めない）と、`content/images/` に仮の写真と、どこからも指定しない画像 1 枚を置く。検証: `pnpm build` が通り、`dist/client/images/` に指定した写真だけがハッシュ名で出力され、元のファイル名がどこにも現れない。`KAKUZUKE_CONTENT_DIR` で誤りを 3 種含むフィクスチャを指定して `pnpm dev` を起動し、`/` のエラーオーバーレイに 3 件すべてが出て、正しいフィクスチャに戻すと表示が回復する
- [ ] 3.2 `src/host/host-data.functions.ts`（`getHostQuestionSet`、handler 内で `virtual:kakuzuke/answers` を動的 import）と、`/` が `virtual:kakuzuke/public`、`/host` が loader の値を使う仮の画面を作る（`/host` は解説を表示しない。正解は埋め込みデータだけに入る状態にする）。`tests/build/plugin.test.ts`（design の Decisions 6 の 6）を書く。design の Risks のうち環境名・handler の除去・`host/index.html` への埋め込みを確定させ、結果を design.md に追記する。検証: `pnpm build` が通り、`plugin.test.ts` の 3 件が通る
- [ ] 3.3 `tests/leak.ts`（復号してから探す検出器と、その正規化の単体テスト）、参加者画面の `LEAK_CANARY`、`tests/build/leak.test.ts`（design の Decisions 6 の 1〜5）を書き、`package.json` の `build` を `vite build && vitest run --project build` にする。検証: `pnpm build` が通る。`/` に解説の文字列を一時的に描画すると `pnpm build` が本検査で失敗し、戻すと通る

## 4. 司会画面

- [ ] 4.1 `src/host/machine.ts`（`booting` と `restore` を含む `step`）、`src/host/reveal.ts`（`revealView`。pick・order とも rank 1 に正解の印）、`src/host/restore.ts`（`readStoredIndex`）を実装する。`tests/unit/` で、booting 中の操作の無視、移動で発表前に戻ること、reveal の `run` の加算と正解情報の不変、restore の丸め、`readStoredIndex` が整数でない値・負の値・空を null にすることを確かめる。検証: `pnpm test` が通る
- [ ] 4.2 `src/host/keymap.ts` に `HOST_KEYS`、`keyToHostEvent`、`installHostKeys` を実装する。6 キーの対応と、押しっぱなし・IME 変換中・修飾キー付きの無視を `tests/unit/keymap.test.ts` で確かめる。検証: `pnpm test` が通る
- [ ] 4.3 テーマ（`src/styles/`。モックの配色・DotGothic16・ドット枠、文字と背景の配色の組の一覧）と `src/ui/OptionCard.tsx` を作る。`tests/unit/theme.test.ts` で配色の組のコントラスト比がすべて 4.5:1 以上であることを確かめる。検証: `pnpm test && pnpm build` が通る
- [ ] 4.4 `src/host/HostScreen.tsx` の表示と移動を作る（16:9、問題番号・問題名・説明・選択肢、画面内の ◀・▶、`installHostKeys` の接続、次の問題の写真の先読み）。E2E のフィクスチャ `tests/fixtures/content/` を作り、host-screen spec の「問題の表示」「前後の問題への移動」「キーボード操作」の Scenario を `tests/e2e/host.spec.ts` に書く。検証: `pnpm e2e` が通る
- [ ] 4.5 正解発表を作る（正解発表ボタン、`revealView` の表示、`<Celebration key={run}>` と `<Stamp key={run}>`、reduced motion）。host-screen spec の「pick の正解発表」「order の正解発表」「正解発表の再演出」の Scenario を `tests/e2e/host.spec.ts` に足す。検証: `pnpm e2e` が通る
- [ ] 4.6 再読み込みの復元（`booting` の間は問題部分を描画しない）と全画面ボタンを作る。host-screen spec の「再読み込みで同じ問題に戻る」「全画面表示」の Scenario を `tests/e2e/host.spec.ts` に足す。検証: `pnpm e2e` が通る

## 5. 参加者画面

- [ ] 5.1 `src/guest/GuestScreen.tsx` を作る（`OptionCard` と `cursor` を共有、正解発表の操作なし、キー操作なし）。guest-screen spec の「問題の表示」「前後の問題への移動」「正解情報を表示しない」「スマホでの表示」の Scenario を `tests/e2e/guest.spec.ts` に書く。検証: `pnpm e2e` が通る

## 6. 実データでの統合確認

- [ ] 6.1 `tests/e2e/content.spec.ts`（design の Decisions 10 の表の最終行）を書く。実データの全問をボタンとキーそれぞれで最後まで進めて正解発表し、1920×1080 で溢れがないこと、司会画面で `/_serverFn/` へのリクエストが 0 件であること、参加者画面を進める間の応答に秘密文字列が 0 件で `/_serverFn/` へのリクエストも 0 件であることを確かめる。`BASE_URL` でデプロイ先にも向けられるようにする。検証: `pnpm e2e` が通る
- [ ] 6.2 `README.md` に問題と写真の追加手順（写真は `content/images/` に好きな名前で置いて `image` で指定すること、説明に価格を書かないこと）、`pnpm dev` / `pnpm test` / `pnpm build` / `pnpm e2e` / `pnpm run deploy`、司会画面と参加者画面の URL を書く。検証: README の手順どおりに例の問題を 1 問足して `pnpm e2e` が通る（確認後に戻す）
- [ ] 6.3 Cloudflare にデプロイし、デプロイ先へ実データの E2E を流す（初回の `wrangler login` はユーザーが行う）。検証: `pnpm run deploy` が成功し、`BASE_URL=<デプロイ先> pnpm exec playwright test tests/e2e/content.spec.ts` が通る

## Workflow follow-up

- 本番用の問題と写真を揃えたら差し替えて `pnpm e2e` を通し、デプロイする。写真に銘柄や価格が写り込んでいないか、EXIF に残っていないかを作者が確認する。
- 本番で使うプレゼン用リモコンで、デプロイ先の `/host` を操作し、前へ・次へ・正解発表がすべて操作できることと、送られるキーを確かめる。足りないキーがあれば別の変更でキー表に足す。
- 明るい部屋のプロジェクタとスマホ数台の実機で、両画面を最後まで進めて確認する（sharpen の Done Means）。
- verify.md を作り、PASS なら archive する。
