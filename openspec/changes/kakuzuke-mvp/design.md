# Design

## Context

リポジトリにアプリのコードはなく、新規に作る（動機と範囲は proposal.md、振る舞いは specs/ を参照）。設計を決める制約は次の 3 つ。

- **TanStack Router の loader は isomorphic。** loader や component で問題ファイルを import すると、その中身はクライアントの JS チャンクに入る。Done Means は「参加者に届くクライアント向けファイルに正解を含めない」ことを求めており、チャンク単位の出し分けでは証明しにくい。
- **Workers にはファイルシステムがない。** 写真の存在確認はビルド時にしかできない。
- **問題データはデプロイごとにしか変わらない。** リクエストごとに描画しても得るものがない。

フレームワークの事実（2026-11-16 時点のドキュメントで確認）:

- Cloudflare 公式手順: `vite.config.ts` のプラグインは `cloudflare({ viteEnvironment: { name: "ssr" } })` → `tanstackStart()` → `react()` の順。`wrangler.jsonc` の `main` は `@tanstack/react-start/server-entry`。
- `tanstackStart({ prerender: { enabled: true } })` は Cloudflare と併用でき、事前レンダリングしたページは static assets として配信される。
- `createServerFn` のクライアント側は `/_serverFn/<id>` への fetch に置き換わり、handler の本体はクライアントのバンドルに入らない。
- Vite プラグインのフックでは `this.environment.name` で実行中の環境を判別できる。
- Workers static assets の既定 `html_handling: "auto-trailing-slash"` は、`host/index.html` しかないとき `/host` を `/host/` へ 307 で転送する。

## Goals / Non-Goals

**Goals:**

- 参加者に正解が届かないことを、規律ではなくビルドの構造で保証し、ビルド成果物の全走査で証明する。漏れがあればデプロイできない。
- 問題ファイルの誤りを、ビルドと dev の両方で、全件まとめて報告する。
- 会場当日のリクエスト時に動く処理を最小にする（両画面とも静的ファイルで配信し、表示中にサーバー関数を呼ばない）。

**Non-Goals:**

- リクエストごとの SSR。`prerender.enabled: false` にすれば SSR に切り替えられる構造は残すが、使わない。
- `/host` の URL を秘匿すること（proposal の範囲外）。
- 実行時の問題データの検証（ビルド時に検証済みの値を信頼する）。
- 画像フォルダ内の未使用画像の検出（公開されないので、検出しなくても漏れない）。

## Decisions

### 1. 利用者側から見た形（Usage）

問題の作者は `content/questions.yaml` と `content/images/` だけを編集する。写真は `content/images/` に好きな名前で置き、`image` でファイル名を指定する。選択肢のラベル A/B/C は `options` に書いた順で決まる。

```yaml
# content/questions.yaml
questions:
  - mode: pick
    title: ワイン
    description: 高いワインはどちら？
    explanation: B は 1本 5万円のボルドー。A はスーパーで買えるテーブルワインでした。
    options:                       # 書いた順に A, B
      - { image: テーブルワイン.jpg, rank: 2, name: テーブルワイン, price: "1本 1,000円" }
      - { image: ボルドー.jpg,       rank: 1, name: ボルドーの赤,   price: "1本 5万円" }
```

```text
✗ content/questions.yaml
  questions[0].options[1].image  写真 ボルドー.jpg が content/images にありません
  questions[2].options         rank は 1〜3 を 1 回ずつ使ってください（1, 1, 2）
  questions[0].description     参加者に見える文に価格「1本 5万円」が含まれています
```

```sh
pnpm dev           # 誤りは dev のエラーオーバーレイに出る（サーバーは止まらない）
pnpm test          # 単体テスト（vitest run --project unit）
pnpm build         # 検証 → "/" と "/host" を事前レンダリング → 漏洩走査（失敗したらビルド失敗）
pnpm e2e           # pnpm build && playwright test（常に最新のビルドを検査する）
pnpm run deploy    # pnpm build && wrangler deploy
```

ルートからの呼び出しは次の 2 通りだけ。

```tsx
// src/routes/index.tsx — 参加者画面 "/"（QR コードの URL を最短にする）。loader もサーバー呼び出しもない
import publicSet from "virtual:kakuzuke/public";
export const Route = createFileRoute("/")({ component: () => <GuestScreen set={publicSet} /> });

// src/routes/host.tsx — 正解が流れる唯一の経路
export const Route = createFileRoute("/host")({
  loader: () => getHostQuestionSet(), // createServerFn。handler 内で virtual:kakuzuke/answers を動的 import
  staleTime: Infinity,
  component: () => <HostScreen set={Route.useLoaderData()} />,
});
```

### 2. データの形（`src/question-set/model.ts`）

正解は `rank` だけが持ち、ほかの表現はすべて導出する（principle-model-the-domain）。ラベルは並び順から導出する。写真は作者が元のファイル名で指定し、ドメインモデルには公開 URL だけを持たせる（元のファイル名はプラグインの外に出さない）。

```ts
export type Mode = "pick" | "order";
export type Label = "A" | "B" | "C";
export type Rank = 1 | 2 | 3;
/** 公開 URL（例 "/images/3f9a2c41.jpg"）。中身のハッシュから作り、元のファイル名を含まない。parseQuestionSet だけが作れる */
export type ImageUrl = string & { readonly __brand: "ImageUrl" };

export interface Option {
  readonly label: Label;    // 並び順から導出
  readonly image: ImageUrl;  // 作者の指定したファイルの公開 URL
  readonly rank: Rank;      // 1 = 最も高価。正解の唯一の情報源
  readonly name: string;
  readonly price: string;   // 表示用の文字列。比較しない
}
export type Options = readonly [Option, Option] | readonly [Option, Option, Option];

export interface Question {
  readonly mode: Mode;
  readonly title: string;
  readonly description: string;
  readonly explanation: string;
  readonly options: Options;
}
/** 検証済み・1 問以上・出題順。parseQuestionSet だけが作れる */
export type QuestionSet = readonly [Question, ...Question[]] & { readonly __brand: "QuestionSet" };

// 参加者向けの公開形。選択肢の 2〜3 個のタプルは保つ
export type PublicOption = Pick<Option, "label" | "image">;
export type PublicQuestion = Pick<Question, "mode" | "title" | "description"> & {
  readonly options: readonly [PublicOption, PublicOption] | readonly [PublicOption, PublicOption, PublicOption];
};
export type PublicQuestionSet = readonly [PublicQuestion, ...PublicQuestion[]];

/** 許可リスト方式の射影。spread も omit も使わず項目ごとに新しいオブジェクトを作る。後から足した項目は既定で非公開になる */
export function toPublic(set: QuestionSet): PublicQuestionSet;
export const PUBLIC_QUESTION_KEYS = ["mode", "title", "description", "options"] as const;
export const PUBLIC_OPTION_KEYS = ["label", "image"] as const;

export type Answer =
  | { readonly mode: "pick"; readonly winner: Label }
  | { readonly mode: "order"; readonly sequence: readonly Label[] }; // rank の昇順
export function answerOf(q: Question): Answer;

/** 漏洩とみなす文字列: 全選択肢の name と price、全問題の explanation（重複は除く）。rank は数値なので構造で検査する */
export function secretStrings(set: QuestionSet): readonly string[];

```

### 3. 検証（`src/question-set/parse.ts`）

`parseQuestionSet(input: unknown, images: ReadonlyMap<string, ImageUrl>): ParseResult` は純粋関数で、最初の誤りで止まらず全件を集める。zod はこのファイルの中だけで使う。`images` は「画像フォルダ内の元のファイル名 → 公開 URL」の対応で、ファイルを読んでハッシュを取るのはプラグインの役目。Vitest では `Map` を渡して写真の欠落を試せる。

```ts
export type IssueCode =
  | "shape"             // 必須項目の欠落・空文字・空白だけ（image・name・price を含む）、未知の mode、選択肢 1 個や 4 個、問題 0 件
  | "rank-permutation"  // rank が 1..n の並べ替えでない（rank 1 がない・重複・範囲外）
  | "image-missing"     // image に指定したファイルが画像フォルダにない
  | "public-text-leak"; // 問題名・説明に、セット内の銘柄・価格・解説の文字列がある
export interface Issue { readonly code: IssueCode; readonly path: readonly (string | number)[]; readonly message: string }
export type ParseResult =
  | { readonly ok: true; readonly set: QuestionSet }
  | { readonly ok: false; readonly issues: readonly Issue[] };
```

`public-text-leak` があるので、参加者に見える文字列（問題名・説明）と秘密の文字列は必ず重ならない。これにより漏洩走査の判定が正確になる。

問題ファイルは YAML にする。日本語の文面を作者が直接編集するので、コメントを書けて引用符がほぼ要らない形式を選んだ。読み込みはビルド時の Vite プラグインだけが行い、`yaml` パッケージはクライアントに入らない。

### 4. 問題コンパイラ（`src/question-set/vite-plugin.ts`）が正解の壁を持つ

`kakuzukeQuestions(options?)` は問題ファイルの場所、検証のタイミング、公開形への射影、クライアントとサーバーの壁をすべて内側に持つ。アプリのコードから見えるのは 2 つの仮想モジュールだけ。

```ts
export interface KakuzukeOptions {
  readonly contentDir?: string; // 既定 "content"。環境変数 KAKUZUKE_CONTENT_DIR でも上書きできる（E2E のフィクスチャ用）
  readonly imagesDir?: string;  // 既定 "<contentDir>/images"。public/ の外に置き、Vite がそのまま公開しないようにする
  readonly serverEnvironment?: string; // 既定 "ssr"。正解を読める唯一の環境
}
export function kakuzukeQuestions(options?: KakuzukeOptions): Plugin;
/** テストが実データを読む唯一の入口。プラグインと同じ場所・同じ検証を使う */
export function loadQuestionSet(root: string, options?: KakuzukeOptions): QuestionSet;
```

| フック | 動作 |
| --- | --- |
| `buildStart`（build） | YAML を読み、画像フォルダの各ファイルの中身のハッシュから公開 URL の対応表を作って `parseQuestionSet`。誤りがあれば `this.error(formatIssues(issues))` でビルドを止める |
| `buildStart`（dev） | 同じ検証をするが、誤りは保持するだけでサーバーは起動させる |
| `configureServer` | 問題ファイルと画像ディレクトリを監視し、変更時に再検証して、全環境の両仮想モジュールを無効化する |
| `load("virtual:kakuzuke/public")` | dev で誤りを保持していれば throw（エラーオーバーレイに全件が出る）。なければ `toPublic(set)` を `export default` する。どの環境でも読める |
| `load("virtual:kakuzuke/answers")` | `this.environment.name` が `serverEnvironment` のときだけ全データを返す。それ以外は `this.error`（許可リスト方式。名前が変わった環境や新しい環境は拒否される） |
| `load(問題ファイル)` | サーバー環境以外からの直接 import を `this.error` にする |
| `generateBundle`（client 環境） | 検証済みのセットが指定している写真だけを `this.emitFile` で `images/<ハッシュ>.<拡張子>` として出力する。指定されていない画像は出力しない |
| `configureServer`（dev の配信） | `/images/<ハッシュ>.<拡張子>` へのリクエストに、対応表から元のファイルを返す |

### 5. 配信: 両ルートを事前レンダリングする

- `vite build` が `/` と `/host` を事前レンダリングする。`/host` の loader はビルド時にプロセス内で `getHostQuestionSet` を実行し、結果は `dist/client/host/index.html` に埋め込まれる。**正解を含んでよいクライアント向けファイルはこの 1 つだけ。**
- 参加者画面はデータ取得の経路を持たない。公開形はビルド時に参加者の HTML と JS へ埋め込まれ、実行時のリクエストは静的ファイルと写真だけになる。
- `wrangler.jsonc` の `assets.html_handling` を `"drop-trailing-slash"` にし、`/host` が転送なしで `host/index.html` を返すようにする（TanStack Router の既定 `trailingSlash: 'never'` と URL の形を揃え、hydration のずれと loader の再実行を防ぐ）。
- Worker は `/_serverFn/*` の受け口として残す。司会画面の表示中にサーバー関数が呼ばれないことは E2E で確かめる（Decisions 10）。
- 写真は `content/images/` に置き、ビルド時に指定されたものだけが `dist/client/images/<ハッシュ>.<拡張子>` に出力され、static assets として配信される。司会画面は次の問題の写真を先読みする。

### 6. 漏洩の証明（`tests/leak.ts`、`tests/build/*.test.ts`）

検出器は「復号してから探す」。走査する各ファイルの内容を 1 回正規化し（`\uXXXX`・`\u{…}`・`\xNN` の JS エスケープを戻し、名前付き・数値の HTML 実体参照を復号する）、そのうえで秘密の文字列をそのまま探す。エンコードの種類ごとに検索語を増やす方式より取りこぼしがない。

`tests/build/`（`pnpm build` の中で実行。漏洩があればデプロイ前に止まる）:

1. **秘密リストの検査**: `secretStrings(loadQuestionSet(root))` が空でなく、件数が「全選択肢の name と price、全問題の explanation の重複を除いた数」と一致すること。リストが空や欠けていると、以下の検査はすべて素通りになるため最初に確かめる。
2. **陽性対照 1（埋め込み）**: `dist/client/host/index.html` から全秘密文字列が見つかること。
3. **陽性対照 2（クライアント JS のカナリア）**: 参加者画面のクライアントコードに置いた固定の文字列（日本語を含む `LEAK_CANARY`）が `dist/client` の JS から見つかること。クライアントの minify や文字コードの設定が変わって検出器が読めなくなれば、ここで失敗する。
4. **本検査**: `dist/client` の全ファイル（全 JS チャンク、CSS、HTML、ソースマップ）のうち `host/index.html` 以外に、秘密文字列が 1 つもないこと。見つかったときはファイル名と前後の文字を報告する。あわせて、`image` に指定された元のファイル名が `dist/client` に現れないことを確かめる。`host/index.html` 以外のファイルでは拡張子を除く部分（例「ボルドー」）を、`host/index.html` では拡張子付きの名前（例「ボルドー.jpg」）を、中身とパスの両方で探す（司会画面の HTML には銘柄が入るので、拡張子を除く部分で探すと「ボルドーの赤」に誤って一致する）。さらに `dist/client/images/` の画像の数が指定された写真の種類数と一致することを確かめる。
5. **公開データの構造検査**: プラグインが `virtual:kakuzuke/public` に出す値そのもの（`load` の出力）が `toPublic(loadQuestionSet(root))` と一致し、各問題のキーが `PUBLIC_QUESTION_KEYS`、各選択肢のキーが `PUBLIC_OPTION_KEYS` と完全一致すること。`rank` は文字列検索できないので、これで保証する。
6. **プラグインの壁の回帰テスト**（`tests/build/plugin.test.ts`）: Vite の `build()` API を小さなフィクスチャで実行し、(a) 誤りを 3 種含む YAML で全件を列挙して失敗する、(b) クライアントのモジュールから `virtual:kakuzuke/answers` を import すると失敗する、(c) クライアントのモジュールから問題ファイルを直接 import すると失敗する、ことを確かめる。

E2E（Playwright、Decisions 10）では、参加者画面を最初から最後まで進める間の全レスポンスを正規化して秘密文字列が 0 件であること、`/_serverFn/` へのリクエストが 0 件であることを確かめる。

### 7. 司会画面の状態（`src/host/machine.ts`）

```ts
export type HostState =
  | { readonly phase: "booting" }                                    // 再読み込みの復元前。操作を受け付けない
  | { readonly phase: "asking"; readonly index: number }
  | { readonly phase: "revealed"; readonly index: number; readonly run: number };
export type HostEvent =
  | { readonly type: "next" } | { readonly type: "prev" } | { readonly type: "reveal" }
  | { readonly type: "restore"; readonly index: number | null };      // null は保存なし → 第 1 問
export function step(state: HostState, event: HostEvent, total: number): HostState;
```

- 初期状態は `booting`。`booting` では next・prev・reveal を無視し、`restore` だけが `asking{index}` に進める。問題部分は `booting` の間は描画しない。
- `asking` は正解の状態を持たないので、「移動したのに発表済み」は表現できない。
- `next`・`prev` は `src/deck/cursor.ts` の `move(index, step, total)` で範囲内に収め、移動先は必ず `asking`。端では同じオブジェクトを返す（React は再描画しない）。
- `reveal` は `asking → revealed{run: 1}`、`revealed{run} → revealed{run: run + 1}`。正解情報は `revealView(question)`（`src/host/reveal.ts`）が問題から導出するので、何回押しても変わらない。`pick` でも `order` でも `rank: 1` の選択肢に正解の印を付ける。
- `run` は再演出の合図。紙吹雪 `<Celebration key={run}>` と、正解の選択肢の印 `<Stamp key={run}>` の両方を `run` で key して、2 回目以降の正解発表で両方を最初から再生する（要素が作り直される）。
- reduced motion と全画面は状態に入れない。前者は `useReducedMotion()`（`matchMedia` を読む自前の小さなフック）で紙吹雪を止め、CSS のメディアクエリで点滅を止める。後者は `toggleFullscreen()` が拒否と API 欠如の両方を握りつぶす。紙吹雪は canvas に描く自前の実装で、ライブラリは使わない。
- `src/deck/cursor.ts` の `move` / `boundsOf` / `positionText` は参加者画面も使い、「前へ・次へを押せるか」と「1 / 3」の表示規則を両画面で 1 つにする。

### 8. 再読み込みで同じ問題に戻る（`src/host/restore.ts`）

```ts
/** 保存値を読む。整数でない・負・空なら null。total 以上は total-1 に丸める */
export function readStoredIndex(raw: string | null, total: number): number | null;
```

- マウント後に `sessionStorage` を読み、`restore` を dispatch する。`booting` 以外の状態になってから、`index` が変わるたびに書く（マウント直後に第 1 問で上書きしない）。
- 読み書きは try/catch で囲み、使えない環境では `restore(null)` で第 1 問から始める。
- 保存するのは `index` だけで、正解発表の状態は保存しない（spec のとおり発表前に戻る）。

### 9. キーボード（`src/host/keymap.ts`）

```ts
export const HOST_KEYS = {
  ArrowRight: "next", PageDown: "next",
  ArrowLeft: "prev",  PageUp: "prev",
  " ": "reveal",      Enter: "reveal",
} as const satisfies Record<string, "next" | "prev" | "reveal">;
export function keyToHostEvent(e: KeyLike): HostEvent | null; // 押しっぱなしの連打・IME 変換中・修飾キー付きは null
export function installHostKeys(target: Window, dispatch: (e: HostEvent) => void): () => void;
```

- window のキャプチャフェーズで 1 つだけ listener を置き、対応するキーは `preventDefault` してから dispatch する。Space はボタンの keyup でも発火するので keyup も止める。
- フォーカスに関係なく表が優先する。マウスで ▶ を押した直後に Space を押しても、▶ がもう一度押されるのではなく正解発表になる（spec の「Space キーで正解発表する」をそのまま満たす）。

### 10. テストの配置と E2E のデータ

| 置き場所 | 実行 | 内容 |
| --- | --- | --- |
| `tests/unit/` | `pnpm test` | parse・model（`secretStrings` を含む）・cursor・machine・reveal・restore・keymap・テーマの配色のコントラスト比 |
| `tests/build/` | `pnpm build` の最後 | Decisions 6 の 1〜6 |
| `tests/e2e/`（scenario） | `pnpm e2e` | spec の Scenario。フィクスチャ `tests/fixtures/content/`（Scenario が前提にするデータ: B が rank 1 の pick、A/B/C が 1/3/2 の order、5 問以上）を `KAKUZUKE_CONTENT_DIR` で読ませてビルドしたものに対して流す |
| `tests/e2e/content.spec.ts` | `pnpm e2e`、`BASE_URL` 指定時はデプロイ先 | 実データの全問をボタンとキーそれぞれで最初から最後まで進め、各問題で正解発表し、`answerOf` の結果と表示が一致すること。1920×1080 で `document.fonts.ready` の後、問題名・全選択肢・解説・操作ボタンが表示領域内にあり、解説欄が `scrollHeight <= clientHeight` であること。司会画面の表示中と再読み込み時に `/_serverFn/` へのリクエストが 0 件であること。参加者画面の漏洩検査 |

- `vitest` は `unit` と `build` の 2 プロジェクトで、どちらも Cloudflare / Start のプラグインを読まない。`pnpm test` は `unit` だけを実行する。テストのない段階でも失敗しないよう `passWithNoTests` を有効にする。
- Playwright の `webServer` は `vite preview`（workerd）。`BASE_URL` があるときは `webServer` を使わず、その URL に対して流す。
- コントラスト比は、テーマの配色トークンの組（`--ink` × `--cream`、`--paper` × `--green-deep` など、文字と背景の組をテーマのファイルに列挙したもの）を単体テストで計算する。
- 「全画面表示が拒否される環境」は `addInitScript` で `requestFullscreen` を reject に差し替えて試す。「演出を最初から再生する」は、2 回目の正解発表の前後で `Celebration` と `Stamp` の要素が別の要素に置き換わることで確かめる。
- 「問題数が減った後の再読み込み」は、`sessionStorage` に範囲外の index を入れてから再読み込みして確かめる（キー名は `restore.ts` から import する）。

### 11. モジュール構成

```text
content/questions.yaml ─┐   作者が編集する（クライアントからの import はビルドエラー）
content/images/*      ──┤
                        ▼
src/question-set/vite-plugin.ts   検証・仮想モジュール・環境の壁・loadQuestionSet
  ├ parse.ts   検証規則（zod はここだけ）。ラベルを並び順から決め、写真を公開 URL に置き換える
  └ model.ts   型・toPublic・answerOf・secretStrings
  ├─ virtual:kakuzuke/public  → src/routes/index.tsx "/"  → src/guest/GuestScreen.tsx（LEAK_CANARY を含む）
  └─ virtual:kakuzuke/answers → src/host/host-data.functions.ts（createServerFn）
                                  ↑ loader
                                src/routes/host.tsx "/host" → src/host/HostScreen.tsx
                                                               ├ machine.ts（booting | asking | revealed{run}）
                                                               ├ restore.ts（sessionStorage）
                                                               ├ keymap.ts（キー表 1 つ）
                                                               └ reveal.ts（answerOf から発表内容を導出）
src/deck/cursor.ts     move / boundsOf / positionText（両画面）
src/ui/OptionCard.tsx  写真とラベルのカード（両画面）
src/styles/            テーマ（配色トークンと文字・背景の組、ドット枠、フォント）
tests/unit/ tests/build/ tests/e2e/ tests/fixtures/content/
```

### 12. 比較して採用した案と、退けた案

2 つの設計案を独立に作り、別のエージェントが評価基準 5 項目で採点した。その後、2 人のレビュワーが proposal・specs・design・tasks を検査し、その指摘をこの版に反映した。

- **土台にした案**: ビルド時の問題コンパイラ + 両ルートの事前レンダリング。参加者にデータ取得の経路がなく、壁は自前のプラグインが全環境で fail closed にし、漏洩走査がデプロイ経路に入っている。フレームワークへの未検証の依存も少ない。
- **もう一方の案から取り込んだもの**: 秘密を「`toPublic` が落とす項目」とみなす考え方、`cursor.ts` と `loadQuestionSet` の共有、正解の印も `run` で key して再演出すること、司会画面の E2E の網羅。

退けた案:

- **Workers 上の SSR で、参加者画面の loader が `toPublic` を返すサーバー関数を呼ぶ形**: 参加者向けの実行時のデータ経路ができ、ビルド成果物の走査では網羅できない。証明が E2E のたまたまの網羅に依存する。データはデプロイごとにしか変わらないので、リクエストごとの描画にも利点がない。
- **TanStack Start の import protection だけで壁を作る形**: 仮想モジュールの ID や YAML への規則の当たり方が未検証で、dev では mock になるだけでエラーにならない。自前のプラグインの環境チェックと併用はできるが、主たる壁にはしない。
- **司会用データを静的 JSON（`/host-data.json`）で配る形**: 正解がクライアント JS から参照されるファイルとして置かれ、許可するファイルが 2 つに増える。司会画面に読み込み中の状態も要る。省けるのはサーバー関数 1 ファイルだけ。
- **問題番号を URL（`/host?q=3`）で持つ形**: 事前レンダリングした HTML は任意のクエリに対応できず hydration がずれる。URL と reducer の両方が状態を持つことにもなる。再読み込みの復元は `sessionStorage` で行う。
- **Space・Enter を、キーボードでフォーカスされたボタンでは押下扱いにする形**: spec の「Space キーで正解発表する」を一部の状況で満たさなくなる。`:focus-visible` の挙動への依存も増える。
- **問題ファイルを JSON にする形**: 読み込みは単純になるが、コメントを書けず、作者の編集がしにくい。
- **ラベルを作者に書かせて検証する形**: 並び順から決まる値を手で書かせると、取り違えを検証で落とす規則が要る。導出すれば取り違えそのものが起きない。
- **写真を `q1-a.jpg` のような並び順から決まる名前で置かせる形**: 作者が付けたい名前を使えず、問題を並べ替えるたびに写真の名前も変える必要がある。元の名前は公開時に付け替えるので、好きな名前を付けても漏れない。
- **`public/images/` に置いた写真をそのまま公開する形**: 元のファイル名が URL に出て、指定していない画像まで公開される。
- **エンコードの種類ごとに検索語を増やす検出器**: `\xNN` や数値実体参照などを取りこぼす。復号してから探せば種類を列挙しなくてよい。
- **漏洩検出の陽性対照を `dist/ssr`（サーバー側バンドル）に置く形**: サーバー側とクライアント側は minify などの設定が違うので、クライアント JS を読めることの証明にならない。クライアント JS のカナリアに置き換えた。

## Risks / Trade-offs

フレームワークの未確認の前提と、それを確定させるタスク:

- [`virtual:kakuzuke/answers` を読める環境の名前が Cloudflare プラグイン下で `"ssr"` 以外] → 許可リスト方式なので、名前違いは漏洩ではなくビルド失敗になる。`serverEnvironment` で合わせる。タスク 3.2 で確定。
- [`createServerFn` の handler 本体がクライアントのビルドから消えない] → 消えなければ handler 内の動的 import がクライアント環境で `answers` を読みにいき、プラグインがビルドエラーにする。タスク 3.2 で確定。
- [正解が `dist/client/host/index.html` に埋め込まれない] → 陽性対照 1 が失敗して気づける。タスク 3.2・3.3 で確定。
- [`tanstackStart` の prerender で、`pages` を置く位置（`prerender` の中か外か）が違う] → `host/index.html` が生成されなければ 1.1 の検証で気づける。自動検出だけで両ルートが出るなら `pages` は書かない。タスク 1.1 で確定。
- [`html_handling: "drop-trailing-slash"` でも `/host` が 200 にならない] → 1.1 の検証（`GET /host` が 200 の HTML）で気づける。代わりに TanStack Router の `trailingSlash` を `'always'` にして URL を `/host/` に揃える。タスク 1.1 で確定。
- 確定（1.1）: `pages` は不要。`tanstackStart({ prerender: { enabled: true } })` だけで、`/` から `/host` へのリンクがなくても両ルートが自動検出され、`dist/client/index.html` と `dist/client/host/index.html` が出る。
- 確定（1.1）: `wrangler.jsonc` の `assets.html_handling: "drop-trailing-slash"` は Cloudflare プラグインが生成する `dist/server/wrangler.json` に `directory: "../client"` と並んで引き継がれる。`vite preview` で `GET /host` は転送なしの 200（`etag` 付きの static asset）、`/host/` は `/host` への 307。対照として設定を外すと `/host` は `/host/` への 307 になる。
- 確定（1.1）: ビルドの出力先は `dist/client`（static assets）と `dist/server`（Worker と生成された `wrangler.json`）。`dist/ssr` はない。`wrangler deploy` は `.wrangler/deploy/config.json` 経由で `dist/server/wrangler.json` を使う。
- 確定（3.1）: client 環境の `generateBundle` で `this.emitFile({ type: "asset", fileName: "images/<ハッシュ>.<拡張子>" })` した写真は `dist/client/images/` に出る。ビルドは client → ssr → 事前レンダリングの順で、写真は事前レンダリングより前に揃う。代替策（作業フォルダへの書き出し）は使っていない。`vite preview` で `/images/<ハッシュ>.<拡張子>` は 200 の `image/*` を返す（smoke の E2E で確認）。
- 確定（3.1）: 環境名は build・dev とも `client` と `ssr`（Cloudflare の Worker 環境が `ssr`、出力先は `dist/server`）。クライアントのモジュールから `virtual:kakuzuke/answers` や `content/questions.yaml`（`?raw`・`?url` 付きを含む）を import すると、ビルドがプラグインのエラーで失敗する。
- 確定（3.1）: build では環境ごとに設定が解決し直され、プラグインのインスタンスも環境ごとに作られる。dev の `buildStart` は client 環境でしか呼ばれない。このため検証結果は、最初に呼ばれたフックが作ってインスタンス内に保持する。
- 確定（3.1）: dev では誤りがあってもサーバーは起動する。`/` の SSR が失敗してクライアント描画に切り替わり、client 環境の `load` が投げた誤りが Vite のエラーオーバーレイに全件出る。dev 中に問題ファイルや写真を直すと、全環境の仮想モジュールを無効化して `full-reload` を送るので、再起動なしで表示が戻る。逆に正しい状態から壊した場合もすぐ誤りが出る。dev で配信する写真も、指定されたものだけ。
- 確定（3.1）: `imagesDir` の既定は `<contentDir>/images` にした。`KAKUZUKE_CONTENT_DIR` でフィクスチャを指定したとき、写真もフィクスチャ側のものを使うため。
- 確定（3.1）: 写真の元のファイル名の検査で、`host/index.html` に拡張子を除く部分を探すと銘柄に誤って一致する（`ボルドー.jpg` と「ボルドーの赤」）。作者に名前の制約を課さず、`host/index.html` では拡張子付きの名前で探すことにした（Decisions 6 の 4）。
- 確定（3.2）: `virtual:kakuzuke/answers` を読む環境の名前は Cloudflare プラグイン下でも `ssr` で、`serverEnvironment` は既定のままでよい。`serverEnvironment` を存在しない名前にすると client のビルドは通り、ssr のビルドがプラグインのエラー（`virtual:kakuzuke/answers はサーバー側でしか読み込めません`）で失敗する。
- 確定（3.2）: `createServerFn` の handler 本体と、その中の動的 import はクライアントのビルドから消える。クライアントの JS に残るのは `/_serverFn/<id>` への fetch だけで、`host/index.html` 以外の `dist/client` には `kakuzuke/answers` の文字列も秘密文字列もない。handler が残れば client のビルドが壁で失敗するので、ビルドが通ること自体も証拠になる。
- 確定（3.2）: 正解は `dist/client/host/index.html` の `<script>` の中に、loader の dehydrate データ（seroval の `$R[n]={…,name:"…",price:"…"}` の形）として入る。日本語などの非 ASCII 文字と `&` は UTF-8 のまま（`\uXXXX` や HTML 実体参照にはならない）で、JS の文字列のエスケープとして `"` は `\"`、`\` は `\\`、`<` は `\x3C` になる（解説に `"`・`\`・`<b>`・`</script>`・`&amp;` を入れたフィクスチャで確認）。漏洩の検出器は Decisions 6 の一覧に加えて `\"` と `\\` も戻す必要がある。`<script>` の外のマークアップに秘密文字列はない（仮の司会画面は番号と問題名だけを描画する）。
- 確定（3.2）: 事前レンダリングした `/host` を開いて hydration しても `/_serverFn/` へのリクエストは起きない（`vite preview` と Playwright で確認。リクエストは HTML と JS 2 本だけ）。hydration 後に `/` へ移動して `/host` に戻っても起きない（`staleTime: Infinity` によると推定。外した対照は取っていない）。`/` を開いてからクライアント側で `/host` に遷移したときだけ GET が 1 回起き、Worker が 200 を返す。
- 確定（3.2）: `QuestionSet` のブランド（タプルとの交差型）は `createServerFn` の直列化の型検査を通らない（配列のメソッドまで直列化の対象として検査される）。handler の戻り値の型を `readonly [Question, ...Question[]]` に広げて返すので、`/host` の loader の値はブランドを持たない。`HostScreen` はこの型を受け取る。

ほかのリスク:

- [dev の `buildStart` でエラーを投げるとサーバーが起動しない] → dev では誤りを保持し、仮想モジュールの `load` で投げてオーバーレイに出す（Decisions 4）。タスク 3.1 で `pnpm dev` を実際に起動して確かめる。
- [実データの解説が長く、プロジェクタで切れる] → 実データの E2E（Decisions 10）が 1920×1080 で溢れを検出し、デプロイ前に気づける。直し方は文面を短くすること。
- [プレゼン用リモコンが Space・Enter を送れず、正解発表をリモコンで操作できない] → 本番前に実機のリモコンで `/host` を操作し、送られるキーを確かめる（tasks の Workflow follow-up）。足りなければキー表に追加する変更を別に起こす。
- [全画面ボタンはキーボードで押せない（Space・Enter は常に正解発表になる）] → マウスで押す。キーボードの全画面ショートカットは spec にないので追加しない。
- [写真の EXIF や写り込んだラベルから正解が漏れる] → 走査では検出できない。写真の準備時に作者が確認する。
- [client 環境の `generateBundle` で出力した画像が、Cloudflare プラグインの出力先 `dist/client` に入らない、または事前レンダリングより後に出力される] → 3.1 の検証（`dist/client/images/` にハッシュ名の画像があること）と E2E の写真表示で気づける。代わりに `buildStart` で `public/` 以外の作業フォルダに書き出して公開対象に加える。タスク 3.1 で確定。
- [短い ASCII の銘柄（例「A5」）がチャンクのハッシュ名などに偶然一致して走査が失敗する] → 走査はファイル名と前後の文字を報告するので、誤検出と見分けられる。直し方は銘柄の表記を変えること。
- 正解の埋め込まれた `/host/index.html` は、URL を知っていれば誰でも開ける。これは SSR の `/host` と同じで、proposal の範囲外。
- 説明文に価格を書けない（`public-text-leak`）。代わりに漏洩走査の判定が正確になる。

## Migration Plan

新規アプリなので移行はない。デプロイは `pnpm run deploy`（ビルド → 漏洩走査 → `wrangler deploy`）。初回は Cloudflare へのログイン（`wrangler login`）が要る。戻すときは `wrangler rollback` で直前のバージョンに戻す。

## Open Questions

- 写真 1 枚あたりの容量上限（会場の Wi-Fi 向け、例 500 KB）を検証規則に入れるか。値は写真が揃ってから決める。
- Google Fonts を使うか、フォントを自前で配信するか。会場の回線で実機確認してから決める。
