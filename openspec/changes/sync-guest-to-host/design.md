# Design

## Context

- 司会の状態機械 `step` はブラウザの `useReducer` で動き、位置を `sessionStorage` に保存している（`src/host/machine.ts`、`src/host/restore.ts`）。参加者画面は自分の `useState` で動く。
- 正解入りのデータは `getHostQuestionSet`（`src/host/host-data.functions.ts`）だけが返し、`/host` の事前レンダリング HTML にも載る（`tests/build/leak.test.ts` の陽性対照が前提にしている）。このサーバー関数は認証なしで全問の正解を返す。
- `virtual:kakuzuke/answers` は ssr 環境でしか load できず、クライアントから import するとビルドが失敗する（`src/question-set/vite-plugin.ts:131-134`）。
- `@cloudflare/vite-plugin` の worker の入口は、wrangler の `main` を `export *` するだけである（`node_modules/@cloudflare/vite-plugin/dist/index.mjs:64311-64331`）。既定の `@tanstack/react-start/server-entry` は default export しか持たない。TanStack Start が `src/server.ts` へ張る alias は `virtual:tanstack-start-server-entry` にしか効かない（`start-plugin-core/dist/esm/vite/planning.js:17-21`）。
- 試作（scratchpad の probe）で次のことを確かめた。
  - `main` を `src/server.ts` にし、そこから DO クラスを export すると、`vite build`（事前レンダリングを含む）が通る。
  - その状態で、`vite dev` と `vite preview` の両方で WebSocket の upgrade が 101 を返し、answers を読んだフレームが届く。
  - 既定の `main` のままだと、build は「no such Durable Object class is exported」で落ちる。
- プレビュー版のデプロイは Workers Builds が `pnpm run deploy:preview`（`wrangler preview`）で行う（README の「デプロイ」）。`wrangler preview` はプレビューごとに DO の migration を当て、migration の tag もプレビューごとに持つ（`wrangler/wrangler-dist/cli.js:185604-185636`）。`wrangler/config-schema.json` の `PreviewsConfig` は `durable_objects.bindings` を持つ。
- CI（`.github/workflows/ci.yml`）は `pnpm test` と `pnpm e2e` を流し、型検査は流していない。

## Goals / Non-Goals

**Goals:**

- 進行状態の書き手を Durable Object の 1 か所にする。
- 正解がサーバーの外へ出る経路を、DO が配る正解発表中の状態の 1 本に絞る。司会画面も同じ経路で正解を受け取る。
- 司会画面と参加者画面が、同じ購読 API を同じ使い方で使う。
- 状態を、それを作った問題セットに結び付ける。問題セットが変わったら、前の状態を使わない。

**Non-Goals:**

- 司会画面を 2 枚開いてほぼ同時に操作したときの調停。2 枚とも「次へ」を押すと 2 問進む。
- 司会の操作を、往復を待たずに画面へ先に出すこと（楽観的な更新）。
- 会場を複数持つことと、テスト専用の API。

## Decisions

### 1. データの形

```ts
// src/venue/machine.ts（共有の純関数。今の src/host/machine.ts から booting と restore を抜いたもの）
type VenueState =
  | { phase: "title" }
  | { phase: "asking"; index: number }
  | { phase: "revealed"; index: number; run: number }; // run は正解発表を押した回数
function step(state: VenueState, intent: Intent, total: number): VenueState; // 変化なしは同じ参照

// DO の storage に保存する値。version は問題セット全体（正解込み）のハッシュ
type Stored = { version: string; state: VenueState };

// src/venue/protocol.ts（共有。zod で境界の parse を持つ）
type Intent = { type: "next" | "prev" | "reveal" };                // 司会 → 会場
type VenueView =                                                     // 画面が描く状態。司会にも参加者にも同じものを送る
  | { phase: "title" }
  | { phase: "asking"; index: number }
  | { phase: "revealed"; index: number; run: number; reveal: RevealView };
type ServerFrame = {                                                 // 会場 → 画面はこの 1 種類
  type: "snapshot";
  cause: "joined" | "operated";
  publicVersion: string;                                             // 公開形の問題セットのハッシュ
  view: VenueView;
};
const PING = "ping"; const PONG = "pong";                           // DO の自動応答とクライアントで共有する
```

- 正解を置ける場所は `revealed` の `reveal` だけにする。`title` と `asking` は、型の上で正解を持てない。
- `RevealView` は今の `src/host/reveal.ts` と同じ形にする。`options` は表示順で、公開形の `options` と添字で対応する。司会画面はラベルで突き合わせるのをやめ、添字で引く。
- DO に保存するのは `Stored` だけにする。`VenueView` は配るたびに導出し、保存した値と二重に持たない。
- ハッシュはビルド時に `kakuzukeQuestions` プラグインが計算し、それぞれの virtual module の名前付き export `version` に出す。
  - `virtual:kakuzuke/public` の `version` は、公開形の JSON の SHA-256 である。
  - `virtual:kakuzuke/answers` の `version` は、正解込みの問題セットの JSON の SHA-256 である。
  - 正解込みのハッシュはサーバーの外へ出さない。

### 2. 司会は相対の意図を送り、会場が `step` を回す

```ts
// src/venue/durable-object.ts
constructor(ctx, env) {
  super(ctx, env);
  const stored = StoredSchema.safeParse(ctx.storage.kv.get(STATE_KEY));
  // 読めない値と、別の問題セットで作った状態はタイトル画面に戻す（venue-sync spec）
  this.#state = stored.success && stored.data.version === ANSWERS_VERSION ? stored.data.state : TITLE;
  if (!stored.success || stored.data.version !== ANSWERS_VERSION) this.#save();
  ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
}
async fetch(request) {
  if (request.headers.get("Upgrade") !== "websocket") return new Response(null, { status: 426 });
  const role = parseRole(new URL(request.url).searchParams.get("role"));   // 不明は guest
  const [client, server] = Object.values(new WebSocketPair());
  this.ctx.acceptWebSocket(server, [role]);
  server.send(this.#frame("joined"));
  return new Response(null, { status: 101, webSocket: client });
}
webSocketMessage(ws, data) {
  if (!this.ctx.getTags(ws).includes("host")) return; // 参加者のソケットからの意図は捨てる
  const intent = parseIntent(data);                  // 境界で zod。壊れた入力は捨てる
  if (intent === null) return;
  const next = step(this.#state, intent, SET.questions.length);
  if (next === this.#state) return;                  // 変化がなければ保存も配信もしない
  this.#state = next;
  this.#save();
  this.#broadcast("operated");
}
```

- 今の `step` の遷移と単体テストをそのまま流用できる。
- 司会がキーを連打しても、押した回数だけ進む。
- 意図は再送しない。切断中の操作は送れない（Decision 4）ので、同じ意図が二重に届く経路がない。
- 問題セットが同じなら、`index` は必ず範囲内にある。そのため、問題数が減ったときの丸めは不要になり、`clampState` は作らない。
- 保存の後に送る順にしてある。DO の output gate が、保存の確定まで送信を外へ出さない見込みである。この挙動は手元で確かめていない。保存が失われても、次の `joined` で全画面が収束する。
- ソケットは Hibernation API で受け、役割をタグに持たせる。ping と pong は `setWebSocketAutoResponse` が DO を起こさずに返す。

### 3. 漏洩の関所は `viewOf` の 1 関数

- `virtual:kakuzuke/answers` を import するのは `src/venue/durable-object.ts` だけにする。
- 配る view を作るのは `viewOf(state, set)` だけにする。`revealed` の枝でだけ `revealView(set.questions[index])` を呼ぶ。`viewOf` は `toPublic` と同じ許可リスト方式で、項目ごとに新しいオブジェクトを作る。spread はしない。
- 司会画面は `/host` の loader をやめ、参加者と同じ `virtual:kakuzuke/public` を使う。発表前の司会画面は公開情報しか出さないので、これで足りる。正解は `VenueView` で受け取る。
- `getHostQuestionSet` と `host-data.functions.ts` は削除する。これで `/host` の HTML と、認証なしのサーバー関数の応答から正解が消える。

### 4. 両画面が使う購読 API `useVenue`

```tsx
// src/guest/GuestScreen.tsx
const { view, connection, celebration } = useVenue("guest");
// src/host/HostScreen.tsx
const venue = useVenue("host");
useEffect(() => installHostKeys(window, (e) => venue.operate?.(e)), [venue.operate]);
```

```ts
interface VenueConnection {
  view: VenueView | null;                        // 最初のフレームが届くまで null。切断中は最後の値を保つ
  connection: "connecting" | "open" | "lost";    // 「再接続中」は lost のときだけ出す
  celebration: string | null;                    // 紙吹雪の key（`${index}:${run}`）
}
interface HostVenueConnection extends VenueConnection {
  operate: ((intent: Intent) => void) | null;    // open のときだけ関数
}
```

- ページにつき 1 本のソケットを `useSyncExternalStore` で共有する。中身は React に依存しない `openVenueSocket(url, deps)` に置く。単体テストでは `WebSocket`・`document`・時計を差し替える。
- ソケットは subscribe されたときに初めて開く。`getServerSnapshot` は `{ view: null, connection: "connecting" }` を返すので、SSR と事前レンダリングでは接続しない。
- `connection` の遷移は次のとおりとする。
  - `open` になるのは、その接続で最初のフレームを受け取ったとき。ソケットが開いたときではない（候補 B から移植）。
  - `lost` になるのは、接続が切れたとき、または開いてから 5 秒たってもフレームが届かないとき。
  - `lost` から `connecting` へは戻さず、次にフレームが届くまで `lost` のままにする。再接続を試すたびに「再接続中」が点滅しないようにするためである。
- `operate` は `open` のときだけ関数で、それ以外は `null` である。そのため、切断中にキーやボタンを押しても何も溜まらない。
- 接続が生きているかを確かめるため、表示中は 15 秒ごとに `PING` を送る。3 秒以内に `PONG` が返らなければ閉じて再接続する。`visibilitychange` で表示に戻ったときも、同じ確認をすぐに行う。`PONG` はフレームとして数えず、`open` への遷移にも使わない。
- 再接続は、上限 5 秒の指数バックオフに、0〜1 秒の揺らぎを足して行う。
- フレームの `publicVersion` が自分の `virtual:kakuzuke/public` の `version` と違うときは、`location.reload()` する。
  - 再読み込みは同じ版に対して 1 回だけにする。対象の版を `sessionStorage` に記録して判定する。
  - 再読み込みしても違うときは、`view` を `null` のままにする。参加者画面はタイトル画面、司会画面は何も出さない。
- 参加者画面は、`view` が `null` の間はタイトル画面を出す。司会画面は、`aria-label="司会画面"` の `<main>` だけを出す。

### 5. 紙吹雪は `cause` から導く

- `celebration` は、最後のフレームが `cause: "operated"` で `view.phase === "revealed"` のときだけ `` `${index}:${run}` ``、それ以外は `null` とする。
- `revealed` へ遷移させる意図は `reveal` だけなので、この判定で足りる。
- 同じ問題を発表し直すと `run` が変わり、紙吹雪を作り直す。key に `index` を含めるので、間に描画を挟まずに別の問題の発表へ移っても作り直す。
- つないだ直後と再接続後のフレームは `joined` なので鳴らない。発表の演出中に再接続すると演出が途中で消えるが、spec どおりとして受け入れる。
- 司会のスタンプの点滅も同じ値で決める。
- `Celebration.tsx` は `src/ui/` へ移し、両画面で使う。

### 6. 入口と設定

```ts
// src/server.ts
import handler from "@tanstack/react-start/server-entry";
export { Venue } from "./venue/durable-object.ts";
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (new URL(request.url).pathname === VENUE_PATH) return env.VENUE.getByName(VENUE_NAME).fetch(request);
    return handler.fetch(request, env, ctx);
  },
};
```

- 会場への入口は Start の request scope の外で処理する。101 の応答が Start の応答加工を通らず、`cloudflare:workers` の import も要らない。
- WebSocket の入口は `/api/venue?role=host|guest` にする。
- `wrangler.jsonc` は次のようにする。
  - `main` を `./src/server.ts` にする。
  - binding `VENUE` を DO クラス `Venue` に割り当てる。
  - `migrations` の v1 で `new_sqlite_classes: ["Venue"]` とする。
  - `previews.durable_objects.bindings` にも `VENUE` を置く。
- プレビュー版が本番と別の DO の名前空間を使うことと、プレビュー版の DO がそのプレビューのコードで動くことは、タスク 2.2 で実際のプレビューのデプロイで確かめる。
  - 宣言型の `exports`（`migrations` と排他）は、`migrations` で通らなかったときの代わりにする。
- 型の扱い:
  - Workers の型は `wrangler types` で `worker-configuration.d.ts` に生成し、コミットする。
  - 型検査は `pnpm typecheck` 1 本にまとめ、CI でも流す。
  - DOM の型と衝突して tsconfig を分けるときは、`typecheck` が両方の `-p` を流す。`pnpm exec tsc --noEmit` だけでサーバー側の型検査が抜けないようにする。

### 7. テスト

- 単体テスト:
  - `step`: 今の `machine.test.ts` のケースを流用する。
  - `viewOf`:
    - フィクスチャの全状態について、正解発表中の問題の秘密文字列だけが出て、他の問題の秘密文字列が出ないことを確かめる。
    - `title`・`asking`・`revealed` の view のキーの集合が許可リストと完全一致することを確かめる。今の `PUBLIC_*_KEYS` と同じ形の検査である。
  - `Venue`: 偽の `ctx`（メモリの `storage.kv`、`acceptWebSocket`・`getTags`・`getWebSockets`・`setWebSocketAutoResponse`）で作る。
    - 同じ storage の上で 2 回作り、状態が戻ること。
    - 版が違うとき・読めない値のときはタイトル画面に戻り、すぐ保存すること。
    - guest のタグの意図を捨てること。
    - 変化がないときは保存も送信もしないこと。
    - upgrade でない要求に 426 を返すこと。
    - つないだ直後に `joined` を送ること。
  - `openVenueSocket`:
    - `connection` の遷移（5 秒の初回タイムアウトを含み、`lost` から `connecting` へ戻らない）
    - 15 秒の ping と 3 秒の pong 期限、`visibilitychange` での確認
    - 揺らぎ付きのバックオフ
    - `celebration` の導出
    - `publicVersion` が違うときの 1 回だけの再読み込み
- E2E:
  - 会場は 1 つなので `workers: 1` で直列に流す。
  - `tests/e2e/venue.spec.ts` を scenario プロジェクトの `testMatch` に足し、`--list` で数に入っていることを確かめる。
  - `resetVenue(baseURL)` は、Node の WebSocket から `role=host` でつなぎ、`joined` の状態を読んで、`title` になるまで `prev` を送る。`prev` を送るたびに `operated` を待つ。`joined` がすでに `title` なら何も送らない。全体を 5 秒のタイムアウトで包む。テスト専用の口は作らない。
  - 会場を動かすテストは、`BASE_URL` が設定されていれば skip する。デプロイ先に向けて流すときに本番の会場を動かさないためである。`BASE_URL` で流れるのは、会場を動かさない検査（smoke と、届く HTML・JS の漏洩検査）だけになる。
  - `pnpm e2e` はフィクスチャと `content/` の 2 回ビルドし、同じ `.wrangler/state` を使う。版が違うので、2 回目の起動で会場はタイトル画面に戻る。
  - 漏洩検査では、受け取った HTTP 応答と WebSocket フレーム（`framereceived`）をすべて集め、秘密文字列を走査する。あわせて、各フレームを parse し、`revealed` 以外のキーの集合が `{phase}` か `{phase, index}` であることを確かめる。
  - 切断の作り方:
    - 「サーバー側で切る」は、`page.routeWebSocket` で中継して、サーバー側を閉じる。
    - 「切れたまま」は、`routeWebSocket` でクライアント側を受けたまま `connectToServer` しない。テストの合図で中継を始めて、つなぎ直させる。
  - `visibilitychange` は、`page.evaluate` で `document.visibilityState` を上書きし、イベントを dispatch して起こす。
  - 正解発表の各カードの銘柄が、同じ位置の写真に対応することを、既存の `photoBoxes` で確かめる。
- ビルドの漏洩検査（`tests/build/leak.test.ts`）:
  - 陽性対照「`host/index.html` から全秘密文字列が見つかる」を削除する。
  - 本検査を、例外なしの「どのファイルにも秘密文字列がない」に強める。
  - 写真の元のファイル名の検査から `HOST_HTML` の分岐を消し、全ファイルを `baseNames` で走査する。
  - 秘密文字列が実際に見つかることは、`viewOf` の単体テストの陽性対照で担保する。

### 8. 削除と移動

- 削除:
  - `src/host/restore.ts` と `tests/unit/restore.test.ts`
  - `src/host/host-data.functions.ts`
  - 参加者画面の `useHydrated` とボタン
- 移動:
  - `src/host/machine.ts` は `src/venue/machine.ts` へ移す。タスク 1 では複製し、司会画面を移すタスク 4 で司会側を消す。
  - `src/host/reveal.ts` は `src/venue/view.ts` へ移す。
  - `src/host/Celebration.tsx` は `src/ui/` へ移す。正解発表の表示部品（ラベル・正解の印・銘柄・価格）も `src/ui/` に置き、両画面で使う。
- 移す module を import している箇所はすべて同じタスクで直す。`tests/unit/{machine,reveal}.test.ts` と `tests/e2e/content.spec.ts` がそれにあたる。

### 却下した案

- 司会が次の状態を計算して絶対値で送り、DO は検証して配るだけにする案（候補 B）。
  - 長所: 2 枚の司会画面が同時に「次へ」を押しても 1 問だけ進む。
  - 短所: 連打に追従するには、未確認の目標（pending）と ack の照合を司会側に持つ必要がある。状態機械も、司会とサーバーの両方に分かれる。
  - 結論: 司会画面は通常 1 枚なので、得られるものより増える部品が多い。
- 問題数が減ったときだけ範囲内に丸める案（`clampState`）。問題数が同じか増えたときは、前の問題セットの `revealed` が残り、誰も発表していない新しい問題の正解を参加者へ配ってしまう。
- 司会がブラウザで状態を持ち続け、会場へは写しを送るだけにする案。書き手が司会のタブごとに増え、再読み込みや 2 枚目のタブで状態が食い違う。
- Durable Object を使わず、ポーリングと KV で配る案。KV は書き込みの反映に最大で数十秒かかり、「1 秒以内に届く」を満たせない。

## Risks / Trade-offs

- [プレビュー版と DO] プレビュー版が DO に届くか、本番と別の名前空間を使うか、そのプレビューのコードで DO が動くかを、まだ実際のデプロイで確かめていない。→ タスク 2.2 で `pnpm run deploy:preview` を実際に流して確かめる。プレビューで確かめられなければ、実機の確認（タスク 6.2）は本番のデプロイの後に、`resetVenue` で会場を戻してから行う。
- [司会の表示は往復を待つ] 操作から表示まで 1 往復かかる。同じ Cloudflare の拠点を通るので数十ミリ秒の見込みで、まだ測っていない。→ E2E で「1 秒以内」を確かめ、会場の回線では実機で体感を確かめる。
- [手元の会場を E2E が動かす] `pnpm dev` と E2E は同じ `.wrangler/state` を使うので、E2E を流すと手元の会場の状態が変わる。→ 手元の状態は使い捨てとして受け入れ、README に書く。
- [リハーサルから本番へ] 問題セットを変えずにリハーサルから本番へ移るときは、会場の状態が残る。タイトル画面へ戻すには「前へ」を押し続ける必要がある。→ README の操作説明に書く。

## Migration Plan

1. main へのマージで `wrangler deploy` が走り、DO の migration v1 が適用される。旧版の司会画面を開いたままの人は、再読み込みすると新しい版になる。
2. 会場の初期状態はタイトル画面なので、データの移行はない。旧版の `sessionStorage` の値は読まれず、残っても害はない。
3. 戻すときは前の版を再デプロイする。DO クラスを消す migration は書かない。会場の状態は残るが、旧版は読まない。
