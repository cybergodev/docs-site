---
title: "HTTP 統合 - HTML"
description: "CyberGo HTML ライブラリと HTTP クライアントの統合実践ガイド。標準ライブラリ net/http を使用した単一ページのスクレイピングと抽出、エラー処理、並列バッチ処理の最適化とリソース管理、コンテキストタイムアウト制御、Web サービス統合パターン、Processor シングルトン再利用パターン、プロダクション環境デプロイのベストプラクティスを含みます。"
---

# HTTP 統合

HTML ライブラリは HTTP クライアントを内蔵せず、標準ライブラリ `net/http` とシームレスに連携します。この記事では一般的な統合パターンを紹介します。

## 基本的なスクレイピングと抽出

最もシンプルなパターン：ページを取得し、コンテンツを抽出します。

```go
package main

import (
    "fmt"
    "io"
    "log"
    "net/http"

    "github.com/cybergodev/html"
)

func main() {
    resp, err := http.Get("https://example.com/article")
    if err != nil {
        log.Fatal(err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        log.Fatalf("HTTP %d", resp.StatusCode)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        log.Fatal(err)
    }

    result, err := html.Extract(body)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("タイトル:", result.Title)
    fmt.Println("単語数:", result.WordCount)
}
```

:::tip 最適化のヒント
メモリオーバーフローを防止するため、入力サイズを適切に制限してください：

```go
body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024)) // 50MB
```
:::

## HTTP クライアントの設定

プロダクション環境では適切なタイムアウトとコネクションプールパラメータを設定してください：

```go
client := &http.Client{
    Timeout: 15 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        20,
        MaxIdleConnsPerHost: 10,
        IdleConnTimeout:     90 * time.Second,
    },
}
```

| パラメータ | 推奨値 | 説明 |
|------|--------|------|
| `Timeout` | 10-30s | 接続+TLS+読み書きの全プロセスを含む |
| `MaxIdleConns` | 10-50 | グローバルの最大アイドル接続数 |
| `MaxIdleConnsPerHost` | 5-10 | ホストあたりの最大アイドル接続数 |
| `IdleConnTimeout` | 90s | アイドル接続の保持時間 |

## Processor シングルトン + HTTP サービス

Web サービスでは、単一の Processor インスタンスを再利用してすべてのリクエストを処理します：

```go
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

    body, err := io.ReadAll(io.LimitReader(r.Body, 10*1024*1024))
    if err != nil {
        http.Error(w, "読み取りに失敗しました", http.StatusBadRequest)
        return
    }

    result, err := processor.ExtractWithContext(ctx, body)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func main() {
    defer processor.Close()

    http.HandleFunc("/extract", extractHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

:::warning 入力の検証
Web サービスではリクエストボディのサイズ制限を必ず設定し、悪意のある大きなファイル攻撃を防止してください。`io.LimitReader` または `http.MaxBytesReader` を使用してください。
:::

## 複数 URL の並列スクレイピング

Processor の並列安全性を活かして、複数ページを効率的に処理します：

```go
type URLResult struct {
    URL    string
    Result *html.Result
    Error  error
}

func processURLs(processor *html.Processor, urls []string) []URLResult {
    results := make([]URLResult, len(urls))
    var wg sync.WaitGroup

    for i, url := range urls {
        wg.Add(1)
        go func(idx int, u string) {
            defer wg.Done()

            resp, err := http.Get(u)
            if err != nil {
                results[idx] = URLResult{URL: u, Error: err}
                return
            }
            defer resp.Body.Close()

            if resp.StatusCode != http.StatusOK {
                results[idx] = URLResult{URL: u, Error: fmt.Errorf("HTTP %d", resp.StatusCode)}
                return
            }

            body, _ := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
            result, err := processor.Extract(body)
            results[idx] = URLResult{URL: u, Result: result, Error: err}
        }(i, url)
    }

    wg.Wait()
    return results
}
```

使用例：

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

urls := []string{
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3",
}

for _, r := range processURLs(p, urls) {
    if r.Error != nil {
        log.Printf("%s: エラー - %v", r.URL, r.Error)
        continue
    }
    fmt.Printf("%s: %s (%d 語)\n", r.URL, r.Result.Title, r.Result.WordCount)
}
```

## リトライ付きスクレイピング

ネットワーク不安定なシーンの処理：

```go
func fetchWithRetry(client *http.Client, url string, maxRetries int) ([]byte, error) {
    var lastErr error

    for i := 0; i < maxRetries; i++ {
        resp, err := client.Get(url)
        if err != nil {
            lastErr = err
            time.Sleep(time.Second * time.Duration(1<<uint(i)))
            continue
        }

        if resp.StatusCode >= 500 {
            lastErr = fmt.Errorf("サーバーエラー: HTTP %d", resp.StatusCode)
            resp.Body.Close()
            time.Sleep(time.Second * time.Duration(1<<uint(i)))
            continue
        }

        if resp.StatusCode != http.StatusOK {
            resp.Body.Close()
            return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
        }

        body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
        resp.Body.Close()
        if err != nil {
            return nil, err
        }
        return body, nil
    }

    return nil, fmt.Errorf("%d 回リトライ後も失敗: %w", maxRetries, lastErr)
}
```

:::tip リトライ戦略
- 4xx エラーはリトライしない（クライアント側の問題）
- 5xx エラーとネットワークエラーはリトライ可能
- 指数バックオフを使用：1s、2s、4s
- 最大リトライ回数を設定（通常 3 回）
:::

## バッチ + コンテキストキャンセル

大規模な URL バッチにはコンテキスト付きバッチ処理を使用し、タイムアウトキャンセルに対応します：

```go
func batchProcessURLs(processor *html.Processor, urls []string) {
    // 全体のタイムアウトを設定
    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
    defer cancel()

    // すべてのページを取得
    pages := make([][]byte, len(urls))
    for i, u := range urls {
        select {
        case <-ctx.Done():
            fmt.Println("取得がタイムアウト、キャンセルされました")
            return
        default:
            body, err := fetchWithRetry(http.DefaultClient, u, 2)
            if err != nil {
                log.Printf("スキップ %s: %v", u, err)
                continue
            }
            pages[i] = body
        }
    }

    // バッチ抽出
    batch := processor.ExtractBatchWithContext(ctx, pages)
    fmt.Printf("成功: %d, 失敗: %d, キャンセル: %d\n",
        batch.Success, batch.Failed, batch.Cancelled)
}
```

## エンコーディングの処理

HTTP レスポンスは非 UTF-8 エンコーディングの場合がありますが、HTML ライブラリは自動的に検出して処理します：

```go
// レスポンスが GBK エンコーディングでも正しく抽出可能
resp, _ := http.Get("https://example.cn/page")
body, _ := io.ReadAll(resp.Body)
result, _ := html.Extract(body) // エンコーディングを自動検出
```

`Content-Type` ヘッダーからエンコーディング情報を取得して手動指定も可能です：

```go
charset := "utf-8" // Content-Type から解析
if ct := resp.Header.Get("Content-Type"); ct != "" {
    if idx := strings.Index(ct, "charset="); idx != -1 {
        charset = ct[idx+8:]
    }
}

cfg := html.DefaultConfig()
cfg.Encoding = charset
result, _ := html.Extract(body, cfg)
```

## ベストプラクティス

| シーン | 推奨事項 |
|------|------|
| 単一ページの抽出 | `http.Get()` + `html.Extract()` |
| Web サービス | Processor シングルトン + `ExtractWithContext()` |
| バッチスクレイピング | `processURLs()` + Processor 再利用 |
| 信頼できないソース | `HighSecurityConfig()` + `io.LimitReader()` |
| エンコーディング不明 | 自動検出に頼る、または Content-Type ヘッダーから指定 |

## 次のステップ

- [キャッシュと再利用](../guides/processor-cache) - Processor ライフサイクル管理
- [監査システム実践](../guides/audit-pipeline) - プロダクション環境のセキュリティモニタリング
- [API リファレンス：バッチ処理](../api-reference/batch) - 完全なバッチ API
- [パフォーマンス最適化](../advanced/performance) - パフォーマンスチューニングのヒント
