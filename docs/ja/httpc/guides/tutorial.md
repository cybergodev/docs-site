---
title: 実践チュートリアル - HTTPC
description: 三十分のチュートリアルで GitHub REST API クライアントを構築し、HTTPC クライアント設定、リクエストオプション、ドメインクライアント、ミドルウェア、エラー処理を学習。
---

# 実践チュートリアル：GitHub API クライアントの構築

GitHub API クライアントを構築しながら、HTTPC のコア概念を学びます。約30分で完了します。

**学習内容：**

- クライアントの作成と設定プリセット
- GET/POST リクエストの送信と JSON レスポンスの処理
- ドメインクライアントを使用した API ベース URL の管理
- ミドルウェアによるログとメトリクスの追加
- エラー処理とリトライ
- オブジェクトプールの再利用によるパフォーマンス最適化

## ステップ 1：基本リクエスト

依存関係をインストールし、`main.go` を作成します：

```bash
go get github.com/cybergodev/httpc
```

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://api.github.com/repos/golang/go")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())       // JSON レスポンス
}
```

ポイント：
- パッケージレベル関数 `httpc.Get` はクライアントの作成不要で、素早く検証できます
- `defer httpc.ReleaseResult(result)` は結果をオブジェクトプールに返却します

## ステップ 2：JSON レスポンスの解析

```go
type Repo struct {
    FullName    string `json:"full_name"`
    Description string `json:"description"`
    Stars       int    `json:"stargazers_count"`
    Language    string `json:"language"`
}

result, err := httpc.Get("https://api.github.com/repos/golang/go")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

var repo Repo
if err := result.Unmarshal(&repo); err != nil {
    log.Fatal(err)
}

fmt.Printf("%s (⭐ %d)\n", repo.FullName, repo.Stars)
fmt.Printf("言語: %s\n", repo.Language)
fmt.Printf("説明: %s\n", repo.Description)
```

ポイント：
- `result.Unmarshal(&v)` は JSON レスポンスを直接構造体に解析します
- API レスポンスに対応する Go 構造体を定義します

## ステップ 3：ドメインクライアントの作成

GitHub API のすべてのエンドポイントは `https://api.github.com` 配下にあるため、ドメインクライアントを使用して URL の重複を回避します：

```go
client, err := httpc.NewDomain("https://api.github.com")
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

// リクエストパスは baseURL からの相対パス
result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)
```

ポイント：
- `NewDomain` はスコープ付きクライアントを作成し、パスは baseURL からの相対パスになります
- `SetHeader` は永続的なリクエストヘッダーを設定し、すべてのリクエストに自動的に付与されます
- `WithHeader` はリクエストオプションとして渡され、現在のリクエストのみに適用されます
- ドメインクライアントは Cookie を自動管理します

## ステップ 4：データの送信（Issue の作成）

```go
type CreateIssueRequest struct {
    Title string `json:"title"`
    Body  string `json:"body"`
}

newIssue := CreateIssueRequest{
    Title: "Bug report",
    Body:  "Found a bug in the API response",
}

result, err := client.Post("/repos/owner/repo/issues",
    httpc.WithJSON(newIssue),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

if !result.IsSuccess() {
    log.Fatalf("作成失敗: %d %s", result.StatusCode(), result.Body())
}

var created struct {
    Number int    `json:"number"`
    URL    string `json:"html_url"`
}
result.Unmarshal(&created)
fmt.Printf("Issue #%d が作成されました: %s\n", created.Number, created.URL)
```

ポイント：
- `WithJSON(data)` は自動的にシリアライズし Content-Type を設定します
- `result.IsSuccess()` は 2xx ステータスコードを確認します

## ステップ 5：ミドルウェアの追加

クライアントにログとリクエスト ID を追加します：

```go
// ミドルウェアの設定
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
}

// 設定を NewDomain に渡して、ミドルウェア付きドメインクライアントを作成
client, err := httpc.NewDomain("https://api.github.com", cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

var repo Repo
result.Unmarshal(&repo)
fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
```

ポイント：
- ミドルウェアは `Config.Middleware.Middlewares` で設定します
- `LoggingMiddleware` はリクエストログを記録します
- `RecoveryMiddleware` は panic によるクラッシュを防ぎます
- `RequestIDMiddleware` は各リクエストに一意の ID を生成します

## ステップ 6：エラー処理とリトライ

```go
result, err := client.Get("/repos/golang/go")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("リクエストがタイムアウトしました。後で再試行してください")
        case httpc.ErrorTypeNetwork:
            log.Println("ネットワークエラー")
        case httpc.ErrorTypeTLS:
            log.Println("TLS エラー")
        default:
            log.Printf("HTTP エラー: %s", clientErr.Error())
        }

        if clientErr.IsRetryable() {
            log.Println("このエラーは自動リトライ可能です")
        }
    }
    return
}
defer httpc.ReleaseResult(result)

// HTTP ステータスコードの処理
switch {
case result.IsSuccess():
    // 2xx 成功
case result.StatusCode() == 401:
    log.Println("Token が期限切れまたは無効です")
case result.IsClientError():
    log.Printf("クライアントエラー: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("サーバーエラー: %d (%d 回自動リトライ済み)",
        result.StatusCode(), result.Meta.Attempts)
}
```

リトライ戦略の設定：

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 5
cfg.Retry.Delay = 2 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true
```

ポイント：
- HTTPC はネットワークエラーと HTTP ステータスコードを分離して処理します
- `ClientError` はエラーの分類とリトライ可否の判定を提供します
- デフォルトでは 408, 429, 500, 502, 503, 504 に対して自動リトライします

## ステップ 7：ファイルダウンロード（リリースパッケージのダウンロード）

```go
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "go1.22.0.linux-amd64.tar.gz"
dlCfg.Overwrite = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\rダウンロード進捗: %.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}

result, err := client.DownloadWithOptions(
    "https://go.dev/dl/go1.22.0.linux-amd64.tar.gz",
    dlCfg,
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nダウンロード完了: %s (%s)\n",
    result.FilePath,
    httpc.FormatBytes(result.BytesWritten),
)
```

## ステップ 8：並行リクエスト

複数のリポジトリ情報を同時に取得します：

```go
func fetchRepos(ctx context.Context, repos []string) error {
    client, _ := httpc.New(httpc.PerformanceConfig())
    defer client.Close()

    results := make([]*httpc.Result, len(repos))
    errs := make([]error, len(repos))

    var wg sync.WaitGroup
    for i, name := range repos {
        wg.Add(1)
        go func(idx int, repo string) {
            defer wg.Done()
            r, err := client.Request(ctx, "GET", fmt.Sprintf("https://api.github.com/repos/%s", repo))
            results[idx] = r
            errs[idx] = err
        }(i, name)
    }
    wg.Wait()

    for i, err := range errs {
        if err != nil {
            return err
        }

        var repo Repo
        results[i].Unmarshal(&repo)
        fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
        httpc.ReleaseResult(results[i])
    }
    return nil
}
```

:::tip ヒント
`PerformanceConfig()` は大規模な接続プール設定を提供し、高並行シナリオに適しています。並行処理では `ReleaseResult` を正しく使用してください。
:::

## 完全なサンプル

上記のステップを統合した完全なコード：

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "os"
    "time"

    "github.com/cybergodev/httpc"
)

type Repo struct {
    FullName    string `json:"full_name"`
    Description string `json:"description"`
    Stars       int    `json:"stargazers_count"`
    Language    string `json:"language"`
}

func main() {
    token := os.Getenv("GITHUB_TOKEN")

    cfg := httpc.DefaultConfig()
    cfg.Retry.MaxRetries = 3
    cfg.Retry.Delay = 1 * time.Second
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.LoggingMiddleware(func(format string, args ...any) {
            log.Printf("[HTTP] "+format, args...)
        }),
        httpc.RecoveryMiddleware(),
    }

    client, err := httpc.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    // リポジトリ情報の取得
    result, err := client.Get("https://api.github.com/repos/golang/go",
        httpc.WithHeader("Authorization", "Bearer "+token),
    )
    if err != nil {
        var clientErr *httpc.ClientError
        if errors.As(err, &clientErr) && clientErr.IsRetryable() {
            log.Fatal("リクエスト失敗（リトライ済み）:", err)
        }
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    if result.IsSuccess() {
        var repo Repo
        result.Unmarshal(&repo)
        fmt.Printf("✅ %s\n", repo.FullName)
        fmt.Printf("   ⭐ %d | 言語: %s\n", repo.Stars, repo.Language)
        fmt.Printf("   %s\n", repo.Description)
        fmt.Printf("   所要時間: %s (リトライ %d 回)\n",
            result.Meta.Duration, result.Meta.Attempts)
    }
}
```

## 次のステップ

- [リクエストとレスポンス](./request-response) — 完全なリクエストオプションリファレンス
- [ミドルウェアチェーン](./middleware-chain) — カスタムミドルウェア開発
- [リトライとフォールトトレランス](./retry-fault-tolerance) — 高度なリトライ戦略
- [パフォーマンス最適化](../advanced/performance) — 本番環境のチューニング
- [本番チェックリスト](../security/production-checklist) — セキュリティベストプラクティス
