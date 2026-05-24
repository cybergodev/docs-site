---
title: "パフォーマンス最適化 - HTML"
description: "CyberGo HTML ライブラリのパフォーマンス最適化ガイド。Processor インスタンスの再利用（sync.Pool オーバーヘッドの回避）、キャッシュ戦略の設定（MaxCacheEntries、CacheTTL、CacheCleanup）、バッチ処理の並列制御（WorkerPoolSize）、入力サイズ制御とタイムアウト設定などの実践的なヒントを含み、大規模コンテンツ処理のスループット向上に役立ちます。"
---

# パフォーマンス最適化

## Processor の再利用

高頻度の呼び出しでは、パッケージ関数ではなく Processor インスタンスを使用してください：

```go
// 推奨：Processor を再利用
p, _ := html.New(html.DefaultConfig())
defer p.Close()

for _, page := range pages {
    result, _ := p.Extract(page)
    // キャッシュ、エンコーディング検出器などのリソースが再利用される
}

// 非推奨：毎回新しい Processor を作成
for _, page := range pages {
    result, _ := html.Extract(page) // 毎回 Pool から取得
}
```

## キャッシュ戦略

Processor にはキャッシュが内蔵されており、同じ入力は重複処理されません：

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 5000     // キャッシュを増やす
cfg.CacheTTL = 10 * time.Minute // シーンに応じて調整
cfg.CacheCleanup = time.Minute   // より頻繁にクリーンアップ
```

キャッシュヒット率をモニタリング：

```go
stats := p.GetStatistics()
hitRate := float64(stats.CacheHits) / float64(stats.CacheHits+stats.CacheMisses)
fmt.Printf("キャッシュヒット率: %.2f%%\n", hitRate*100)
```

## バッチ処理

バッチ処理は自動的に並列実行されるため、個別処理より効率的です：

```go
// 推奨：バッチ処理
batch := p.ExtractBatch(pages)

// 非推奨：ループで個別処理
for _, page := range pages {
    p.Extract(page) // 直列処理
}
```

CPU コア数に合わせてワーカープールサイズを設定：

```go
cfg.WorkerPoolSize = runtime.NumCPU()
```

## 入力の制御

- `MaxInputSize` を小さくして大きなドキュメントの処理を回避
- `TextOnlyConfig()` で不要なメディア抽出をスキップ
- 不要な `Preserve*` オプションを無効化

```go
// TextOnlyConfig はすべてのメディア保持を無効化済み、追加設定不要
cfg := html.TextOnlyConfig()

// 記事認識も無効化してパフォーマンスをさらに向上
cfg.ExtractArticle = false
```

## タイムアウト設定

適切なタイムアウトでスローリクエストのブロッキングを防止：

```go
cfg.ProcessingTimeout = 10 * time.Second
```
