# Sharpen

## Request

> 同期を考えたい。発表者用の画面に同期して参加者側の画面も切り替えたいな。
> 問題の移動と、正解も回答者画面で見えるようにしたい。

対話で確定した前提（ユーザー回答の要約）:

- 参加者は完全に司会に追従する。参加者側の前へ・次へ・はじめるはなくす。
- 正解発表のとき、参加者画面にも司会画面と同じ情報（ラベル・正解の印・順位・銘柄・価格・解説）を出す。紙吹雪も出す。
- 操作できるのは今のまま `/host` を知る人。認証は足さない。
- 中身が `.openspec.yaml` だけだった未着手の change `limit-guest-to-host-progress` は、この change で置き換える。

## Sharpened

参加者画面を司会画面に完全に同期させる。

- **状態の持ち主**: サーバーの Durable Object「会場」を 1 つ置き、司会の状態（タイトル・出題中・正解発表と問題番号）を持たせる。司会画面は操作を送り、届いた状態を描画する。今の `sessionStorage` による復元は、サーバーが持つ状態に置き換える。
- **参加者の表示**: 参加者は操作しない。前へ・次へ・はじめるのボタンをなくす。
  - 開いたとき・再接続したとき・スリープから復帰したときは、サーバーの今の状態を表示する。
  - タイトル画面は会のタイトルだけを出し、司会が始めるのを待つ。
  - 接続が切れている間は「再接続中」と小さく出す。
- **参加者側の正解発表**: 司会画面の発表後と同じ情報と紙吹雪を出す。司会が前後の問題へ移ったら、それに合わせる。
- **正解の守り方**: 参加者に届く HTML と JS には、これまでどおり正解を含めない。正解は発表したときにだけ WebSocket で届け、発表前の問題の正解はどの応答にも含めない。
- **通信が不安定な場合への備え**: スマホのスリープや回線の切り替えで切れても、自動で再接続して最新の状態に追いつく。次の問題の写真は切り替わる前に先読みする。
- **範囲外**: 操作の認証、複数の会場（部屋）を同時に開くこと、参加者の回答の集計。

## Current System

- 司会の状態機械は `booting`・`title`・`asking`・`revealed` の 4 相で、ブラウザの `useReducer` が動かしている（`src/host/machine.ts:3`、`src/host/HostScreen.tsx:16`）。`revealed` の `run` は正解発表を押した回数で、紙吹雪をやり直すために使う（`src/host/machine.ts:7`）。
- 司会の位置は `sessionStorage` に保存し、`restore` イベントで復元する（`src/host/restore.ts:15`、`src/host/HostScreen.tsx:18`）。状態はタブごとに閉じていて、司会画面を 2 枚開くと別々に動く。
- 位置の移動と境界の計算は `src/deck/cursor.ts:12` の `move` と `boundsOf` が持ち、司会画面と参加者画面の両方が使う。
- 参加者画面は自分の `useState` で位置を持ち、司会とは連動しない（`src/guest/GuestScreen.tsx:20`）。spec でも「参加者画面の移動は司会画面の状態と連動しない」と定めている（`openspec/specs/guest-screen/spec.md` の「前後の画面への移動」）。
- 参加者画面のデータはビルド時に生成した `virtual:kakuzuke/public` で、選択肢は `image` と `note` だけを持つ（`src/routes/index.tsx:2`）。`/` は事前レンダリングした静的 HTML である（`vite.config.ts:11`）。
- 正解入りのデータは `getHostQuestionSet` のサーバー関数だけが返す（`src/host/host-data.functions.ts:8`）。発表後の表示内容は `revealView` が `Question` から作る（`src/host/reveal.ts:20`）。
- 紙吹雪は `src/host/Celebration.tsx` にあり、司会画面だけが使う。
- サーバーは TanStack Start の既定の server-entry（`wrangler.jsonc` の `main`）で、Durable Object の binding はない。TanStack Start は `src/server.ts` があればそれを server-entry として使う（`@tanstack/start-plugin-core` の `planning.js:77`、既定のエントリ名は `server`）。
- 漏洩検査はビルド成果物の文字列走査と公開データの構造検査で、HTTP の応答とファイルだけを対象にしている（`tests/build/leak.test.ts:117`、`:137`）。WebSocket の通信は対象外である。

## Done Means

- 単体テストで、サーバー側の状態機械が今の `step` と同じ遷移をすること、参加者へ送る状態が発表前の問題の正解を含まないことを確かめる。
- E2E で、司会 1 つと参加者 2 つのブラウザを同時に開き、司会の次へ・前へ・正解発表が両方の参加者画面に反映されること、途中から開いた参加者が今の画面から始まること、切断後に再接続して追いつくことを確かめる。
- E2E で、参加者のブラウザが受け取ったすべての HTTP 応答と WebSocket フレームを集め、発表前の問題の銘柄・価格・解説が含まれないことを確かめる。発表した問題の分は含まれることを陽性対照にする。
- 参加者画面の正解発表が、幅 360px で横スクロールなしに収まることを確かめる。
- `pnpm exec tsc --noEmit`・`pnpm test`・`pnpm e2e`・`pnpm build` が通る。
- プレビュー環境へデプロイし、実機のスマホで司会の操作への追従とスリープ復帰後の追いつきを確かめる。
