---
title: 接続プールとプロキシ - HTTPC
description: HTTPC 接続プールとプロキシ設定ガイド。接続プールパラメータチューニング、HTTP と SOCKS5 プロキシ、DoH カスタムリゾルバー、アイドル接続管理戦略。
---

# 接続プールとプロキシ

## 接続プール設定

接続プールは HTTP クライアントのパフォーマンスにおける重要な要素です。HTTPC は `ConnectionConfig` で接続プールを管理します。

```go
cfg := httpc.DefaultConfig()

// 接続プールパラメータ
cfg.Connection.MaxIdleConns = 100         // グローバル最大アイドル接続数
cfg.Connection.MaxConnsPerHost = 20       // ホストあたりの最大接続数
cfg.Timeouts.IdleConn = 120 * time.Second // アイドル接続の保持時間
```

### パラメータの説明

| パラメータ | デフォルト | 説明 |
|------|------|------|
| `MaxIdleConns` | 50 | グローバル最大アイドル接続数 |
| `MaxConnsPerHost` | 10 | ホストあたりの最大接続数（アクティブ+アイドル含む） |
| `IdleConn` | 90s | アイドル接続タイムアウト、超過すると閉じられる |
| `Dial` | 10s | 接続確立タイムアウト |
| `TLSHandshake` | 10s | TLS ハンドシェイクタイムアウト |
| `ResponseHeader` | 30s | レスポンスヘッダー待機タイムアウト |

### シナリオ別の推奨

| シナリオ | MaxIdleConns | MaxConnsPerHost | IdleConn |
|------|-------------|-----------------|----------|
| 高同時 API | 100 | 20 | 120s |
| 通常のサービス | 50 | 10 | 90s |
| 低頻度リクエスト | 10 | 2 | 30s |
| マイクロサービス内部 | 50 | 10 | 60s |

:::tip ヒント
`MaxConnsPerHost` はアクティブ接続とアイドル接続の両方を含みます。この制限を超える新しいリクエストは、接続が解放されるまでキューで待機します。
:::

## プロキシ設定

### 手動プロキシ

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy.example.com:8080"

client, _ := httpc.New(cfg)
```

### 認証付きプロキシ

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://user:password@proxy.example.com:8080"
```

:::tip ヒント
`Config.String()` メソッドは、プロキシ URL 内のユーザー名とパスワードを自動的にマスクします。
:::

### SOCKS5 プロキシ

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "socks5://proxy.example.com:1080"
```

### システムプロキシの自動検出

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableSystemProxy = true

// 自動検出:
// - Windows: レジストリ Internet Settings
// - macOS: システム環境設定のネットワークプロキシ
// - Linux: 環境変数 HTTP_PROXY / HTTPS_PROXY
```

プロキシの優先順位：

1. `ProxyURL`（手動指定、最優先）
2. `EnableSystemProxy`（システムプロキシ検出）
3. 直接接続（プロキシなし）

## DNS-over-HTTPS

DoH を有効にすると、DNS 解決遅延の削減と DNS ハイジャックの防止ができます：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

デフォルトの DoH プロバイダー（優先順位順）：

| プロバイダー | アドレス | 説明 |
|--------|------|------|
| Cloudflare | `1.1.1.1/dns-query` | 最速、プライバシー重視 |
| Google | `8.8.8.8/resolve` | グローバルカバレッジ |
| AliDNS | `223.5.5.5/resolve` | 中国地域最適化 |

:::tip ヒント
DoH を有効にすると、DNS 解決結果は `DoHCacheTTL` の間キャッシュされます。すべての DoH プロバイダーが利用できない場合、システム DNS にフォールバックします。
:::

## HTTP/2

デフォルトで HTTP/2 が有効（TLS が必要）：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // HTTP/2 を無効化
```

HTTP/2 の機能：
- 多重化：単一接続で複数の同時リクエストを処理
- ヘッダー圧縮：重複ヘッダーの転送を削減
- サーバープッシュ

## オブジェクトプールの再利用

```go
result, err := client.Get(url)
if err != nil {
    return err
}
defer httpc.ReleaseResult(result) // オブジェクトプールに返却
```

高同時接続シナリオでは、`ReleaseResult` によって GC 負荷を大幅に軽減できます。

## 同時リクエストパターン

```go
func fetchAll(ctx context.Context, urls []string) ([]*httpc.Result, error) {
    results := make([]*httpc.Result, len(urls))
    errs := make([]error, len(urls))

    var wg sync.WaitGroup
    for i, url := range urls {
        wg.Add(1)
        go func(idx int, u string) {
            defer wg.Done()
            result, err := client.Request(ctx, "GET", u)
            results[idx] = result
            errs[idx] = err
        }(i, url)
    }
    wg.Wait()

    for _, err := range errs {
        if err != nil {
            return nil, err
        }
    }
    return results, nil
}
```

## 接続プールのよくある問題

| 問題 | 原因 | 解決策 |
|------|------|----------|
| 大量の TIME_WAIT | アイドル接続タイムアウトが短すぎる | `IdleConn` タイムアウトを増加 |
| 接続拒否 | ホストあたりの接続数が不足 | `MaxConnsPerHost` を増加 |
| リクエストがキューで待機 | 接続プールが小さすぎる | `MaxIdleConns` を増加 |

完全なパフォーマンスアンチパターンと最適化の提案は[パフォーマンス最適化](./performance)を参照してください。

## 次のステップ

- [パフォーマンス最適化](./performance) - パフォーマンスチューニングガイド
- [設定 API](../api-reference/config) - 接続設定リファレンス
- [セキュリティ概要](../security/) - SSRF と TLS セキュリティ
