---
title: パフォーマンス最適化 - HTTPC
description: HTTPC パフォーマンス最適化ガイド。4 種類のプリセット設定のパフォーマンス比較、コネクションプールチューニング、Result オブジェクトプール再利用戦略、よくあるパフォーマンスアンチパターンの解決策を解説。
---

# パフォーマンス最適化

## プリセット設定の比較

| 指標 | Default | Secure | Performance | Minimal |
|------|---------|--------|-------------|---------|
| Request タイムアウト | 180s | 15s | 60s | 180s |
| MaxIdleConns | 50 | 20 | 100 | 10 |
| MaxConnsPerHost | 10 | 5 | 20 | 2 |
| MaxRetries | 3 | 1 | 3 | 0 |
| MaxResponseBodySize | 10MB | 5MB | 50MB | 1MB |
| HTTP/2 | 有効 | 有効 | 有効 | 有効 |
| Cookies | 無効 | 無効 | 有効 | 無効 |
| SSRF 防護 | 有効 | 有効 | 有効 | 有効 |
| FollowRedirects | 有効 | 無効 | 有効 | 無効 |

## シナリオ別選択

| シナリオ | 推奨プリセット | 調整の提案 |
|------|----------|----------|
| 汎用 Web サービス | Default | - |
| ユーザー提供 URL の処理 | Secure | - |
| 内部マイクロサービスの高並行 | Performance | MaxIdleConns を増やす |
| 一次性スクリプト | Minimal | - |
| ファイルダウンロードサービス | Performance | MaxResponseBodySize を増やす |
| 金融・医療 API | Secure + カスタム | 監査ミドルウェアを追加 |

```go
// 高スループットシナリオ
client, _ := httpc.New(httpc.PerformanceConfig())

// プリセットをベースに微調整
cfg := httpc.PerformanceConfig()
cfg.Timeouts.Request = 120 * time.Second
cfg.Connection.MaxIdleConns = 200
client, _ := httpc.New(cfg)
```

## オブジェクトプールの再利用

HTTPC には Result オブジェクトプールが組み込まれており、`ReleaseResult` で返却します：

```go
result, err := client.Get(url)
if err != nil {
    return err
}
defer httpc.ReleaseResult(result) // オブジェクトプールに返却
```

:::tip
高並行シナリオでは、`ReleaseResult` により GC 負荷を大幅に軽減できます。
:::

## パフォーマンスアンチパターン

| アンチパターン | 原因 | 適切な対応 |
|--------|------|----------|
| リクエストごとにクライアントを作成 | 接続を再利用できない | クライアントをグローバルで再利用 |
| ReleaseResult を無視 | GC 負荷が増加 | defer で返却 |
| MaxResponseBodySize が大きすぎる | メモリ使用量の増加 | 適切な制限を設定 |
| ホットパスで result.String() を使用 | 文字列構築のオーバーヘッド | Body() を直接使用 |

## 次のステップ

- [コネクションプールとプロキシ](./connection-pool) — コネクションプールパラメータの選択、プロキシと DoH 設定
- [エラー処理](./error-handling) — タイムアウト階層戦略
- [セキュリティ概要](../security/) — セキュリティとパフォーマンスのバランス
