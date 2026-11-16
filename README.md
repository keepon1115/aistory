# 原稿用紙（10文字から物語が続く展示アプリ）

来場者が打った2〜10文字の言葉の続きをAIが物語にして、プロジェクターの縦書き原稿用紙に1文字ずつ書いていく展示アプリ。
投影が終わると、送信者のスマホに同じ物語が出て、画像として持ち帰れる。

| パス | 使う場所 |
|---|---|
| `/` | 来場者のスマホ |
| `/?kiosk=1` | 会場の入力端末（送信後に持ち帰り用QRを出し、20秒で自動的に入力画面へ戻る） |
| `/screen?key=<SCREEN_KEY>` | 投影用PC（全画面） |
| `/s/<id>` | 物語のページ（キオスクのQRの行き先） |

技術: Next.js 15（App Router）/ TypeScript / Tailwind CSS / Supabase（Postgres）/ Anthropic 公式 SDK / Vercel

## 仕組み（1分で）

1. `POST /api/stories` … 言葉を検証 → AIを **1回** 呼んで「通してよいか」と「物語」を同時に得る → 通ったものだけ `aistory_stories` に保存（順番待ち）。
2. `/screen` は2秒ごとに `POST /api/screen/next` を呼び、列の先頭を取り出して演出（白→5秒の沈黙→灰色→15秒→2秒で消える）。投影中にAIは呼ばない。
3. 演出が終わると `POST /api/screen/done` で「投影済み」にする。スマホは5秒ごとに状態を見ていて、投影済みになったら物語を表示する。
4. 状態は `queued → showing → shown`（Sキーでのスキップは `skipped`）。物語の本文は `shown` になるまでスマホ側へ返さない。

主なファイル:

- `lib/config.ts` … 時間・文字数・マス数・ラベル「2026/11スクールフェスタ」など調整値はここ
- `lib/ai.ts` … プロンプトと判定・生成（`MOCK_AI=1` でAIなし）
- `lib/store.ts` … DBの窓口（Supabase。`SUPABASE_URL` 未設定の開発時だけメモリ上のDB）
- `lib/manuscript.ts` … 原稿用紙の配置と縦書きの字形補正（投影画面と保存画像で共通）
- `lib/storyImage.ts` … 保存画像を canvas で描く
- `components/ScreenClient.tsx` … 投影画面の演出

## 1. Supabase

SQL Editor に [`supabase/schema.sql`](supabase/schema.sql) の中身を貼って1回実行する（テーブル `aistory_stories`、RLS有効・ポリシーなし、`aistory_claim_next_story()` 関数。名前に `aistory_` を付けているので、他のアプリと同じSupabaseプロジェクトを共有できる）。
Project Settings → API から **Project URL** と **service_role key** を控える。

## 2. 環境変数

Vercel の Project Settings → Environment Variables（ローカルは `.env.local`。`.env.example` を参照）。

| 名前 | 必須 | 説明 |
|---|---|---|
| `ANTHROPIC_API_KEY` | ○ | サーバー側のみ。`MOCK_AI=1` なら不要 |
| `SUPABASE_URL` | ○ | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ○ | サーバー側のみ。ブラウザには出さない |
| `SCREEN_KEY` | ○ | 投影用APIの合言葉。推測されにくい長い文字列にする（例: `openssl rand -hex 16`） |
| `ANTHROPIC_MODEL` | | 初期値 `claude-sonnet-5-5` |
| `DAILY_LIMIT` | | 1日の受付総数の上限。初期値 `1000` |
| `MOCK_AI` | | `1` でAIを呼ばず固定の物語を返す。**本番は `0` か未設定** |

`.env` 類は `.gitignore` 済み。秘密の値をリポジトリに書かないこと。

## 3. デプロイ

1. このリポジトリを GitHub に置き、Vercel で Import（設定はそのまま。Framework は Next.js が自動選択される）。
2. 上の環境変数を登録して Deploy。
3. デプロイ後の URL（例: `https://xxxx.vercel.app`）で、下の「リハーサル」を行う。

フォント（Shippori Mincho）はビルド時に取得して自前配信するため、当日 Google のサーバーに依存しない。ビルドにはネットワークが要る。

## 4. ローカルで試す

```bash
npm install
cp .env.example .env.local   # MOCK_AI=1 / SCREEN_KEY=test に編集。SUPABASE_URL は空でよい（メモリ上のDBになる）
npm run dev
```

- スマホ側: http://localhost:3000/
- 投影側: http://localhost:3000/screen?key=test
- `MOCK_AI=1` では、`NG` を含む言葉は「通らない」扱いになる（不通過の確認用）。

## 5. 当日の運用

**事前（前日までに）**: 本番URLで `MOCK_AI=1` と本物のAI（`MOCK_AI=0`）の両方でリハーサルし、スマホ実機で画像保存まで試す。`SCREEN_KEY` を決め、`/screen?key=...` のURLを控える。

**当日の準備**

1. 投影用PCでブラウザを開き、`https://<本番URL>/screen?key=<SCREEN_KEY>` を表示して全画面にする（F11）。投影用PCはスリープ・画面オフを無効にする。
2. 入力用端末（別端末）で `https://<本番URL>/?kiosk=1` を開く。
3. 投影画面の右下のQRコードが、来場者用の入力画面（`/`）に飛ぶ。

**困ったとき**

| 状況 | 操作 |
|---|---|
| 不適切な物語が映ってしまいそう・止めたい | 投影PCで **`S` キー**。表示中の物語がすぐ消えて次へ進む（送信者のスマホは「表示できませんでした」になる） |
| 投影画面が固まった・おかしい | 投影PCでページを再読み込み。表示中だった物語は最初から映し直され、列は詰まらない |
| 順番待ちが多すぎて受付できない | 30件を超えると新規送信を断る仕様。流れるのを待つと自動で再開する |
| 入力端末が固まった | ページを再読み込み（`/?kiosk=1`） |
| AIの費用が心配 | Vercel の環境変数 `DAILY_LIMIT` を下げて再デプロイ |
| 一時的にAIを止めたい | `MOCK_AI=1` にして再デプロイ（固定の物語になる） |

通信エラーは投影画面には出ず、黙って再試行する。

## 設計メモ・制限

- 同じ端末の60秒の再送信禁止は、ブラウザの `localStorage` で見ている（キオスクは対象外）。悪意ある連投は止められないので、`DAILY_LIMIT` と順番待ち30件の上限が歯止め。
- `DAILY_LIMIT` の数え方は「保存された（判定を通った）物語の数」。判定で弾かれた分は数えない（指示書の「通ったものだけ保存」に従うため）。
- AIが安全分類器で拒否した場合は「通さない」扱い。Sonnet 5.5 向けのサーバー側フォールバック（`fallbacks`）は使っていない。
- 保存画像は端末内の canvas で作る。Web Share API → ダウンロード → 画像を表示して長押し、の順に案内する。
