---
title: "定数とエラー - CyberGo JSON | API リファレンス"
description: "CyberGo JSON 定数とエラー定義完全リファレンス：DefaultMaxJSONSize/DefaultMaxNestingDepth デフォルト制限定数、ErrPathNotFound/ErrTypeMismatch エラー変数、MergeMode マージモード列挙型を含み、設定プリセットとエラー処理をサポート。"
---

# 定数とエラー

## エラー変数

### 主要なエラー

```go
var (
    // 基本エラー
    ErrInvalidJSON     = errors.New("invalid JSON format")
    ErrPathNotFound    = errors.New("path not found")
    ErrTypeMismatch    = errors.New("type mismatch")
    ErrInvalidPath     = errors.New("invalid path format")
    ErrProcessorClosed = errors.New("processor is closed")

    // 制限エラー
    ErrSizeLimit        = errors.New("size limit exceeded")
    ErrDepthLimit       = errors.New("depth limit exceeded")
    ErrConcurrencyLimit = errors.New("concurrency limit exceeded")

    // セキュリティとバリデーションエラー
    ErrSecurityViolation = errors.New("security violation detected")
    ErrUnsupportedPath   = errors.New("unsupported path operation")

    // リソースとパフォーマンスエラー
    ErrOperationTimeout  = errors.New("operation timeout")
    ErrResourceExhausted = errors.New("system resources exhausted")
)
```

### エラーチェック

`errors.Is` を使用してエラー型をチェックします：

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // パスが存在しない
        fmt.Println("パスが見つかりません")
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // 型が一致しない
        fmt.Println("型が一致しません")
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // JSON 形式エラー
        fmt.Println("無効な JSON")
    }
}
```

## JsonsError 型

### 構造定義

```go
type JsonsError struct {
    Op      string `json:"op"`      // 操作名
    Path    string `json:"path"`    // エラーが発生したパス
    Message string `json:"message"` // 人間可読なエラーメッセージ
    Err     error  `json:"err"`     // 基底エラー
}
```

### メソッド

```go
func (e *JsonsError) Error() string
func (e *JsonsError) Unwrap() error
func (e *JsonsError) Is(target error) bool
```

### 使用例

```go
val, err := json.Get(data, "complex.path[0]")
if err != nil {
    var jsonErr *json.JsonsError
    if errors.As(err, &jsonErr) {
        fmt.Printf("操作: %s\n", jsonErr.Op)
        fmt.Printf("パス: %s\n", jsonErr.Path)
        fmt.Printf("メッセージ: %s\n", jsonErr.Message)
        if jsonErr.Err != nil {
            fmt.Printf("原因: %v\n", jsonErr.Err)
        }
    }
}
```

## 設定プリセット

### デフォルト値定数

```go
const (
    // サイズ制限
    DefaultMaxJSONSize     = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth = 200
    DefaultMaxPathDepth    = 50
    DefaultMaxConcurrency  = 50

    // セキュリティ制限
    DefaultMaxSecuritySize   = 10 * 1024 * 1024  // 10MB
    DefaultMaxObjectKeys     = 100000
    DefaultMaxArrayElements  = 100000
    DefaultMaxBatchSize      = 2000
    DefaultParallelThreshold = 10

    // キャッシュ
    DefaultCacheTTL = 5 * time.Minute
)
```

## 設定プリセット関数

### DefaultConfig

シグネチャ：`func DefaultConfig() Config`

デフォルト設定を返します。

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### SecurityConfig

シグネチャ：`func SecurityConfig() Config`

セキュリティ設定を返します。信頼できない入力の処理に適しています。

```go
// 以下の用途に推奨：
// - パブリック API と Web サービス
// - ユーザー送信データ
// - 外部 Webhook
// - 認証エンドポイント
// - 金融データ処理
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**セキュリティ設定の特徴**：

- 完全セキュリティスキャン
- 厳格モード
- 控えめな制限値
- キャッシュ有効

### PrettyConfig

シグネチャ：`func PrettyConfig() Config`

フォーマット出力設定を返します。

```go
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

## マージモード定数

```go
// MergeMode はマージモード型（internal パッケージからエクスポート）
type MergeMode = internal.MergeMode

const (
    // MergeUnion - ユニオンマージ（デフォルト）
    // オブジェクト：すべてのキーをマージ、競合値は上書き値を使用
    // 配列：すべての要素をマージして重複排除
    MergeUnion = internal.MergeUnion

    // MergeIntersection - 積集合マージ
    // オブジェクト：共通キーのみ保持
    // 配列：共通要素のみ保持
    MergeIntersection = internal.MergeIntersection

    // MergeDifference - 差集合マージ
    // オブジェクト：ベースに存在し上書きに存在しないキーのみ保持
    // 配列：ベースに存在し上書きに存在しない要素のみ保持
    MergeDifference = internal.MergeDifference
)
```

## パスセグメント型

`PathSegment` は `internal` パッケージからエクスポートされたパスセグメント型で、解析後のパス構成要素を表します。

```go
type PathSegment = internal.PathSegment
```

### PathSegment 構造体

```go
type PathSegment struct {
    Type  PathSegmentType  // セグメントタイプ

    // 型に応じて異なるフィールドを使用
    Key   string // プロパティ名（Property/Extract 型）
    Index int    // 配列インデックス（ArrayIndex 型）またはスライス開始
    End   int    // スライス終了（ArraySlice 型）
    Step  int    // スライスステップ（ArraySlice 型）
    Flags PathSegmentFlags // セグメントフラグ
}
```

### PathSegment メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `HasStart` | `func (s *PathSegment) HasStart() bool` | スライスに開始値があるか |
| `HasEnd` | `func (s *PathSegment) HasEnd() bool` | スライスに終了値があるか |
| `HasStep` | `func (s *PathSegment) HasStep() bool` | スライスにステップ値があるか |
| `IsNegativeIndex` | `func (s *PathSegment) IsNegativeIndex() bool` | 負のインデックスか |
| `IsWildcardSegment` | `func (s *PathSegment) IsWildcardSegment() bool` | ワイルドカードか |
| `IsFlatExtract` | `func (s *PathSegment) IsFlatExtract() bool` | フラットパターンか |

## セキュリティパターンレベル

```go
type PatternLevel int

const (
    // PatternLevelCritical - 重大リスク、常に操作をブロック
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning - 警告レベル、厳格モードではブロック
    PatternLevelWarning

    // PatternLevelInfo - 情報レベル、ログ記録のみ
    PatternLevelInfo
)
```

### DangerousPattern 構造体

```go
type DangerousPattern struct {
    Pattern string       // 検出する部分文字列
    Name    string       // 人間可読なセキュリティリスクの説明
    Level   PatternLevel // 処理レベル
}
```

## エラー処理のベストプラクティス

### errors.Is で型をチェック

```go
result, err := json.Get(data, path)
if errors.Is(err, json.ErrPathNotFound) {
    return defaultValue
}
if errors.Is(err, json.ErrTypeMismatch) {
    return defaultValue
}
```

### errors.As で詳細を取得

```go
var jsonErr *json.JsonsError
if errors.As(err, &jsonErr) {
    log.Printf("操作 %s がパス %s で失敗: %s",
        jsonErr.Op, jsonErr.Path, jsonErr.Message)
}
```

### エラーラッピング

```go
val := json.GetString(data, path)
if val == "" {
    return fmt.Errorf("設定 %s の取得で空の値が返されました", path)
}
```

## 関連

- [エラー処理](../advanced/error-handling) - 高度なエラー処理ガイド
- [Config](./config) - 設定オプション
- [セキュリティ概要](../security/) - セキュリティベストプラクティス
