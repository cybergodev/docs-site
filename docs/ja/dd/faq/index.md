---
sidebar_label: "よくある質問"
title: "FAQ - CyberGo DD | よくある質問"
description: "CyberGo DD ログライブラリのよくある質問と回答集。設定チューニング、パフォーマンス最適化、機密データフィルタリングルール、監査ログとコンプライアンス設定、ファイルローテーションポリシー、エラー処理のベストプラクティス、フックシステムの使用例など、実際のプロジェクトで遭遇する様々な問題を迅速に解決。"
sidebar_position: 1
---

# よくある質問

## 基本的な使い方

### グローバルロガーとカスタムロガーの違いは？

**グローバルロガー**は `dd.Info()` などのパッケージレベル関数で直接使用し、シンプルなシナリオに適しています。**カスタムロガー**は `dd.New()` で作成し、独立した設定とライフサイクル管理をサポートします。

```go
// グローバルロガー
dd.Info("グローバルログ")

// カスタムロガー
logger, _ := dd.New(dd.JSONConfig())
logger.Info("独立ログ")
```

### プログラム起動時にグローバルロガーを初期化するには？

```go
func init() {
    err := dd.InitDefault(dd.JSONConfig())
    if err != nil {
        log.Fatal(err)
    }
}
```

または `SetDefault` で設定：

```go
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
dd.SetDefault(logger)
```

### Fatal レベルのログはどうなりますか？

`Fatal` / `Fatalf` / `FatalWith` はログ出力後に `os.Exit(1)` を呼び出します（**defer 文は実行されません**；内部でまず `Close()` を試みて保留中のログをフラッシュし、最長 5 秒待機します）。`FatalHandler` で終了動作をカスタマイズできます；リソースクリーンアップが必要な場合は `ErrorWith` + 明示的な `Shutdown(ctx)` を使用してください。

## 設定

### コンソールとファイルに同時出力するには？

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
// または JSON フォーマット
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
```

### ログレベルを動的に変更するには？

```go
_ = logger.SetLevel(dd.LevelDebug)  // 実行時に変更（error を返す）
_ = dd.SetLevel(dd.LevelDebug)      // グローバルロガーのレベルを変更
```

### ファイルローテーションポリシーを設定するには？

`FileWriter` で設定：

```go
fw, _ := dd.NewFileWriter("logs/app.log",
    dd.DefaultFileWriterConfig(),  // 100MB、30日、10バックアップ
)
```

## パフォーマンス

### ログはプログラムのパフォーマンスに影響しますか？

DD は高いパフォーマンスを目指して設計されています：
- ホットパスでの低アロケーション最適化
- アトミックレベルチェック、ロックなし
- 大きい入力（≥10KB）の機密データフィルタリングは独立した goroutine で実行されタイムアウト保護付き；小さい入力は同期処理
- オプションのバッファリングで I/O を削減

### 高スループット環境での最適化方法は？

1. `BufferedWriter` を使用して I/O を削減
2. レベルチェックを先に行ってからフィールドを構築
3. ログサンプリングの有効化を検討
4. 高頻度パスでの `Any` フィールドの使用を避ける

詳細は [パフォーマンス最適化](../advanced/performance) を参照。

## セキュリティ

### 機密データフィルタリングの仕組みは？

`SensitiveDataFilter` は正規表現パターンマッチングを使用し、ログ書き込み前に一致した機密値を `[REDACTED]` に自動置換します。小さい入力は同期的に処理し、大きい入力は独立した goroutine でタイムアウト保護付きで実行されるため、ログ書き込みをブロックしません。

### カスタム機密データパターンを追加するには？

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)my_secret_field\s*[:=]\s*\S+`,
)
```

### ログの改ざんを防ぐには？

`IntegritySigner` を使用してログに HMAC 署名：

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
sig := signer.Sign(logMessage)
// 検証: signer.Verify(signedEntry)
```

## エラー処理

### AddWriter がエラーを返す理由は？

考えられる原因：
- `ErrNilWriter` -- nil Writer が渡された
- `ErrLoggerClosed` -- ロガーが既に閉じている
- `ErrMaxWritersExceeded` -- Writer 数が上限を超えている

### 書き込み失敗を処理するには？

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // カスタム処理
    metrics.WriteErrors.Inc()
})
```

## テスト

### テストでログをキャプチャするには？

`LoggerRecorder` を使用：

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.Info("test")

if !rec.ContainsMessage("test") {
    t.Error("期待されるログが見つかりません")
}
```

詳細は [テスト補助](../api-reference/dev-tools/recorder) を参照。

## 次のステップ

- [クイックスタート](../getting-started/) -- 入門ガイド
- [API リファレンス](../api-reference/) -- 完全 API
- [本番チェックリスト](../security/production-checklist) -- リリース前チェック
