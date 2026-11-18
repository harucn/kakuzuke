# Verify

## Result

PASS。CRITICAL は 0 件。tasks.md は 4/4 完了、`openspec validate hide-labels-until-reveal` が通る。`4519709` で `pnpm exec tsc --noEmit`・`pnpm test`（152 件）・`pnpm e2e`（scenario 57 件・content 6 件・build 12 件 × 2）・`pnpm build` が通った。

WARNING 1 件: 本番の `content/questions.yaml` はラベルが書いた順（A・B・C）のままで、選択肢の説明は仮の文。くじでのラベルの決め直しと説明の書き直しは作者の作業として残る（README の本番前の確認）。

## Spec Coverage

### question-set

| Requirement / Scenario | 実装 | テスト |
| --- | --- | --- |
| データ形式: 正しい問題セット・タイトルなし／空・問題 0 件・未知の mode・空の項目・複数の誤り | `src/question-set/parse.ts`（`label`・`note` のスキーマ） | `tests/unit/parse.test.ts:46`・`:78`・`:86`・`:90`・`:94`・`:105`・`:115`・`:136` |
| データ形式: 選択肢の説明が空／ない | 同上 | `tests/unit/parse.test.ts:123`・`:128` |
| 作者が付けるラベル: 1 個・4 個 | 既存 | `tests/unit/parse.test.ts:151`・`:156` |
| 作者が付けるラベル: ない・A〜C 以外・重複・数を超える | `parse.ts` のスキーマと `label-permutation` | `tests/unit/parse.test.ts:162`・`:170`・`:176`・`:187` |
| 作者が付けるラベル: 書いた値になり表示順は書いた順 | `parse.ts` の `toQuestionSet` | `tests/unit/parse.test.ts:198` |
| 正解情報を含めない: 既存 3 件と検証を通る例 | 既存 | `tests/unit/parse.test.ts:245`・`:256`・`:267`・`:296` |
| 正解情報を含めない: 選択肢の説明に銘柄／写真のファイル名 | `parse.ts` の `crossFieldIssues`・`secretsIn` | `tests/unit/parse.test.ts:274`・`:285` |
| 公開形: rank・name・price／ラベル／解説を含まない、表示順を保つ | `src/question-set/model.ts`（`toPublicOption`・`PUBLIC_OPTION_KEYS`） | `tests/unit/model.test.ts:65`・`:75`・`:83`・`:89`、`tests/build/leak.test.ts:137` |

### host-screen

| Requirement / Scenario | テスト |
| --- | --- |
| 問題画面の表示: 第 1 問を問題番号つきで表示する（写真と説明を表示順に） | `tests/e2e/host.spec.ts:109` |
| 問題画面の表示: 正解発表前は正解情報／ラベルを表示しない | `tests/e2e/host.spec.ts:115`・`:126`（最終問の発表後を陽性対照にする） |
| 問題画面の表示: 正解発表後に移動して戻るとラベルを表示しない | `tests/e2e/host.spec.ts:139` |
| pick の正解発表: 各選択肢にラベル（B・A）、位置は変わらない | `tests/e2e/host.spec.ts:381`・`:386`（写真の座標と大きさを完全一致で比較） |
| pick の正解発表: 既存 3 件 | `tests/e2e/host.spec.ts:396`・`:401`・`:409` |
| order の正解発表: 各選択肢にラベル（C・A・B）と既存 3 件 | `tests/e2e/host.spec.ts:420`・`:425`・`:434`・`:439` |
| 再演出: 3 件（正解情報にラベルを含める） | `tests/e2e/host.spec.ts:447`・`:461`・`:479` |
| 可読性: 1920×1080 で発表前・発表後・タイトル画面が収まる | `tests/e2e/content.spec.ts:139`（本番データの全問。写真・選択肢の説明を検査対象に追加、写真の高さがカードの半分以上、発表前後で写真が動かない） |
| 可読性: コントラスト 4.5:1 以上（選択肢の説明を含む） | `src/styles/tokens.ts` の `TEXT_PAIRS`（ink on paper）、`tests/unit/theme.test.ts:34` |

### guest-screen

| Requirement / Scenario | テスト |
| --- | --- |
| 正解情報を表示しない: 正解情報・ラベル・操作 | `tests/e2e/guest.spec.ts:144`・`:156`・`:167` |
| 届くデータ: 応答・HTML・JS に文字列がない | `tests/e2e/content.spec.ts:170`、`tests/build/leak.test.ts:117` |
| 届くデータ: 選択肢は順位／ラベルを持たない | `tests/build/leak.test.ts:137`・`:152` |
| スマホ: 幅 360px で横スクロールなし | `tests/e2e/guest.spec.ts:182` |
| 問題画面の表示: 第 1 問・3 択 | `tests/e2e/guest.spec.ts:99`・`:103` |

## Blast Radius

**安全の根拠になる事実.** 参加者に届くデータの選択肢は `image` と `note` だけを持つ。許可リストで写す `toPublicOption`（`src/question-set/model.ts:52`）が唯一の出口で、ビルドの構造検査（`tests/build/leak.test.ts:137`・`:152`）が通っている。実行して確かめた。`pnpm build` 後の `dist/client/assets/routes-*.js` の問題データは `options:[{image:…,note:"チリ産の赤ワイン"},{image:…,note:"フランス産の赤ワイン"}]` で、`label` のキーはない。`label` の文字列を含むのは `OptionCard` の props と司会画面の chunk だけで、どちらも問題データではない。

**リスク.**
- 本番データのラベルが書いた順のままなので、今の `content/questions.yaml` では位置からラベルが分かる。起こる見込みは高く、影響は答えの漏洩。作者がくじで決め直すまで残る（Result の WARNING）。
- `.msg` の高さを 2 行ぶんに固定した（`src/styles/theme.css` の `.msg`）。解説が 3 行を超えると発表の前後で写真が動く。本番データでは content.spec の位置の検査が落ちて知らせる。
- `.btn:hover` の浮き上がりをやめたので、参加者画面のボタンも浮かなくなった。見た目だけの変化で、明るくなる効果は残る。

**確認して問題なかったもの.**
- 写真の URL は中身のハッシュで、ラベルも表示順も含まない（`dist/client/assets/routes-*.js` の上の出力）。
- React の `key` は表示順の添字で、DOM に出ない。
- 司会画面の保存は問題の添字だけ（`src/host/restore.ts`）で、ラベルを持たない。
- 事前レンダリングした参加者画面の HTML はタイトル画面だけで、選択肢を含まない。
- 司会画面の HTML と loader の応答は、もともと正解を含んでよい経路で、今回の変更で参加者に届く範囲は広がっていない。

## Interrogate

計画段階（tasks 作成後）に 2 名のレビュアーで実施した。Act On はすべて計画に反映してから実装した。

- 「表示順をラベル順からずらす」と README に書くと、2 択の並びが B・A に確定する。くじで決め、ラベル順と同じでも直さない運用にした（README の本番前の確認）。
- 選択肢の説明に写真のファイル名が入ると、ビルド後の漏洩検査でしか捕まらない。問題データの検証で落とす（`tests/unit/parse.test.ts:285`）。
- 各タスクの直し漏れ（content.spec.ts、型付きの Option を直書きした単体テスト）。tasks.md に列挙して実装した。
- 「ラベルが表示されない」を文字で判定すると確かめられない。`.label-bar`・`[data-label]`・`alt` の構造の検査にした。
- ラベルを行として足すと写真が縮む。写真に重ね、カードの行構成を変えない形にした。

実装後に設計の問い残りはないので、再実施はしていない。
