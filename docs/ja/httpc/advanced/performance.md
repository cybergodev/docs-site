---
title: "パフォーマンス最適化 - HTTPC"
description: "HTTPCパフォーマンス最適化ガイド：Default/Secure/Performance/Minimal 4種類のプリセット比較とシナリオ選択、プリセットベースの接続プールとタイムアウト微調整、ReleaseResultオブジェクトプール再利用によるGC負荷軽減とよくあるパフォーマンスアンチパターン。"
---

# パフォーマンス最適化

## プリセット設定の比較

| 指標 | Default | Secure | Performance | Minimal |
|------|---------|--------|-------------|---------|
| Requestタイムアウト | 180s | 15s | 60s | 180s |
| MaxIdleConns | 50 | 20 | 100 | 10 |
| MaxConnsPerHost | 10 | 5 | 20 | 2 |
| MaxRetries | 3 | 1 | 3 | 0 |
| MaxResponseBodySize | 10MB | 5MB | 50MB | 1MB |
| HTTP/2 | 有効 | 有効 | 有効 | 有効 |
| Cookies | 無効 | 無効 | 有効 | 無効 |
| SSRF防御 | 有効 | 有効 | 有効 | 有効 |
| FollowRedirects | 有効 | 無効 | 有効 | 無効 |

## シナリオ選択

| シナリオ | 推奨プリセット | 調整の提案 |
|----------|---------------|------------|
| 汎用Webサービス | Default | - |
| ユーザー提供URLの処理 | Secure | - |
| 内部マイクロサービス高並行 | Performance | MaxIdleConnsを増やす |
| 一回限りのスクリプト | Minimal | - |
| ファイルダウンロードサービス | Performance | MaxResponseBodySizeを増やす |
| 金融/医療API | Secure + カスタム | 監査ミドルウェアを追加 |

```go
// 高スループットシナリオ
client, _ := httpc.New(httpc.PerformanceConfig())

// プリセットをベースに微調整
cfg := httpc.PerformanceConfig()
cfg.Timeouts.Request = 120 * time.Second
cfg.Connection.MaxIdleConns = 200
client, _ := httpc.New(cfg)
```

## オブジェクトプール再利用

HTTPCはResultオブジェクトプールを内蔵しており、`ReleaseResult`で返却します：

```go
result, err := client.Get(url)
if err != nil {
    return err
}
defer httpc.ReleaseResult(result) // オブジェクトプールに返却
```

:::tip ヒント
高並行シナリオでは、`ReleaseResult`がGC負荷を大幅に軽減できます。
:::

## パフォーマンスアンチパターン

| アンチパターン | 原因 | 正しいアプローチ |
|----------------|------|------------------|
| リクエストごとにクライアントを作成 | 接続の再利用ができない | クライアントをグローバルに再利用 |
| ReleaseResultの無視 | GC負荷の増加 | deferで返却 |
| 大きすぎるMaxResponseBodySize | メモリ消費 | 合理的な制限を設定 |
| ホットパスでのresult.String() | 文字列構築のオーバーヘッド | Body()を直接使用 |

## 次のステップ

- [接続プールとプロキシ](./connection-pool) — 接続プールパラメータの選択、プロキシとDoHの設定
- [エラー処理](./error-handling) — タイムアウト階層化戦略
- [セキュリティ概要](../security/) — セキュリティとパフォーマンスのバランス
