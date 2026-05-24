---
title: "コンテンツ抽出実践 - HTML"
description: "CyberGo HTML コンテンツ抽出実践ガイド。抽出フローの概要、スマート記事認識アルゴリズムの原理、基本的なテキスト抽出とファイル抽出、Result 構造体のフィールド完全解説、カスタム Scorer スコアラーの実装方法、非 UTF-8 エンコーディングの自動検出と手動指定のベストプラクティスを含み、コンテンツ抽出のコア用法を習得できます。"
---

# コンテンツ抽出実践

このガイドでは、実際のユースケースを通じて HTML コンテンツ抽出の仕組みとベストプラクティスを理解します。

## 抽出フローの概要

`Extract` を呼び出すと、ライブラリは以下のステップを実行します：

```text
HTML 入力 → エンコーディング検出(自動 UTF-8 変換) → セキュリティクリーニング → DOM パース → 深度検証
    → 記事認識(オプション) → コンテンツ抽出 → フォーマット → Result を返す
```

各ステップは [設定](../api-reference/config) でカスタマイズできます。

## 基本的なテキスト抽出

最もシンプルな使い方は、HTML バイトからコンテンツを抽出することです：

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/html"
)

func main() {
    data := []byte(`<html>
        <head><title>Go 言語チュートリアル</title></head>
        <body>
            <article>
                <h1>Go 入門ガイド</h1>
                <p>Go は静的型付けのコンパイル言語で、組み込みの並行処理サポートを備えています。</p>
                <p>コンパイルが速く、デプロイが簡単で、高性能サービスの構築に適しています。</p>
                <img src="gopher.png" alt="Gopher マスコット" />
                <a href="https://go.dev">Go 公式サイト</a>
            </article>
        </body>
    </html>`)

    result, err := html.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("タイトル:", result.Title)
    // タイトル: Go 言語チュートリアル

    fmt.Println("本文:", result.Text)
    // 本文: Go 入門ガイド
    //       Go は静的型付けのコンパイル言語で、組み込みの並行処理サポートを備えています。
    //       コンパイルが速く、デプロイが簡単で、高性能サービスの構築に適しています。
    //       Go 公式サイト

    fmt.Println("単語数:", result.WordCount)
    // 単語数: 7

    fmt.Println("読了時間:", result.ReadingTime)
    // 読了時間: 2.1s（200 語/分で計算）

    fmt.Println("画像:", len(result.Images))
    // 画像: 1

    fmt.Println("リンク:", len(result.Links))
    // リンク: 1
}
```

## 抽出結果の理解

`Result` は以下のフィールドを含みます：

| フィールド | 型 | 説明 |
|------|------|------|
| `Title` | `string` | ページタイトル。`<title>` を優先、次に `<h1>`、`<h2>` |
| `Text` | `string` | 本文コンテンツ（クリーニング済み、タグと余分な空白は除去） |
| `Images` | `[]ImageInfo` | 抽出された画像のリスト |
| `Links` | `[]LinkInfo` | 抽出されたリンクのリスト |
| `Videos` | `[]VideoInfo` | 抽出された動画のリスト |
| `Audios` | `[]AudioInfo` | 抽出された音声のリスト |
| `WordCount` | `int` | 本文の単語数 |
| `ReadingTime` | `time.Duration` | 推定読了時間（200 語/分） |
| `ProcessingTime` | `time.Duration` | 処理時間 |

## ファイルから抽出

ローカル HTML ファイルを処理する場合、`ExtractFromFile` を使用します：

```go
result, err := html.ExtractFromFile("article.html")
if err != nil {
    log.Fatal(err)
}
fmt.Println("タイトル:", result.Title)
```

ファイル操作には組み込みのセキュリティチェックがあります：
- パストラバーサル攻撃の自動検出（例：`../../../etc/passwd`）
- ファイルサイズは `MaxInputSize` で制限
- エラーメッセージは `SafePath()` で完全パスを隠蔽

## 記事認識アルゴリズム

`ExtractArticle` が `true`（デフォルト）の場合、ライブラリはページ内の「メインコンテンツ領域」を自動的に認識します。

### 動作原理

1. **候補ノードのスコアリング**：DOM ツリーを走査し、各要素ノードのコンテンツ関連性をスコアリング
2. **最良候補の選択**：最もスコアの高いノードを記事コンテナとして選択
3. **フォールバック**：適切な候補が見つからない場合、`<body>` ノードにフォールバック

:::tip 適用シーン
記事認識は、ニュース、ブログ、ドキュメントなど明確な「本文領域」があるページに最適です。ナビゲーションページやリストページでは、本文を正確に特定できない場合があります。
:::

### カスタムスコアリング

`Scorer` インターフェースを実装してスコアリングロジックをカスタマイズします：

```go
type myScorer struct{}

func (s myScorer) Score(node html.ContentNode) int {
    // ノードの特徴に基づいてスコアを返す
    class := node.AttrValue("class")
    if strings.Contains(class, "article") || strings.Contains(class, "post") {
        return 100
    }
    if strings.Contains(class, "sidebar") || strings.Contains(class, "comment") {
        return -50
    }
    return 0
}

func (s myScorer) ShouldRemove(node html.ContentNode) bool {
    // true を返すとそのノードを削除
    return node.Data() == "nav" || node.Data() == "footer"
}
```

:::tip 注意
この例の `strings.Contains` は標準ライブラリ `strings` パッケージのものです。完全な実行可能な例は [テストとカスタム拡張](./testing-custom) を参照してください。
:::

## テキストのみ抽出

プレーンテキストのみが必要で、画像やリンクなどのメタデータが不要な場合：

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

これはテキスト分析や検索インデックス構築などのシーンで非常に実用的です。

## 非 UTF-8 エンコーディングの処理

ライブラリは 15+ 種類の文字エンコーディング（UTF-8、GBK、Shift_JIS、Windows-1252 など）を自動検出し、自動的に UTF-8 に変換します。

```go
// エンコーディングを自動検出
result, err := html.Extract(gbkEncodedData)

// エンコーディングを手動指定
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
result, err = html.Extract(gbkEncodedData, cfg)
```

## コンテキストとタイムアウト

大きなファイルや信頼できないソースからの HTML では、コンテキスト付きバージョンの使用を推奨します：

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if errors.Is(err, html.ErrProcessingTimeout) {
    log.Println("処理がタイムアウトしました")
}
```

## 次のステップ

- [出力フォーマットの選択](../guides/output-formats) - 用途に合った出力フォーマットの選択
- [Processor 再利用とキャッシュ](../guides/processor-cache) - 高頻度呼び出しのパフォーマンス最適化
- [API リファレンス：パッケージ関数](../api-reference/functions) - 完全な関数シグネチャ
