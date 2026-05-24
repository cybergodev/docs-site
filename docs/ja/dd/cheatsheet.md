---
title: "チートシート - CyberGo DD | よく使う API クイックリファレンス"
description: "CyberGo DD ログライブラリのよく使う API チートシート。ロガーの作成とクローン、ログレベル制御、構造化フィールドコンストラクタ、ファイル出力ローテーションとバッファ設定、機密データセキュリティフィルタリングルール、フック登録とコールバックハンドラ、監査ログ記録、整合性署名検証など高頻度操作をカバー。開発者がすばやく参照・利用できるよう設計されています。"
---

# チートシート

## ロガーの作成

| 方法 | コード | 説明 |
|------|------|------|
| グローバルデフォルト | `dd.Info("msg")` | ゼロ設定ですぐ使える |
| 開発モード | `dd.New(dd.DevelopmentConfig())` | DEBUG レベル、caller 付き |
| カスタム | `dd.New(dd.Config{Targets: ...})` | 完全設定 |
| ファイル | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.FileOutput("path")}})` | ファイル出力のみ |
| デュアル出力先 | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | コンソール+ファイル |
| JSON デュアル出力先 | `dd.New(dd.Config{Format: dd.FormatJSON, Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | JSONフォーマット デュアル出力先 |

## プリセット設定

```go
dd.DefaultConfig()       // デフォルト設定：INFO レベル、テキストフォーマット
dd.DevelopmentConfig()   // 開発設定：DEBUG レベル、動的 caller
dd.JSONConfig()          // JSON 設定：JSON フォーマット出力
```

## ログレベル

| レベル | 定数 | メソッド | フォーマット |
|------|------|------|--------|
| Debug | `LevelDebug` | `Debug()` | `Debugf()` |
| Info | `LevelInfo` | `Info()` | `Infof()` |
| Warn | `LevelWarn` | `Warn()` | `Warnf()` |
| Error | `LevelError` | `Error()` | `Errorf()` |
| Fatal | `LevelFatal` | `Fatal()` | `Fatalf()` |

構造化版：`DebugWith()`、`InfoWith()`、`WarnWith()`、`ErrorWith()`、`FatalWith()`

## フィールドコンストラクタ

| 型 | コンストラクタ | 例 |
|------|--------|------|
| 汎用 | `Any(key, val)` | `dd.Any("data", obj)` |
| 文字列 | `String(key, val)` | `dd.String("name", "test")` |
| 整数 | `Int(key, val)` | `dd.Int("count", 42)` |
| 真偽値 | `Bool(key, val)` | `dd.Bool("ok", true)` |
| 時刻 | `Time(key, val)` | `dd.Time("ts", time.Now())` |
| 所要時間 | `Duration(key, val)` | `dd.Duration("took", 100*time.Millisecond)` |
| エラー | `Err(err)` | `dd.Err(err)` |
| エラー+スタック | `ErrWithStack(err)` | `dd.ErrWithStack(err)` |

## フィールドチェーン

```go
// プリセットフィールド
entry := dd.WithFields(dd.String("svc", "api"))
entry.Info("起動")                    // svc=api を自動付与

// フィールド追加
entry2 := entry.WithField("env", "prod")
entry2.Info("環境準備完了")               // svc + env を付与
```

## 出力先

```go
// ファイルライター（自動ローテーション）
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// バッファライター
bwCfg := dd.DefaultBufferedWriterConfig()
bwCfg.BufferSize = 4096
bw, _ := dd.NewBufferedWriter(os.Stdout, bwCfg)

// マルチライター
mw := dd.NewMultiWriter(os.Stdout, fw)
```

## コンテキスト統合

```go
ctx = dd.WithTraceID(ctx, "trace-123")
ctx = dd.WithRequestID(ctx, "req-456")
dd.GetTraceID(ctx)     // "trace-123"
dd.GetRequestID(ctx)   // "req-456"
```

## セキュリティ設定

```go
dd.DefaultSecurityConfig()   // 基本フィルタリング（推奨）
dd.DefaultSecureConfig()     // 完全フィルタリング
dd.HealthcareConfig()        // HIPAA 準拠
dd.FinancialConfig()         // PCI-DSS 準拠
dd.GovernmentConfig()        // 政府基準
```

## ライフサイクル

```go
logger.Flush()                           // バッファをフラッシュ
logger.Close()                           // ロガーを閉じる
logger.Shutdown(ctx)                     // グレースフルシャットダウン（タイムアウト付き）
dd.SetDefault(logger)                    // グローバルロガーを置き換え
dd.InitDefault(cfg)                      // グローバルロガーを初期化
```

## デバッグ出力

```go
// グローバル Logger 経由（セキュリティフィルタリング対象）
dd.Print("値:", val)       // クイック出力
dd.Printf("フォーマット: %v", val) // フォーマット出力

// 直接出力（セキュリティフィルタリングなし、デバッグ専用）
dd.JSON(data)              // JSON フォーマット デバッグ出力
dd.Text(data)              // テキストフォーマット デバッグ出力
dd.Exit(data)              // 出力後に終了
```
