---
title: "コネクションプールとプロキシ - CyberGo HTTPC | プールとプロキシ"
description: "HTTPC コネクションプールとプロキシガイド: MaxIdleConns チューニングとシナリオ推奨、ProxyURL 手動とシステムプロキシ、SOCKS5 と HTTP プロキシ、DoH フェイルバック、HTTP/2 設定の実践ポイントを解説します。"
---

# コネクションプールとプロキシ

## コネクションプール設定

コネクションプールは HTTP クライアントのパフォーマンスの重要な要素です。HTTPC は `ConnectionConfig` でコネクションプールを管理します。

```go
cfg := httpc.DefaultConfig()

// コネクションプールパラメータ
cfg.Connection.MaxIdleConns = 100         // グローバル最大アイドル接続数
cfg.Connection.MaxConnsPerHost = 20       // ホストあたりの最大接続数
cfg.Timeouts.IdleConn = 120 * time.Second // アイドル接続維持時間
```

### パラメータの説明

| パラメータ | デフォルト | 説明 |
|-----------|-----------|------|
| `MaxIdleConns` | 50 | グローバル最大アイドル接続数 |
| `MaxConnsPerHost` | 10 | ホストあたりの最大接続数（アクティブ+アイドル含む） |
| `IdleConn` | 90s | アイドル接続タイムアウト。超過するとクローズ |
| `Dial` | 10s | 接続確立タイムアウト |
| `TLSHandshake` | 10s | TLS ハンドシェイクライムアウト |
| `ResponseHeader` | 0 | 無効（Request タイムアウトを使用） |

### シナリオ別推奨

| シナリオ | MaxIdleConns | MaxConnsPerHost | IdleConn |
|---------|-------------|-----------------|----------|
| 高並列 API | 100 | 20 | 120s |
| 通常サービス | 50 | 10 | 90s |
| 低頻度リクエスト | 10 | 2 | 30s |
| マイクロサービス内部 | 50 | 10 | 60s |

:::tip
`MaxConnsPerHost` はアクティブ接続とアイドル接続の両方を含みます。この制限を超える新しいリクエストは接続の解放を待ってキューに入ります。
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
`Config.String()` メソッドはプロキシ URL のユーザー名とパスワードを自動的にマスクします。
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
// - macOS: システム環境設定ネットワークプロキシ
// - Linux: 環境変数 HTTP_PROXY / HTTPS_PROXY
```

プロキシの優先度：

1. `ProxyURL`（手動指定、最高優先度）
2. `EnableSystemProxy`（システムプロキシ検出）
3. 直接接続（プロキシなし）

## DNS-over-HTTPS

DoH を有効にして DNS 解決遅延を削減し、DNS ハイジャックを防止：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

デフォルトの DoH プロバイダー（優先度順）：

| プロバイダー | アドレス | 説明 |
|-------------|---------|------|
| Cloudflare | `1.1.1.1/dns-query` | 最速、プライバシー重視 |
| Google | `dns.google/resolve` | グローバルカバレッジ |
| AliDNS | `dns.alidns.com/resolve` | 中国地域最適化 |

:::tip
DoH を有効にすると、DNS 解決結果が `DoHCacheTTL` の間キャッシュされます。すべての DoH プロバイダーが利用できない場合、システム DNS にフォールバックします。
:::

## HTTP/2

デフォルトで HTTP/2 が有効です（TLS が必要）：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // HTTP/2 を無効化
```

HTTP/2 の特徴：
- 多重化：単一接続で複数の並列リクエストを処理
- ヘッダー圧縮：繰り返しヘッダーの転送を削減
- サーバープッシュ

## オブジェクトプール再利用

HTTPC は内部でエンジンのレスポンスオブジェクトと文字列ビルダーを sync.Pool で再利用し、GC 負荷を軽減します。Result 自体はリクエストごとに新規作成され、GC が自動的に回収します。

```go
result, err := client.Get(url)
if err != nil {
    return err
}
// Result はリクエストごとに新規作成、GC が自動回収、手動解放不要
```

高並列シナリオでは、内部オブジェクトプールの再利用により GC 負荷を大幅に軽減できます。

## 並列リクエストパターン

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
|------|------|--------|
| 大量の TIME_WAIT | アイドル接続タイムアウトが短すぎる | `IdleConn` タイムアウトを増加 |
| 接続拒否 | ホストあたりの接続数が不足 | `MaxConnsPerHost` を増加 |
| リクエストがキューで待機 | コネクションプールが小さすぎる | `MaxIdleConns` を増加 |

完全なパフォーマンスアンチパターンと最適化の提案は [パフォーマンス最適化](./performance) をご覧ください。

## 次のステップ

- [パフォーマンス最適化](./performance) - パフォーマンスチューニングガイド
- [設定 API](../api-reference/config) - 接続設定リファレンス
- [セキュリティ概要](../security/) - SSRF と TLS セキュリティ
