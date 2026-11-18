# Proposal

## Why

今は司会画面も参加者画面も開くといきなり第 1 問が出る。開場から出題までの間、会のタイトルを映し、参加者が自分のスマホで参加者画面を開ける QR コードを見せる 1 枚が要る（sharpen.md の Request）。

## What Changes

- **BREAKING** `content/questions.yaml` の最上位に必須の `title`（会のタイトル）を足す。`title` のない既存の問題ファイルはビルドが失敗する。`title` は参加者にも見える公開項目で、銘柄・価格・解説の文字列を含めるとビルドが失敗する。
- 司会画面の最初に、第 1 問の前の 1 枚としてタイトル画面を置く。タイトルと参加者画面の QR コードを出す。▶・→・PageDown で第 1 問へ進み、第 1 問の ◀・←・PageUp で戻る。Space・Enter は何もしない。新しいタブとタイトル画面での再読み込みはタイトル画面を出す。
- 参加者画面の最初にもタイトル画面を置く。タイトルと「はじめる」ボタンだけを出し、押すと第 1 問へ進む。第 1 問の「前へ」で戻る。
- 範囲外: 遊び方の説明、司会画面と参加者画面の同期、タイトル画面の画像や背景の差し替え。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `question-set`: 問題セットが最上位に必須の `title` を持ち、公開形に入る。`title` にも銘柄・価格・解説を含めてはならない。
- `host-screen`: 新しいタブはタイトル画面から始まる。タイトル画面の表示内容（QR コードを含む）、タイトル ↔ 第 1 問の移動、タイトル画面でのキー操作と再読み込みを足す。
- `guest-screen`: 開いた直後はタイトル画面を出す。「はじめる」で第 1 問へ、第 1 問の「前へ」でタイトル画面へ移る。

## Impact

- コード: `src/question-set/`（型・検証・公開形）、`src/deck/cursor.ts`（タイトルを含む位置）、`src/host/`（状態機械・保存・画面）、`src/guest/GuestScreen.tsx`、`src/styles/theme.css`。
- データ: `content/questions.yaml` と `tests/fixtures/*/questions.yaml` に `title` を足す。README の書き方の例も直す。
- 依存の追加: QR コードの生成（`uqr`、実行時）、E2E での QR の復号（`jsqr`・`pngjs`、開発時のみ）。
- 完了の判定は sharpen.md の Done Means。
