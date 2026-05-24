---
title: "よくある質問 - HTTPC"
description: "HTTPCよくある質問集：パッケージ関数とクライアントインスタンスの使い分け、5種の設定プリセット比較、HTTP/SOCKS5プロキシとDoH設定、errors.Is/Asエラーマッチング、ReleaseResultオブジェクトプール管理、4段階タイムアウトチューニング。"
---

# よくある質問

## パッケージ関数とクライアント作成、いつどちらを使う？

**パッケージ関数**はシンプルな場面に適しています：一回限りのリクエスト、スクリプト、ツール。

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**クライアントの作成**はカスタム設定、接続プールの再利用、ミドルウェアの使用が必要な場面に適しています。

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## 設定プリセットの選び方は？

| プリセット | 適用シナリオ |
|------------|--------------|
| `DefaultConfig()` | 汎用シナリオ。安全なデフォルト値 |
| `SecureConfig()` | ユーザー提供のURLを処理、金融/医療シナリオ |
| `PerformanceConfig()` | 内部マイクロサービス通信、高並行API |
| `TestingConfig()` | ユニットテスト、ローカル開発 |
| `MinimalConfig()` | 一回限りのスクリプト、シンプルなHTTP呼び出し |

## 内部サービスにアクセスするには？

デフォルトのSSRF防御がプライベートIPへの接続をブロックします。内部サービスへのアクセスが必要な場合：

```go
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true // 全プライベートIPを許可

// または精密な免除
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

## HTTPエラーコードの処理方法は？

HTTPCは4xx/5xxをerrorとして扱いません。手動で確認する必要があります：

```go
result, err := client.Get(url)
if err != nil {
    // ネットワーク層エラー
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

## ReleaseResultの呼び出しが必要な理由は？

`ReleaseResult`はResultをオブジェクトプールに返却し、GC負荷を軽減します。返却時にはレスポンスボディ全体をゼロクリアして機密データの残留を防止し、オブジェクトプール内での情報漏洩を回避します。高並行シナリオでパフォーマンスが大幅に向上します。

```go
result, _ := client.Get(url)
defer httpc.ReleaseResult(result)
// 以降はresultにアクセスしない
```

## リトライを無効にするには？

```go
// 全体で無効化
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 0

// またはMinimalConfigを使用
client, _ := httpc.New(httpc.MinimalConfig())

// 個別リクエストで無効化
result, _ := client.Get(url, httpc.WithMaxRetries(0))
```

## リクエストタイムアウトの設定方法は？

4つの方法、優先度が高い順：

```go
// 1. コンテキストタイムアウト（推奨）
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, _ := client.Request(ctx, "GET", url)

// 2. リクエストオプション
result, _ := client.Get(url, httpc.WithTimeout(5*time.Second))

// 3. ミドルウェア強制タイムアウト
middleware := httpc.TimeoutMiddleware(5 * time.Second)

// 4. クライアントデフォルトタイムアウト
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

## TestingConfigが警告を表示する理由は？

`TestingConfig`はセキュリティ機能（TLS検証、SSRF防御）を無効にするため、テスト以外の環境での使用はセキュリティリスクがあります。テスト以外の環境を検出すると警告を表示します。

`*_test.go`ファイルまたはローカル開発でのみ使用してください。

## DNS-over-HTTPSの有効化方法は？

DoHはDNS解決の遅延を減らし、DNSハイジャックを防止できます：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

デフォルトでCloudflare、Google、AliDNSの3つのプロバイダーを使用します（優先度順にフォールバック）。全DoHプロバイダーが利用不可能な場合、システムDNSに自動的にフォールバックします。

:::tip ヒント
DoHはDNS解決のセキュリティが求められるシナリオに適しています。通常のAPI呼び出しでは有効にする必要はなく、デフォルトのDNSで十分です。
:::

## その他のリソース

- [クイックスタート](./getting-started) - 5分で始める
- [チュートリアル](./guides/tutorial) - 段階的な完全な例
- [設定API](./api-reference/config) - 完全な設定リファレンス
- [エラー処理](./advanced/error-handling) - エラー処理ガイド
