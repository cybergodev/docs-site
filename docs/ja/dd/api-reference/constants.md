---
title: "定数とエラー - CyberGo DD | LogLevel、Format、SentinelErrors"
description: "CyberGo DD 定数定義とエラータイプ完全ドキュメント。LogLevel ログレベル定数（Debug/Info/Warn/Error/Fatal）、Format 出力フォーマット定数、SentinelErrors センチネルエラー定義を含み、ログ動作とエラー処理を正確に制御。DD ログライブラリの設定体系を理解するためのコア基盤。"
---

# 定数とエラー

DD は豊富な定数とエラータイプを定義し、ログレベル制御、フォーマット、エラー処理に使用します。

## ログレベル

```go
type LogLevel int8 // ログレベル型
```

| 定数 | 値 | 説明 |
|------|----|------|
| `LevelDebug` | 0 | デバッグレベル |
| `LevelInfo` | 1 | 情報レベル（デフォルト） |
| `LevelWarn` | 2 | 警告レベル |
| `LevelError` | 3 | エラーレベル |
| `LevelFatal` | 4 | 致命的レベル |

## ログフォーマット

```go
type LogFormat int8 // 出力フォーマット型
```

| 定数 | 説明 |
|------|------|
| `FormatText` | テキストフォーマット |
| `FormatJSON` | JSON フォーマット |

## フィールド検証モード

```go
type FieldValidationMode int // フィールドキー検証モード
```

| 定数 | 値 | 説明 |
|------|----|------|
| `FieldValidationNone` | 0 | 検証を無効化（デフォルト） |
| `FieldValidationWarn` | 1 | 検証失敗時に警告するが受け付ける |
| `FieldValidationStrict` | 2 | 厳格モード、検証失敗時にエラーを記録 |

## フィールド命名規則

```go
type FieldNamingConvention int // フィールドキー命名規則
```

| 定数 | 値 | 説明 |
|------|----|------|
| `NamingConventionAny` | 0 | 任意のフォーマットを受け付け（デフォルト） |
| `NamingConventionSnakeCase` | 1 | snake_case（例: user_id） |
| `NamingConventionCamelCase` | 2 | camelCase（例: userId） |
| `NamingConventionPascalCase` | 3 | PascalCase（例: UserId） |
| `NamingConventionKebabCase` | 4 | kebab-case（例: user-id） |

## ハッシュアルゴリズム

```go
type HashAlgorithm int // 整合性署名ハッシュアルゴリズム
```

| 定数 | 説明 |
|------|------|
| `HashAlgorithmSHA256` | SHA-256 アルゴリズム |

## デフォルト値

| 定数 | 値 | 説明 |
|------|----|------|
| `DefaultTimeFormat` | `"2006-01-02T15:04:05Z07:00"` | ISO 8601 時間フォーマット |
| `DefaultLogPath` | `"logs/app.log"` | デフォルトログファイルパス |
| `DefaultMaxSizeMB` | `100` | デフォルトファイルサイズ制限（MB） |
| `DefaultMaxBackups` | `10` | デフォルトバックアップ数 |
| `DefaultMaxAge` | `30 * 24 * time.Hour` | デフォルト保持日数（30日） |

## コンテキストキー

| 定数 | 型 | 値 |
|------|------|----|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## エラーコード

`LoggerError.Code` フィールドには機械可読なエラーコード文字列が含まれ、エラータイプの精密なマッチングに使用されます。エラーコードは内部実装の詳細であり、センチネルエラーによるマッチングを推奨します。

## センチネルエラー

各エラーコードに対応するセンチネルエラー変数があります：

```go
var (
    ErrNilConfig          = errors.New("config cannot be nil")
    ErrNilWriter          = errors.New("writer cannot be nil")
    ErrNilFilter          = errors.New("filter cannot be nil")
    ErrNilHook            = errors.New("hook cannot be nil")
    ErrNilExtractor       = errors.New("context extractor cannot be nil")
    ErrLoggerClosed       = errors.New("logger is closed")
    ErrWriterNotFound     = errors.New("writer not found")
    ErrInvalidLevel       = errors.New("invalid log level")
    ErrInvalidFormat      = errors.New("invalid log format")
    ErrMaxWritersExceeded = errors.New("maximum writer count exceeded")
    ErrEmptyFilePath      = errors.New("file path cannot be empty")
    ErrPathTooLong        = errors.New("file path too long")
    ErrPathTraversal      = errors.New("path traversal detected")
    ErrNullByte           = errors.New("null byte in input")
    ErrInvalidPath        = errors.New("invalid file path")
    ErrSymlinkNotAllowed  = errors.New("symlinks not allowed")
    ErrHardlinkNotAllowed = errors.New("hardlinks not allowed")
    ErrOverlongEncoding   = errors.New("UTF-8 overlong encoding detected")
    ErrMaxSizeExceeded    = errors.New("maximum size exceeded")
    ErrMaxBackupsExceeded = errors.New("maximum backup count exceeded")
    ErrBufferSizeTooLarge = errors.New("buffer size too large")
    ErrInvalidPattern     = errors.New("invalid regex pattern")
    ErrEmptyPattern       = errors.New("pattern cannot be empty")
    ErrPatternTooLong     = errors.New("pattern length exceeds maximum")
    ErrReDoSPattern       = errors.New("pattern contains dangerous nested quantifiers that may cause ReDoS")
    ErrPatternFailed      = errors.New("failed to add pattern")
    ErrConfigValidation   = errors.New("configuration validation failed")
    ErrWriterAdd          = errors.New("failed to add writer")
    ErrMultipleConfigs    = errors.New("multiple configs provided, expected 0 or 1")
    ErrNilMultiWriter     = errors.New("multiwriter is nil")
)
```

### エラーチェック

```go
if errors.Is(err, dd.ErrLoggerClosed) {
    // ロガーが閉じている
}

if errors.Is(err, dd.ErrPathTraversal) {
    // パストラバーサル攻撃を検出
}
```

## エラータイプ

### LoggerError

```go
type LoggerError struct {
    Code    string
    Message string
    Cause   error
    Context map[string]any
}
```

メソッド：`Error()`、`Unwrap()`、`Is(target)`、`WithContext(key, value)`、`WithField(key, value)`

```go
// LoggerError にはエラーコード、メッセージ、原因、コンテキストが含まれる
// errors.Is でセンチネルエラーをチェック
if errors.Is(err, dd.ErrLoggerClosed) {
    // ロガーが閉じている
}
```

### WriterError

```go
type WriterError struct {
    Index  int
    Writer io.Writer
    Err    error
}
```

メソッド：`Error()`、`Unwrap()`

### MultiWriterError

```go
type MultiWriterError struct {
    Errors []WriterError
}
```

メソッド：`Error()`、`Unwrap()`、`HasErrors()`、`ErrorCount()`、`FirstError()`

## 次のステップ

- [パッケージ関数](./functions) -- エラー処理関数
- [セキュリティフィルタ](./security) -- パスセキュリティ検証
- [フックシステム](./hooks) -- OnError フック
