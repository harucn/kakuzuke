# Tasks

各タスクは「実装 → 検証コマンドが通る → コミット」で閉じる。検証が通るまで次のタスクに進まない。テストの名前は spec の Scenario 名に合わせる。`pnpm test` も `pnpm e2e` も型検査をしないので、どのタスクの検証にも `pnpm exec tsc --noEmit` を入れる。

## 1. 問題セットにタイトルを足す

- [ ] 1.1 design の Decisions 1 のとおり `QuestionSet`・`PublicQuestionSet`・`HostQuestionSet` を `{ title, questions }` の形にし、`PUBLIC_SET_KEYS` と `toPublic` のタイトルの射影を足す。`parseQuestionSet` に必須の `title` と、タイトルへの `public-text-leak` 検査を足す。呼び出し側（vite-plugin・`virtual-kakuzuke.d.ts`・`host-data.functions.ts`・両画面・テスト・`tests/fixtures/{content,broken,plugin}`・`content/questions.yaml`・README の例と箇条書き）を同じコミットで移す。画面の振る舞いはまだ変えない（両画面とも第 1 問から始まる）。`tests/unit/parse.test.ts` に question-set spec の「タイトルがない」「タイトルが空」「タイトルに銘柄を含む」の Scenario、`tests/unit/model.test.ts` と `tests/build/leak.test.ts` に公開形の最上位のキーが `PUBLIC_SET_KEYS` と完全一致することと、公開形がタイトルを保つことを書く。検証: `pnpm exec tsc --noEmit && pnpm test && pnpm e2e` が通る（既存の E2E が変更なしで通ることで、移行が振る舞いを変えていないと確かめる）

## 2. 参加者画面のタイトル画面

- [ ] 2.1 design の Decisions 2 のとおり `src/deck/cursor.ts` の位置を `"title" | number` にし、`tests/unit/cursor.test.ts` でタイトル ↔ 第 1 問の移動、最終問での据え置き、タイトルの `boundsOf` を確かめる。参加者画面（Decisions 5）をタイトル画面から始め、`tests/e2e/guest.spec.ts` を guest-screen spec の Scenario（タイトル画面 4 件、問題画面の表示 2 件、前後の画面への移動 4 件）に合わせて直す。司会画面は `cursor` の新しい型に合わせるだけで、まだ第 1 問から始まる。検証: `pnpm exec tsc --noEmit && pnpm test && pnpm e2e` が通る

## 3. 司会画面のタイトル画面

- [ ] 3.1 `uqr` を dependencies、`jsqr`・`pngjs`・`@types/pngjs` を devDependencies に固定版で足す。検証: `pnpm install --frozen-lockfile` が通り、`node -e` で `uqr` の `encode` が行列を返す
- [ ] 3.2 design の Decisions 3 のとおり `src/host/machine.ts` に `title` の状態、`src/host/restore.ts` にタイトル画面での保存キーの削除を足す。`tests/unit/machine.test.ts` に「保存なしの restore でタイトル画面」「タイトル ↔ 第 1 問」「タイトル画面の reveal は同じオブジェクトを返す」、`tests/unit/restore.test.ts` に削除と、削除後の読み戻しが null になることを書く。司会画面にタイトル画面（Decisions 4。タイトル・「全 N 問」・URL・QR・◀（無効）・▶・全画面）を描き、テーマのトークンと cqw で 16:9 に配置する。新しい文字色と背景の組があれば `TEXT_PAIRS` に足す。`tests/e2e/host.spec.ts` を host-screen spec の Scenario（タイトル画面 2 件、問題画面の表示 2 件、前後の画面への移動 7 件、再読み込み 4 件、キーボード操作 11 件）に合わせて直し、QR は要素のスクリーンショットを復号して確かめる（Decisions 6）。検証: `pnpm exec tsc --noEmit && pnpm test && pnpm e2e` が通る

## 4. 実データでの通し確認と文書

- [ ] 4.1 `tests/e2e/content.spec.ts` の司会画面の通しをタイトル画面から始め、1920×1080 でタイトル画面が枠と表示領域に収まりスクロールしないこと（host-screen spec「1920×1080 の表示でタイトル画面が 1 画面に収まる」）を足す。参加者画面の通しもタイトル画面から始める。`tests/e2e/smoke.spec.ts` の写真の確認を、問題データの公開 URL を直接取得する形に変える（design の Risks）。README の操作の表と本番前の確認にタイトル画面と QR の読み取りを足す。検証: `pnpm exec tsc --noEmit && pnpm test && pnpm e2e && openspec validate first-view` が通る。`/host` を 1920×1080、`/` を 360×740 でスクリーンショットして目で確かめる

## Workflow follow-up

- verify.md を書き、PASS ならアーカイブする。
- 会場のプロジェクタに映した QR を参加者のスマホで読み取れることを、本番前に実機で確かめる。
