---
sidebar_label: "パッケージ関数"
title: "パッケージ関数 - CyberGo DD | グローバル関数とコンストラクタ"
description: "CyberGo DD パッケージ関数 API ドキュメント。New ロガー作成、Default/SetDefault/InitDefault グローバル管理、設定プリセット、全コンストラクタを含み dd. プレフィックスで直接呼び出し可能。"
sidebar_position: 1
---

# パッケージ関数

DD は豊富なパッケージレベル関数を提供し、`dd.` プレフィックスで直接呼び出せます。これらの関数はすべてグローバルロガー（`Default()`）を通じて実行されます。

## ロガー作成

### New

```go
func New(cfg ...Config) (*Logger, error)
```

新しい Logger インスタンスを作成します。設定を省略した場合はデフォルト設定が使用されます。

```go
// デフォルト設定
logger, _ := dd.New()

// カスタム設定
logger, _ := dd.New(dd.DefaultConfig())

// 注意：0 または 1 つの設定のみ受け付けます。複数渡すとエラーが返ります
// logger, _ := dd.New(cfg1, cfg2)  // エラー！
```

## グローバルロガー

### 取得と設定

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `Default` | `func Default() *Logger` | グローバルロガーを取得（遅延初期化） |
| `SetDefault` | `func SetDefault(logger *Logger)` | グローバルロガーを設定 |
| `InitDefault` | `func InitDefault(cfg ...Config) error` | 設定でグローバルロガーを初期化 |
| `DefaultWithErr` | `func DefaultWithErr() (*Logger, error)` | グローバルロガーと初期化エラーを取得 |
| `DefaultInitError` | `func DefaultInitError() error` | 初期化エラーを取得 |

### グローバルロガーの初期化

```go
// 方法 1：自動初期化（初回呼び出し時に作成）
dd.Default().Info("グローバルロガーが自動作成されました")

// 方法 2：明示的初期化
err := dd.InitDefault(dd.JSONConfig())
if err != nil {
    log.Fatal(err)
}
dd.Default().Info("JSON 設定のグローバルロガーを使用")

// 方法 3：グローバルロガーを置き換え
custom, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
})
dd.SetDefault(custom)

// 方法 4：初期化エラーを確認
logger, err := dd.DefaultWithErr()
if err != nil {
    log.Printf("グローバルロガーの初期化に失敗: %v", err)
}
```

## 設定プリセット

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `DefaultConfig` | `func DefaultConfig() Config` | デフォルト設定（Info レベル、テキストフォーマット） |
| `DevelopmentConfig` | `func DevelopmentConfig() Config` | 開発設定（Debug レベル） |
| `JSONConfig` | `func JSONConfig() Config` | JSON 出力設定 |

```go
cfg := dd.DefaultConfig()
cfg.Level = dd.LevelDebug
logger, _ := dd.New(cfg)
```

## 出力先コンストラクタ

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `ConsoleOutput` | `func ConsoleOutput() OutputTarget` | コンソール出力 |
| `FileOutput` | `func FileOutput(path string) OutputTarget` | ファイル出力（ローテーション対応） |
| `CustomOutput` | `func CustomOutput(w io.Writer) OutputTarget` | カスタム Writer 出力 |

```go
cfg := dd.DefaultConfig()
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
    dd.CustomOutput(customWriter),
}
logger, _ := dd.New(cfg)
```

## 基本ログ（パッケージレベル）

以下の関数はグローバルロガーを通じてログを出力します：

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `Debug` | `func Debug(args ...any)` | Debug レベルログ |
| `Info` | `func Info(args ...any)` | Info レベルログ |
| `Warn` | `func Warn(args ...any)` | Warn レベルログ |
| `Error` | `func Error(args ...any)` | Error レベルログ |
| `Fatal` | `func Fatal(args ...any)` | Fatal レベルログ（デフォルトで os.Exit(1) を呼び出し、**defer は実行されません**；FatalHandler でカスタマイズ可能） |

```go
dd.Info("アプリケーション起動完了")
dd.Errorf("ユーザー %s のログイン失敗", username)
dd.Warn("ディスク容量不足")
```

## フォーマットログ（パッケージレベル）

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `Debugf` | `func Debugf(format string, args ...any)` | Debug レベル フォーマットログ |
| `Infof` | `func Infof(format string, args ...any)` | Info レベル フォーマットログ |
| `Warnf` | `func Warnf(format string, args ...any)` | Warn レベル フォーマットログ |
| `Errorf` | `func Errorf(format string, args ...any)` | Error レベル フォーマットログ |
| `Fatalf` | `func Fatalf(format string, args ...any)` | Fatal レベル フォーマットログ（デフォルトで os.Exit(1) を呼び出し、**defer は実行されません**；FatalHandler でカスタマイズ可能） |

## 汎用レベルログ（パッケージレベル）

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `Log` | `func Log(level LogLevel, args ...any)` | レベル指定ログ |
| `Logf` | `func Logf(level LogLevel, format string, args ...any)` | レベル指定 フォーマットログ |
| `LogWith` | `func LogWith(level LogLevel, msg string, fields ...Field)` | レベル指定 構造化ログ |

```go
dd.Log(dd.LevelDebug, "デバッグ情報")
dd.Logf(dd.LevelWarn, "警告: %s", reason)
dd.LogWith(dd.LevelError, "リクエスト失敗",
    dd.String("path", "/api/users"),
    dd.Int("status", 500),
)
```

## 構造化ログ（パッケージレベル）

以下の関数はグローバルロガーを通じて構造化ログを出力します：

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `DebugWith` | `func DebugWith(msg string, fields ...Field)` | Debug レベル 構造化ログ |
| `InfoWith` | `func InfoWith(msg string, fields ...Field)` | Info レベル 構造化ログ |
| `WarnWith` | `func WarnWith(msg string, fields ...Field)` | Warn レベル 構造化ログ |
| `ErrorWith` | `func ErrorWith(msg string, fields ...Field)` | Error レベル 構造化ログ |
| `FatalWith` | `func FatalWith(msg string, fields ...Field)` | Fatal レベル 構造化ログ（デフォルトで os.Exit(1) を呼び出し、**defer は実行されません**；FatalHandler でカスタマイズ可能） |

```go
dd.InfoWith("リクエスト完了",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)

dd.ErrorWith("データベースエラー",
    dd.Err(err),
    dd.String("query", sql),
)
```

## レベル管理（パッケージレベル）

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `SetLevel` | `func SetLevel(level LogLevel) error` | グローバルログレベルを設定 |
| `GetLevel` | `func GetLevel() LogLevel` | グローバルログレベルを取得 |
| `IsLevelEnabled` | `func IsLevelEnabled(level LogLevel) bool` | 指定レベルが有効か確認 |
| `IsDebugEnabled` | `func IsDebugEnabled() bool` | Debug レベルが有効か確認 |
| `IsInfoEnabled` | `func IsInfoEnabled() bool` | Info レベルが有効か確認 |
| `IsWarnEnabled` | `func IsWarnEnabled() bool` | Warn レベルが有効か確認 |
| `IsErrorEnabled` | `func IsErrorEnabled() bool` | Error レベルが有効か確認 |
| `IsFatalEnabled` | `func IsFatalEnabled() bool` | Fatal レベルが有効か確認 |

```go
// ログレベルを動的に調整
dd.SetLevel(dd.LevelDebug)

// 条件付きログ（不要な計算を回避）
if dd.IsDebugEnabled() {
    dd.Debug(computeExpensiveDebugInfo())
}
```

## フィールドチェーン（パッケージレベル）

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `WithFields` | `func WithFields(fields ...Field) *LoggerEntry` | プリセットフィールド付き Entry を作成 |
| `WithField` | `func WithField(key string, value any) *LoggerEntry` | 単一プリセットフィールド付き Entry を作成 |

```go
dd.WithFields(dd.String("service", "api"), dd.String("version", "1.0")).
    Info("リクエスト処理完了")

dd.WithField("request_id", "abc123").Info("リクエスト処理")
```

## ライフサイクル（パッケージレベル）

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `Flush` | `func Flush() error` | グローバルログバッファをフラッシュ |

## Writer 管理（パッケージレベル）

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `AddWriter` | `func AddWriter(writer io.Writer) error` | 出力ライターを追加 |
| `RemoveWriter` | `func RemoveWriter(writer io.Writer) error` | 出力ライターを削除 |
| `WriterCount` | `func WriterCount() int` | ライター数を取得 |

## サンプリング制御（パッケージレベル）

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `SetSampling` | `func SetSampling(config *SamplingConfig)` | サンプリング設定を設定 |
| `GetSampling` | `func GetSampling() *SamplingConfig` | サンプリング設定を取得 |

## Writer コンストラクタ

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `NewFileWriter` | `func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)` | ファイルライターを作成 |
| `DefaultFileWriterConfig` | `func DefaultFileWriterConfig() FileWriterConfig` | デフォルトファイルライター設定 |
| `NewBufferedWriter` | `func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)` | バッファライターを作成 |
| `DefaultBufferedWriterConfig` | `func DefaultBufferedWriterConfig() BufferedWriterConfig` | デフォルトバッファライター設定 |
| `NewMultiWriter` | `func NewMultiWriter(writers ...io.Writer) *MultiWriter` | マルチ出力ライターを作成 |

## セキュリティ設定コンストラクタ

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `DefaultSecurityConfig` | `func DefaultSecurityConfig() *SecurityConfig` | デフォルトセキュリティ設定（基本フィルタリング） |
| `DefaultSecureConfig` | `func DefaultSecureConfig() *SecurityConfig` | 完全セキュリティ設定 |
| `HealthcareConfig` | `func HealthcareConfig() *SecurityConfig` | HIPAA 準拠設定 |
| `FinancialConfig` | `func FinancialConfig() *SecurityConfig` | PCI-DSS 準拠設定 |
| `GovernmentConfig` | `func GovernmentConfig() *SecurityConfig` | 政府基準設定 |
| `SecurityConfigForLevel` | `func SecurityConfigForLevel(level SecurityLevel) *SecurityConfig` | レベルでセキュリティ設定を取得 |

## 機密データフィルターコンストラクタ

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `NewSensitiveDataFilter` | `func NewSensitiveDataFilter() *SensitiveDataFilter` | 完全パターンセットフィルター |
| `NewEmptySensitiveDataFilter` | `func NewEmptySensitiveDataFilter() *SensitiveDataFilter` | 空のフィルター |
| `NewCustomSensitiveDataFilter` | `func NewCustomSensitiveDataFilter(patterns ...string) (*SensitiveDataFilter, error)` | カスタムパターンフィルター |

## フックコンストラクタ

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `NewHookRegistry` | `func NewHookRegistry() *HookRegistry` | フックレジストリを作成 |
| `NewHooksFromConfig` | `func NewHooksFromConfig(cfg HooksConfig) *HookRegistry` | 設定からフックレジストリを作成 |

## 監査ログコンストラクタ

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `NewAuditLogger` | `func NewAuditLogger(cfg AuditConfig) (*AuditLogger, error)` | 監査ロガーを作成 |
| `DefaultAuditConfig` | `func DefaultAuditConfig() AuditConfig` | デフォルト監査設定 |
| `VerifyAuditEvent` | `func VerifyAuditEvent(entry string, signer *IntegritySigner) *AuditVerificationResult` | 監査イベントの整合性を検証 |

## 整合性署名コンストラクタ

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `NewIntegritySigner` | `func NewIntegritySigner(cfg IntegrityConfig) (*IntegritySigner, error)` | 整合性署名器を作成 |
| `DefaultIntegrityConfigSafe` | `func DefaultIntegrityConfigSafe() (IntegrityConfig, error)` | 安全なランダムキー設定 |

## テスト補助コンストラクタ

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `NewLoggerRecorder` | `func NewLoggerRecorder() *LoggerRecorder` | ログレコーダーを作成（テスト用） |

## コンテキスト関数

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `WithTraceID` | `func WithTraceID(ctx context.Context, traceID string) context.Context` | Trace ID を設定 |
| `WithSpanID` | `func WithSpanID(ctx context.Context, spanID string) context.Context` | Span ID を設定 |
| `WithRequestID` | `func WithRequestID(ctx context.Context, requestID string) context.Context` | Request ID を設定 |
| `GetTraceID` | `func GetTraceID(ctx context.Context) string` | Trace ID を取得 |
| `GetSpanID` | `func GetSpanID(ctx context.Context) string` | Span ID を取得 |
| `GetRequestID` | `func GetRequestID(ctx context.Context) string` | Request ID を取得 |

## JSON 設定

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `DefaultJSONOptions` | `func DefaultJSONOptions() *JSONOptions` | デフォルト JSON 出力オプション |

## フィールドコンストラクタ

構造化ログフィールド（`Field`）の作成に使用。`*With` シリーズメソッドや `WithFields` と組み合わせて使用します。

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `Any` | `func Any(key string, value any) Field` | 任意の型フィールド |
| `String` | `func String(key, value string) Field` | 文字列フィールド |
| `Bool` | `func Bool(key string, value bool) Field` | 真偽値フィールド |
| `Int` | `func Int(key string, value int) Field` | int フィールド |
| `Int8` | `func Int8(key string, value int8) Field` | int8 フィールド |
| `Int16` | `func Int16(key string, value int16) Field` | int16 フィールド |
| `Int32` | `func Int32(key string, value int32) Field` | int32 フィールド |
| `Int64` | `func Int64(key string, value int64) Field` | int64 フィールド |
| `Uint` | `func Uint(key string, value uint) Field` | uint フィールド |
| `Uint8` | `func Uint8(key string, value uint8) Field` | uint8 フィールド |
| `Uint16` | `func Uint16(key string, value uint16) Field` | uint16 フィールド |
| `Uint32` | `func Uint32(key string, value uint32) Field` | uint32 フィールド |
| `Uint64` | `func Uint64(key string, value uint64) Field` | uint64 フィールド |
| `Float32` | `func Float32(key string, value float32) Field` | float32 フィールド |
| `Float64` | `func Float64(key string, value float64) Field` | float64 フィールド |
| `Duration` | `func Duration(key string, value time.Duration) Field` | 所要時間フィールド |
| `Time` | `func Time(key string, value time.Time) Field` | 時刻フィールド |
| `Err` | `func Err(err error) Field` | エラーフィールド（key は "error"） |
| `ErrWithKey` | `func ErrWithKey(key string, err error) Field` | カスタム key のエラーフィールド |
| `ErrWithStack` | `func ErrWithStack(err error) Field` | スタックトレース付きエラーフィールド |

```go
dd.InfoWith("リクエスト完了",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 100*time.Millisecond),
    dd.Err(err),
)
```

:::tip 型安全性の推奨
`Any` よりも型が明確なコンストラクタ（`Int`、`String` など）を優先することで、コンパイル時に型エラーを検出でき、実行時に型不一致で問題が発生するのを防げます。
:::

## フィールド検証設定

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `DefaultFieldValidationConfig` | `func DefaultFieldValidationConfig() *FieldValidationConfig` | デフォルトフィールド検証（検証なし） |
| `StrictSnakeCaseConfig` | `func StrictSnakeCaseConfig() *FieldValidationConfig` | 厳格 snake_case 検証 |
| `StrictCamelCaseConfig` | `func StrictCamelCaseConfig() *FieldValidationConfig` | 厳格 camelCase 検証 |

## デバッグ出力関数

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `Print` | `func Print(args ...any)` | グローバルログ Writer に出力（LevelInfo、セキュリティフィルタリング対象） |
| `Println` | `func Println(args ...any)` | Print と同じ（内部 Log() で自動改行、セキュリティフィルタリング対象） |
| `Printf` | `func Printf(format string, args ...any)` | フォーマット出力（LevelInfo、セキュリティフィルタリング対象） |
| `JSON` | `func JSON(data ...any)` | コンパクト JSON フォーマットで stdout に出力（呼び出し元情報付き、セキュリティフィルタリングなし） |
| `JSONF` | `func JSONF(format string, args ...any)` | フォーマット文字列をコンパクト JSON として stdout に出力（呼び出し元情報付き、セキュリティフィルタリングなし） |
| `Text` | `func Text(data ...any)` | pretty-print フォーマットで stdout に出力（セキュリティフィルタリングなし） |
| `Textf` | `func Textf(format string, args ...any)` | フォーマットテキストを stdout に出力（セキュリティフィルタリングなし） |
| `Exit` | `func Exit(data ...any)` | 呼び出し元情報付きテキスト出力後に終了（exit code 0）、複雑な型は自動 pretty-print、セキュリティフィルタリングなし |
| `Exitf` | `func Exitf(format string, args ...any)` | 呼び出し元情報付きフォーマット出力後に終了（exit code 0、セキュリティフィルタリングなし） |

:::warning デバッグ関数のセキュリティに関する注意
`Print`/`Println`/`Printf` はセキュリティフィルタリングを経ますが、`JSON`/`JSONF`/`Text`/`Textf`/`Exit`/`Exitf` は生データを直接出力し、**セキュリティフィルタリングを経ません**。
:::

## 次のステップ

- [Logger](./logger) -- Logger インスタンスメソッド詳解
- [LoggerEntry](./entry) -- プリセットフィールド付きログ Entry
- [設定](./config) -- Config 構造体
- [デバッグ出力](../dev-tools/debug-visual) -- デバッグビジュアライゼーション関数
