# Tasks

各タスクは「実装 → 検証コマンドが通る → コミット」で閉じる。検証が通るまで次のタスクに進まない。テストの名前は spec の Scenario 名に合わせる。`pnpm test` も `pnpm e2e` も型検査をしないので、どのタスクの検証にも `pnpm exec tsc --noEmit` を入れる。

## 1. 問題セットにタイトルを足す

- [x] 1.1 design の Decisions 1 のとおり `QuestionSet`・`PublicQuestionSet`・`HostQuestionSet` を `{ title, questions }` の形にし、`PUBLIC_SET_KEYS` と `toPublic` のタイトルの射影を足す。`parseQuestionSet` に必須の `title` と、タイトルへの `public-text-leak` 検査を足す。呼び出し側（vite-plugin・`virtual-kakuzuke.d.ts`・`host-data.functions.ts`・両画面・テスト・`tests/fixtures/{content,broken,plugin}`・`content/questions.yaml`・README の例と箇条書き）を同じコミットで移す。画面の振る舞いはまだ変えない（両画面とも第 1 問から始まる）。`tests/unit/parse.test.ts` に question-set spec の「タイトルがない」「タイトルが空」「タイトルに銘柄を含む」の Scenario、`tests/unit/model.test.ts` と `tests/build/leak.test.ts` に公開形の最上位のキーが `PUBLIC_SET_KEYS` と完全一致することと、公開形がタイトルを保つことを書く。検証: `pnpm exec tsc --noEmit && pnpm test && pnpm e2e` が通る（既存の E2E が変更なしで通ることで、移行が振る舞いを変えていないと確かめる）

## 2. タイトル画面を位置に入れる

`cursor.move` がタイトル画面を返すようになると、司会画面の状態機械と両画面が同時に変わる。司会画面だけ第 1 問から始める中間状態は作らず、両画面を 1 つの単位で移す。

- [x] 2.1 design の Decisions 2・3・5 のとおり、`src/deck/cursor.ts` の位置を `"title" | number` にし、`src/host/machine.ts` に `title` の状態、`src/host/restore.ts` にタイトル画面での保存キーの削除を足す。単体テスト: `cursor.test.ts` でタイトル ↔ 第 1 問の移動・最終問での据え置き・タイトルの `boundsOf`、`machine.test.ts` で「保存なしの restore でタイトル画面」「タイトル ↔ 第 1 問」「タイトル画面の reveal は同じオブジェクトを返す」、`restore.test.ts` で削除と削除後の読み戻しが null になること。参加者画面はタイトル画面（タイトル・「全 N 問」・「はじめる」）から始め、司会画面はタイトル画面（タイトル・「全 N 問」・◀（無効）・▶・全画面。QR はまだ出さない）から始める。E2E: `guest.spec.ts` を guest-screen spec の Scenario（タイトル画面 4 件、問題画面の表示 2 件、前後の画面への移動 4 件）、`host.spec.ts` を host-screen spec の Scenario（新しいタブでタイトル画面、問題画面の表示 2 件、前後の画面への移動 7 件、再読み込み 4 件、キーボード操作 11 件）に合わせて直し、`content.spec.ts` の両画面の通しをタイトル画面から始め、`smoke.spec.ts` の写真の確認を問題データの公開 URL を直接取得する形に変える（参加者画面の HTML に `<img>` がなくなるため。design の Risks）。検証: `pnpm exec tsc --noEmit && pnpm test && pnpm e2e` が通る

## 3. 司会画面の QR コード

- [ ] 3.1 `uqr` を dependencies、`jsqr`・`pngjs`・`@types/pngjs` を devDependencies に固定版で足す。検証: `pnpm install --frozen-lockfile` が通り、`node -e` で `uqr` の `encode` が行列を返す
- [ ] 3.2 design の Decisions 4 のとおり司会画面のタイトル画面に参加者画面の URL と QR コードを足し、テーマのトークンと cqw で 16:9 に配置する。新しい文字色と背景の組があれば `TEXT_PAIRS` に足す。`host.spec.ts` に「QR コードを読み取ると参加者画面の URL になる」（要素のスクリーンショットを復号する。Decisions 6）、`content.spec.ts` に「1920×1080 の表示でタイトル画面が 1 画面に収まる」を足す。検証: `pnpm exec tsc --noEmit && pnpm test && pnpm e2e` が通る

## 4. 文書と見た目の確認

- [ ] 4.1 README の操作の表と本番前の確認に、タイトル画面と QR の読み取りを足す。`/host` を 1920×1080、`/` を 360×740 でスクリーンショットして目で確かめる。検証: `pnpm exec tsc --noEmit && pnpm test && pnpm e2e && openspec validate first-view` が通る

## Workflow follow-up

- verify.md を書き、PASS ならアーカイブする。
- 会場のプロジェクタに映した QR を参加者のスマホで読み取れることを、本番前に実機で確かめる。
