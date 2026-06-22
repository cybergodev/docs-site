---
title: "基本サンプル - CyberGo HTML | 実行可能サンプル"
description: "CyberGo HTML 基本サンプル：基本抽出、ファイル抽出、テキスト、Markdown 出力、リンクグループ化、Processor 再利用、タイムアウト、並列バッチ、JSON 直列化の実行可能例です。"
---

# 基本サンプル

## 基本的な抽出

HTML バイトからタイトル、本文、メディア情報を抽出します：

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
                <p>Go は Google が開発したオープンソースプログラミング言語です。</p>
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
    fmt.Println("本文:", result.Text)
    fmt.Println("単語数:", result.WordCount)
    fmt.Println("読了時間:", result.ReadingTime)
    // 出力:
    // タイトル: Go 言語チュートリアル
    // 本文: Go 入門ガイド
    //
    //       Go は Google が開発したオープンソースプログラミング言語です。
    //
    //       Go 公式サイト
    // 単語数: 8
    // 読了時間: 2.4s
}
```

## ファイルから抽出

```go
result, err := html.ExtractFromFile("article.html")
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.Title)
```

## テキストのみ抽出

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

## Markdown 出力

```go
md, err := html.ExtractToMarkdown(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(md)
```

## リンクの抽出

```go
links, err := html.ExtractAllLinks(data)
if err != nil {
    log.Fatal(err)
}

for _, link := range links {
    fmt.Printf("[%s] %s - %s\n", link.Type, link.Title, link.URL)
}

// タイプ別にグループ化
groups := html.GroupLinksByType(links)
for typ, items := range groups {
    fmt.Printf("%s: %d 件\n", typ, len(items))
}
```

## Processor の使用

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()

// Processor を再利用して複数ページを処理
for _, page := range pages {
    result, err := p.Extract(page)
    if err != nil {
        log.Printf("処理に失敗: %v", err)
        continue
    }
    fmt.Println(result.Title)
}

// 統計を確認
stats := p.GetStatistics()
fmt.Printf("処理済み: %d, キャッシュヒット: %d\n",
    stats.TotalProcessed, stats.CacheHits)
```

## タイムアウト制御付き

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if err != nil {
    log.Fatal(err)
}
```

## バッチ処理

```go
pages := [][]byte{page1, page2, page3}

p, _ := html.New(html.DefaultConfig())
defer p.Close()

batch := p.ExtractBatch(pages)
fmt.Printf("成功: %d, 失敗: %d\n", batch.Success, batch.Failed)

for i, result := range batch.Results {
    if result != nil {
        fmt.Printf("ページ %d: %s\n", i, result.Title)
    }
}
```

## JSON 出力

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```
