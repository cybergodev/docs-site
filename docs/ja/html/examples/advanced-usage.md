---
title: "高度なサンプル - CyberGo HTML | 応用シナリオ"
description: "CyberGo HTML 高度なサンプル：カスタム Scorer、マルチ Sink 監査パイプライン、バッチファイルと並列制御、Processor プーリング、ChannelAuditSink 監視の実行可能例です。"
---

# 高度なサンプル

## カスタム Scorer

特定のウェブサイト構造に合わせてコンテンツ認識ロジックをカスタマイズします。完全な実装は [テストとカスタム拡張](../guides/testing-custom) を参照してください。以下はコアとなる使い方です：

```go
package main

import (
    "fmt"
    "log"
    "strings"

    "github.com/cybergodev/html"
)

// カスタム Scorer の実装（完全な例は guides/testing-custom を参照）
type myScorer struct{}

func (s myScorer) Score(node html.ContentNode) int {
    if node == nil {
        return 0
    }
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
    switch node.Data() {
    case "nav", "footer", "header":
        return true
    }
    return false
}

func main() {
    cfg := html.DefaultConfig()
    cfg.Scorer = myScorer{}

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    data := []byte(`<html><body>
        <nav><a href="/">ホーム</a></nav>
        <article class="post-content">
            <h1>Go 並行処理の深い理解</h1>
            <p>goroutine は Go の軽量スレッドです。</p>
        </article>
        <aside class="sidebar">おすすめ記事</aside>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("本文:", result.Text)
    // 本文: Go 並行処理の深い理解
    //
    // goroutine は Go の軽量スレッドです。
}
```

## マルチ Sink 監査パイプライン

階層型監査パイプラインの構築：critical イベントは別ファイルに書き込み、すべてのイベントは同時にログにも出力します。

```go
package main

import (
    "fmt"
    "log"
    "os"

    "github.com/cybergodev/html"
)

func main() {
    // 出力先を作成
    allFile, _ := os.Create("audit-all.jsonl")
    criticalFile, _ := os.Create("audit-critical.jsonl")
    defer allFile.Close()
    defer criticalFile.Close()

    // 多層パイプラインを構築
    allSink := html.NewWriterAuditSink(allFile)
    criticalSink := html.NewFilteredSink(
        html.NewWriterAuditSink(criticalFile),
        func(e html.AuditEntry) bool {
            return e.Level == html.AuditLevelCritical
        },
    )
    loggerSink := html.NewLoggerAuditSink()

    pipeline := html.NewMultiSink(allSink, criticalSink, loggerSink)

    // 設定
    cfg := html.HighSecurityConfig()
    cfg.Audit = html.HighSecurityAuditConfig()
    cfg.Audit.Sink = pipeline

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    // コンテンツを処理
    data := []byte(`<html><body>
        <script>alert('xss')</script>
        <article><p>安全なコンテンツ</p></article>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("本文:", result.Text)
    // 監査ログは自動的にファイルと stderr に記録される
}
```

## バッチファイル処理

ディレクトリ内の HTML ファイルをバッチ処理し、結果とエラーを収集します：

```go
package main

import (
    "fmt"
    "os"
    "path/filepath"

    "github.com/cybergodev/html"
)

func main() {
    // ファイルパスを収集
    var files []string
    filepath.Walk("./pages", func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return nil
        }
        if filepath.Ext(path) == ".html" || filepath.Ext(path) == ".htm" {
            files = append(files, path)
        }
        return nil
    })

    fmt.Printf("%d 個のファイルを発見\n", len(files))

    // バッチ処理
    p, _ := html.New(html.TextOnlyConfig())
    defer p.Close()

    // 1 バッチ最大 10000 ファイル
    batch := p.ExtractBatchFiles(files)

    fmt.Printf("成功: %d, 失敗: %d, キャンセル: %d\n",
        batch.Success, batch.Failed, batch.Cancelled)

    // 結果を処理
    for i, result := range batch.Results {
        if result != nil {
            fmt.Printf("[%d] %s (単語数: %d)\n", i, result.Title, result.WordCount)
        }
    }

    // エラーを確認
    for i, err := range batch.Errors {
        if err != nil {
            fmt.Printf("[%d] エラー: %v\n", i, err)
        }
    }
}
```

## タイムアウト付き Processor 再利用

Web サービスシーンでの Processor シングルトンパターン：

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "time"

    "github.com/cybergodev/html"
)

var processor *html.Processor

func init() {
    cfg := html.DefaultConfig()
    cfg.MaxCacheEntries = 5000
    cfg.CacheTTL = 30 * time.Minute
    cfg.ProcessingTimeout = 10 * time.Second

    var err error
    processor, err = html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
}

func extractHandler(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    data := []byte(r.FormValue("html"))
    if len(data) == 0 {
        http.Error(w, "html field required", http.StatusBadRequest)
        return
    }

    result, err := processor.ExtractWithContext(ctx, data)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
    stats := processor.GetStatistics()
    fmt.Fprintf(w, "処理済み: %d\nキャッシュヒット: %d\nエラー: %d\n",
        stats.TotalProcessed, stats.CacheHits, stats.ErrorCount)
}

func main() {
    defer processor.Close()

    http.HandleFunc("/extract", extractHandler)
    http.HandleFunc("/stats", statsHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

## 抽出して Markdown ファイルを生成

HTML ページからコンテンツを抽出し、Markdown ファイルとして保存します：

```go
package main

import (
    "fmt"
    "log"
    "os"
    "strings"

    "github.com/cybergodev/html"
)

func main() {
    p, err := html.New(html.MarkdownConfig())
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    urls := []string{
        "downloaded/page1.html",
        "downloaded/page2.html",
        "downloaded/page3.html",
    }

    for _, path := range urls {
        md, err := p.ExtractToMarkdownFromFile(path)
        if err != nil {
            log.Printf("処理 %s に失敗: %v", path, err)
            continue
        }

        // 出力ファイル名を生成
        outPath := strings.Replace(path, ".html", ".md", 1)
        if err := os.WriteFile(outPath, []byte(md), 0644); err != nil {
            log.Printf("書き込み %s に失敗: %v", outPath, err)
            continue
        }
        fmt.Printf("ok %s -> %s\n", path, outPath)
    }
}
```
