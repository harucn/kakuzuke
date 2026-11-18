# Design

## Context

動機と範囲は proposal.md、振る舞いは specs/ を参照。設計を決める現状（sharpen.md の Current System）は次の 5 点。

- ラベルは `toQuestionSet` が書いた順から作る。表示順とラベル順は同じ配列の同じ順で、分ける場所がない。
- 公開形の選択肢は `{ label, image }`。許可リスト（`PUBLIC_OPTION_KEYS`）で 1 項目ずつ写すので、項目を外せば構造検査（`tests/build/leak.test.ts:135`）がそのまま守る。
- `OptionCard` はラベルを必須で受け取り、帯・`data-label`・`alt` の 3 か所にラベルを書く。カードは `grid-template-rows: minmax(0, 1fr) auto`（`src/styles/theme.css:34`）で、2 行目がラベルの帯。
- 正解の判定（`answerOf`）と発表の表示（`revealView`）はラベルで選択肢を引く。配列の順には依存しない。
- 写真の元のファイル名は、ビルド後の漏洩検査（`tests/build/leak.test.ts:121`）だけが参加者に届くファイルから探す。問題データの検証（`public-text-leak`）は銘柄・価格・解説しか見ない。

## Goals / Non-Goals

**Goals:**

- 表示順とラベルを、問題データの段階で別の情報として持つ。
- 参加者画面はラベルを型の上で受け取れない（`PublicOption` にない）。司会画面の発表前は全データを持つので、DOM にラベルがないことを E2E で守る。
- 発表の瞬間にカードを動かさず、その場にラベルが現れる。写真の座標と大きさは発表前後で変わらない。
- 選択肢の説明に写真のファイル名が入ったら、ビルド後の漏洩検査より先に、問題データの検証で作者に分かる形で落とす。

**Non-Goals:**

- 表示順がラベル順からずれているかの検査。ずらすよう求めると、2 択では並びが B・A に確定し、3 択でも候補が 2 通りに絞られる。ラベルはくじで決め、結果がラベル順と同じでも直さない運用にする（README に書く）。
- 選択肢の説明に銘柄の一部（「マルゴー」など）が入ることの検査。部分一致は誤検出が多い。README で注意する。

## Decisions

### 1. 問題データの形

選択肢は表示順に並べた配列のまま、各要素が `label` と `note` を持つ。表示順は配列の順そのもので、別の項目を持たない。

```yaml
# content/questions.yaml（選択肢は表示順に書く。label は会場で配るものに書いたラベル）
options:
  - { label: B, image: ボルドー.jpg, note: フランス産の赤ワイン, rank: 1, name: シャトー・マルゴー 2015, price: "1本 8万円" }
  - { label: A, image: テーブルワイン.jpg, note: チリ産の赤ワイン, rank: 2, name: スーパーの赤ワイン, price: "1本 900円" }
```

```ts
export interface Option {
  readonly label: Label;    // 作者が書く。表示順とは無関係
  readonly image: ImageUrl;
  readonly note: string;    // 公開。参加者にも見える
  readonly rank: Rank;
  readonly name: string;
  readonly price: string;
}
/** 表示順 */
export type Options = readonly [Option, Option] | readonly [Option, Option, Option];

export type PublicOption = Pick<Option, "image" | "note">;
export const PUBLIC_OPTION_KEYS = ["image", "note"] as const;
```

検証:

- スキーマで `label` を `"A" | "B" | "C"`、`note` を `text`（空白だけを許さない）で読む。形のエラー文は `{ label, image, note, rank, name, price } の形` にする。
- 新しい規則 `label-permutation` で、ラベルが A から選択肢数番目までを 1 回ずつ使うかを検査する。`rank-permutation` と同じ形で、エラーの位置は `questions[i].options`。
- `public-text-leak` の検査対象に `note`（位置は `questions[i].options[j].note`）を足し、探す文字列に写真の元のファイル名（拡張子を除く）を足す。種類名は「写真のファイル名」。タイトル・問題名・説明も同じ規則で検査される。

`answerOf`・`revealView` は今もラベルで引くので変えない。`revealView` の `options` のコメントを「ラベル順」から「表示順」に直す（中身は `q.options.map` のままで表示順になる）。

却下した案:

- **ラベルは書いた順のまま、表示順を別項目（`display: 2` など）で持つ。** 1 つの選択肢に順序が 2 つでき、作者が両方を整合させる必要がある。
- **ビルド時に表示順を自動で並べ替える。** ユーザーが「書いた順が表示順」を選んだ。写真の並びを作者が決められない。

### 2. カードの部品（`src/ui/OptionCard.tsx`）

ラベルを任意の引数にする。渡されたときだけ、ラベルの印（`.label-bar`）を写真の上に重ねて出し、`data-label` を付ける。カードの 2 行目は常に選択肢の説明（`.option-note`）で、発表前後で行の構成が変わらないので写真の座標と大きさも変わらない。写真の `alt` は空にする（説明は隣に文字で出ているので、読み上げが二重にならない）。

```tsx
<OptionCard image={o.image} note={o.note} size="guest" />                  // 参加者画面（PublicOption にラベルがない）
<OptionCard image={o.image} note={o.note} size="host" />                   // 司会画面・発表前
<OptionCard image={o.image} note={o.note} size="host" label={o.label} tone={tone}>  // 発表後
  <Tag option={shown} />
</OptionCard>
```

React の `key` は表示順の添字にする。参加者画面にはラベルがないため。

E2E での引き方:

- 写真は表示順の添字（`.option-card` の n 番目の `img`）で引く。
- 「ラベルがない」は構造で確かめる。対象の画面に `.label-bar` と `[data-label]` が 0 個で、どの `img` の `alt` も `/選択肢\s*[ABC]/` に一致しない。司会画面の発表後に同じセレクタでラベルが見つかることが、この検査の正の対照になる。
- 発表後のラベルは `data-label` で引く。

却下した案:

- **発表前用と発表後用に別の部品を作る。** 写真・説明・枠の見た目が 2 か所に分かれ、発表の瞬間にカードが作り直されて写真がちらつく。
- **ラベルの帯をカードの行として残し、発表前は CSS で隠す。** DOM と `data-label` にラベルが残る。
- **発表後にラベルの行を足す。** 写真の行が縮み、写真の位置と大きさが発表前後で変わる。

### 3. 選択肢の説明の置き場所と大きさ

写真の下の行に置く。クラス名は既存の `.note`（`src/styles/theme.css:201`）と衝突しないよう `.option-note` にする。司会画面は 16:9 の枠の cqw で文字の大きさを決め、参加者画面は幅 360px で折り返す。説明の文字色と背景色の組を `TEXT_PAIRS`（`src/styles/tokens.ts:31`）に必ず足し、コントラスト 4.5:1 を単体テストで守る。

写真の行は `minmax(0, 1fr)` なので、説明が長いと写真が先に縮んでも既存のはみ出し検査は通ってしまう。content.spec.ts で、本番の問題データの全問について、発表前の司会画面（1920×1080）の写真の高さがカードの高さの半分以上あることを確かめる。

## Risks / Trade-offs

- [`label` と `note` を必須にしたので、既存の問題ファイルはビルドが失敗する] → エラーは既存の形式で `questions[0].options[0].label  必須の項目です` と出る。README の書き方の例と項目の説明を直す。
- [作者が YAML のラベルと会場で配る実物のラベルを取り違えると、正解が逆になる] → 検査できない。README の本番前の確認に「YAML のラベルと実物のラベルを照合する」を足す。
- [解説の文（「B は…」）はラベルを文字で書くので、ラベルを付け替えると食い違う] → 検査できない。README の本番前の確認に「解説のラベルと YAML のラベルを照合する」を足す。
- [写真のファイル名の検査を公開項目すべてに広げたので、既存の問題ファイルのタイトル・問題名・説明がファイル名を含んでいると新たに落ちる] → 今の `content/questions.yaml` と fixtures は含まない（タスク 1.1 の検証で確かめる）。
