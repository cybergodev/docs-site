---
title: "エラー処理 - CyberGo env | センチネルエラーと復旧戦略"
description: "CyberGo env エラー処理ガイド。16個のセンチネルエラーの errors.Is 検査、8種の構造化エラーの errors.As 抽出、復旧・グレードダウン戦略、エラーチェーン追跡を解説します。"
---

# エラー処理

env ライブラリは構造化されたエラー処理メカニズムを提供し、`errors.Is` と `errors.As` パターンをサポートしています。

## センチネルエラー

### ファイルエラー

```go
var (
    ErrFileNotFound  = errors.New("file not found")
    ErrFileTooLarge  = errors.New("file exceeds maximum size limit")
)
```

**使用例：**

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    log.Println("設定ファイルが存在しません")
}
if errors.Is(err, env.ErrFileTooLarge) {
    log.Println("設定ファイルが大きすぎます")
}
```

### 解析エラー

```go
var (
    ErrLineTooLong  = errors.New("line exceeds maximum length limit")
    ErrInvalidKey   = errors.New("invalid key format")
    ErrDuplicateKey = errors.New("duplicate key encountered")
)
```

### セキュリティエラー

```go
var (
    ErrForbiddenKey      = errors.New("key is forbidden for security reasons")
    ErrSecurityViolation = errors.New("security policy violation")
    ErrInvalidValue      = errors.New("invalid value content")
)
```

**禁止キーのチェック：**

```go
err := loader.Set("PATH", "/malicious")
if errors.Is(err, env.ErrForbiddenKey) {
    log.Println("禁止キーの設定を試みました")
}
```

### 展開エラー

```go
var ErrExpansionDepth = errors.New("variable expansion depth exceeded")
```

### 制限エラー

```go
var ErrMaxVariables = errors.New("maximum number of variables exceeded")
```

### ステータスエラー

```go
var (
    ErrClosed             = errors.New("loader has been closed")
    ErrInvalidConfig      = errors.New("invalid configuration")
    ErrAlreadyInitialized = errors.New("default loader already initialized")
    ErrNotInitialized     = errors.New("default loader not initialized; call Load() first")
    ErrMissingRequired    = errors.New("required key is missing")
)
```

**確認方法：**

```go
// ローダーがクローズ済みか確認
if errors.Is(err, env.ErrClosed) {
    // ローダークローズ済み
}

// デフォルトローダーが初期化済みか確認
if errors.Is(err, env.ErrAlreadyInitialized) {
    // デフォルトローダーが既に存在し、Load を繰り返し呼び出せません
}

// デフォルトローダーが未初期化か確認
if errors.Is(err, env.ErrNotInitialized) {
    // 先に env.Load() または env.LoadWithConfig() を呼び出す必要がある
}

// 必須キーが不足していないか確認
if errors.Is(err, env.ErrMissingRequired) {
    // 必須キーが不足
}
```

### アダプターエラー

```go
var ErrValidateRequiredUnsupported = errors.New(
    "custom validator does not implement ValidateRequired; " +
    "implement Validator interface for required key validation",
)
```

カスタムバリデーターが `KeyValidator` インターフェースのみを実装し、完全な `Validator` インターフェースを実装していない場合、`ValidateRequired` を呼び出すとこのエラーが返されます。

**確認方法：**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // カスタムバリデーターは必須キー検証をサポートしていません
    // 完全な Validator インターフェースを実装する必要がある
}
```

::: tip 解決方法
`KeyValidator` のみではなく、`Validator` インターフェース（`ValidateKey`、`ValidateValue`、`ValidateRequired` の3つのメソッドを含む）を実装してください。
:::

## 構造化エラー型

### ParseError

解析エラー、位置情報を含む：

```go
type ParseError struct {
    File    string  // ファイル名
    Line    int     // 行番号
    Content string  // エラー内容
    Err     error   // 元のエラー
}
```

**使用例：**

```go
err := loader.LoadFiles(".env")

var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    log.Printf("解析エラー %s:%d - %s\n",
        parseErr.File, parseErr.Line, parseErr.Err)
    // 出力: 解析エラー .env:15 - invalid key format
}
```

### FileError

ファイル操作エラー：

```go
type FileError struct {
    Path  string  // ファイルパス
    Op    string  // 操作
    Err   error   // 元のエラー
    Size  int64   // ファイルサイズ
    Limit int64   // 制限
}
```

**使用例：**

```go
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    if fileErr.Size > 0 {
        log.Printf("ファイル %s のサイズ %d が制限 %d を超過\n",
            fileErr.Path, fileErr.Size, fileErr.Limit)
    }
}
```

### SecurityError

セキュリティエラー：

```go
type SecurityError struct {
    Action  string  // 操作
    Reason  string  // 原因
    Key     string  // キー名
    Details string  // 詳細
}
```

**使用例：**

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    log.Printf("セキュリティエラー: %s - %s (キー: %s)\n",
        secErr.Action, secErr.Reason, secErr.Key)
}
```

### ValidationError

検証エラー：

```go
type ValidationError struct {
    Field   string  // フィールド名
    Value   string  // 値
    Rule    string  // ルール
    Message string  // メッセージ
}
```

**使用例：**

```go
var valErr *env.ValidationError
if errors.As(err, &valErr) {
    log.Printf("検証失敗: フィールド %s - %s\n", valErr.Field, valErr.Message)
}
```

### ExpansionError

変数展開エラー：

```go
type ExpansionError struct {
    Key   string             // キー名
    Depth int                // 現在の深度
    Limit int                // 制限
    Chain string             // 展開チェーン
    Kind  ExpansionErrorKind // エラー原因の分類（ゼロ値 = 深度/循環）
}
```

**使用例：**

```go
var expErr *env.ExpansionError
if errors.As(err, &expErr) {
    log.Printf("展開深度超過: %s (チェーン: %s)\n", expErr.Key, expErr.Chain)
}
```

### JSONError

JSON 解析エラー：

```go
type JSONError struct {
    Path    string  // ファイルパス
    Message string  // エラーメッセージ
    Err     error   // 元のエラー
}
```

**使用例：**

```go
var jsonErr *env.JSONError
if errors.As(err, &jsonErr) {
    log.Printf("JSON エラー %s: %s\n", jsonErr.Path, jsonErr.Message)
}
```

### YAMLError

YAML 解析エラー：

```go
type YAMLError struct {
    Path    string  // ファイルパス
    Line    int     // 行番号
    Column  int     // 列番号
    Message string  // エラーメッセージ
    Err     error   // 元のエラー
}
```

**使用例：**

```go
var yamlErr *env.YAMLError
if errors.As(err, &yamlErr) {
    log.Printf("YAML エラー %s:%d:%d - %s\n",
        yamlErr.Path, yamlErr.Line, yamlErr.Column, yamlErr.Message)
}
```

### MarshalError

シリアライズ/デシリアライズエラー：

```go
type MarshalError struct {
    Field   string  // フィールド名
    Message string  // エラーメッセージ
}
```

**使用例：**

```go
_, err := env.MarshalStruct(invalidData)
if err != nil && env.IsMarshalError(err) {
    var marshalErr *env.MarshalError
    if errors.As(err, &marshalErr) {
        log.Printf("シリアライズエラー: フィールド %s - %s\n", marshalErr.Field, marshalErr.Message)
    }
}
```

## エラー処理模式

### errors.Is パターン

センチネルエラーのチェック：

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // ファイルが存在しない
    log.Println("設定ファイルが存在しません。デフォルト値を使用します")

case errors.Is(err, env.ErrFileTooLarge):
    // ファイルが大きすぎます
    log.Fatal("設定ファイルが大きすぎます")

case errors.Is(err, env.ErrForbiddenKey):
    // 禁止キー
    log.Fatal("禁止キーを検出")

case errors.Is(err, env.ErrInvalidKey):
    // 無効なキーフォーマット
    log.Fatal("無効なキーを検出")

case err != nil:
    // その他のエラー
    log.Fatalf("読み込み失敗: %v", err)
}
```

### errors.As パターン

詳細なエラー情報の抽出：

```go
err := loader.LoadFiles(".env")
if err == nil {
    return
}

// 解析エラーの抽出を試行
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    log.Fatalf("解析エラー %s 第 %d 行: %v",
        parseErr.File, parseErr.Line, parseErr.Err)
}

// ファイルエラーの抽出を試行
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    log.Fatalf("ファイル %s エラー: %v", fileErr.Path, fileErr.Err)
}

// セキュリティエラーの抽出を試行
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    log.Fatalf("セキュリティエラー: %s - %s", secErr.Action, secErr.Reason)
}

// その他のエラー
log.Fatalf("不明なエラー: %v", err)
```

### 組み合わせ処理

```go
func handleLoadError(err error) {
    if err == nil {
        return
    }

    // まずセンチネルエラーをチェック
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        log.Println("警告: 設定ファイルが存在しません")
        return

    case errors.Is(err, env.ErrFileTooLarge):
        var fileErr *env.FileError
        errors.As(err, &fileErr)
        log.Fatalf("ファイル %s が大きすぎます (%d > %d)",
            fileErr.Path, fileErr.Size, fileErr.Limit)
    }

    // 次に構造化エラーをチェック
    var parseErr *env.ParseError
    if errors.As(err, &parseErr) {
        log.Fatalf("解析エラー %s:%d - %v",
            parseErr.File, parseErr.Line, parseErr.Err)
    }

    var secErr *env.SecurityError
    if errors.As(err, &secErr) {
        log.Fatalf("セキュリティエラー: %s", secErr.Reason)
    }

    // 不明なエラー
    log.Fatalf("エラー: %v", err)
}
```

## 復旧パターン

### グレースフルデグラデーション

```go
func loadConfig() *Config {
    cfg := env.ProductionConfig()
    cfg.Filenames = nil
    loader, err := env.New(cfg)
    if err != nil {
        log.Printf("設定エラー: %v，デフォルト設定を使用", err)
        return defaultConfig()
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        if errors.Is(err, env.ErrFileNotFound) {
            log.Println("設定ファイルが存在しません。デフォルト値を使用します")
            return defaultConfig()
        }
        log.Fatalf("読み込み失敗: %v", err)
    }

    if err := loader.Validate(); err != nil {
        log.Fatalf("検証失敗: %v", err)
    }

    return parseConfig(loader)
}
```

### リトライパターン

```go
func loadWithRetry(filenames []string, maxRetries int) error {
    cfg := env.DefaultConfig()
    cfg.Filenames = nil
    loader, err := env.New(cfg)
    if err != nil {
        return err
    }
    defer loader.Close()

    for i := 0; i < maxRetries; i++ {
        err := loader.LoadFiles(filenames...)
        if err == nil {
            return nil
        }

        if errors.Is(err, env.ErrFileNotFound) {
            time.Sleep(time.Second * time.Duration(i+1))
            continue
        }

        return err
    }

    return errors.New("max retries exceeded")
}
```

## 完全な例

```go
package main

import (
    "errors"
    "log"

    "github.com/cybergodev/env"
)

func main() {
    cfg := env.ProductionConfig()
    cfg.Filenames = nil
    cfg.FailOnMissingFile = true
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        handleLoadError(err)
    }

    if err := loader.Validate(); err != nil {
        handleValidationError(err)
    }

    log.Println("設定の読み込みに成功")
}

func handleLoadError(err error) {
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        log.Fatal("設定ファイルが存在しません")

    case errors.Is(err, env.ErrFileTooLarge):
        var fileErr *env.FileError
        errors.As(err, &fileErr)
        log.Fatalf("ファイルが大きすぎます: %s (%d bytes)", fileErr.Path, fileErr.Size)

    case errors.Is(err, env.ErrForbiddenKey):
        log.Fatal("禁止キーを検出")
    }

    // 構造化エラー
    var parseErr *env.ParseError
    if errors.As(err, &parseErr) {
        log.Fatalf("解析エラー %s:%d - %v",
            parseErr.File, parseErr.Line, parseErr.Err)
    }

    var secErr *env.SecurityError
    if errors.As(err, &secErr) {
        log.Fatalf("セキュリティエラー: %s - %s", secErr.Action, secErr.Reason)
    }

    log.Fatalf("読み込み失敗: %v", err)
}

func handleValidationError(err error) {
    var valErr *env.ValidationError
    if errors.As(err, &valErr) {
        log.Fatalf("検証失敗: %s - %s", valErr.Field, valErr.Message)
    }

    if errors.Is(err, env.ErrMissingRequired) {
        log.Fatal("必須キーが不足")
    }

    log.Fatalf("検証失敗: %v", err)
}
```

## 関連ドキュメント

- [定数とエラー](/ja/env/api-reference/constants) - 完全なエラーリスト
- [Config API](/ja/env/api-reference/config) - 制限設定
- [セキュリティ概要](/ja/env/security/) - セキュリティエラー処理
