# Sharpen

## Request

> ファーストビュー作っておきたいな。進行、回答者の両方

対話で確定した前提（ユーザー回答の要約）:

- 司会画面のファーストビューには、タイトルと参加者画面の QR コードを出す。
- タイトル文言は `content/questions.yaml` に書く。
- 参加者画面のファーストビューはタイトルだけにし、遊び方の説明は出さない。自動では先へ進まない。

## Sharpened

司会画面（`/host`）と参加者画面（`/`）の最初に、第 1 問の前の 1 枚としてタイトル画面を置く。

- **問題データ**: `questions.yaml` の最上位に必須の `title`（会のタイトル、例 `2026 忘年会 格付けチェック`）を足す。参加者にも見える公開項目で、銘柄・価格・解説の文字列を含めるとビルドが失敗する（問題名・説明と同じ扱い）。
- **司会画面のタイトル画面**: タイトルと参加者画面の QR コードを 16:9 の 1 画面に出す。QR の URL は開いているページの origin から作るので、本番とプレビューのどちらでも正しい先を指す。
  - ▶・→・PageDown で第 1 問へ進む。◀ は無効。Space・Enter は何もしない（リモコンの連打で第 1 問の正解発表まで進まないようにする）。
  - 第 1 問の ◀・←・PageUp でタイトル画面に戻る。遅れて来た人に QR を見せ直せる。
  - 新しいタブではタイトル画面を出す。タイトル画面で再読み込みするとタイトル画面のまま、第 n 問で再読み込みすると第 n 問に戻る。
- **参加者画面のタイトル画面**: タイトルと「はじめる」ボタンだけを出す。押すと第 1 問へ進む。第 1 問の「前へ」でタイトル画面に戻る。
- **範囲外**: 遊び方の説明、司会画面と参加者画面の同期、タイトル画面の画像や背景の差し替え。

## Current System

- 問題セットは問題の配列で、セット単位の項目を持たない。`QuestionSet` は `readonly [Question, ...Question[]]` のブランド型（`src/question-set/model.ts:31`）、公開形 `PublicQuestionSet` も配列（`src/question-set/model.ts:37`）、`toPublic` は問題ごとに許可リストで射影する（`src/question-set/model.ts:68`）。
- `parseQuestionSet` のスキーマは最上位に `questions` だけを持つ（`src/question-set/parse.ts:31`）。銘柄・価格・解説が問題名・説明に入っていないかは `public-text-leak` で検査する。
- 仮想モジュール `virtual:kakuzuke/public` が公開形を、`virtual:kakuzuke/answers` がサーバー側だけで全データを出す（`src/question-set/vite-plugin.ts:131`）。司会画面は loader（`src/routes/host.tsx:6`）で全データを受け取る。
- 司会画面の状態は `booting | asking | revealed`（`src/host/machine.ts:3`）。`restore` の `null` は「保存なし、第 1 問から」（`src/host/machine.ts:13`）。位置は sessionStorage の `kakuzuke:host:index` に整数で保存する（`src/host/restore.ts:3`）。`booting` の間は問題部分を描画しない（`src/host/HostScreen.tsx:33`）。
- 参加者画面は `useState(0)` の添字だけで進む（`src/guest/GuestScreen.tsx:20`）。前後の範囲は `boundsOf`・`move`（`src/deck/cursor.ts`）で決める。
- E2E は「開いた直後は第 1 問」を前提にしている（`tests/e2e/host.spec.ts:74`、`tests/e2e/guest.spec.ts:65`、`tests/e2e/content.spec.ts:110`）。

## Done Means

- 単体テストで、`title` の欠落・空・銘柄などの混入がビルドエラーになり、公開形に `title` が入ることを確かめる。
- 単体テストで、司会画面の状態機械がタイトル ↔ 第 1 問を行き来し、タイトルでの正解発表を無視し、再読み込みでタイトルと第 n 問をそれぞれ復元することを確かめる。
- E2E で、両画面が新しいタブでタイトル画面を出し、そこから最終問まで進めて戻れることを確かめる。司会画面の QR を復号すると参加者画面の URL になり、1920×1080 に収まることを確かめる。
- `pnpm test` と `pnpm e2e` が通り、漏洩走査（`pnpm build`）が通る。
