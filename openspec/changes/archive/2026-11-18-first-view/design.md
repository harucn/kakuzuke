# Design

## Context

動機と範囲は proposal.md、振る舞いは specs/ を参照。設計を決める現状（sharpen.md の Current System）は次の 4 点。

- 問題セットは問題の配列そのもので、セット単位の項目を置く場所がない（`QuestionSet`・`PublicQuestionSet` とも配列）。
- 位置は問題の添字だけで表す。両画面とも `src/deck/cursor.ts` の `move`・`boundsOf` で前後の範囲を決める。
- 司会画面は `booting | asking | revealed` の状態機械で動き、位置を sessionStorage に整数で保存する。`booting` の間は何も描画しないので、事前レンダリングの HTML とクライアントの初回描画が食い違わない。
- 司会画面の HTML は事前レンダリングするので、配信先の origin（本番と Workers のプレビューで異なる）をビルド時には知らない。

## Goals / Non-Goals

**Goals:**

- タイトル画面を「第 1 問の前の 1 枚」として位置の型に入れ、両画面の前後移動・端の判定・司会画面の状態機械が同じ規則で扱う。
- 会のタイトルを問題と同じ 1 つの問題ファイルから、同じ検証（空・漏洩）を通して両画面に届ける。
- QR コードが、開いている司会画面と同じ配信先の参加者画面を指す。

**Non-Goals:**

- QR コードの見た目の装飾（ロゴの埋め込み・色付き）。読み取りやすさだけを優先する。
- タイトル画面で問題の写真を先に全部読み込むこと。第 1 問の写真だけ先読みする。

## Decisions

### 1. 問題セットの形

`QuestionSet` を配列から、タイトルと問題の組に変える。公開形も同じ形で、`toPublic` は許可リストで項目を 1 つずつ写す（既存の `PUBLIC_QUESTION_KEYS`・`PUBLIC_OPTION_KEYS` と同じ方式）。

```ts
export type QuestionSet = {
  readonly title: string;
  readonly questions: readonly [Question, ...Question[]];
} & { readonly __brand: "QuestionSet" };

export type PublicQuestionSet = {
  readonly title: string;
  readonly questions: readonly [PublicQuestion, ...PublicQuestion[]];
};
export const PUBLIC_SET_KEYS = ["title", "questions"] as const;

// 司会画面の loader の値。ブランドは createServerFn の直列化を通らないので持たない
export type HostQuestionSet = { readonly title: string; readonly questions: readonly [Question, ...Question[]] };
```

```yaml
# content/questions.yaml
title: 2026 忘年会 格付けチェック   # 必須。参加者にも見える
questions:
  - mode: pick
    ...
```

検証は最上位の `title` を `text`（空白だけを許さない文字列）で読み、問題名・説明と同じ `public-text-leak` の規則でタイトルを検査する（エラーの位置は `title`）。呼び出し側（モデル・検証・Vite プラグイン・仮想モジュールの型・司会画面のデータ取得・ルート・両画面・テスト・フィクスチャ・`content/questions.yaml`・README）は 1 回の変更で新しい形に移す。古い配列の形は残さない（principle-migrate-callers-then-delete-legacy-apis）。

却下した案:

- **タイトル専用の仮想モジュール（`virtual:kakuzuke/title`）を足す。** 問題データの型を変えずに済むが、1 つの問題ファイルから 2 つの出口ができ、漏洩検査とビルド時の検証を 2 か所に通す必要がある。
- **公開形にタイトルを spread で足す。** 許可リスト方式の射影（後から足した項目は既定で非公開）が崩れる。

### 2. 位置の型（`src/deck/cursor.ts`）

位置を `"title" | number`（number は問題の添字）にし、タイトル画面を位置の 1 つとして扱う（principle-model-the-domain）。画面ごとに「タイトルかどうか」の真偽値を持たない。

```ts
export type Position = "title" | number;
export function move(position: Position, step: Step, total: number): Position;
// "title" の次は 0、0 の前は "title"、最終問の次は最終問のまま
export function boundsOf(position: Position, total: number): { readonly canPrev: boolean; readonly canNext: boolean };
// "title" は canPrev: false・canNext: true
export function positionText(index: number, total: number): string; // 問題だけ
```

却下した案: **各画面が添字 -1 をタイトルとして扱う。** 型でタイトルと問題を区別できず、`set.questions[-1]` を読む誤りを型検査で止められない。

### 3. 司会画面の状態機械（`src/host/machine.ts`）

状態に `{ phase: "title" }` を足す。

```ts
export type HostState =
  | { readonly phase: "booting" }
  | { readonly phase: "title" }
  | { readonly phase: "asking"; readonly index: number }
  | { readonly phase: "revealed"; readonly index: number; readonly run: number };
```

- `restore` の `null`（保存なし）はタイトル画面にする。
- `next`・`prev` は `cursor.move` で位置を動かし、`"title"` なら `{ phase: "title" }`、添字なら `asking` にする。動かないときは同じオブジェクトを返す（既存の規則）。
- タイトル画面の `reveal` は同じオブジェクトを返す。キー割り当て（`keymap.ts`）は変えず、Space・Enter の無視は状態機械が決める。タイトル画面には正解発表ボタンを出さない。
- 保存: タイトル画面では保存キーを消し、問題では今どおり添字を保存する。新しいタブ（保存なし）とタイトル画面での再読み込み（キーを消した後）が同じ「保存なし → タイトル」に揃う。`booting` の間は保存も削除もしない（復元前に保存値を消さないため）。

却下した案: **タイトル画面を `"title"` という文字列で保存する。** 読み戻しの分岐が 1 つ増えるだけで、「保存なし」と区別する必要がない。

### 4. QR コード

参加者画面の URL は `window.location.origin + "/"` からクライアントで作り、QR コードもクライアントで生成する。事前レンダリングの HTML は origin を知らず、本番とプレビューで origin が違うため。司会画面は `booting` の間は何も描画しないので、生成をタイトル画面の描画の中で行っても hydration の食い違いは起きない。

ライブラリは `uqr`（依存なし、MIT、0.1.3 は 2026-04-03 公開）。`encode` が返すモジュールの行列から、司会画面が自分で 1 本の `<path>` の SVG を組み立てる。ライブラリの SVG 文字列（色が直書き）を `dangerouslySetInnerHTML` で入れずに済み、色をテーマのトークン（暗いモジュールは `--ink`、地は `--paper`）で塗れる。周囲に 4 モジュール分の余白（quiet zone）を SVG の中に取り、`shape-rendering: crispEdges` でモジュールの境目をぼかさない。大きさは 16:9 の枠の cqw で決める。URL の文字は出さない（ユーザーの判断。読み取りは QR に任せる）。

却下した案:

- **ビルド時に QR を生成する。** origin を知らないので本番とプレビューの両方で正しい先を指せない。
- **サーバー関数で QR を返す。** 会場当日にサーバー関数を呼ばない方針（MVP の design）に反する。

### 5. 参加者画面

`useState<Position>("title")` から始める。タイトル画面はタイトルと「はじめる」だけを出す。「はじめる」は既存の前へ・次へと同じく hydration が終わるまで無効にする。タイトル画面でも第 1 問の写真を先読みする。

### 6. E2E での QR の確かめ方

司会画面の QR の要素だけをスクリーンショットし、`pngjs` で画素に戻して `jsqr` で復号する。復号した文字列が、テストが開いているサーバーの `/` の URL と一致することを確かめる。どちらも devDependencies に固定版で入れる（`jsqr` 1.4.0、`pngjs` 7.0.0）。

## Risks / Trade-offs

- [`title` を必須にしたので、`title` のない問題ファイルはビルドが失敗する] → エラーは既存の形式で `title  必須の項目です` と出る。README の書き方の例と項目の説明を直す。
- [事前レンダリングした参加者画面の HTML に第 1 問が入らなくなり、写真の `<img>` もなくなる] → 写真の URL を HTML から拾っていた smoke テストは、問題データの公開 URL を直接取得して確かめる形に変える。
- [プロジェクタ越しの QR の読み取りは会場の明るさと投影の大きさに左右される] → 枠の高さの半分以上の大きさで描き、余白と暗色・明色の組を確保する。実機での読み取りは本番前の確認（README）に足す。
- [spec の「問題の表示」「前後の問題への移動」は既存の Scenario（「開いた直後は第 1 問」「第 1 問では前へを操作できない」）が成り立たなくなる] → MODIFIED では Scenario を消せないので、REMOVED にして「問題画面の表示」「前後の画面への移動」として ADDED し直す。
