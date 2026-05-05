---
title: よくある質問 - HTTPC
description: HTTPC よくある質問の回答集。パッケージレベル関数とクライアントの選択推奨、5 つの設定プリセットの比較分析、HTTP と SOCKS5 プロキシの設定方法、ClientError エラー分類とマッチング、オブジェクトプールのリソース管理戦略、タイムアウト設定のチューニング、接続プールの最適化など、高頻度の質問に対する詳細な回答とコード例。
---

# よくある質問

## パッケージレベル関数とクライアント作成、どちらを使うべき？

**パッケージレベル関数**はシンプルなシナリオに適しています：使い捨てリクエスト、スクリプト、ツール。

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**クライアントの作成**は、カスタム設定、接続プールの再利用、ミドルウェアの使用が必要なシナリオに適しています。

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## どの設定プリセットを選ぶべき？

| プリセット | 適用シナリオ |
|------|----------|
| `DefaultConfig()` | 一般的なシナリオ、安全なデフォルト値 |
| `SecureConfig()` | ユーザー提供の URL を処理、金融/医療シナリオ |
| `PerformanceConfig()` | 内部マイクロサービス通信、高同時 API |
| `TestingConfig()` | ユニットテスト、ローカル開発 |
| `MinimalConfig()` | 使い捨てスクリプト、シンプルな HTTP 呼び出し |

## 内部サービスにアクセスするには？

デフォルトの SSRF 防護はプライベート IP 接続をブロックします。内部サービスにアクセスする必要がある場合：

```go
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true // すべてのプライベート IP を許可

// または精密な除外
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

## なぜ ReleaseResult を呼び出す必要がある？

`ReleaseResult` は Result をオブジェクトプールに返却し、GC 負荷を軽減します。返却時にはレスポンスボディ内の機密データ（最初の 64KB）がクリアされ、オブジェクトプール内での情報漏洩を防止します。高同時接続シナリオではパフォーマンスの向上が顕著です。

```go
result, _ := client.Get(url)
defer httpc.ReleaseResult(result)
// これ以降 result にはアクセスしない
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

## リクエストタイムアウトを設定するには？

4 つの方法があり、優先順位の高い順に：

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

## TestingConfig が警告を出力するのはなぜ？

`TestingConfig` はセキュリティ機能（TLS 検証、SSRF 防護）を無効にするため、テスト以外の環境で使用するとセキュリティリスクがあります。テスト以外の環境が検出されると警告が出力されます。

`*_test.go` ファイルまたはローカル開発でのみ使用してください。

## DNS-over-HTTPS を有効にするには？

DoH は DNS 解決遅延の削減と DNS ハイジャックの防止に役立ちます：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

デフォルトでは Cloudflare、Google、AliDNS の 3 つのプロバイダーが使用されます（優先順位に従ってフォールバック）。すべての DoH プロバイダーが利用できない場合、自動的にシステム DNS にフォールバックします。

:::tip ヒント
DoH は DNS 解決のセキュリティが求められるシナリオに適しています。通常の API 呼び出しでは有効にする必要はなく、デフォルトの DNS で十分です。
:::

## その他のリソース

- [クイックスタート](./getting-started) - 5 分で始める
- [チュートリアル](./guides/tutorial) - ステップバイステップの完全な例
- [設定 API](./api-reference/config) - 完全な設定リファレンス
- [エラー処理](./advanced/error-handling) - エラー処理ガイド
