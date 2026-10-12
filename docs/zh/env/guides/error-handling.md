---
sidebar_label: "错误处理"
title: "错误处理 - CyberGo env | 哨兵错误与恢复策略"
description: "CyberGo env 错误处理指南，详解 16 个哨兵错误的 errors.Is 精确匹配、ParseError/FileError/SecurityError 等结构化错误的 errors.As 上下文提取、恢复降级策略与错误链 Unwrap 追踪，附生产环境错误分类实践。"
sidebar_position: 5
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
    ErrInvalidValue      = errors.New("invalid value content")
)
```

**禁止键检查（实际返回 `*SecurityError`，匹配 `ErrSecurityViolation`）：**

```go
err := loader.Set("PATH", "/malicious")
if errors.Is(err, env.ErrSecurityViolation) {
    log.Println("尝试设置禁止键")
}
```

### 展开错误

```go
var ErrExpansionDepth = errors.New("variable expansion depth exceeded")
```

### 限制错误

```go
var ErrMaxVariables = errors.New("maximum number of variables exceeded")
```

### 状态错误

```go
var (
    ErrClosed             = errors.New("loader has been closed")
    ErrInvalidConfig      = errors.New("invalid configuration")
    ErrAlreadyInitialized = errors.New("default loader already initialized")
    ErrNotInitialized     = errors.New("default loader not initialized; call Load() first")
    ErrMissingRequired    = errors.New("required key is missing")
)
```

**检查方式：**

```go
// 检查加载器是否已关闭
if errors.Is(err, env.ErrClosed) {
    // 加载器已关闭
}

// 检查默认加载器是否已初始化
if errors.Is(err, env.ErrAlreadyInitialized) {
    // 默认加载器已存在，无法重复调用 Load()
}

// 检查默认加载器是否未初始化
if errors.Is(err, env.ErrNotInitialized) {
    // 需要先调用 env.Load() 或 env.LoadWithConfig()
}

// 检查必需键是否缺失（实际返回 *ValidationError，Rule=="required"）
var valErr *env.ValidationError
if errors.As(err, &valErr) && valErr.Rule == "required" {
    // 缺少必需键：valErr.Message 含缺失键列表
}
```

### 适配器错误

```go
var ErrValidateRequiredUnsupported = errors.New(
    "custom validator does not implement ValidateRequired; " +
    "implement Validator interface for required key validation",
)
```

当自定义验证器仅实现 `KeyValidator` 接口而未实现完整 `Validator` 接口时，调用 `ValidateRequired` 会返回此错误。

**检查方式：**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // 自定义验证器不支持必需键验证
    // 需要实现完整的 Validator 接口
}
```

::: tip 解决方法
实现 `Validator` 接口（包含 ValidateKey、ValidateValue、ValidateRequired 三个方法）而非仅实现 `KeyValidator`。
:::

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
    // 输出：解析错误 .env:15 - invalid key format
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
    Key   string             // 键名
    Depth int                // 当前深度
    Limit int                // 限制
    Chain string             // 展开链
    Kind  ExpansionErrorKind // 错误原因类别（零值 = 深度/循环）
}
```

**使用示例：**

```go
var expErr *env.ExpansionError
if errors.As(err, &expErr) {
    log.Printf("展开深度超限: %s (链: %s)\n", expErr.Key, expErr.Chain)
}
```

### JSONError

JSON 解析错误：

```go
type JSONError struct {
    Path    string  // JSON 文档内路径（出错位置）
    Message string  // 错误消息
    Err     error   // 原始错误
}
```

**使用示例：**

```go
var jsonErr *env.JSONError
if errors.As(err, &jsonErr) {
    log.Printf("JSON 错误 %s: %s\n", jsonErr.Path, jsonErr.Message)
}
```

### YAMLError

YAML 解析错误：

```go
type YAMLError struct {
    Path    string  // YAML 文档内路径（出错位置）
    Line    int     // 行号
    Column  int     // 列号
    Message string  // 错误消息
    Err     error   // 原始错误
}
```

**使用示例：**

```go
var yamlErr *env.YAMLError
if errors.As(err, &yamlErr) {
    log.Printf("YAML 错误 %s:%d:%d - %s\n",
        yamlErr.Path, yamlErr.Line, yamlErr.Column, yamlErr.Message)
}
```

### MarshalError

序列化/反序列化错误：

```go
type MarshalError struct {
    Field   string  // 字段名
    Message string  // 错误消息
}
```

**使用示例：**

```go
_, err := env.MarshalStruct(invalidData)
if err != nil && env.IsMarshalError(err) {
    var marshalErr *env.MarshalError
    if errors.As(err, &marshalErr) {
        log.Printf("序列化错误: 字段 %s - %s\n", marshalErr.Field, marshalErr.Message)
    }
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

case errors.Is(err, env.ErrSecurityViolation):
    // 禁止键（实际返回 *SecurityError）
    log.Fatal("检测到禁止键")

case err != nil:
    // 其他错误
    log.Fatalf("加载失败: %v", err)
}

// 键格式非法（实际返回 *ValidationError，Field=="key"）
var valErr *env.ValidationError
if errors.As(err, &valErr) && valErr.Field == "key" {
    log.Fatalf("检测到无效键: %s", valErr.Message)
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
        log.Println("警告：配置文件不存在")
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

::: tip 关于 ProductionConfig 的审计行为
`ProductionConfig` 默认启用审计（`AuditEnabled=true`），未配置 `AuditHandler` 时审计日志会以 `[AUDIT]` 前缀写入 stderr；如需落盘，请显式设置 `cfg.AuditHandler`（例如 `env.NewJSONAuditHandler(file)`）。
:::

### 重试模式

```go
func loadWithRetry(filenames []string, maxRetries int) error {
    cfg := env.DefaultConfig()
    cfg.Filenames = nil
    cfg.FailOnMissingFile = true // 缺失文件返回 ErrFileNotFound，而非静默跳过
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

触发条件说明：`LoadFiles` 默认（`FailOnMissingFile=false`）对缺失文件**静默跳过**，上例的 `ErrFileNotFound` 分支只有在 `FailOnMissingFile=true` 时才可达（`ProductionConfig` 预设默认开启该项）。

## 完整示例

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

	case errors.Is(err, env.ErrSecurityViolation):
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
		if valErr.Rule == "required" {
			// 缺少必需键：valErr.Message 含缺失键列表
			log.Fatalf("缺少必需键: %s", valErr.Message)
		}
		log.Fatalf("验证失败: %s - %s", valErr.Field, valErr.Message)
	}

	log.Fatalf("验证失败: %v", err)
}
```

## 错误类型完整对照

库的结构化错误类型均可用 `errors.As` 提取上下文：

| 类型 | 场景 | 关键信息 |
|------|------|----------|
| `ParseError` | 文件解析失败 | 文件名、行号、内容（已脱敏） |
| `ValidationError` | 配置/键值校验失败 | 字段、规则、消息 |
| `SecurityError` | 安全策略违规（禁止键、路径校验等） | 违规详情 |
| `FileError` | 文件操作失败 | 路径、操作、大小/上限 |
| `ExpansionError` | 变量展开失败 | `Kind`（失败原因分类） |
| `JSONError` | JSON 解析失败 | 位置信息 |
| `YAMLError` | YAML 解析失败 | 位置信息 |
| `MarshalError` | 序列化/反序列化失败 | 操作与原因 |

### ExpansionErrorKind

`ExpansionError` 通过 `Kind` 字段区分两类失败，便于精确处理：

| 常量 | 含义 |
|------|------|
| `ExpansionDepthKind` | 超出递归深度上限或检测到循环引用 |
| `ExpansionRequiredKind` | `${VAR:?message}` 引用的变量未设置 |

### 补充哨兵错误

除[哨兵错误](#哨兵错误)一节列出的常用项外，还有：

| 哨兵 | 含义 |
|------|------|
| `ErrClosed` | Loader 已关闭（或为 nil）后继续操作 |
| `ErrInvalidConfig` | 配置无效，`New()` 返回时会包裹具体的校验错误 |
| `ErrNotInitialized` | 全局模式下未先调用 `Load()` 即使用写入类函数 |
| `ErrAlreadyInitialized` | 默认 Loader 已初始化，重复调用 `Load()` |
| `ErrDuplicateKey` | 保留字段：当前重复键在 `OverwriteExisting=false` 时静默跳过，暂无代码路径返回 |

### 判断辅助函数

`IsMarshalError(err)` 用 `errors.As` 判断错误是否为 `*MarshalError`，无需手动断言。

## 相关文档

- [常量与错误](../api-reference/constants) - 完整错误列表
- [Config API](../api-reference/config) - 配置限制设置
- [安全概述](../security/) - 安全错误处理
