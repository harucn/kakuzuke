# Verify

## Result

PASS（CRITICAL 0 件）。delta spec の Requirement 20 件・Scenario 65 件のすべてに実装と、それを確かめるテストがある。`openspec validate kakuzuke-mvp` は `Change 'kakuzuke-mvp' is valid`。

2026-11-17 に HEAD（22e0ee5）で次を流し、すべて通った。

- `pnpm test`: 132 件
- `pnpm e2e`: ビルド時の走査 11 件、E2E のフィクスチャ 37 件、E2E の実データ 6 件。ビルドは 2 回走る
- `pnpm exec tsc --noEmit`: エラーなし
- デプロイ先 `https://kakuzuke.harucn.workers.dev` への `content.spec.ts`: 3 件

sharpen の Done Means のうち、明るい部屋のプロジェクタとスマホ数台の実機での確認はまだ済んでいない。これは tasks.md の Workflow follow-up に残しており、自動検証の範囲外とする。

## Spec Coverage

テストの名前は Scenario 名に合わせてある。名前が違うものだけ、括弧で対応を書く。

### question-set

| Requirement | Scenario | テスト |
|---|---|---|
| 問題セットのデータ形式 | 正しい問題セットは検証を通る | `tests/unit/parse.test.ts:44` |
| | 問題が 0 件の問題セットは検証に失敗する | `tests/unit/parse.test.ts:73` |
| | 未知の mode は検証に失敗する | `tests/unit/parse.test.ts:77` |
| | 問題名・説明・解説が空の問題は検証に失敗する | `tests/unit/parse.test.ts:88` |
| | 写真・銘柄・価格が空の選択肢は検証に失敗する | `tests/unit/parse.test.ts:98` |
| | 複数の誤りはまとめて報告される | `tests/unit/parse.test.ts:103`、`tests/build/plugin.test.ts:29`（ビルドで全件を列挙する） |
| 選択肢の数とラベル | 選択肢が 1 個／4 個の問題は検証に失敗する | `tests/unit/parse.test.ts:118`、`:123` |
| | ラベルは並び順に A・B・C が付く | `tests/unit/parse.test.ts:129` |
| 選択肢の順位 | rank 1 がない／rank が重複する問題は検証に失敗する | `tests/unit/parse.test.ts:141`、`:152` |
| | pick の正解は rank 1、order の正解は rank の昇順のラベル列 | `tests/unit/model.test.ts:49`、`:53` |
| 写真の指定と公開名 | 指定した写真がない選択肢は検証に失敗する | `tests/unit/parse.test.ts:165` |
| | 写真は元のファイル名を含まない URL で公開される | `tests/build/leak.test.ts:119`（元の名前がどのファイルの中身とパスにもない）、`tests/e2e/smoke.spec.ts:15`（ハッシュ名の URL で配信される） |
| | 指定されていない画像は公開されない | `tests/build/leak.test.ts:127`（`dist/client/images` が指定された写真と一致する） |
| 問題名と説明に正解情報を含めない | 説明に価格・問題名に銘柄を含む問題は失敗し、含まなければ通る | `tests/unit/parse.test.ts:176`、`:187`、`:198` |
| 参加者向けの公開形 | rank・name・price・解説を含まず、出題順と表示項目を保つ | `tests/unit/model.test.ts:61`、`:71`、`:77`、`tests/build/leak.test.ts:133`（実際の出力のキーが許可リストと完全一致する） |

実装: `src/question-set/model.ts`、`src/question-set/parse.ts`、`src/question-set/vite-plugin.ts`。

### host-screen

| Requirement | Scenario | テスト |
|---|---|---|
| 問題の表示 | 新しいタブで開いた直後は第 1 問、発表前は正解情報を表示しない | `tests/e2e/host.spec.ts:74`、`:82` |
| 前後の問題への移動 | 次へ・前へ・両端で操作できない | `tests/e2e/host.spec.ts:95`、`:101`、`:108`、`:115` |
| | 正解発表後に移動して戻ると発表前に戻る | `tests/unit/machine.test.ts:73`、`tests/e2e/host.spec.ts:123` |
| 再読み込みで同じ問題に戻る | 第 3 問に戻る・発表前に戻る・問題数が減ったら範囲内に丸める | `tests/e2e/host.spec.ts:135`、`:142`、`:151`、`tests/unit/restore.test.ts:11` |
| pick の正解発表 | 正解の印・全選択肢の銘柄と価格・正解ラベルと解説 | `tests/e2e/host.spec.ts:265`、`:270`、`:278`、`tests/unit/reveal.test.ts:31`、`:46` |
| order の正解発表 | 1 位に正解の印・全選択肢に順位・正解の並びと解説 | `tests/e2e/host.spec.ts:298`、`:289`、`:303`、`tests/unit/reveal.test.ts:54`、`:70` |
| 正解発表の再演出 | もう一度押すと再生・正解情報は変わらない・reduced motion では再生しない | `tests/e2e/host.spec.ts:311`、`:325`、`:341`、`tests/unit/reveal.test.ts:78` |
| キーボード操作 | → / PageDown / ← / PageUp / Space / Enter | `tests/e2e/host.spec.ts:205`〜`:226`（実ブラウザ）、`tests/unit/keymap.test.ts:16`〜`:21`、`tests/e2e/content.spec.ts:106`（実データの全問をキーだけで進める） |
| 全画面表示 | 全画面になる・元に戻る・拒否されても操作を続けられる | `tests/e2e/host.spec.ts:163`、`:171`、`:180` |
| 投影時の可読性 | 1920×1080 の表示で全要素が 1 画面に収まる | `tests/e2e/content.spec.ts:106`（1920×1080 で実データの全問を発表前後とも確かめる。写真の枠が 0px にならないことも見る） |
| | 文字と背景のコントラスト比が 4.5:1 以上である | `tests/unit/theme.test.ts:34`（配色の組 14 件。最小は 4.54:1）、`:44`（`theme.css` に色の値を直接書かない） |

実装: `src/host/`、`src/routes/host.tsx`、`src/ui/OptionCard.tsx`、`src/styles/`。

### guest-screen

| Requirement | Scenario | テスト |
|---|---|---|
| 問題の表示 | 開いた直後は第 1 問・3 択で 3 つ表示する | `tests/e2e/guest.spec.ts:65`、`:69` |
| 前後の問題への移動 | 次へ・前へ・両端で操作できない | `tests/e2e/guest.spec.ts:80`、`:86`、`:93`、`:100` |
| 正解情報を表示しない | どの問題でも表示されない・正解発表の操作がない | `tests/e2e/guest.spec.ts:110`、`:122` |
| 参加者に届くデータに正解情報を含めない | 参加者画面を進める間に受け取る応答に正解情報を含まない | `tests/e2e/content.spec.ts:130`（ローカルとデプロイ先の両方で流した） |
| | 参加者に届くデータの選択肢は順位を持たない | `tests/build/leak.test.ts:133` |
| | 参加者画面の HTML・JavaScript に正解情報を含まない | `tests/build/leak.test.ts:113`（本検査）。検査が働いていることは `:96`、`:101`、`:108` の陽性対照で確かめる |
| スマホでの表示 | 幅 360px で横スクロールが発生しない | `tests/e2e/guest.spec.ts:137` |

実装: `src/guest/GuestScreen.tsx`、`src/routes/index.tsx`、`src/deck/cursor.ts`。

## Blast Radius

### 何が変わるか

`main` は OpenSpec の導入だけで、アプリのコードはない。この変更は 93 ファイルの追加だけで成り立ち、`git diff --diff-filter=MD main...HEAD` は 0 件だった。既存のコードを壊す経路はない。

リポジトリの外では、次の 2 つを変えた。

- Cloudflare アカウントに Worker `kakuzuke` を作った。
- アカウントの workers.dev サブドメインを `harucn` にした。

アカウントにある Worker は `kakuzuke` の 1 つだけで、サブドメインの変更で URL が変わる Worker はほかにない（`workers/scripts` API の一覧で確認した）。

### 安全の根拠になる 1 つの事実

参加者に届くファイルと応答には正解情報が入らない。正解が入るのは `dist/client/host/index.html` だけである。

確かめ方は段階 4（実際に走らせた）。

- `pnpm e2e` の中のビルドで `tests/build/leak.test.ts` が毎回走り、`host/index.html` 以外のすべてのクライアントファイルを、復号してから秘密文字列で探す。
- 陽性対照として、`host/index.html` から全秘密文字列が見つかること、クライアント JS と参加者 HTML から `LEAK_CANARY` が見つかることを確かめる。
- 実装中に、参加者画面へ解説を一時的に描画すると本検査が失敗することを確かめた（3.3）。
- `pnpm run deploy` はこの検査を通らないと公開しない。
- デプロイ先でも `content.spec.ts:130` が、参加者画面を最後まで進める間の全応答に秘密文字列がないことを確かめた。

### リスク

- **司会画面の URL を知られると正解が見える**: `/host` は誰でも開け、その HTML に正解が入る。起こりやすさは中、起きたときの影響は大きい。範囲外として決めたことだが（proposal の範囲外「司会画面の URL 秘匿」）、本番当日までは対策がない。
- **解説が長いと写真が小さくなる**: 150 字で写真は 228px になる。0px になることは `content.spec.ts` が検出するが、小さすぎることは検出しない。README で 100〜150 字を目安に案内している。起こりやすさは中、影響は小さい。
- **短い画像名でビルドが失敗する**: 1〜2 文字の画像名が他の文字列と偶然一致すると、走査が漏洩と判断してビルドを止める。止まる方向に倒れるので漏洩にはならない。README に意味のある名前を付けるよう書いている。
- **検出器の既知の穴**: HTML のテキスト中で `\` で終わる秘密文字列は、検出できない場合がある。design.md の Risks に記録済み。実データの銘柄・価格・解説にはこの形がない。
- **プリレンダの内容は古くなる**: 問題を変えたら、ビルドとデプロイをやり直すまで反映されない。`pnpm run deploy` は毎回ビルドするので、手順どおりなら問題にならない。

### 確認して問題なしとしたもの

- **司会画面がサーバー関数を呼ぶか**: 開いても再読み込みしても呼ばない。デプロイ先の `content.spec.ts:106` で 0 件だった。
- **`/host` が転送されるか**: 転送されず 200 を返す。デプロイ先に `curl` して確かめた。`assets.html_handling: "drop-trailing-slash"` による。
- **元の写真のファイル名が漏れるか**: 漏れない。公開物には `images/<hash>` だけが入る。デプロイ時にアップロードしたファイルの一覧でも確かめた。

## Interrogate

実行していない。設計上の未決の問いは残っていない。

次の 2 つは未決だが、どちらも製品の判断で、データと画面はどちらにも対応している。

- `pick` と `order` のどちらを出題に使うか
- 写真の最小サイズを検査で縛るか
