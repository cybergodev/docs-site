---
title: "チュートリアル - HTTPC"
description: "30分の実践チュートリアル：httpc.Getから段階的にGitHub REST APIクライアントを構築し、JSON解析、NewDomainドメインクライアント、WithJSONデータ送信、ミドルウェアチェーン、ClientErrorエラー処理、ファイルダウンロードをカバーします。"
---

# チュートリアル：GitHub APIクライアントの構築

GitHub APIクライアントを構築しながら、HTTPCのコア概念を学びます。約30分で完了します。

**学べる内容：**

- クライアントの作成と設定プリセット
- GET/POSTリクエストの送信とJSONレスポンスの処理
- ドメインクライアントによるAPIベースURLの管理
- ミドルウェアによるログとメトリクスの追加
- エラー処理とリトライ
- オブジェクトプール再利用によるパフォーマンス最適化

## ステップ1：基本的なリクエスト

依存関係をインストールし、`main.go`を作成：

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
    fmt.Println(result.Body())       // JSONレスポンス
}
```

ポイント：
- パッケージ関数`httpc.Get`はクライアントの作成不要。素早い検証に適しています
- `defer httpc.ReleaseResult(result)`で結果をオブジェクトプールに返却

## ステップ2：JSONレスポンスの解析

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
- `result.Unmarshal(&v)`でJSONレスポンスを直接構造体に解析
- APIレスポンスに対応するGo構造体を定義

## ステップ3：ドメインクライアントの作成

GitHub APIのすべてのエンドポイントは`https://api.github.com`以下にあるため、ドメインクライアントを使えばURLの重複記述を避けられます：

```go
client, err := httpc.NewDomain("https://api.github.com")
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

// パスはbaseURLからの相対パス
result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)
```

ポイント：
- `NewDomain`でスコープ付きクライアントを作成。パスはbaseURLからの相対パス
- `SetHeader`で永続ヘッダーを設定。毎回のリクエストに自動的に付与
- `WithHeader`はリクエストオプションとして渡し、そのリクエストのみに適用
- ドメインクライアントはCookieを自動的に管理

## ステップ4：データの送信（Issueの作成）

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
- `WithJSON(data)`が自動的にシリアライズし、Content-Typeを設定
- `result.IsSuccess()`で2xxステータスコードを確認

## ステップ5：ミドルウェアの追加

クライアントにログとリクエストIDを追加：

```go
// ミドルウェアを設定
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
}

// 設定をNewDomainに渡し、ミドルウェア付きドメインクライアントを作成
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
- ミドルウェアは`Config.Middleware.Middlewares`で設定
- `LoggingMiddleware`がリクエストログを記録
- `RecoveryMiddleware`がpanicによるクラッシュを防止
- `RequestIDMiddleware`が各リクエストにユニークIDを生成

## ステップ6：エラー処理とリトライ

```go
result, err := client.Get("/repos/golang/go")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("リクエストタイムアウト、後で再試行してください")
        case httpc.ErrorTypeNetwork:
            log.Println("ネットワークエラー")
        case httpc.ErrorTypeTLS:
            log.Println("TLSエラー")
        default:
            log.Printf("HTTPエラー: %s", clientErr.Error())
        }

        if clientErr.IsRetryable() {
            log.Println("このエラーは自動リトライ可能です")
        }
    }
    return
}
defer httpc.ReleaseResult(result)

// HTTPステータスコードの処理
switch {
case result.IsSuccess():
    // 2xx 成功
case result.StatusCode() == 401:
    log.Println("Tokenの有効期限切れまたは無効")
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
- HTTPCはネットワークエラーとHTTPステータスコードを分離して処理
- `ClientError`がエラー分類とリトライ可否の判定を提供
- デフォルトで408, 429, 500, 502, 503, 504を自動リトライ

## ステップ7：ファイルダウンロード（リリースパッケージのダウンロード）

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

## ステップ8：並行リクエスト

複数のリポジトリ情報を同時に取得：

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
`PerformanceConfig()`は大規模接続プール設定を提供し、高並行シナリオに適しています。並行処理で`ReleaseResult`を正しく使用してください。
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
