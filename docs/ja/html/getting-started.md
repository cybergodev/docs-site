---
title: "クイックスタート - CyberGo HTML | 5分ガイド"
description: "CyberGo HTML クイックスタート：インストール、基本抽出、4 種の Config プリセット、テキスト・Markdown・JSON 出力、コンテキストタイムアウトと並列安全パターンで 5 分で始められます。"
---

# クイックスタート

## インストール

```bash
go get github.com/cybergodev/html
```

Go 1.25+ が必要です。

## 基本的な抽出

HTML バイトからコンテンツを抽出します：

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
                <p>Go は静的型付けのコンパイル言語です。</p>
                <img src="gopher.png" alt="Gopher" />
                <a href="https://go.dev">Go 公式サイト</a>
            </article>
        </body>
    </html>`)

    result, err := html.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("タイトル:", result.Title)
    fmt.Println("本文:", result.Text)
    fmt.Println("画像数:", len(result.Images))
    fmt.Println("リンク数:", len(result.Links))
    fmt.Println("単語数:", result.WordCount)
}
```

出力：

```text
タイトル: Go 言語チュートリアル
本文: Go 入門ガイド

Go は静的型付けのコンパイル言語です。

Go 公式サイト
画像数: 1
リンク数: 1
単語数: 6
```

## ファイルから抽出

```go
result, err := html.ExtractFromFile("page.html")
if err != nil {
    log.Fatal(err)
}
```

## 設定の使用

`Config` で抽出動作をカスタマイズします：

```go
cfg := html.MarkdownConfig()
p, err := html.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer p.Close()

result, err := p.Extract(data)
```

### プリセット設定

| プリセット | 関数 | 説明 |
|------|------|------|
| デフォルト | `DefaultConfig()` | バランスの取れた設定、一般的な用途に適しています |
| テキストのみ | `TextOnlyConfig()` | プレーンテキストのみ抽出、メディアを無効化 |
| Markdown | `MarkdownConfig()` | Markdown 出力に最適化 |
| 高セキュリティ | `HighSecurityConfig()` | 厳格な制限、完全な監査 |

## 出力フォーマット

```go
// プレーンテキスト
text, err := html.ExtractText(data)

// Markdown
md, err := html.ExtractToMarkdown(data)

// JSON
jsonBytes, err := html.ExtractToJSON(data)
```

## コンテキストサポート

すべての関数に `WithContext` バージョンがあり、キャンセルとタイムアウトをサポートします：

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

## 重要なポイント

### 並列安全性

`Processor` インスタンスは並列安全で、複数の goroutine で共有して使用できます：

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

// 複数の goroutine で安全に呼び出し
var wg sync.WaitGroup
for _, url := range urls {
    wg.Add(1)
    go func(u string) {
        defer wg.Done()
        result, err := p.Extract(fetchHTML(u))
        // ...
    }(url)
}
wg.Wait()
```

パッケージ関数も並列安全です（内部で Processor プールを使用）。

### エンコーディング検出

ライブラリは HTML エンコーディングを自動検出するため、手動処理は不要です：

```go
// GBK エンコーディングの HTML、自動検出して正しく抽出
result, err := html.Extract(gbkData)

// Config.Encoding で手動指定も可能
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

UTF-8、GBK、GB18030、Shift_JIS、EUC-JP、Windows-1252 など 15+ エンコーディングをサポートしています。

## 次のステップ

- [コンテンツ抽出の実践](./guides/content-extraction) - 抽出フローと記事認識の深い理解
- [出力フォーマットの選択](./guides/output-formats) - 用途に合った出力フォーマットの選択
- [Processor 再利用とキャッシュ](./guides/processor-cache) - 高頻度呼び出しのパフォーマンス最適化
- [チートシート](./cheatsheet) - よく使う API クイックリファレンス
