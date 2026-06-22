---
title: "Processor 再利用とキャッシュ - CyberGo HTML | 高性能ガイド"
description: "CyberGo HTML Processor 再利用とキャッシュ：パッケージ関数との違い、sync.Pool、キャッシュ戦略（TTL・容量・クリーンアップ）、ヒット率統計とシングルトン実践を扱います。"
---

# Processor 再利用とキャッシュ

このガイドでは、パッケージ関数と Processor インスタンスの違いを説明し、さまざまなシーンで正しく選択し、最高のパフォーマンスを得る方法を解説します。

## 2 つの呼び出しモード

### パッケージ関数（一回限りの呼び出し）

```go
result, err := html.Extract(data)
```

内部では `sync.Pool` を使って一時的な Processor を管理し、毎回の呼び出しでプールから取得、使用後に返却します。

**適用シーン**：低頻度の呼び出し（CLI ツール、一回限りのスクリプトなど）

**ライフサイクル**：

```text
Extract() を呼び出し
  → sync.Pool から Processor を取得（または新規作成）
  → 抽出を実行
  → sync.Pool に返却
```

### Processor インスタンス（再利用モード）

```go
p, _ := html.New()
defer p.Close()

for _, page := range pages {
    result, _ := p.Extract(page)
}
```

独立した Processor インスタンスを作成し、ライフサイクルを手動管理します。

**適用シーン**：高頻度の呼び出し（Web サービス、クローラーなど）

**ライフサイクル**：

```text
html.New()
  → Processor を作成（キャッシュ、監査、統計）
  → ループで p.Extract() を呼び出し（キャッシュを再利用）
  → defer p.Close()
```

## 選び方

| シーン | 推奨方法 | 理由 |
|------|----------|------|
| CLI ツール、単発処理 | パッケージ関数 | シンプルで管理不要 |
| Web サービス、API バックエンド | Processor インスタンス | キャッシュによる高速化、統計モニタリング |
| バッチクローラー | Processor インスタンス | キャッシュによる重複排除、リソース制御 |
| テストコード | パッケージ関数 | ステートレス、テストの独立性 |

## キャッシュメカニズム

Processor インスタンスにはコンテンツベースのキャッシュが内蔵されています。同じ HTML 入力は重複処理されません。

### キャッシュ設定

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 2000     // キャッシュ最大エントリ数（0=無効）
cfg.CacheTTL = time.Hour       // キャッシュ有効期限
cfg.CacheCleanup = 5 * time.Minute // バックグラウンドクリーンアップ間隔
```

| パラメータ | デフォルト値 | 説明 |
|------|--------|------|
| `MaxCacheEntries` | 2000 | キャッシュ容量の上限、0 でキャッシュを無効化 |
| `CacheTTL` | 1 時間 | エントリの有効期限 |
| `CacheCleanup` | 5 分 | 期限切れエントリのバックグラウンドクリーンアップ間隔 |

### キャッシュキーの生成

キャッシュキーはエンコーディング変換後の UTF-8 コンテンツに基づいて生成されます：
- 64KB 未満のコンテンツ：完全なコンテンツのハッシュを計算
- 64KB 以上のコンテンツ：5 点サンプリングアルゴリズム（先頭 + 末尾 + 均一サンプリング）

同じ HTML コンテンツは再呼び出し時に直接キャッシュヒットし、パースと抽出ステップをスキップします。

## キャッシュヒット率のモニタリング

```go
p, _ := html.New()
defer p.Close()

// 一連のページを処理
for _, page := range pages {
    p.Extract(page)
}

// 統計を取得
stats := p.GetStatistics()
fmt.Printf("総処理: %d\n", stats.TotalProcessed)
fmt.Printf("キャッシュヒット: %d\n", stats.CacheHits)
fmt.Printf("キャッシュミス: %d\n", stats.CacheMisses)

hitRate := float64(stats.CacheHits) / float64(stats.TotalProcessed) * 100
fmt.Printf("ヒット率: %.1f%%\n", hitRate)
```

## 推奨パターン

### Web サービスのシングルトン

Web サービスでは、シングルトン Processor の使用を推奨します：

```go
var processor *html.Processor

func init() {
    cfg := html.DefaultConfig()
    cfg.MaxCacheEntries = 5000
    cfg.CacheTTL = 30 * time.Minute
    cfg.ProcessingTimeout = 10 * time.Second

    var err error
    processor, err = html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
}

func handleExtract(w http.ResponseWriter, r *http.Request) {
    data, _ := io.ReadAll(r.Body)
    result, err := processor.Extract(data)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    json.NewEncoder(w).Encode(result)
}
```

### クローラーのバッチ処理

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

urls := crawlURLs()
pages := fetchPages(urls) // [][]byte

batch := p.ExtractBatch(pages)
fmt.Printf("成功: %d, 失敗: %d\n", batch.Success, batch.Failed)
```

### 定期メンテナンス

長期稼働する Processor は定期的なメンテナンスが必要です：

```go
// 定期的にキャッシュをクリア（メモリ増加を防止）
go func() {
    ticker := time.NewTicker(10 * time.Minute)
    for range ticker.C {
        p.ClearCache()
    }
}()

// 定期的に統計をリセット（キャッシュは保持）
go func() {
    ticker := time.NewTicker(time.Hour)
    for range ticker.C {
        stats := p.GetStatistics()
        log.Printf("処理 %d 回, エラー %d 回",
            stats.TotalProcessed, stats.ErrorCount)
        p.ResetStatistics()
    }
}()
```

## パフォーマンス比較

同じ HTML を 1000 回繰り返し処理（参考値）：

| モード | 初回処理 | キャッシュヒット |
|------|----------|----------|
| パッケージ関数 | ベースライン | キャッシュなし |
| Processor（キャッシュなし） | ≈ベースライン | ≈ベースライン |
| Processor（キャッシュあり） | ≈ベースライン | ≈ベースラインの 1/10 |

:::tip キャッシュの有効条件
キャッシュは Processor インスタンスでのみ有効です。パッケージ関数は毎回異なる Processor インスタンスを使用するため、キャッシュを利用できません。
:::

## よくある誤解

| 誤解 | 正しい方法 |
|------|----------|
| 毎回 `html.New()` で Processor を作成する | 同じインスタンスを再利用する |
| `p.Close()` の呼び出しを忘れる | `defer p.Close()` を使用する |
| パッケージ関数でキャッシュを期待する | キャッシュは Processor インスタンスでのみ有効 |
| クローズ後に Processor を使用し続ける | `ErrProcessorClosed` エラーを確認する |

## 次のステップ

- [パフォーマンス最適化](../advanced/performance) - さらなるパフォーマンスチューニングのヒント
- [API リファレンス：Processor](../api-reference/processor) - 完全なメソッド一覧
- [API リファレンス：設定](../api-reference/config) - キャッシュ設定の詳細
