# Tasks

各タスクは「実装 → 検証コマンドが通る → コミット」で閉じる。検証が通るまで次のタスクに進まない。

- テストの名前は spec の Scenario 名に合わせる。
- 設計の正は design.md の Decisions で、番号はそれを指す。
- 型検査はタスク 1.1 で足す `pnpm typecheck` を使う。それまでは `pnpm exec tsc --noEmit` を使う。

## 1. 会場の純粋な部品

- [x] 1.1 型検査の口をそろえる（Decision 6）。
  - `package.json` に `typecheck` を足す。中身は今の段階では `tsc --noEmit` である。
  - `.github/workflows/ci.yml` で `pnpm typecheck` を流す。
  - 検証: `pnpm typecheck && pnpm test` が通る
- [x] 1.2 `src/venue/` に純粋な部品を書く（Decisions 1・3）。司会画面と参加者画面にはまだ触れない。
  - `src/venue/machine.ts`: `src/host/machine.ts` を複製し、`booting`・`restore` を抜いて `VenueState`・`step`・`positionOf` にする。司会側の `src/host/machine.ts` は残す。
  - `src/venue/protocol.ts`: `Intent`・`VenueView`・`ServerFrame` の zod スキーマ、`PING`・`PONG`、`parseIntent`・`parseServerFrame`・`venueUrl` を書く。
  - `src/venue/view.ts`: `src/host/reveal.ts` を移し、`viewOf` を足す。`src/host/reveal.ts` を import している `HostScreen.tsx`・`tests/unit/reveal.test.ts`・`tests/e2e/content.spec.ts` の import も直す。
  - `kakuzukeQuestions` プラグインで、両方の virtual module に名前付き export `version` を足す。`src/virtual-kakuzuke.d.ts` も直す。
  - 単体テスト:
    - `tests/unit/venue-machine.test.ts`: `tests/unit/machine.test.ts` から `booting`・`restore` 以外のケースを移す。
    - `tests/unit/view.test.ts`: venue-sync spec の「出題中の状態は正解情報を含まない」「正解発表した問題の正解情報だけを含む」「タイトル画面と出題中の状態は画面の種類と問題番号だけを持つ」を、フィクスチャの全状態に対する `viewOf` で確かめる。陽性対照（発表した問題の秘密文字列が見つかること）も入れる。
    - `parseIntent` と `parseServerFrame` が、壊れた入力を null にすること。
    - `version` が、公開項目・正解のどちらを変えても変わること。公開形の `version` が、正解だけを変えたときは変わらないこと。
  - 検証: `pnpm typecheck && pnpm test && pnpm e2e && pnpm build` が通る

## 2. Durable Object と入口

- [x] 2.1 `src/venue/durable-object.ts` に `Venue` を、`src/server.ts` に入口を書き、`wrangler.jsonc` を変える（Decisions 2・6）。
  - `wrangler.jsonc`: `main` を `./src/server.ts` にする。binding `VENUE`、migration v1 の `new_sqlite_classes: ["Venue"]`、`previews.durable_objects.bindings` を足す。
  - `wrangler types` で生成した `worker-configuration.d.ts` をコミットし、`pnpm typecheck` がサーバー側の型も検査するようにする。
  - `tests/e2e/venue.ts` に、Decision 7 のとおりの `resetVenue` と、Node の WebSocket で会場につなぐヘルパーを書く。
  - `playwright.config.ts`: `workers: 1` にし、scenario プロジェクトの `testMatch` に `venue.spec.ts` を足す。
  - 既存の全 spec の `beforeEach` で `resetVenue` を呼ぶ。会場を動かすテストは、`BASE_URL` があるときは skip する。
  - 単体テスト（`tests/unit/venue-do.test.ts`、偽の `ctx`）。venue-sync spec の次の Scenario と、Decision 7 の残りの項目を確かめる。
    - 「会場を作り直しても状態が残る」
    - 「一度も操作していない会場はタイトル画面」
    - 「保存した状態が読めないときはタイトル画面」
    - 「問題セットを変えてデプロイするとタイトル画面に戻る」
    - 「問題数が減ったセットをデプロイするとタイトル画面に戻る」
    - 「参加者としての接続から操作を送っても進行状態は変わらない」
    - 変化がないときは保存も送信もしないこと、upgrade でない要求への 426、つないだ直後の `joined`
  - 新しい E2E（`tests/e2e/venue.spec.ts`、Node の WebSocket で直接つなぐ）:
    - 「すべての画面を閉じても状態が残る」
    - 「次へが 2 つの参加者画面に届く」の会場側（2 本の guest ソケットに `operated` が 1 秒以内に届く）
  - 検証: `pnpm typecheck && pnpm test && pnpm e2e && pnpm build` が通り、`pnpm exec playwright test --project=scenario --list` に `venue.spec.ts` が出る
- [x] 2.2 実際のプレビューのデプロイで、DO が動くかを確かめる（Risks の「プレビュー版と DO」）。
  - `pnpm run deploy:preview` を流し、プレビューの URL の `/api/venue` に司会として WebSocket でつないで、次を確かめる。
    - `joined` が届く。
    - 操作するとプレビューの会場だけが変わり、本番の会場は変わらない。
    - プレビューのコードで DO が動いている。たとえば `publicVersion` がプレビューのビルドの値と一致する。
  - 通らなければ、宣言型の `exports` に切り替えて試す。それでも通らなければ、design の Risks どおりタスク 6.2 を本番のデプロイ後に回す。
  - 結果と判断を verify.md に書く。
  - 検証: プレビューのデプロイのログと、上の 3 点の確認結果

## 3. 購読 API

- [ ] 3.1 `src/venue/useVenue.ts` に、`openVenueSocket(url, deps)` と、それを `useSyncExternalStore` で包んだ `useVenue(role)` を書く（Decisions 4・5）。
  - 単体テスト（偽の `WebSocket`・`document`・時計・`location`）:
    - 最初のフレームまでは `connecting` で、`operate` は null である。フレームを受け取ると `open` になる。
    - 5 秒たってもフレームが届かなければ `lost` になる。`lost` から `connecting` へは戻らない。
    - 切断すると `lost` になり、`view` は最後の値を保つ。`lost` の間は `operate` が null で、押した操作は再接続後にも送られない。
    - 揺らぎ付きのバックオフで再接続する。上限は 5 秒に揺らぎを足した値である。
    - 15 秒ごとに ping を送り、3 秒以内に pong がなければ閉じる。`visibilitychange` で表示に戻ると、閉じていればすぐ再接続し、開いていれば ping で確かめる。pong はフレームとして数えない。
    - `celebration` は、`operated` かつ `revealed` のときだけ `${index}:${run}` になる。`joined` では null になる。
    - `publicVersion` が違えば 1 回だけ再読み込みする。2 回目は再読み込みせず、`view` は null のままである。
    - subscribe するまでソケットを開かない。
  - 検証: `pnpm typecheck && pnpm test` が通る

## 4. 司会画面を会場につなぐ

- [ ] 4.1 `HostScreen` を `useVenue("host")` に移す（Decisions 3・4・5・8）。
  - `/host` の loader と `getHostQuestionSet`・`host-data.functions.ts` を消し、`virtual:kakuzuke/public` を使う。
  - `src/host/machine.ts`・`src/host/restore.ts`・`tests/unit/restore.test.ts`・`tests/unit/machine.test.ts` を消す。
  - 正解発表の表示は `view.reveal` を添字で引いて描く。表示部品と `Celebration.tsx` は `src/ui/` へ移す。
  - 「再接続中」の表示を足す。`view` が null の間は `<main aria-label="司会画面">` だけを出す。
  - `tests/build/leak.test.ts` を Decision 7 のとおりに直す（陽性対照の削除、例外なしの本検査、`HOST_HTML` の分岐の削除）。
  - E2E の移行: `host.spec.ts` の `STORAGE_KEY` と `sessionStorage` に頼る箇所を、会場を前提にした形に直す。`content.spec.ts` の司会画面の検査も、会場を前提にした形に直す。
  - 新しい E2E: host-screen spec の次の Scenario。
    - 「第 3 問で再読み込みすると第 3 問に戻る」
    - 「正解発表後に再読み込みすると正解発表を表示する」
    - 「新しいタブで開くと会場の今の状態を表示する」
    - 「会場がタイトル画面のときに開くとタイトル画面を表示する」
    - 「正解発表中に再読み込みしても演出を再生しない」
    - 「接続が切れると再接続中と表示する」「最初につながらないときは再接続中と表示する」「接続が切れている間のキー操作は捨てる」。切断は Decision 7 の作り方で起こす。
    - venue-sync spec の「2 つの司会画面は同じ状態を表示する」
    - 正解発表の各カードの銘柄が、同じ位置の写真に対応すること
  - 検証: `pnpm typecheck && pnpm test && pnpm e2e && pnpm build` が通る

## 5. 参加者画面を追従させる

- [ ] 5.1 `GuestScreen` を `useVenue("guest")` に移す（Decisions 4・5）。
  - ボタンと `useHydrated` を消す。
  - 問題が変わったら先頭へスクロールし、次の問題の写真を先読みする。
  - 正解発表の表示と紙吹雪は `src/ui/` の部品で描く。
  - 「再接続中」の表示を足す。
  - 幅 360px で正解発表が収まるよう `theme.css` を整える。
  - E2E の移行:
    - `guest.spec.ts` のボタン操作を、司会画面または `tests/e2e/venue.ts` の司会としての接続からの操作に置き換える。
    - `content.spec.ts` の参加者画面の漏洩検査（`はじめる`・`次へ` を押す箇所）を、司会としての接続で進める形に直す。WebSocket のフレームも集めて検査する。
  - 新しい E2E（`guest.spec.ts`、司会 1 つと参加者 2 つのブラウザコンテキスト）:
    - guest-screen spec: 「司会画面への追従」「正解発表の表示」「正解発表の演出」「接続が切れている間の表示」「タイトル画面で司会を待つ」の全 Scenario と、「幅 360px で正解発表が横スクロールなしに見られる」。
    - venue-sync spec:
      - 「正解発表が参加者画面に届く」「前へが参加者画面に届く」
      - 「途中から開いた参加者画面は今の問題から始まる」「正解発表中に開いた参加者画面は正解発表を表示する」
      - 「切断中に進んだ状態に再接続で追いつく」「接続が切れても自動で再接続する」「画面が表示に戻るとすぐ再接続する」「応答しなくなった接続を切れたものとして扱う」
      - 「参加者画面でキーを押しても進行状態は変わらない」
      - 「問題セットが変わった後に古い参加者画面は読み込み直す」。公開版の値をフレームの中継で書き換えて起こす。
    - 漏洩（Decision 7）: 参加者のブラウザが受け取った HTTP 応答と WebSocket フレームで、次の 3 つを確かめる。
      - 「参加者画面を進める間に受け取る応答に正解情報を含まない」
      - 「正解発表した問題の正解情報だけを含む」
      - 「発表後に戻した問題へ途中参加しても正解情報は届かない」
  - 検証: `pnpm typecheck && pnpm test && pnpm e2e && pnpm build` が通る

## 6. 説明と実機の確認

- [ ] 6.1 README を直す。
  - 「画面と URL」「操作」: 参加者画面が司会に追従すること、正解は発表したときだけ `/` に届くこと。
  - 問題セットを変えてデプロイすると、会場がタイトル画面に戻ること。リハーサルから同じ問題セットで本番へ移るときは、「前へ」でタイトル画面まで戻すこと。
  - E2E と `pnpm dev` が手元の会場を共有すること。`BASE_URL` で流すときは会場を動かすテストが skip されること。
  - プレビュー環境の会場が本番と分かれているか（タスク 2.2 の結果）。
  - 検証: `pnpm typecheck && pnpm test && pnpm e2e && pnpm build` が通る
- [ ] 6.2 プレビュー環境（タスク 2.2 で使えなければ、本番のデプロイ後に `resetVenue` で戻した会場）で、実機のスマホ 1 台以上を使って次の 3 点を確かめ、結果を verify.md に書く。
  - 司会の操作に 1 秒以内で追従するか（体感）
  - 正解発表と紙吹雪が出るか
  - 画面をスリープして司会が 2 問進めた後、復帰すると追いつくか
  - 検証: 実機での確認結果を verify.md に書く
