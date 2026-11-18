# Tasks

各タスクは「実装 → 検証コマンドが通る → コミット」で閉じる。検証が通るまで次のタスクに進まない。テストの名前は spec の Scenario 名に合わせる。`pnpm test` も `pnpm e2e` も型検査をしないので、どのタスクの検証にも `pnpm exec tsc --noEmit` を入れる。

## 1. 問題データに label と note を足す

画面はまだ今のまま（どの画面もラベルの帯を出す）。ラベルが YAML から来るようになっても、E2E はラベルで選択肢を引くので通る。

- [ ] 1.1 design の Decisions 1 のとおり `Option` に `label`（作者が書く）と `note` を足す。`parseQuestionSet` に `label`・`note` のスキーマと形のエラー文、`label-permutation` 規則、`note` への `public-text-leak` 検査、写真のファイル名を探す文字列に足すことを入れる。`toQuestionSet` は書いた順のまま YAML の `label` を使う。同じコミットで次を移す。
  - データ: `content/questions.yaml`（書いた順に A・B・C）、`tests/fixtures/{content,broken,plugin}`。`tests/fixtures/content` は pick の第 1 問を B・A、order の第 2 問を C・A・B の順に書き直し、解説の文のラベルも合わせる。`tests/fixtures/broken` は期待する 3 件（rank 重複・写真欠落・空の解説）以外のエラーが出ないよう `label`・`note` を足す。
  - テスト: `tests/unit/fixtures.ts`、型付きの `Option` を直書きしている `tests/unit/model.test.ts:23-47`・`tests/unit/reveal.test.ts:13-26`、`tests/unit/parse.test.ts` の正常系の入力。`parse.test.ts:146`「ラベルは並び順に A・B・C が付く」は「ラベルは書いた値になり表示順は書いた順になる」に置き換える。
  - README: 書き方の例と項目の説明（`label`・`note`）。
  - 新しい単体テスト（`tests/unit/parse.test.ts`）: question-set spec の「選択肢の説明がない」「選択肢の説明が空」「ラベルがない」「A・B・C 以外のラベル」「ラベルが重複する」「選択肢数を超えるラベル」「選択肢の説明に銘柄を含む」「選択肢の説明に写真のファイル名を含む」。
  - 検証: `pnpm exec tsc --noEmit && pnpm test && pnpm e2e && pnpm build` が通る（E2E の変更は fixture の並びに合わせた期待値だけ）

## 2. 発表前の画面からラベルを外す

公開形から `label` を外すと参加者画面が同時に壊れるので、公開形・部品・両画面・E2E を 1 つの単位で移す。

- [ ] 2.1 公開形と部品を変える。`PublicOption` を `{ image, note }`、`PUBLIC_OPTION_KEYS` を `["image", "note"]` にする。design の Decisions 2・3 のとおり `OptionCard` のラベルを任意にして写真に重ね、2 行目を `.option-note` にし、`alt` を空にする。参加者画面と司会画面の発表前はラベルを渡さず、発表後だけ渡す。`key` は表示順の添字。説明の文字色の組を `TEXT_PAIRS` に足す。
  - 単体・ビルドのテスト: `tests/unit/model.test.ts` に「公開形はラベルを含まない」と、表示項目（写真・選択肢の説明）を表示順で保つこと。`tests/build/leak.test.ts:149` に `not.toHaveProperty("label")` を足し、公開データの選択肢が `note` を持つことを確かめる。
  - E2E の移行: `data-label`・`選択肢 `・`labelBar` を参照する箇所を `rg` で全件洗い出して直す。写真は表示順の添字で引き、ラベルは発表後だけ `data-label` で引く。少なくとも次を含む。
    - `guest.spec.ts:17-18`・`:24`・`:48-52`・`:112-114`・`:185-190`
    - `host.spec.ts:41-44`・`:62-65`（`expectAsking` に design の Decisions 2 の「ラベルがない」構造検査を足す）・`:71`
    - `content.spec.ts:31`・`:38-40`・`:80`・`:96`・`:111-115`
  - 新しい E2E: guest-screen spec の「どの問題でもラベルが表示されない」「参加者に届くデータの選択肢はラベルを持たない」。host-screen spec の「正解発表前はラベルを表示しない」「正解発表後に移動して戻るとラベルを表示しない」「pick／order の正解発表で各選択肢にラベルを表示する」「pick の正解発表で選択肢の位置は変わらない」（写真の bounding box を発表前後で比べる）。問題画面の表示・スマホ表示・再演出の「正解情報は変わらない」を写真と選択肢の説明・ラベルで書き直す。
  - 検証: `pnpm exec tsc --noEmit && pnpm test && pnpm e2e && pnpm build` が通る

## 3. 画面に収まることを確かめる

- [ ] 3.1 `content.spec.ts` に host-screen spec の「1920×1080 の表示で正解発表前の全要素が 1 画面に収まる」と、design の Decisions 3 の「写真の高さがカードの高さの半分以上」を本番の問題データの全問について足す。検証: `pnpm exec tsc --noEmit && pnpm test && pnpm e2e` が通る

## 4. 文書

- [ ] 4.1 README の本番前の確認に、「ラベルはくじで決め、ラベル順と同じ並びになっても直さない」「YAML のラベルと会場で配る実物のラベルを照合する」「解説の文のラベルと YAML のラベルを照合する」「選択肢の説明に銘柄の一部を書かない」を足す。検証: `pnpm exec tsc --noEmit && pnpm test && pnpm e2e && pnpm build && openspec validate hide-labels-until-reveal` が通る

## Workflow follow-up

- verify.md を書き、PASS ならアーカイブする。
- `/host` を 1920×1080（発表前・発表後）、`/` を 360×740 でスクリーンショットして目で確かめる。
- 本番の `content/questions.yaml` のラベルをくじで決め直し、解説の文を合わせる（作者の作業）。
- 本番前のリハーサルで、YAML のラベルと会場で配る実物のラベルが一致することを確かめる。
