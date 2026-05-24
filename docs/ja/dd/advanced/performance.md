---
title: "パフォーマンス最適化 - CyberGo DD | 高性能ログ"
description: "CyberGo DD ログライブラリのパフォーマンス最適化完全ガイド。ゼロアロケーション最適化のヒント、BufferedWriter バッファ書き込み設定、ログサンプリング戦略と頻度制御、レベル事前チェックで不要なアロケーションを回避、sync.Pool オブジェクトプール再利用、ベンチマークテスト分析方法を詳解し、高並行シナリオで極限のログパフォーマンスを獲得。"
---

# パフォーマンス最適化

DD は高いパフォーマンスを目指して設計されています。以下に、ログパフォーマンスをさらに最適化するためのアドバイスをいくつか紹介します。

## ゼロアロケーション最適化

DD はホットパスでメモリ割り当てを最小化：

- `IsLevelEnabled()` チェックはアトミック操作を使用、ロックなし
- 構造化フィールドは事前割り当てバッファを使用
- ログレベルが一致しない場合のメッセージフォーマットを回避

## レベルチェック

高頻度パスでは先にレベルをチェックし、不要なフィールド構築を回避：

```go
// 推奨：先にレベルをチェック
if logger.IsDebugEnabled() {
    logger.DebugWith("詳細情報",
        dd.String("data", expensiveToString()),
        dd.Int("size", len(largeSlice)),
    )
}

// 非推奨：常にフィールドを構築
logger.DebugWith("詳細情報",
    dd.String("data", expensiveToString()),
)
```

## バッファ書き込み

`BufferedWriter` を使用して I/O システムコールを削減：

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
bwCfg := dd.DefaultBufferedWriterConfig()
bwCfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(fw, bwCfg)  // 8KB バッファ

logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
defer logger.Close()  // Close は自動 Flush
```

:::tip バッファサイズ
4KB-16KB を推奨。小さすぎるバッファはシステムコール削減効果がなく、大きすぎるバッファはメモリ使用量とレイテンシが増加します。
:::

## ログサンプリング

高スループット環境でログサンプリングを有効にし、重複ログを削減：

```go
logger.SetSampling(&dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,    // 最初の 100 件は全て記録
    Thereafter: 10,     // その後は 10 件に 1 件を記録
    Tick:       time.Minute, // 毎分カウンターをリセット
})

// 実行時に動的に調整
cfg := logger.GetSampling()
```

## ファイル書き込みの最適化

### 適切なローテーション設定

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
// デフォルト: 100MB / 30日 / 10バックアップ
```

- ファイルが小さすぎると頻繁なローテーションで I/O が増加
- バックアップが多すぎるとディスク容量を圧迫
- 実際のログ量に応じてパラメータを調整

### マルチファイル分離

```go
// レベル別に分離
infoWriter, _ := dd.NewFileWriter("logs/info.log", dd.DefaultFileWriterConfig())
errorWriter, _ := dd.NewFileWriter("logs/error.log", dd.DefaultFileWriterConfig())
```

## Writer 管理

### 動的 Writer の追加・削除

```go
// 実行時に動的に追加
logger.AddWriter(newWriter)

// 不要になった Writer を削除
logger.RemoveWriter(oldWriter)
```

### Writer の過多を避ける

各 Writer は書き込みレイテンシを増加させます。3-4 個以下の Writer を推奨。

## フィールド最適化

### 型付きフィールドを使用

```go
// 推奨：型付きコンストラクタ
dd.Int("count", 42)
dd.String("name", "test")

// 避ける：Any（追加の型アサーションが必要）
dd.Any("count", 42)
```

### 大きなオブジェクトを避ける

```go
// 非推奨：大きなオブジェクトを記録
logger.InfoWith("データ", dd.Any("payload", hugeStruct))

// 推奨：重要な情報のみ記録
logger.InfoWith("データ",
    dd.Int("count", len(items)),
    dd.String("first", items[0].Name),
)
```

## 終了とクリーンアップ

```go
// フィルター goroutine の完了を待機
logger.WaitForFilterGoroutines(3 * time.Second)

// グレースフルシャットダウン、全バッファのフラッシュを待機
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
logger.Shutdown(ctx)
```

## 次のステップ

- [出力先](../api-reference/writers) -- FileWriter、BufferedWriter API
- [設定](../api-reference/config) -- パフォーマンス関連の設定項目
- [本番チェックリスト](../security/production-checklist) -- リリース前チェック
