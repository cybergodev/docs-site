---
title: よくある質問 - HTTPC
description: HTTPC よくある質問集。パッケージ関数の選択、設定プリセットの比較、プロキシ設定、エラーマッチング、オブジェクトプール管理、タイムアウトチューニングなど。
---

# よくある質問

## パッケージ関数とクライアント作成、どちらを使うべき？

**パッケージ関数**はシンプルなシナリオに適しています：一回限りのリクエスト、スクリプト、ツール。

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**クライアント作成**はカスタム設定、コネクションプール再利用、ミドルウェア使用のシナリオに適しています。

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## 設定プリセットの選び方は？

| プリセット | 適用シナリオ |
|------------|-------------|
| `DefaultConfig()` | 汎用、セキュアなデフォルト値 |
| `SecureConfig()` | ユーザー提供 URL の処理、金融・医療シナリオ |
| `PerformanceConfig()` | 内部マイクロサービス通信、高並列 API |
| `TestingConfig()` | ユニットテスト、ローカル開発 |
| `MinimalConfig()` | 一回限りのスクリプト、シンプルな HTTP 呼び出し |

## 内部サービスにアクセスするには？

デフォルトの SSRF 防護がプライベート IP 接続をブロックします。内部サービスへのアクセスが必要な場合：

```go
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true // すべてのプライベート IP を許可

// または精確な豁免
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

## なぜ ReleaseResult を呼ぶ必要がある？

`ReleaseResult` は Result をオブジェクトプールに返却し、GC 負荷を軽減します。返却時にはレスポンスボディ内の機密データ（先頭 64KB）をクリアし、オブジェクトプール内での情報漏洩を防止します。高並列シナリオでパフォーマンス向上が顕著です。

```go
result, _ := client.Get(url)
defer httpc.ReleaseResult(result)
// 以降 result にアクセスしないこと
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

## リクエストタイムアウトの設定方法は？

4 つの方法、優先度が高い順：

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

## TestingConfig が警告を出力する理由は？

`TestingConfig` はセキュリティ機能（TLS 検証、SSRF 防護）を無効にするため、テスト以外の環境での使用にはセキュリティリスクがあります。テスト以外の環境が検出されると警告が出力されます。

`*_test.go` ファイルまたはローカル開発でのみ使用してください。

## DNS-over-HTTPS の有効化方法は？

DoH は DNS 解決レイテンシを削減し、DNS ハイジャックを防止できます：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

デフォルトで Cloudflare、Google、AliDNS の 3 つのプロバイダーを使用します（優先度順にフォールバック）。すべての DoH プロバイダーが利用できない場合、システム DNS に自動的にフォールバックします。

:::tip ヒント
DoH は DNS 解決のセキュリティが求められるシナリオに適しています。通常の API 呼び出しでは有効化する必要はなく、デフォルトの DNS で十分です。
:::

## その他のリソース

- [クイックスタート](./getting-started) - 5 分で始める
- [チュートリアル](./guides/tutorial) - ステップバイステップの完全な例
- [設定 API](./api-reference/config) - 完全な設定リファレンス
- [エラー処理](./advanced/error-handling) - エラー処理ガイド
