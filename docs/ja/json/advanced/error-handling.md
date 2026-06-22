---
title: "エラー処理 - CyberGo JSON | ベストプラクティス"
description: "CyberGo JSON エラー処理ベストプラクティス：JsonsError 判定、errors.Is/As、標準エラー変数、リカバリ戦略、SafeError、RedactedPath ログで堅牢な例外処理を構築します。"
---

# エラー処理

JSON 操作におけるエラーを正しく処理します。

## エラータイプ

### 標準エラー

```go
var (
    ErrPathNotFound       = errors.New("path not found")
    ErrInvalidPath        = errors.New("invalid path format")
    ErrTypeMismatch       = errors.New("type mismatch")
    ErrInvalidJSON        = errors.New("invalid JSON format")
    ErrDepthLimit         = errors.New("depth limit exceeded")
    ErrSizeLimit          = errors.New("size limit exceeded")
    ErrSecurityViolation  = errors.New("security violation detected")
    ErrProcessorClosed    = errors.New("processor is closed")
    ErrConcurrencyLimit   = errors.New("concurrency limit exceeded")
    ErrUnsupportedPath    = errors.New("unsupported path operation")
    ErrOperationTimeout   = errors.New("operation timeout")
    ErrResourceExhausted  = errors.New("system resources exhausted")
)
```

### エラーチェック

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // パスが存在しない
        return defaultName
    }
    if errors.Is(err, json.ErrTypeMismatch) {
        // 型の不一致
        return "", fmt.Errorf("フィールドの型エラー: %w", err)
    }
    return "", err
}
```

## JsonsError

### 構造

`JsonsError` はライブラリの主要なエラータイプで、操作コンテキスト情報を含みます：

```go
type JsonsError struct {
    Op      string `json:"op"`      // 操作タイプ: "get", "set", "delete", "marshal" など
    Path    string `json:"path"`    // JSON パス（該当する場合）
    Message string `json:"message"` // 人間が読めるエラーメッセージ
    Err     error  `json:"err"`     // 基底エラー
}

func (e *JsonsError) Error() string
func (e *JsonsError) Unwrap() error
func (e *JsonsError) Is(target error) bool
```

### 使用方法

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // errors.Is でエラータイプを確認
    if errors.Is(err, json.ErrPathNotFound) {
        // パスが存在しない
    }
    if errors.Is(err, json.ErrTypeMismatch) {
        // 型の不一致
    }

    // errors.As で詳細なコンテキストを取得
    var jsonErr *json.JsonsError
    if errors.As(err, &jsonErr) {
        fmt.Printf("操作: %s\n", jsonErr.Op)
        fmt.Printf("パス: %s\n", jsonErr.Path)
        fmt.Printf("メッセージ: %s\n", jsonErr.Message)
    }
}
```

## エラー処理パターン

### デフォルト値の提供

```go
// 型安全な取得関数はデフォルト値サポートを内蔵
name := json.GetString(data, "user.name", "匿名")
age := json.GetInt(data, "user.age", 0)
active := json.GetBool(data, "user.active", false)
```

### 複数エラーの収集

```go
type MultiError struct {
    Errors []error
}

func (e *MultiError) Add(err error) {
    e.Errors = append(e.Errors, err)
}

func (e *MultiError) HasError() bool {
    return len(e.Errors) > 0
}

func (e *MultiError) Error() string {
    msgs := make([]string, len(e.Errors))
    for i, err := range e.Errors {
        msgs[i] = err.Error()
    }
    return strings.Join(msgs, "; ")
}

// 使用方法
var multiErr MultiError
for _, path := range requiredPaths {
    if _, err := json.Get(data, path); err != nil {
        multiErr.Add(fmt.Errorf("%s: %w", path, err))
    }
}
if multiErr.HasError() {
    return multiErr.Error()
}
```

### エラーのラップ

```go
val, err := json.Get(data, "config.api_key")
if err != nil {
    return fmt.Errorf("API キーの読み取りに失敗: %w", err)
}
```

## カスタムエラー

### ビジネスエラー

```go
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("バリデーション失敗 %s: %s", e.Field, e.Message)
}

// 使用方法
func validateUser(data string) error {
    name := json.GetString(data, "name")
    if name == "" {
        return &ValidationError{Field: "name", Message: "必須"}
    }
    if len(name) < 2 {
        return &ValidationError{Field: "name", Message: "2 文字以上必要"}
    }
    return nil
}
```

## ログ記録

### 構造化ログ

```go
val, err := json.Get(data, path)
if err != nil {
    log.Error("JSON 操作に失敗",
        "path", path,
        "error", err,
        "error_type", fmt.Sprintf("%T", err),
    )
    return err
}
```

### 監査ログ

```go
func auditLog(op string, path string, err error) {
    if err != nil {
        log.Warn("操作に失敗",
            "operation", op,
            "path", path,
            "error", err,
        )
    } else {
        log.Info("操作に成功",
            "operation", op,
            "path", path,
        )
    }
}
```

## リカバリ戦略

### SafeError セーフ出力

`SafeError` はクライアントに安全なエラーメッセージを返し、内部コンテキスト情報を削除します：

```go
// シグネチャ: func SafeError(err error) string

val, err := json.Get(untrustedInput, "data")
if err != nil {
    // SafeError strips internal details like paths and operation context
    safeMsg := json.SafeError(err)
    http.Error(w, safeMsg, http.StatusBadRequest)
    return
}
```

### リトライ

```go
func withRetry(fn func() error, maxRetries int) error {
    var err error
    for i := 0; i < maxRetries; i++ {
        if err = fn(); err == nil {
            return nil
        }
        time.Sleep(time.Second * time.Duration(i+1))
    }
    return err
}

// 使用方法
err := withRetry(func() error {
    return processData(data)
}, 3)
```

### デグラデーション

```go
func getConfig(data string) Config {
    cfg := json.DefaultConfig()

    // 型安全な取得関数を使用、デフォルト値を内蔵
    cfg.StrictMode = json.GetBool(data, "config.strict", true)

    return cfg
}
```

## エラーの分類

### ユーザー入力エラー

ユーザーが提供した JSON データまたはパスに起因するエラー：

```go
val, err := json.Get(data, "user.name")
if err != nil {
    switch {
    case errors.Is(err, json.ErrInvalidJSON):
        // JSON 形式エラー
        return fmt.Errorf("データ形式エラー: %w", err)
    case errors.Is(err, json.ErrPathNotFound):
        // パスが存在しない
        return fmt.Errorf("フィールドが存在しません: %w", err)
    case errors.Is(err, json.ErrTypeMismatch):
        // 型の不一致
        return fmt.Errorf("型エラー: %w", err)
    case errors.Is(err, json.ErrInvalidPath):
        // パス構文エラー
        return fmt.Errorf("パス構文エラー: %w", err)
    case errors.Is(err, json.ErrUnsupportedPath):
        // サポートされていないパス操作
        return fmt.Errorf("サポートされていない操作: %w", err)
    }
}
```

### セキュリティ関連エラー

潜在的なセキュリティ脅威が検出された場合：

```go
val, err := json.Get(untrustedInput, "data")
if err != nil {
    if errors.Is(err, json.ErrSecurityViolation) {
        // セキュリティ違反、記録して拒否
        log.Warn("セキュリティ違反", "error", err)
        return errors.New("入力が不正です")
    }
    if errors.Is(err, json.ErrSizeLimit) {
        return fmt.Errorf("データがサイズ制限を超過: %w", err)
    }
    if errors.Is(err, json.ErrDepthLimit) {
        return fmt.Errorf("ネスト深度の制限超過: %w", err)
    }
    return err
}
```

### システムエラー

システムレベルの一時的なエラー：

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrOperationTimeout) {
        // 操作タイムアウト、リトライ可能
        return fmt.Errorf("一時的なエラーです、リトライしてください: %w", err)
    }
    if errors.Is(err, json.ErrConcurrencyLimit) {
        // 同時実行制限
        return fmt.Errorf("システムが混雑しています、後でもう一度お試しください: %w", err)
    }
    if errors.Is(err, json.ErrResourceExhausted) {
        // リソース枯渇
        return fmt.Errorf("システムリソースが不足: %w", err)
    }
    if errors.Is(err, json.ErrProcessorClosed) {
        // プロセッサがクローズ済み
        return fmt.Errorf("プロセッサが利用不可: %w", err)
    }
    return err
}
```

## エラー処理のベストプラクティス

### 1. エラータイプの区別

```go
func processJSON(data string) error {
    val, err := json.Get(data, "user.name")
    if err != nil {
        // errors.Is でエラータイプを区別
        switch {
        case errors.Is(err, json.ErrInvalidJSON),
            errors.Is(err, json.ErrPathNotFound),
            errors.Is(err, json.ErrTypeMismatch),
            errors.Is(err, json.ErrInvalidPath):
            // ユーザー入力エラー、フレンドリーなメッセージを返す
            return fmt.Errorf("データ形式エラー: %w", err)
        case errors.Is(err, json.ErrSecurityViolation):
            // セキュリティエラー、記録して拒否
            log.Warn("セキュリティ違反", "error", err)
            return errors.New("入力が不正です")
        case errors.Is(err, json.ErrOperationTimeout),
            errors.Is(err, json.ErrConcurrencyLimit):
            // リトライ可能なエラー
            return fmt.Errorf("一時的なエラーです、リトライしてください: %w", err)
        default:
            // システムエラー
            log.Error("システムエラー", "error", err)
            return errors.New("内部エラー")
        }
    }
    return nil
}
```

### 2. errors.As でコンテキストを取得

```go
func handleWithDetail(data string, path string) error {
    val, err := json.Get(data, path)
    if err != nil {
        var jsonErr *json.JsonsError
        if errors.As(err, &jsonErr) {
            return fmt.Errorf("操作 %s に失敗 (パス: %s): %w",
                jsonErr.Op, jsonErr.Path, jsonErr.Err)
        }
        return fmt.Errorf("操作に失敗: %w", err)
    }
    return nil
}
```

### 3. エラーチェーンのトレース

```go
func deepProcess(data string) error {
    if err := processLevel1(data); err != nil {
        return fmt.Errorf("深度処理に失敗: %w", err)
    }
    return nil
}

func processLevel1(data string) error {
    if err := processLevel2(data); err != nil {
        return fmt.Errorf("レベル1処理に失敗 (パス data.field): %w", err)
    }
    return nil
}

func processLevel2(data string) error {
    _, err := json.Get(data, "data.field")
    return err
}

// エラーチェーンの例:
// 深度処理に失敗: レベル1処理に失敗 (パス data.field): path not found
```

## 関連

- [定数とエラー](../api-reference/constants)
- [セキュリティ概要](../security/)
- [パフォーマンス最適化](./performance)
