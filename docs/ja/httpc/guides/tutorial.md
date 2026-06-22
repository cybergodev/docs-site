---
title: "チュートリアル - CyberGo HTTPC | GitHub API 実戦"
description: "HTTPC 実践チュートリアル: httpc.Get から段階的に完全な GitHub REST API クライアントを構築し、JSON 解析、ドメインクライアント、ミドルウェアチェーン組み合わせ、ClientError エラー処理、ファイルダウンロードをカバーします。"
---

# チュートリアル：GitHub API クライアントの構築

GitHub API クライアントを構築しながら HTTPC のコアコンセプトを学びます。約 30 分で完了します。

**学ぶこと：**

- クライアントの作成と設定プリセット
- GET/POST リクエストの送信と JSON レスポンスの処理
- ドメインクライアントで API ベース URL を管理
- ミドルウェアでログとメトリクスを追加
- エラー処理とリトライ
- Result レスポンスオブジェクトと自動管理

## ステップ 1：基本的なリクエスト

依存関係をインストールして `main.go` を作成します：

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

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())       // JSON レスポンス
}
```

ポイント：
- パッケージ関数 `httpc.Get` はクライアントの作成が不要で、素早く確認するのに適しています
- Result はリクエストごとに新規作成され、GC が自動的に回収します。手動での解放は不要です

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

var repo Repo
if err := result.Unmarshal(&repo); err != nil {
    log.Fatal(err)
}

fmt.Printf("%s (⭐ %d)\n", repo.FullName, repo.Stars)
fmt.Printf("言語: %s\n", repo.Language)
fmt.Printf("説明: %s\n", repo.Description)
```

ポイント：
- `result.Unmarshal(&v)` で JSON レスポンスを構造体に直接解析
- API レスポンスに対応する Go 構造体を定義

## ステップ 3：ドメインクライアントの作成

GitHub API のすべてのエンドポイントは `https://api.github.com` にあるため、ドメインクライアントを使うと URL の重複を避けられます：

```go
client, err := httpc.NewDomain("https://api.github.com")
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

// パスは baseURL からの相対パス
result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}
```

ポイント：
- `NewDomain` はスコープ付きクライアントを作成し、パスは baseURL からの相対パス
- `SetHeader` は永続的なヘッダーを設定し、毎回のリクエストに自動的に付与
- `WithHeader` はリクエストオプションとして渡し、現在のリクエストのみに適用
- ドメインクライアントは Cookie を自動管理

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

if !result.IsSuccess() {
    log.Fatalf("作成に失敗: %d %s", result.StatusCode(), result.Body())
}

var created struct {
    Number int    `json:"number"`
    URL    string `json:"html_url"`
}
result.Unmarshal(&created)
fmt.Printf("Issue #%d を作成しました: %s\n", created.Number, created.URL)
```

ポイント：
- `WithJSON(data)` が自動的にシリアライズし、Content-Type を設定
- `result.IsSuccess()` で 2xx ステータスコードを確認

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

// 設定を NewDomain に渡して、ミドルウェア付きのドメインクライアントを作成
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

var repo Repo
result.Unmarshal(&repo)
fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
```

ポイント：
- ミドルウェアは `Config.Middleware.Middlewares` で設定
- `LoggingMiddleware` はリクエストログを記録
- `RecoveryMiddleware` は panic によるクラッシュを防止
- `RequestIDMiddleware` は各リクエストにユニーク ID を生成

## ステップ 6：エラー処理とリトライ

```go
result, err := client.Get("/repos/golang/go")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("リクエストタイムアウト、後でリトライしてください")
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

// HTTP ステータスコードの処理
switch {
case result.IsSuccess():
    // 2xx 成功
case result.StatusCode() == 401:
    log.Println("Token が期限切れまたは無効")
case result.IsClientError():
    log.Printf("クライアントエラー: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("サーバーエラー: %d (自動リトライ %d 回)",
        result.StatusCode(), result.Meta.Attempts)
}
```

リトライポリシーの設定：

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 5
cfg.Retry.Delay = 2 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true
```

ポイント：
- HTTPC はネットワークエラーと HTTP ステータスコードを分離して処理
- `ClientError` はエラー分類とリトライ可否の判定を提供
- デフォルトで 408, 429, 500, 502, 503, 504 を自動リトライ

## ステップ 7：ファイルダウンロード（リリースパッケージのダウンロード）

```go
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "go1.22.0.linux-amd64.tar.gz"
dlCfg.Overwrite = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\rダウンロード進捗: %.1f%% (%.2f MB/s)", pct, float64(speed)/1024/1024)
}

result, err := client.Download(
    context.Background(),
    "https://go.dev/dl/go1.22.0.linux-amd64.tar.gz",
    dlCfg,
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nダウンロード完了: %s (%d bytes)\n",
    result.FilePath,
    result.BytesWritten,
)
```

## ステップ 8：並列リクエスト

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
    }
    return nil
}
```

:::tip
`PerformanceConfig()` は大規模コネクションプール設定を提供し、高並列シナリオに適しています。Result はリクエストごとに新規作成され、GC が自動的に回収されます。
:::

## 完全な例

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
- [リトライとフォールトトレランス](./retry-fault-tolerance) — 高度なリトライポリシー
- [パフォーマンス最適化](../advanced/performance) — 本番環境のチューニング
- [本番チェックリスト](../security/production-checklist) — セキュリティベストプラクティス
