---
title: "定数とエラー - HTML"
description: "CyberGo HTML ライブラリの定数とエラータイプ API リファレンス。DefaultMaxInputSize（50MB）などのデフォルト値定数、ErrInputTooLarge などのセンチネルエラー、InputError、ConfigError、FileError の構造化エラータイプを含み、すべて errors.Is/As による判定に対応し、ランタイム異常の正確な特定と処理に役立ちます。"
---

# 定数とエラー

## デフォルト設定定数

| 定数 | 型 | 値 | 説明 |
|------|------|----|------|
| `DefaultMaxInputSize` | `int` | `52428800` | 最大入力サイズ (50MB) |
| `DefaultMaxCacheEntries` | `int` | `2000` | キャッシュ最大エントリ |
| `DefaultWorkerPoolSize` | `int` | `4` | ワーカープールサイズ |
| `DefaultCacheTTL` | `time.Duration` | `1h` | キャッシュ有効期限 |
| `DefaultCacheCleanup` | `time.Duration` | `5m` | キャッシュクリーンアップ間隔 |
| `DefaultMaxDepth` | `int` | `500` | 最大 DOM 深度 |
| `DefaultProcessingTimeout` | `time.Duration` | `30s` | 処理タイムアウト時間 |

## 監査定数

### 監査イベントタイプ

| 定数 | 値 | 説明 |
|------|------|------|
| `AuditEventBlockedTag` | `"blocked_tag"` | ブロックされたタグ |
| `AuditEventBlockedAttr` | `"blocked_attr"` | ブロックされた属性 |
| `AuditEventBlockedURL` | `"blocked_url"` | ブロックされた URL |
| `AuditEventInputViolation` | `"input_violation"` | 入力違反 |
| `AuditEventDepthViolation` | `"depth_violation"` | 深度違反 |
| `AuditEventTimeout` | `"timeout"` | 処理タイムアウト |
| `AuditEventEncodingIssue` | `"encoding_issue"` | エンコーディングの問題 |
| `AuditEventPathTraversal` | `"path_traversal"` | パストラバーサルの試行 |

### 監査レベル

| 定数 | 型 | 値 | 説明 |
|------|------|------|------|
| `AuditLevelInfo` | `AuditLevel` | `"info"` | 情報レベル |
| `AuditLevelWarning` | `AuditLevel` | `"warning"` | 警告レベル |
| `AuditLevelCritical` | `AuditLevel` | `"critical"` | 重大レベル |

:::info
監査システムの詳細な使い方と Sink タイプは [監査システム](./audit) を参照してください。
:::

## センチネルエラー

| エラー | メッセージ | 説明 |
|------|------|------|
| `ErrInputTooLarge` | `html: input size exceeds maximum` | 入力がサイズ制限を超過 |
| `ErrInvalidHTML` | `html: invalid HTML` | 無効な HTML コンテンツ |
| `ErrProcessorClosed` | `html: processor closed` | プロセッサがクローズ済み |
| `ErrMaxDepthExceeded` | `html: max depth exceeded` | 最大深度を超過 |
| `ErrInvalidConfig` | `html: invalid config` | 無効な設定 |
| `ErrProcessingTimeout` | `html: processing timeout exceeded` | 処理タイムアウト |
| `ErrFileNotFound` | `html: file not found` | ファイルが見つからない |
| `ErrInvalidFilePath` | `html: invalid file path` | 無効なファイルパス |
| `ErrInternalPanic` | `html: internal panic recovered` | 内部パニックからリカバリ |
| `ErrMultipleConfigs` | `html: at most one Config may be provided` | Config は最大 1 つまで |

## エラータイプ

### InputError

入力関連エラー。サイズ情報を含みます。

```go
type InputError struct {
    Op       string // 操作名
    Size     int    // 実際のサイズ
    MaxSize  int    // 最大制限
    InputErr error  // 元のエラー
}

func (e *InputError) Error() string
func (e *InputError) Unwrap() error // → InputErr（非 nil の場合）または ErrInputTooLarge
```

### ConfigError

設定検証エラー。フィールド情報を含みます。

```go
type ConfigError struct {
    Field   string // フィールド名
    Value   any    // 無効な値
    Message string // エラーの説明
}

func (e *ConfigError) Error() string
func (e *ConfigError) Unwrap() error // → ErrInvalidConfig
```

### FileError

ファイル操作エラー。パスを自動的に切り詰めて漏洩を防止します。

```go
type FileError struct {
    Op      string // 操作名
    Path    string // ファイルパス
    FileErr error  // 元のエラー
}

func (e *FileError) Error() string        // 安全な出力（パスを切り詰め）
func (e *FileError) SafePath() string     // ファイル名のみ返す
func (e *FileError) Unwrap() error        // → ErrFileNotFound | 元のエラー | ErrInvalidFilePath
```

:::tip 安全なパス
`FileError.Error()` と `SafePath()` はどちらも切り詰められた安全なパス（ファイル名のみ）を返し、パスの漏洩を防止します。デバッグ時に完全なパスが必要な場合は `Path` フィールドに直接アクセスできます。
:::

## エラー処理パターン

```go
result, err := html.Extract(data)
if err != nil {
    var inputErr *html.InputError
    var configErr *html.ConfigError
    var fileErr *html.FileError

    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // 入力が大きすぎる
    case errors.Is(err, html.ErrInvalidHTML):
        // 無効な HTML
    case errors.Is(err, html.ErrFileNotFound):
        // ファイルが存在しない
    case errors.As(err, &inputErr):
        fmt.Printf("サイズ %d が制限 %d を超過\n", inputErr.Size, inputErr.MaxSize)
    case errors.As(err, &configErr):
        fmt.Printf("設定フィールド %s が無効: %s\n", configErr.Field, configErr.Message)
    case errors.As(err, &fileErr):
        fmt.Printf("ファイル: %s\n", fileErr.SafePath())
    }
}
```
