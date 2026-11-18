# Verify

## Result

PASS。CRITICAL は 0 件。tasks.md は 5/5 完了、`openspec validate first-view` が通る。`b0cbdf2` で `pnpm test`（141 件）・`pnpm e2e`（scenario 51 件・content 6 件・build 11 件 × 2）が通り、PR #3 の CI（test）と Workers Builds も通った。

WARNING 1 件: 会場のプロジェクタに映した QR をスマホで読み取れるかは未検証（下の Blast Radius）。

## Spec Coverage

### question-set

| Requirement / Scenario | 実装 | テスト |
| --- | --- | --- |
| データ形式: 正しい問題セットは検証を通る | `src/question-set/parse.ts`（最上位の `title`） | `tests/unit/parse.test.ts:46` |
| タイトルがない問題セットは検証に失敗する | 同上 | `tests/unit/parse.test.ts:78` |
| タイトルが空の問題セットは検証に失敗する | 同上 | `tests/unit/parse.test.ts:86` |
| 問題 0 件・未知の mode・空の項目・複数の誤り | 既存 | `tests/unit/parse.test.ts:90`・`:94`・`:105`・`:115`・`:120` |
| 正解情報を含めない: タイトルに銘柄を含む問題セットは検証に失敗する | `public-text-leak` の対象に `title` を追加 | `tests/unit/parse.test.ts:215` |
| 同 Requirement の既存 3 件 | 既存 | `tests/unit/parse.test.ts:193`・`:204`・`:222` |
| 公開形: rank・name・price・解説を含まない、出題順と表示項目を保つ | `src/question-set/model.ts`（`toPublic`・`PUBLIC_SET_KEYS`） | `tests/unit/model.test.ts:64`・`:74`・`:80`・`:114`、`tests/build/leak.test.ts:135` |

### host-screen

| Requirement / Scenario | テスト |
| --- | --- |
| タイトル画面: 新しいタブで開いた直後はタイトル画面を表示する | `tests/e2e/host.spec.ts:96` |
| タイトル画面: QR コードを読み取ると参加者画面の URL になる | `tests/e2e/host.spec.ts:103`（要素のスクリーンショットを jsQR で復号） |
| 問題画面の表示 2 件 | `tests/e2e/host.spec.ts:113`・`:119` |
| 前後の画面への移動 7 件 | `tests/e2e/host.spec.ts:132`〜`:172`、`tests/unit/machine.test.ts:49`〜`:86` |
| 再読み込み 4 件（タイトル画面のままを含む） | `tests/e2e/host.spec.ts:184`〜`:208`、`tests/unit/restore.test.ts:65` |
| キーボード操作 11 件（タイトル画面の Space・Enter の無視を含む） | `tests/e2e/host.spec.ts:265`〜`:314`、`tests/unit/machine.test.ts:93` |
| 投影時の可読性: 1920×1080 に収まる（問題・タイトル画面） | `tests/e2e/content.spec.ts:128`（実データ、`LAYOUTS.title`） |
| 投影時の可読性: コントラスト比 4.5:1 以上 | `tests/unit/theme.test.ts:34` |
| REMOVED 問題の表示・前後の問題への移動 | 「新しいタブで第 1 問」「第 1 問で前へが無効」は残っていない。`src/host/machine.ts` の restore(null) はタイトル画面、`src/deck/cursor.ts` の `move` は第 1 問の前をタイトル画面にする。`tests/e2e/host.spec.ts:96`・`:138` が新しい振る舞いを確かめる |

### guest-screen

| Requirement / Scenario | テスト |
| --- | --- |
| タイトル画面 4 件 | `tests/e2e/guest.spec.ts:82`・`:86`・`:92`・`:98` |
| 問題画面の表示 2 件 | `tests/e2e/guest.spec.ts:105`・`:109` |
| 前後の画面への移動 4 件 | `tests/e2e/guest.spec.ts:120`・`:126`・`:133`・`:139` |
| REMOVED 問題の表示・前後の問題への移動 | `src/guest/GuestScreen.tsx` は `useState<Position>("title")` から始まり、第 1 問の前へはタイトル画面に戻る。`tests/e2e/guest.spec.ts:82`・`:133` |

## Blast Radius

| 壊れうる所 | 安全と言える根拠 |
| --- | --- |
| `title` のない `questions.yaml` はビルドが失敗する | 意図した変更。`content/questions.yaml` とフィクスチャ 3 つに `title` を足し、`pnpm e2e` の実データビルドが通った。README の例も更新済み |
| 正解の漏洩（公開形の形を変えた） | `tests/build/leak.test.ts` の本検査が実データとフィクスチャの両方のビルドで通った。公開形のキーは許可リストと完全一致を確かめている |
| 参加者画面の事前レンダリング HTML が第 1 問を含まなくなった | 写真の配信は `tests/e2e/smoke.spec.ts:18` が問題データの URL を直接取得して確かめた |
| 本番で開いたままの司会画面の sessionStorage | 保存形式（整数の文字列）は変えていない。整数は従来どおり第 n 問に復元する（`tests/unit/restore.test.ts:58`） |
| QR の URL が本番とプレビューで違う | origin から作る。プレビュー `https://feat-first-view-kakuzuke.harucn.workers.dev/` へ Workers Builds がデプロイし、`/host` は 200 を返した。E2E はローカルの origin で復号を確かめた |
| 投影した QR をスマホで読み取れるか | unproven。README の「本番前の確認」に入れた |

## Interrogate

実行していない。設計上の未決事項は残っていない。
