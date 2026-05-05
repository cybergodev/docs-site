---
title: 错误处理 - CyberGo env | 哨兵错误与恢复策略
description: CyberGo env 库错误处理模式与最佳实践完整指南，包括哨兵错误 errors.Is 检查、结构化错误类型 errors.As 提取、错误恢复与降级策略、自定义错误包装和错误链追踪，帮助 Go 开发者编写健壮的环境变量管理代码并实现优雅的错误处理与故障恢复。
---

# 错误处理

env 库提供结构化的错误处理机制，支持 `errors.Is` 和 `errors.As` 模式。

## 哨兵错误

### 文件错误

```go
var (
    ErrFileNotFound  = errors.New("file not found")
    ErrFileTooLarge  = errors.New("file exceeds maximum size limit")
)
```

**使用示例：**

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    log.Println("配置文件不存在")
}
if errors.Is(err, env.ErrFileTooLarge) {
    log.Println("配置文件过大")
}
```

### 解析错误

```go
var (
    ErrLineTooLong  = errors.New("line exceeds maximum length limit")
    ErrInvalidKey   = errors.New("invalid key format")
    ErrDuplicateKey = errors.New("duplicate key encountered")
)
```

### 安全错误

```go
var (
    ErrForbiddenKey      = errors.New("key is forbidden for security reasons")
    ErrSecurityViolation = errors.New("security policy violation")
    ErrNullByte          = errors.New("null byte detected in input")
    ErrControlChar       = errors.New("control character detected in input")
    ErrInvalidValue      = errors.New("invalid value content")
)
```

**禁止键检查：**

```go
err := loader.Set("PATH", "/malicious")
if errors.Is(err, env.ErrForbiddenKey) {
    log.Println("尝试设置禁止键")
}
```

### 展开错误

```go
var ErrExpansionDepth = errors.New("variable expansion depth exceeded")
```

### 状态错误

```go
var (
    ErrClosed             = errors.New("loader has been closed")
    ErrInvalidConfig      = errors.New("invalid configuration")
    ErrAlreadyInitialized = errors.New("default loader already initialized")
    ErrMissingRequired    = errors.New("required key is missing")
)
```

## 结构化错误类型

### ParseError

解析错误，包含位置信息：

```go
type ParseError struct {
    File    string  // 文件名
    Line    int     // 行号
    Content string  // 错误内容
    Err     error   // 原始错误
}
```

**使用示例：**

```go
err := loader.LoadFiles(".env")

var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    log.Printf("解析错误 %s:%d - %s\n",
        parseErr.File, parseErr.Line, parseErr.Err)
    // 输出: 解析错误 .env:15 - invalid key format
}
```

### FileError

文件操作错误：

```go
type FileError struct {
    Path  string  // 文件路径
    Op    string  // 操作
    Err   error   // 原始错误
    Size  int64   // 文件大小
    Limit int64   // 限制
}
```

**使用示例：**

```go
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    if fileErr.Size > 0 {
        log.Printf("文件 %s 大小 %d 超过限制 %d\n",
            fileErr.Path, fileErr.Size, fileErr.Limit)
    }
}
```

### SecurityError

安全错误：

```go
type SecurityError struct {
    Action  string  // 操作
    Reason  string  // 原因
    Key     string  // 键名
    Details string  // 详情
}
```

**使用示例：**

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    log.Printf("安全错误: %s - %s (键: %s)\n",
        secErr.Action, secErr.Reason, secErr.Key)
}
```

### ValidationError

验证错误：

```go
type ValidationError struct {
    Field   string  // 字段名
    Value   string  // 值
    Rule    string  // 规则
    Message string  // 消息
}
```

**使用示例：**

```go
var valErr *env.ValidationError
if errors.As(err, &valErr) {
    log.Printf("验证失败: 字段 %s - %s\n", valErr.Field, valErr.Message)
}
```

### ExpansionError

变量展开错误：

```go
type ExpansionError struct {
    Key   string  // 键名
    Depth int     // 当前深度
    Limit int     // 限制
    Chain string  // 展开链
}
```

**使用示例：**

```go
var expErr *env.ExpansionError
if errors.As(err, &expErr) {
    log.Printf("展开深度超限: %s (链: %s)\n", expErr.Key, expErr.Chain)
}
```

### 格式错误

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

## 错误处理模式

### errors.Is 模式

检查哨兵错误：

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // 文件不存在
    log.Println("配置文件不存在，使用默认值")

case errors.Is(err, env.ErrFileTooLarge):
    // 文件过大
    log.Fatal("配置文件过大")

case errors.Is(err, env.ErrForbiddenKey):
    // 禁止键
    log.Fatal("检测到禁止键")

case errors.Is(err, env.ErrInvalidKey):
    // 无效键格式
    log.Fatal("检测到无效键")

case err != nil:
    // 其他错误
    log.Fatalf("加载失败: %v", err)
}
```

### errors.As 模式

提取详细错误信息：

```go
err := loader.LoadFiles(".env")
if err == nil {
    return
}

// 尝试提取解析错误
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    log.Fatalf("解析错误在 %s 第 %d 行: %v",
        parseErr.File, parseErr.Line, parseErr.Err)
}

// 尝试提取文件错误
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    log.Fatalf("文件 %s 错误: %v", fileErr.Path, fileErr.Err)
}

// 尝试提取安全错误
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    log.Fatalf("安全错误: %s - %s", secErr.Action, secErr.Reason)
}

// 其他错误
log.Fatalf("未知错误: %v", err)
```

### 组合处理

```go
func handleLoadError(err error) {
    if err == nil {
        return
    }

    // 首先检查哨兵错误
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        log.Println("警告: 配置文件不存在")
        return

    case errors.Is(err, env.ErrFileTooLarge):
        var fileErr *env.FileError
        errors.As(err, &fileErr)
        log.Fatalf("文件 %s 过大 (%d > %d)",
            fileErr.Path, fileErr.Size, fileErr.Limit)
    }

    // 然后检查结构化错误
    var parseErr *env.ParseError
    if errors.As(err, &parseErr) {
        log.Fatalf("解析错误 %s:%d - %v",
            parseErr.File, parseErr.Line, parseErr.Err)
    }

    var secErr *env.SecurityError
    if errors.As(err, &secErr) {
        log.Fatalf("安全错误: %s", secErr.Reason)
    }

    // 未知错误
    log.Fatalf("错误: %v", err)
}
```

## 恢复模式

### 优雅降级

```go
func loadConfig() *Config {
    cfg := env.ProductionConfig()
    cfg.Filenames = nil
    loader, err := env.New(cfg)
    if err != nil {
        log.Printf("配置错误: %v，使用默认配置", err)
        return defaultConfig()
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        if errors.Is(err, env.ErrFileNotFound) {
            log.Println("配置文件不存在，使用默认值")
            return defaultConfig()
        }
        log.Fatalf("加载失败: %v", err)
    }

    if err := loader.Validate(); err != nil {
        log.Fatalf("验证失败: %v", err)
    }

    return parseConfig(loader)
}
```

### 重试模式

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

## 完整示例

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

    log.Println("配置加载成功")
}

func handleLoadError(err error) {
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        log.Fatal("配置文件不存在")

    case errors.Is(err, env.ErrFileTooLarge):
        var fileErr *env.FileError
        errors.As(err, &fileErr)
        log.Fatalf("文件过大: %s (%d bytes)", fileErr.Path, fileErr.Size)

    case errors.Is(err, env.ErrForbiddenKey):
        log.Fatal("检测到禁止键")
    }

    // 结构化错误
    var parseErr *env.ParseError
    if errors.As(err, &parseErr) {
        log.Fatalf("解析错误 %s:%d - %v",
            parseErr.File, parseErr.Line, parseErr.Err)
    }

    var secErr *env.SecurityError
    if errors.As(err, &secErr) {
        log.Fatalf("安全错误: %s - %s", secErr.Action, secErr.Reason)
    }

    log.Fatalf("加载失败: %v", err)
}

func handleValidationError(err error) {
    var valErr *env.ValidationError
    if errors.As(err, &valErr) {
        log.Fatalf("验证失败: %s - %s", valErr.Field, valErr.Message)
    }

    if errors.Is(err, env.ErrMissingRequired) {
        log.Fatal("缺少必需键")
    }

    log.Fatalf("验证失败: %v", err)
}
```

## 相关文档

- [常量与错误](/zh/env/api-reference/constants) - 完整错误列表
- [Config API](/zh/env/api-reference/config) - 配置限制设置
- [安全概述](/zh/env/security/) - 安全错误处理
