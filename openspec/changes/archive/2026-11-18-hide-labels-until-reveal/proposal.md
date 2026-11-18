# Proposal

## Why

写真を見れば商品が分かるので、どの写真が A・B・C かが分かると答えが分かってしまう。今は司会画面の発表前も参加者画面も写真にラベルを付けて出し、表示順もラベル順なので、正解発表までラベルと写真の対応を伏せられない。また、発表前に選択肢ごとの手がかりを見せる項目がない（sharpen.md の Sharpened）。

## What Changes

- **BREAKING** `content/questions.yaml` の各選択肢に必須の `label`（A・B・C）と `note`（選択肢の説明）を足す。選択肢は表示順に書き、ラベルは書いた順と無関係に作者が付ける。ラベルは A から選択肢数番目までを 1 回ずつ使う。`note` は参加者に見える公開項目で、銘柄・価格・解説の文字列を含めるとビルドが失敗する。
- 司会画面の発表前は、写真と選択肢の説明を表示順に出し、ラベルを出さない。発表後は同じ位置のカードにラベルを出し、正解の印・銘柄・価格・順位・解説を今まで通り出す。
- 参加者画面は写真と選択肢の説明を表示順に出し、ラベルを出さない。参加者に届くデータからラベルを外す。
- 範囲外: 銘柄名を発表前に見せること、表示順の自動並べ替え、司会画面と参加者画面の同期。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `question-set`: 選択肢が `label` と `note` を持つ。ラベルは作者が書き、表示順と独立する。`note` も正解情報を含めない検査の対象になる。公開形の選択肢は `image` と `note` だけになる。
- `host-screen`: 発表前の問題画面はラベルを出さず選択肢の説明を出す。発表後は各カードにラベルを出す。
- `guest-screen`: ラベルを正解情報として扱い、表示せず、届くデータにも含めない。問題画面は写真と選択肢の説明を出す。

## Impact

- コード: `src/question-set/`（型・検証・公開形）、`src/ui/OptionCard.tsx`、`src/host/HostScreen.tsx`・`reveal.ts`、`src/guest/GuestScreen.tsx`、`src/styles/theme.css`。
- データ: `content/questions.yaml` と `tests/fixtures/*/questions.yaml` に `label` と `note` を足す。README の書き方の例を直す。
- 完了の判定は sharpen.md の Done Means。単体テスト（検証・公開形）、ビルドの漏洩検査（公開データの構造）、E2E（発表前の DOM にラベルがない・発表後に正しいラベル・画面に収まる）で確かめる。
