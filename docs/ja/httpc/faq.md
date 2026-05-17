---
title: よくある質問 - HTTPC
description: HTTPC よくある質問集。パッケージレベル関数の使い分け、設定プリセット比較、プロキシ設定、エラーハンドリング、オブジェクトプール管理、タイムアウトチューニングなど高頻度の質問を解説。
---

# よくある質問

## パッケージレベル関数とクライアント作成の使い分けは？

**パッケージレベル関数**は単純なシナリオに適しています：一度きりのリクエスト、スクリプト、ツールなど。

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**クライアント作成**はカスタム設定、コネクションプールの再利用、ミドルウェアの使用が必要なシナリオに適しています。

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## 設定プリセットの選び方は？

| プリセット | 適用シナリオ |
|------|----------|
| `DefaultConfig()` | 汎用シナリオ、安全なデフォルト値 |
| `SecureConfig()` | ユーザー提供 URL の処理、金融・医療シナリオ |
| `PerformanceConfig()` | 内部マイクロサービス通信、高並行 API |
| `TestingConfig()` | ユニットテスト、ローカル開発 |
| `MinimalConfig()` | 一次性スクリプト、シンプルな HTTP 呼び出し |

## 内部サービスにアクセスするには？

デフォルトでは SSRF 防護によりプライベート IP への接続がブロックされます。内部サービスにアクセスする必要がある場合：

```go
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true // すべてのプライベート IP を許可

// または CIDR 単位で除外
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}
```

## プロキシの設定方法は？

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy:8080"
client, _ := httpc.New(cfg)

// システムプロキシを使用
cfg.Connection.EnableSystemProxy = true
```

## HTTP エラーコードの処理方法は？

HTTPC は 4xx/5xx を error として扱いません。手動で確認する必要があります：

```go
result, err := client.Get(url)
if err != nil {
    // ネットワーク層のエラー
    return err
}

switch {
case result.IsSuccess():
    // 2xx 成功
case result.IsClientError():
    // 4xx クライアントエラー
    log.Printf("リクエストパラメータエラー: %d", result.StatusCode())
case result.IsServerError():
    // 5xx サーバーエラー
    log.Printf("サーバー障害: %d", result.StatusCode())
}
```

## なぜ ReleaseResult を呼び出す必要がありますか？

`ReleaseResult` は Result をオブジェクトプールに返却し、GC 負荷を軽減します。返却時にはレスポンスボディを全体ゼロクリアして機密データの残留を防止し、オブジェクトプール内での情報漏洩を防ぎます。高並行シナリオではパフォーマンスの向上が顕著です。

```go
result, _ := client.Get(url)
defer httpc.ReleaseResult(result)
// 以降、result にはアクセスしないでください
```

## リトライを無効にするには？

```go
// グローバルで無効化
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 0

// または MinimalConfig を使用
client, _ := httpc.New(httpc.MinimalConfig())

// 個別リクエストで無効化
result, _ := client.Get(url, httpc.WithMaxRetries(0))
```

## リクエストタイムアウトの設定方法は？

4 つの方法があり、優先度が高い順に示します：

```go
// 1. コンテキストタイムアウト（推奨）
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, _ := client.Request(ctx, "GET", url)

// 2. リクエストオプション
result, _ := client.Get(url, httpc.WithTimeout(5*time.Second))

// 3. ミドルウェアによる強制タイムアウト
middleware := httpc.TimeoutMiddleware(5 * time.Second)

// 4. クライアントのデフォルトタイムアウト
cfg.Timeouts.Request = 30 * time.Second
```

## リクエストログの記録方法は？

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }),
}
client, _ := httpc.New(cfg)
```

## TestingConfig が警告を表示するのはなぜですか？

`TestingConfig` はセキュリティ機能（TLS 検証、SSRF 防護）を無効にするため、テスト以外の環境で使用するとセキュリティリスクがあります。テスト環境以外での使用が検出されると警告が表示されます。

`*_test.go` ファイルまたはローカル開発でのみ使用してください。

## DNS-over-HTTPS を有効にするには？

DoH は DNS 解析遅延の削減と DNS ハイジャック防止に効果があります：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

デフォルトでは Cloudflare、Google、AliDNS の 3 つのプロバイダーが使用されます（優先度順にフォールバック）。すべての DoH プロバイダーが利用できない場合、自動的にシステム DNS にフォールバックします。

:::tip
DoH は DNS 解析のセキュリティが求められるシナリオに適しています。通常の API 呼び出しでは有効化する必要はなく、デフォルトの DNS で十分です。
:::

## その他のリソース

- [クイックスタート](./getting-started) - 5 分で始める
- [チュートリアル](./guides/tutorial) - ステップバイステップの完全な例
- [設定 API](./api-reference/config) - 完全な設定リファレンス
- [エラー処理](./advanced/error-handling) - エラー処理ガイド
