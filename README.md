# kakuzuke

写真を見て値段の高いものを当てる格付けクイズを、会場のプロジェクタと参加者のスマホに出す Web アプリ。Cloudflare Workers に静的ファイルとして配信する。

## 画面と URL

| URL | 画面 | 使い方 |
| --- | --- | --- |
| `/` | 参加者画面 | QR コードに載せて参加者に配る。正解は含まない |
| `/host` | 司会画面 | プロジェクタに映す。正解が入っているので参加者に教えない |

## 問題と写真の追加

編集するのは `content/questions.yaml` と `content/images/` だけ。

1. 写真を `content/images/` に好きな名前で置く。使える形式は `.jpg`・`.jpeg`・`.png`・`.webp`・`.gif`・`.avif`。
2. `content/questions.yaml` の `questions` に問題を足し、`image` に写真のファイル名を書く。

```yaml
questions:
  - mode: pick                    # pick: 一番高いものを選ぶ / order: 高い順に並べる
    title: ワイン                  # 問題名（参加者にも見える）
    description: 高いワインはどちら？ # 説明（参加者にも見える）
    explanation: B は 1本 8万円のシャトー・マルゴー。A はスーパーで買える 1本 900円の赤ワインでした。
    options:                      # 書いた順に A, B, C
      - { image: テーブルワイン.jpg, rank: 2, name: スーパーの赤ワイン, price: "1本 900円" }
      - { image: ボルドー.jpg, rank: 1, name: シャトー・マルゴー 2015, price: "1本 8万円" }
```

- `options` は 2〜3 個。ラベル A・B・C は書いた順で決まる。
- `rank` は値段の順位で、1 が最も高い。1 から選択肢の数までを 1 回ずつ使う。
- `name`（銘柄）・`price`（価格）・`explanation`（解説）は、正解発表のときに司会画面にだけ出る。
- 問題名と説明に、銘柄・価格・解説の文字列を書かない。書くとビルドが失敗する。
- 解説は 100〜150 字程度にする。投影画面からはみ出すと `pnpm e2e` が失敗する。
- 写真には意味のある名前を付ける。`a.png` のような 1〜2 文字の名前は、漏洩走査が誤検出してビルドが失敗する。
- 公開されるのは `image` で指定した写真だけで、ファイル名は中身のハッシュに置き換わる。指定していない写真は `content/images/` にあっても公開されない。

誤りはビルドと `pnpm dev` の両方で全件まとめて表示される。

## 操作（司会画面）

| 操作 | キー | ボタン |
| --- | --- | --- |
| 次の問題へ | → / PageDown | ▶ |
| 前の問題へ | ← / PageUp | ◀ |
| 正解発表 | Space / Enter | 正解発表 |
| 全画面 | なし | ⛶ |

再読み込みすると同じ問題に戻る。

## 開発コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバーを起動する。問題ファイルの誤りはエラーオーバーレイに出る |
| `pnpm test` | 単体テストを実行する |
| `pnpm build` | 問題ファイルを検証し、`/` と `/host` を事前レンダリングして、正解の漏洩を走査する。どれかが失敗したらビルドも失敗する |
| `pnpm e2e` | フィクスチャ（`tests/fixtures/content`）でビルドして E2E を流し、実データでビルドし直して全問を通す E2E を流す |
| `pnpm run deploy` | `pnpm test` と `pnpm build` の後に `wrangler deploy` で公開する |
| `pnpm run deploy:preview` | 同じ手順の最後を `wrangler preview` にして、本番に出さずにプレビューを作る。Workers Builds が main 以外のブランチで使う |

`pnpm e2e` の後の `dist` は実データのビルドなので、そのままデプロイできる。

## CI/CD

- CI: PR と main への push で GitHub Actions（`.github/workflows/ci.yml`）が `pnpm test` と `pnpm e2e` を流す。
- CD: Cloudflare Workers Builds が main への push を拾ってビルドとデプロイを行う。GitHub に Secrets は置かない。

Workers Builds の設定はファイルに書けず、Cloudflare ダッシュボードで一度だけ設定する。手順は `package.json` の `deploy` に寄せ、ダッシュボードにはそれを呼ぶことだけを書く。

1. Workers & Pages → `kakuzuke` → Settings → Build → Connect で GitHub のこのリポジトリをつなぐ
2. 次の値を設定する

| 項目 | 値 |
| --- | --- |
| Git branch | `main` |
| Build command | 空欄 |
| Deploy command | `pnpm run deploy` |
| Preview command | `pnpm run deploy:preview` |

Node のバージョンは `.node-version` で決める。CI と Workers Builds はこのファイルを読む。asdf に読ませるには `~/.asdfrc` に `legacy_version_file = yes` を書く。Node 26 には Corepack が同梱されていない。Workers Builds が pnpm を起動できない場合は、ビルド変数に `NODE_VERSION=24` を入れる。

Workers Builds は CI の結果を待たない。単体テストと漏洩走査（`pnpm build` に含まれる）が落ちればデプロイは止まるが、E2E が落ちてもデプロイされるので、main へは CI が通った PR だけをマージする。

## 手動デプロイ

```sh
pnpm exec wrangler login   # 初回だけ
pnpm run deploy
```

直前のバージョンに戻すときは `pnpm exec wrangler rollback` を使う。

## 本番前の確認

- プレゼン用リモコンで `/host` を操作し、次へ・前へ・正解発表が効くことを確かめる。リモコンが Space・Enter を送れないと正解発表はリモコンで操作できない。
- 写真の EXIF や、写り込んだ値札・ラベルに正解が出ていないことを確かめる。漏洩走査ではこれを検出できない。
- 会場のプロジェクタに `/host` を映し、参加者のスマホで `/` を開いて表示を確かめる。
