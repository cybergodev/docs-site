---
title: "接続プールとプロキシ - HTTPC"
description: "HTTPC接続プールとプロキシ設定ガイド：MaxIdleConnsなどパラメータのチューニングとシナリオ別推奨、ProxyURL手動プロキシとシステムプロキシ検出、SOCKS5プロキシ、DoH 3プロバイダーフォールバック、HTTP/2設定、ReleaseResultオブジェクトプール再利用と並行リクエストパターン。"
---

# 接続プールとプロキシ

## 接続プール設定

接続プールはHTTPクライアントのパフォーマンスの重要な要素です。HTTPCは`ConnectionConfig`で接続プールを管理します。

```go
cfg := httpc.DefaultConfig()

// 接続プールパラメータ
cfg.Connection.MaxIdleConns = 100         // グローバル最大アイドル接続
cfg.Connection.MaxConnsPerHost = 20       // ホストごとの最大接続数
cfg.Timeouts.IdleConn = 120 * time.Second // アイドル接続保持時間
```

### パラメータの説明

| パラメータ | デフォルト | 説明 |
|------------|------------|------|
| `MaxIdleConns` | 50 | グローバル最大アイドル接続数 |
| `MaxConnsPerHost` | 10 | ホストごとの最大接続数（アクティブ+アイドル含む） |
| `IdleConn` | 90s | アイドル接続タイムアウト。超過すると閉じられる |
| `Dial` | 10s | 接続確立タイムアウト |
| `TLSHandshake` | 10s | TLSハンドシェイクタイムアウト |
| `ResponseHeader` | 0 | 無効（Requestタイムアウトを使用） |

### シナリオ別推奨

| シナリオ | MaxIdleConns | MaxConnsPerHost | IdleConn |
|----------|-------------|-----------------|----------|
| 高並行API | 100 | 20 | 120s |
| 通常サービス | 50 | 10 | 90s |
| 低頻度リクエスト | 10 | 2 | 30s |
| マイクロサービス内部 | 50 | 10 | 60s |

:::tip ヒント
`MaxConnsPerHost`はアクティブ接続とアイドル接続の両方を含みます。この制限を超える新しいリクエストは接続の解放を待ちます。
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
`Config.String()`メソッドはプロキシURL内のユーザー名とパスワードを自動的にマスクします。
:::

### SOCKS5プロキシ

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
// - macOS: システム環境設定 ネットワークプロキシ
// - Linux: 環境変数 HTTP_PROXY / HTTPS_PROXY
```

プロキシの優先度：

1. `ProxyURL`（手動指定、最優先）
2. `EnableSystemProxy`（システムプロキシ検出）
3. 直接接続（プロキシなし）

## DNS-over-HTTPS

DoHを有効にするとDNS解決の遅延を減らし、DNSハイジャックを防止できます：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

デフォルトDoHプロバイダー（優先度順）：

| プロバイダー | アドレス | 説明 |
|--------------|----------|------|
| Cloudflare | `1.1.1.1/dns-query` | 最速、プライバシー優先 |
| Google | `8.8.8.8/resolve` | グローバルカバレッジ |
| AliDNS | `223.5.5.5/resolve` | 中国リージョン最適化 |

:::tip ヒント
DoH有効時、DNS解決結果は`DoHCacheTTL`時間キャッシュされます。全DoHプロバイダーが利用不可能な場合、システムDNSにフォールバックします。
:::

## HTTP/2

デフォルトでHTTP/2が有効（TLSが必要）：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // HTTP/2を無効化
```

HTTP/2の特徴：
- 多重化：単一接続で複数の並行リクエストを処理
- ヘッダー圧縮：繰り返しヘッダーの伝送を削減
- サーバープッシュ

## オブジェクトプール再利用

```go
result, err := client.Get(url)
if err != nil {
    return err
}
defer httpc.ReleaseResult(result) // オブジェクトプールに返却
```

高並行シナリオでは、`ReleaseResult`がGC負荷を大幅に軽減できます。

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

## 接続プールのよくある問題

| 問題 | 原因 | 解決策 |
|------|------|--------|
| 大量のTIME_WAIT | アイドル接続タイムアウトが短すぎる | `IdleConn`タイムアウトを増やす |
| 接続拒否 | ホストごとの接続数が不足 | `MaxConnsPerHost`を増やす |
| リクエストの待ち行列 | 接続プールが小さすぎる | `MaxIdleConns`を増やす |

完全なパフォーマンスアンチパターンと最適化の提案は[パフォーマンス最適化](./performance)をご覧ください。

## 次のステップ

- [パフォーマンス最適化](./performance) - パフォーマンスチューニングガイド
- [設定API](../api-reference/config) - 接続設定リファレンス
- [セキュリティ概要](../security/) - SSRFとTLSセキュリティ
