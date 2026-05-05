---
title: エラー処理 - CyberGo env | センチネルエラーとリカバリ戦略
description: CyberGo env ライブラリのエラー処理パターンとベストプラクティスの完全ガイド。センチネルエラーの errors.Is チェック、構造化エラータイプの errors.As 抽出、エラーリカバリとグレースフルデグラデーション戦略、カスタムエラーラッピングとエラーチェーン追跡を含み、Go 開発者が堅牢な環境変数管理コードを書き、優雅なエラー処理と障害リカバリを実現できるようにします。
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

### パースエラー

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
    ErrNullByte          = errors.New("null byte detected in input")
    ErrControlChar       = errors.New("control character detected in input")
    ErrInvalidValue      = errors.New("invalid value content")
)
```

**禁止キーのチェック：**

```go
err := loader.Set("PATH", "/malicious")
if errors.Is(err, env.ErrForbiddenKey) {
    log.Println("禁止キーの設定が試みられました")
}
```

### 展開エラー

```go
var ErrExpansionDepth = errors.New("variable expansion depth exceeded")
```

### ステータスエラー

```go
var (
    ErrClosed             = errors.New("loader has been closed")
    ErrInvalidConfig      = errors.New("invalid configuration")
    ErrAlreadyInitialized = errors.New("default loader already initialized")
    ErrMissingRequired    = errors.New("required key is missing")
)
```

## 構造化エラータイプ

### ParseError

パースエラー。位置情報を含みます：

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
    log.Printf("パースエラー %s:%d - %s\n",
        parseErr.File, parseErr.Line, parseErr.Err)
    // 出力: パースエラー .env:15 - invalid key format
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
        log.Printf("ファイル %s のサイズ %d が制限 %d を超えています\n",
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
    Key   string  // キー名
    Depth int     // 現在の深度
    Limit int     // 制限
    Chain string  // 展開チェーン
}
```

**使用例：**

```go
var expErr *env.ExpansionError
if errors.As(err, &expErr) {
    log.Printf("展開深度の制限超過: %s (チェーン: %s)\n", expErr.Key, expErr.Chain)
}
```

### フォーマットエラー

```go
type JSONError struct {
    Path    string
    Message string
    Err     error
}

type YAMLError struct {
    Path    string
    Line    int
    Column  int
    Message string
    Err     error
}

type MarshalError struct {
    Field   string
    Message string
}
```

## エラー処理パターン

### errors.Is パターン

センチネルエラーのチェック：

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // ファイルが存在しない
    log.Println("設定ファイルが存在しません、デフォルト値を使用")

case errors.Is(err, env.ErrFileTooLarge):
    // ファイルが大きすぎる
    log.Fatal("設定ファイルが大きすぎます")

case errors.Is(err, env.ErrForbiddenKey):
    // 禁止キー
    log.Fatal("禁止キーが検出されました")

case errors.Is(err, env.ErrInvalidKey):
    // 無効なキー形式
    log.Fatal("無効なキーが検出されました")

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

// パースエラーの抽出を試みる
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    log.Fatalf("パースエラー %s 第 %d 行: %v",
        parseErr.File, parseErr.Line, parseErr.Err)
}

// ファイルエラーの抽出を試みる
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    log.Fatalf("ファイル %s エラー: %v", fileErr.Path, fileErr.Err)
}

// セキュリティエラーの抽出を試みる
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
        log.Fatalf("パースエラー %s:%d - %v",
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

## リカバリパターン

### グレースフルデグラデーション

```go
func loadConfig() *Config {
    cfg := env.ProductionConfig()
    cfg.Filenames = nil
    loader, err := env.New(cfg)
    if err != nil {
        log.Printf("設定エラー: %v、デフォルト設定を使用", err)
        return defaultConfig()
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        if errors.Is(err, env.ErrFileNotFound) {
            log.Println("設定ファイルが存在しません、デフォルト値を使用")
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

## 完全なサンプル

```go
package main

import (
    "errors"
    "fmt"
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

    log.Println("設定の読み込みに成功しました")
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
        log.Fatal("禁止キーが検出されました")
    }

    // 構造化エラー
    var parseErr *env.ParseError
    if errors.As(err, &parseErr) {
        log.Fatalf("パースエラー %s:%d - %v",
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
        log.Fatal("必須キーが不足しています")
    }

    log.Fatalf("検証失敗: %v", err)
}
```

## 関連ドキュメント

- [定数とエラー](/ja/env/api-reference/constants) - 完全なエラーリスト
- [Config API](/ja/env/api-reference/config) - 設定制限の設定
- [セキュリティ概要](/ja/env/security/) - セキュリティエラー処理
