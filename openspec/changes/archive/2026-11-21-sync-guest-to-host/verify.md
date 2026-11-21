# Verify

## Result

PASS。CRITICAL は 0 件。

- tasks.md は 9/9 完了で、`openspec validate sync-guest-to-host` が通る。
- `54aac4a` で次のコマンドが通った。
  - `pnpm typecheck`
  - `pnpm test`（174 件）
  - `pnpm e2e`（scenario 90 件・content 8 件、ビルドの漏洩検査 11 件 × 2）
  - `pnpm build`
- プレビュー環境で次のことを確かめた。
  - 会場の動作
  - 2 分半放置した後と、同じ問題セットで上げ直した後の状態の保持
  - ブラウザでの司会から参加者への切り替え
  - 実機のスマホでの 5 項目（ユーザーが確認）

WARNING は 2 件。

1. 本番とプレビューの会場が分かれているかは未確認である。本番にまだ会場がない（本番の `/api/venue` は 404）ためで、マージ後に確かめる（Blast Radius の「Before you merge」）。
2. 「問題セットが変わった後に古い参加者画面は読み込み直す」の E2E は、中継で `publicVersion` を書き換えて起こしている。実際の再デプロイではないので、読み込み直した後に出るのが新しい問題セットのタイトル画面であることまでは確かめていない。

## Spec Coverage

BASE_URL を付けて流すと、`host.spec.ts`・`guest.spec.ts`・`venue.spec.ts` は会場を動かすので全体が skip される。`tests/unit` と `tests/build` は影響を受けない。

### venue-sync

| Requirement / Scenario | 実装 | テスト |
| --- | --- | --- |
| 進行状態を 1 か所で持つ: 2 つの司会画面は同じ状態を表示する | `src/server.ts:8`、`src/venue/room.ts:60` | `tests/e2e/host.spec.ts:238` |
| 進行状態を 1 か所で持つ: 参加者画面でキーを押しても進行状態は変わらない | `src/venue/room.ts:61` | `tests/e2e/guest.spec.ts:533` |
| 進行状態を 1 か所で持つ: 参加者としての接続から操作を送っても進行状態は変わらない | `src/venue/room.ts:53`・`:61` | `tests/unit/venue-do.test.ts:156` |
| 状態の変化を全画面へ届ける: 次へが 2 つの参加者画面に届く | `src/venue/room.ts:68`、`src/venue/socket.ts:158` | `tests/e2e/venue.spec.ts:37`（1 秒以内）、`tests/e2e/guest.spec.ts:137`（2 枚の画面の表示） |
| 状態の変化を全画面へ届ける: 正解発表／前へが参加者画面に届く | 同上、`src/guest/GuestScreen.tsx:53` | `tests/e2e/guest.spec.ts:430`・`:441` |
| つながった画面に今の状態を届ける: 途中から開いた・正解発表中に開いた・切断中に進んだ状態に追いつく | `src/venue/room.ts:56`、`src/venue/socket.ts:130` | `tests/e2e/guest.spec.ts:453`・`:459`・`:465`、`tests/unit/venue-do.test.ts:206` |
| 進行状態を保存する: すべての画面を閉じても状態が残る | `src/venue/room.ts:41`・`:72` | `tests/e2e/venue.spec.ts:19` |
| 進行状態を保存する: 会場を作り直しても状態が残る | `src/venue/room.ts:41` | `tests/unit/venue-do.test.ts:101`。プレビューでも同じ問題セットを上げ直して `asking/2` が残ることを確かめた |
| 進行状態を保存する: 一度も操作していない／保存した状態が読めないときはタイトル画面 | `src/venue/room.ts:10`・`:45` | `tests/unit/venue-do.test.ts:111`・`:115` |
| 問題セットが変わったらタイトル画面に戻す: 2 Scenario | `src/venue/room.ts:43`、`src/question-set/vite-plugin.ts:93` | `tests/unit/venue-do.test.ts:127`・`:142` |
| 古い版の画面は読み込み直す | `src/venue/socket.ts:67`・`:172` | `tests/e2e/guest.spec.ts:550`、`tests/unit/use-venue.test.ts:249`（WARNING 2） |
| 参加者へ届ける正解の範囲: 4 Scenario | `src/venue/view.ts:22`、`src/venue/protocol.ts:39` | `tests/unit/view.test.ts:21`・`:27`・`:35`、`tests/e2e/guest.spec.ts:601`・`:619`・`:640`、`tests/e2e/content.spec.ts:196` |
| 接続が切れたら自動で再接続する: 3 Scenario | `src/venue/socket.ts:130`・`:142`・`:182` | `tests/e2e/guest.spec.ts:482`・`:495`・`:518`、`tests/unit/use-venue.test.ts:167`・`:180`・`:213` |

### host-screen

| Requirement / Scenario | 実装 | テスト |
| --- | --- | --- |
| タイトル画面と QR コード: 2 Scenario | `src/host/HostScreen.tsx:34`・`:55` | `tests/e2e/host.spec.ts:98`・`:105` |
| 会場の進行状態を表示する: 3 Scenario | `src/host/HostScreen.tsx:18`、`src/venue/room.ts:56` | `tests/e2e/host.spec.ts:217`・`:224`・`:230` |
| つないだ直後は演出を再生しない | `src/venue/socket.ts:63`、`src/ui/RevealedCard.tsx:32` | `tests/e2e/host.spec.ts:249`、`tests/unit/use-venue.test.ts:236` |
| 接続が切れている間の表示と操作: 3 Scenario | `src/host/HostScreen.tsx:29`・`:134`、`src/venue/socket.ts:85`・`:127` | `tests/e2e/host.spec.ts:262`・`:272`・`:281`、`tests/unit/use-venue.test.ts:137`・`:152` |

### guest-screen

| Requirement / Scenario | 実装 | テスト |
| --- | --- | --- |
| 司会画面への追従: 4 Scenario | `src/guest/GuestScreen.tsx:14`・`:22` | `tests/e2e/guest.spec.ts:137`・`:145`・`:154`・`:167` |
| 正解発表の表示: 4 Scenario | `src/guest/GuestScreen.tsx:53`、`src/ui/RevealedCard.tsx:21` | `tests/e2e/guest.spec.ts:201`・`:210`・`:219`・`:231` |
| 正解発表の演出: 4 Scenario | `src/guest/GuestScreen.tsx:76`、`src/ui/Celebration.tsx:10` | `tests/e2e/guest.spec.ts:243`・`:254`・`:270`・`:278` |
| 接続が切れている間の表示: 3 Scenario | `src/guest/GuestScreen.tsx:28`、`src/venue/socket.ts:127`・`:178` | `tests/e2e/guest.spec.ts:292`・`:303`・`:312` |
| タイトル画面で司会を待つ: 3 Scenario | `src/guest/GuestScreen.tsx:31` | `tests/e2e/guest.spec.ts:326`・`:331`・`:337` |
| 正解情報を表示しない（MODIFIED）: 3 Scenario | `src/guest/GuestScreen.tsx:63`、`src/ui/OptionCard.tsx:25` | `tests/e2e/guest.spec.ts:345`・`:356`・`:366` |
| 参加者に届くデータに正解情報を含めない（MODIFIED）: 5 Scenario | `src/venue/view.ts:22`、`src/question-set/model.ts:45` | `tests/e2e/guest.spec.ts:601`、`tests/e2e/content.spec.ts:183`（BASE_URL でも流れる）・`:196`、`tests/build/leak.test.ts:98`・`:105`・`:111`・`:130`・`:145` |
| スマホでの表示（MODIFIED）: 2 Scenario | `src/styles/theme.css:345`・`:377` | `tests/e2e/guest.spec.ts:391`・`:404` |
| 問題画面の表示（MODIFIED）: 2 Scenario | `src/guest/GuestScreen.tsx:56` | `tests/e2e/guest.spec.ts:182`・`:188` |

削除した要件（host「再読み込みで同じ問題に戻る」「タイトル画面」、guest「前後の画面への移動」「タイトル画面」）の旧挙動を確かめるテストは残っていない。

- `tests/e2e/` に「はじめる」は 0 件である。`tests/e2e/guest.spec.ts:154` は、ボタンが 0 件であることを確かめている。
- `tests/e2e/host.spec.ts:209`「タイトル画面で再読み込みするとタイトル画面のまま」は、旧要件と同じ名前のテストである。ただし確かめているのは、会場がタイトル画面のときに再読み込みしてもタイトル画面のままであることで、新しい挙動と矛盾しない。

## Blast Radius

### 何が変わるか

- 司会の進行状態の持ち主が、司会のタブ（`sessionStorage`）から Durable Object「会場」に変わる。
- worker の入口が、TanStack Start の既定の入口から `src/server.ts` に変わる（`wrangler.jsonc` の `main`）。
- 正解を返していたサーバー関数 `getHostQuestionSet` を消した。これで、`/host` の HTML と、認証なしの `/_serverFn` の応答から正解が消える。

### 安全の根拠になる事実

正解がクライアントに届く経路は、`viewOf` の `revealed` の枝だけである。そのため、HTML・JS・発表前の WebSocket フレームのどれにも正解は載らない。

この事実は「4. 実行して確かめた」の段階まで確かめた。

- `virtual:kakuzuke/answers` を import するのは `src/venue/durable-object.ts:2` だけである。この module はクライアントの環境では load できない（`src/question-set/vite-plugin.ts:136`）。
- `54aac4a` で `content/` をビルドし、次のことを確かめた。
  - 実データの最初の解説文を `grep -rlF` で探すと、`dist/client` では 0 件（exit 1）、`dist/server/index.js` では 1 件だった。
  - ビルドの漏洩検査「どのファイルにも秘密文字列がない」が通った。
- E2E は、参加者のブラウザが受け取った HTTP 応答と WebSocket フレームをすべて集めて走査し、正解発表した問題の秘密文字列だけが出ることを確かめている（陽性対照あり）。
- タスク 5.1 の変異検査として、`viewOf` に全問の解説を混ぜると、`tests/e2e/guest.spec.ts:619` が漏洩の検査で落ちた。

### Risks

| 壊れ方 | 場所 | 起こりやすさ・影響 | 確かめ方 |
| --- | --- | --- | --- |
| 本番の初回デプロイで DO の migration v1 が適用できず、Workers Builds のデプロイが失敗する | `wrangler.jsonc` の `migrations`。本番は `pnpm run deploy`（`wrangler deploy`）で、プレビューで通った `wrangler preview` とは経路が違う | 低い。プレビューでは同じアカウントで SQLite の DO の migration が通った（段階 5）。失敗しても本番は前の版のまま動き続ける | マージ後に Workers Builds のログで、デプロイの成功と migration の適用を確かめる |
| プレビューと本番が同じ会場を共有し、プレビューの操作が本番の会場を動かす | `wrangler.jsonc` の `previews.durable_objects` | 未確認。`wrangler preview` はプレビューごとに migration の tag を持つ（`wrangler/wrangler-dist/cli.js:185604`）ので、分かれる見込みである | マージ後の本番デプロイの後、プレビューの会場を動かし、本番の `/api/venue` の `joined` が変わらないことを確かめる |
| デプロイの瞬間に開いていた旧版の画面が壊れる | 旧版の参加者画面は会場を使わない。旧版の司会画面は読み込み済みのデータで動く | 低い。どちらも再読み込みすると新しい版になる。旧版の `sessionStorage` の値は読まれない | 本番デプロイの後に司会画面を再読み込みする |
| サーバー側のファイルを足したとき、型検査から漏れる | `tsconfig.json` の `exclude` と `tsconfig.worker.json` の `include` を手で並べている | 低い。漏れると、ブラウザの設定で型検査して落ちるか、どちらの設定にも入らない | サーバー側のファイルを足すときに両方の一覧を直す |

### Cleared

- **`main` の変更による事前レンダリング**: `pnpm build` が通り、プレビューで `/` と `/host` が配信された。デプロイ先に向けた content E2E も、5 件通り 3 件 skip だった。
- **休止状態からの復元**: プレビューで正解発表のまま 150 秒放置した後に「次へ」を送ると、`asking/2` になった。
- **同じ問題セットでの再デプロイ**: プレビューを上げ直した後に新しくつなぐと、`asking/2` のまま残っていた。
- **SSR と事前レンダリングで接続しないこと**: `getServerSnapshot` は接続を開かない（`tests/unit/use-venue.test.ts`）。事前レンダリングした HTML の smoke 検査も通った。
- **Durable Object を使えるプランか**: 同じアカウントでプレビューの migration と WebSocket が動いた。

### Before you merge

- CI（`pnpm typecheck`・`pnpm test`・`pnpm e2e`）が PR で通ることを確かめる。
- マージ後に、Workers Builds の本番デプロイのログで migration の適用を確かめる。あわせて、プレビューの会場を動かしても本番の `/api/venue` の `joined` が変わらないことを、`scratchpad` の `peek.mjs` と同じ手順で確かめる。

## Interrogate

実施していない。設計の問いは、計画の段階の interrogate（レビュアー 2 人）で出た指摘を反映して閉じた。実装の段階で新しく開いた問いもない。
