---
title: コネクションプールとプロキシ - HTTPC
description: HTTPC コネクションプールとプロキシ設定ガイド。コネクションプールパラメータのチューニング、HTTP・SOCKS5 プロキシ、DoH カスタムリゾルバー、アイドル接続管理戦略を詳解。
---

# コネクションプールとプロキシ

## コネクションプール設定

コネクションプールは HTTP クライアントのパフォーマンスにおける重要な要素です。HTTPC は `ConnectionConfig` を使用してコネクションプールを管理します。

```go
cfg := httpc.DefaultConfig()

// コネクションプールパラメータ
cfg.Connection.MaxIdleConns = 100         // グローバル最大アイドル接続数
cfg.Connection.MaxConnsPerHost = 20       // ホストごとの最大接続数
cfg.Timeouts.IdleConn = 120 * time.Second // アイドル接続の保持時間
```

### パラメータ説明

| パラメータ | デフォルト | 説明 |
|------|------|------|
| `MaxIdleConns` | 50 | グローバル最大アイドル接続数 |
| `MaxConnsPerHost` | 10 | ホストごとの最大接続数（アクティブ+アイドル） |
| `IdleConn` | 90s | アイドル接続タイムアウト、超過すると閉じられる |
| `Dial` | 10s | 接続確立タイムアウト |
| `TLSHandshake` | 10s | TLS ハンドシェイクタイムアウト |
| `ResponseHeader` | 0 | 無効（Request タイムアウトを使用） |

### シナリオ別おすすめ設定

| シナリオ | MaxIdleConns | MaxConnsPerHost | IdleConn |
|------|-------------|-----------------|----------|
| 高並行 API | 100 | 20 | 120s |
| 一般サービス | 50 | 10 | 90s |
| 低頻度リクエスト | 10 | 2 | 30s |
| マイクロサービス内部 | 50 | 10 | 60s |

:::tip
`MaxConnsPerHost` にはアクティブ接続とアイドル接続が含まれます。この制限を超える新しいリクエストは、接続が解放されるまでキューで待機します。
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

:::tip
`Config.String()` メソッドは、プロキシ URL 内のユーザー名とパスワードを自動的にマスキングします。
:::

### SOCKS5 プロキシ

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "socks5://proxy.example.com:1080"
```

### システムプロキシ自動検出

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableSystemProxy = true

// 自動検出:
// - Windows: レジストリ Internet Settings
// - macOS: システム環境設定ネットワークプロキシ
// - Linux: 環境変数 HTTP_PROXY / HTTPS_PROXY
```

プロキシ優先度：

1. `ProxyURL`（手動指定、最優先）
2. `EnableSystemProxy`（システムプロキシ検出）
3. ダイレクト接続（プロキシなし）

## DNS-over-HTTPS

DoH を有効にすると、DNS 解析遅延の削減と DNS ハイジャック防止に効果があります：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

デフォルト DoH プロバイダー（優先度順）：

| プロバイダー | アドレス | 説明 |
|--------|------|------|
| Cloudflare | `1.1.1.1/dns-query` | 最速、プライバシー優先 |
| Google | `8.8.8.8/resolve` | グローバルカバレッジ |
| AliDNS | `223.5.5.5/resolve` | 中国地域最適化 |

:::tip
DoH 有効時、DNS 解析結果は `DoHCacheTTL` の間キャッシュされます。すべての DoH プロバイダーが利用できない場合、システム DNS にフォールバックします。
:::

## HTTP/2

デフォルトで HTTP/2 が有効です（TLS が必要）：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // HTTP/2 を無効化
```

HTTP/2 の特徴：
- 多重化：単一接続で複数の並行リクエストを処理
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

高並行シナリオでは、`ReleaseResult` により GC 負荷を大幅に軽減できます。

## 並行リクエストパターン

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

## コネクションプールのよくある問題

| 問題 | 原因 | 解決策 |
|------|------|----------|
| 大量の TIME_WAIT | アイドル接続タイムアウトが短すぎる | `IdleConn` タイムアウトを増やす |
| 接続拒否 | ホストごとの接続数が不足 | `MaxConnsPerHost` を増やす |
| リクエストがキューで待機 | コネクションプールが小さすぎる | `MaxIdleConns` を増やす |

パフォーマンスのアンチパターンと最適化の提案の詳細は [パフォーマンス最適化](./performance) をご覧ください。

## 次のステップ

- [パフォーマンス最適化](./performance) - パフォーマンスチューニングガイド
- [設定 API](../api-reference/config) - 接続設定リファレンス
- [セキュリティ概要](../security/) - SSRF と TLS セキュリティ
