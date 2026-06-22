---
title: "パフォーマンス最適化 - CyberGo HTTPC | プリセットと並列"
description: "HTTPC パフォーマンス最適化ガイド: Default/Secure/Performance/Minimal 4 種類のプリセット比較とシナリオ選択、接続プールとタイムアウト微調整、Result ライフサイクル管理、高並列リクエストパターンを解説します。"
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
|---------|-------------|-----------|
| 汎用 Web サービス | Default | - |
| ユーザー提供の URL を処理 | Secure | - |
| 内部マイクロサービス高並列 | Performance | MaxIdleConns を増加 |
| 一度きりのスクリプト | Minimal | - |
| ファイルダウンロードサービス | Performance | MaxResponseBodySize を増加 |
| 金融/医療 API | Secure + カスタム | 監査ミドルウェアを追加 |

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

HTTPC は内部でエンジンのレスポンスオブジェクトと文字列ビルダーを sync.Pool で再利用し、GC 負荷を軽減します。Result 自体はリクエストごとに新規作成され、GC が自動的に回収します：

```go
result, err := client.Get(url)
if err != nil {
    return err
}
// Result はリクエストごとに新規作成、GC が自動回収、手動解放不要
```

:::tip
高並列シナリオでは、オブジェクトプールの再利用により GC 負荷を大幅に軽減できます。
:::

## パフォーマンスアンチパターン

| アンチパターン | 原因 | 正しいアプローチ |
|-------------|------|---------------|
| リクエストごとにクライアントを作成 | 接続の再利用ができない | クライアントをグローバルで再利用 |
| MaxResponseBodySize が大きすぎる | メモリ消費 | 適切な制限を設定 |
| ホットパスで result.String() を使用 | 文字列構築のオーバーヘッド | Body() を直接使用 |

## 次のステップ

- [コネクションプールとプロキシ](./connection-pool) — コネクションプールパラメータの選択、プロキシと DoH 設定
- [エラー処理](./error-handling) — タイムアウト階層化戦略
- [セキュリティ概要](../security/) — セキュリティとパフォーマンスのバランス
