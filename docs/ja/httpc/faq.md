---
title: "よくある質問 - CyberGo HTTPC | 質問と回答"
description: "HTTPC よくある質問: パッケージ関数とクライアントの選択、設定プリセットの比較、プロキシと DoH、Cookie セッション、リトライとタイムアウトの調整、errors.Is/As エラーマッチングパターンで実開発の典型的な疑問を解決します。"
---

# よくある質問

## パッケージ関数とクライアント作成、どちらを使うべき？

**パッケージ関数**はシンプルなケースに適しています：一度きりのリクエスト、スクリプト、ツール。

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**クライアント作成**はカスタム設定、コネクションプールの再利用、ミドルウェアの使用が必要なケースに適しています。

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## 設定プリセットの選び方は？

| プリセット | 適用シナリオ |
|------------|--------------|
| `DefaultConfig()` | 汎用シナリオ、安全なデフォルト値 |
| `SecureConfig()` | ユーザー提供の URL を処理、金融/医療シナリオ |
| `PerformanceConfig()` | 内部マイクロサービス通信、高並列 API |
| `TestingConfig()` | ユニットテスト、ローカル開発 |
| `MinimalConfig()` | 一度きりのスクリプト、シンプルな HTTP 呼び出し |

## 内部サービスにアクセスするには？

デフォルトの SSRF 防護がプライベート IP 接続をブロックします。内部サービスにアクセスする必要がある場合：

```go
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true // 全プライベート IP を許可

// または精密な免除
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}
```

## プロキシを設定するには？

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy:8080"
client, _ := httpc.New(cfg)

// システムプロキシを使用
cfg.Connection.EnableSystemProxy = true
```

## HTTP エラーコードを処理するには？

HTTPC は 4xx/5xx を error として扱いません。手動で確認する必要があります：

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

## リトライを無効にするには？

```go
// 全体で無効化
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 0

// または MinimalConfig を使用
client, _ := httpc.New(httpc.MinimalConfig())

// 個別リクエストで無効化
result, _ := client.Get(url, httpc.WithMaxRetries(0))
```

## リクエストタイムアウトを設定するには？

4 つの方法があります。優先度が高い順：

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

## リクエストログを記録するには？

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }),
}
client, _ := httpc.New(cfg)
```

## TestingConfig が警告を出力する理由は？

`TestingConfig` はセキュリティ機能（TLS 検証、SSRF 防護）を無効にしています。テスト以外の環境で使用するとセキュリティリスクがあります。テスト以外の環境を検出すると警告が出力されます。

`*_test.go` ファイルまたはローカル開発でのみ使用してください。

## DNS-over-HTTPS を有効にするには？

DoH は DNS 解決遅延を削減し、DNS ハイジャックを防止できます：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

デフォルトで Cloudflare、Google、AliDNS の 3 プロバイダーを使用します（優先度順にフェイルバック）。全 DoH プロバイダーが利用できない場合、システム DNS に自動的にフォールバックします。

:::tip
DoH は DNS 解決のセキュリティが求められるシナリオに適しています。通常の API 呼び出しでは有効にする必要はなく、デフォルトの DNS で十分です。
:::

## その他のリソース

- [クイックスタート](./getting-started) - 5 分で始める
- [チュートリアル](./guides/tutorial) - ステップバイステップの完全な例
- [設定 API](./api-reference/config) - 完全な設定リファレンス
- [エラー処理](./advanced/error-handling) - エラー処理ガイド
