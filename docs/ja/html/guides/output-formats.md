---
title: "出力フォーマットの選択 - CyberGo HTML | 比較ガイド"
description: "CyberGo HTML 出力フォーマット選択：テキスト・Markdown・JSON の三形式の特徴と適用シーンを比較し、フォーマットオプションとファイル読み込みを扱います。"
---

# 出力フォーマットの選択

このガイドは、プレーンテキスト、Markdown、JSON の 3 種類の出力フォーマットから正しく選ぶのに役立ちます。

## フォーマット比較

| 特徴 | プレーンテキスト | Markdown | JSON |
|------|--------|----------|------|
| 可読性 | 高 | 高 | 低（機械向け） |
| 構造の保持 | なし | 見出し/リスト/リンク/画像 | 完全なメタデータ |
| 画像の処理 | 削除 | `![alt](url)` | ImageInfo リスト |
| リンクの処理 | テキストのみ保持 | `[text](url)` | LinkInfo リスト |
| テーブル対応 | なし | Markdown テーブル | 生データ |
| 適用シーン | 検索インデックス/テキスト分析 | ブログ/ドキュメント/リーダー | API 転送/データ保存 |

## プレーンテキスト

最も軽量な出力方式。テキストコンテンツのみを保持し、すべての HTML タグとフォーマットを除去します。

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

### 適用シーン

- 検索インデックスの構築
- テキスト分析と NLP 処理
- 要約とプレビューの生成
- 単語数と読了時間の集計

### 特徴

- 画像とリンクのテキストは削除される
- 見出し、段落間の改行は保持される
- リストの内容はプレーンテキスト形式で表示される

## Markdown

ドキュメント構造を保持しつつ可読性に優れ、コンテンツ移行や閲覧シーンに適しています。

```go
// 方法 1：パッケージレベル関数
md, err := html.ExtractToMarkdown(data)

// 方法 2：Processor を使用
p, _ := html.New()
defer p.Close()
md2, err := p.ExtractToMarkdown(data)
```

### 出力例

入力 HTML：

```html
<article>
    <h1>Go 入門ガイド</h1>
    <p>Go はコンパイル言語です。</p>
    <img src="gopher.png" alt="Gopher" />
    <a href="https://go.dev">Go 公式サイト</a>
</article>
```

出力 Markdown：

```markdown
Go 入門ガイド

Go はコンパイル言語です。

![Gopher](gopher.png)
[Go 公式サイト](https://go.dev)
```

### フォーマットオプション

Markdown フォーマットは 2 つの設定フィールドで制御します：

```go
cfg := html.DefaultConfig()
cfg.InlineImageFormat = "markdown"  // "none" | "markdown" | "html" | "placeholder"
cfg.InlineLinkFormat = "markdown"   // "none" | "markdown" | "html"
```

| フォーマット値 | 画像出力（InlineImageFormat） | リンク出力（InlineLinkFormat） |
|--------|----------|----------|
| `none` | 削除 | テキストのみ保持 |
| `markdown` | `![alt](url)` | `[text](url)` |
| `html` | `<img src="..." alt="...">` | `<a href="...">text</a>` |
| `placeholder` | `[IMAGE:N]` | -（非対応） |

:::tip MarkdownConfig() の使用
`MarkdownConfig()` プリセットは画像とリンクのフォーマットを既に `markdown` に設定しているため、そのまま使用でき、手動設定は不要です。
:::

:::info placeholder フォーマット
`placeholder` は `InlineImageFormat` のみに適用され、テキスト内に `[IMAGE:N]` プレースホルダを保持します。`InlineLinkFormat` はこの値をサポートせず、`none`、`markdown`、`html` のみ対応しています。
:::

### 適用シーン

- Markdown ブログ/静的サイトへのコンテンツ移行
- メール本文の生成
- ドキュメントフォーマットの変換
- RSS / Newsletter コンテンツの生成

## JSON

構造化出力。完全なメタデータを保持し、プログラム間の転送や永続ストレージに適しています。

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```

### 出力構造

```json
{
  "text": "Go 入門ガイド\n\nGo はコンパイル言語です。\n\nGo 公式サイト",
  "title": "Go 入門ガイド",
  "images": [
    {"url": "gopher.png", "alt": "Gopher", "title": "", "width": "", "height": "", "is_decorative": false, "position": 1}
  ],
  "links": [
    {"url": "https://go.dev", "text": "Go 公式サイト", "title": "", "is_external": true, "is_nofollow": false, "position": 1}
  ],
  "processing_time_ms": 2,
  "word_count": 6,
  "reading_time_ms": 1800
}
```

:::tip 時間フィールド
JSON 出力では、`ProcessingTime` と `ReadingTime` は自動的にミリ秒（`processing_time_ms`、`reading_time_ms`）に変換され、フロントエンドや API コンシューマーに便利です。
:::

### 適用シーン

- API レスポンスデータ
- データベース保存
- マイクロサービス間の転送
- フロントエンドアプリケーションとの統合

## ファイルから各フォーマットを抽出

各フォーマットはファイル読み込みに対応しています：

```go
// プレーンテキスト
text, err := html.ExtractTextFromFile("page.html")

// Markdown
md, err := html.ExtractToMarkdownFromFile("page.html")

// JSON
jsonBytes, err := html.ExtractToJSONFromFile("page.html")
```

## コンテキスト付きバージョン

すべてのフォーマット関数には `WithContext` バリアントがあり、タイムアウトとキャンセルに対応します：

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

md, err := html.ExtractToMarkdownWithContext(ctx, data)
```

## 選択の判断基準

```text
プログラムで消費する？── はい ──→ JSON
        │
        いいえ
        │
フォーマットを保持する必要がある？── はい ──→ Markdown
        │
        いいえ
        │
        └──→ プレーンテキスト
```

## 次のステップ

- [API リファレンス：出力フォーマット](../api-reference/output) - 完全な API シグネチャ
- [リンク抽出とグループ化](../guides/link-extraction) - ページのリソースリンクを抽出
- [設定詳細](../api-reference/config) - すべての設定オプション
