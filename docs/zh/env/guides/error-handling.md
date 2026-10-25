---
sidebar_label: "错误处理"
title: "错误处理 - CyberGo env | 哨兵错误与恢复策略"
description: "CyberGo env 错误处理指南：哨兵错误用 errors.Is 精确匹配，ParseError、FileError、SecurityError 等结构化错误用 errors.As 提取上下文，附恢复降级策略、错误分类对照表与生产环境实践。"
sidebar_position: 5
---

# 错误处理

env 的错误体系分两层：哨兵错误用 `errors.Is` 匹配，结构化错误类型用 `errors.As` 提取上下文。

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

// 检查必需键是否缺失：errors.Is 匹配 ErrMissingRequired，
// errors.As 可拿到 *ValidationError（Rule=="required"）里的缺失键列表
if errors.Is(err, env.ErrMissingRequired) {
    var valErr *env.ValidationError
    if errors.As(err, &valErr) {
        // valErr.Message 含缺失键列表
    }
}
```

### 适配器错误

```go
var ErrValidateRequiredUnsupported = errors.New(
    "custom validator does not implement ValidateRequired; " +
    "implement Validator interface for required key validation",
)
```

当自定义验证器只实现了 `KeyValidator` 接口、未实现完整的 `Validator` 接口时，调用 `ValidateRequired` 返回此错误。

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

### 用 errors.Is 匹配哨兵错误

`errors.Is` 只判断类别，适合在 `switch` 里分流 `ErrFileNotFound`、`ErrFileTooLarge`、`ErrSecurityViolation` 等哨兵。完整分支写法见[组合处理](#组合处理)。

### 查看结构化错误字段

`errors.As` 逐类尝试，命中后即可读取该类型的字段（`*ParseError` 取文件与行号、`*FileError` 取路径与大小、`*SecurityError` 取动作与原因）。与哨兵分支合并的完整写法见[组合处理](#组合处理)，各类字段清单见[错误类型完整对照](#错误类型完整对照)。

### 组合处理

先用哨兵错误分流，需要细节时再用 `errors.As` 取结构化字段：

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

    case errors.Is(err, env.ErrSecurityViolation):
        log.Fatal("检测到禁止键")
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

    // 键格式非法（实际返回 *ValidationError，Field=="key"）
    var valErr *env.ValidationError
    if errors.As(err, &valErr) && valErr.Field == "key" {
        log.Fatalf("检测到无效键: %s", valErr.Message)
    }

    // 未知错误
    log.Fatalf("错误: %v", err)
}
```

## 恢复模式

### 降级到默认配置

配置文件缺失时使用内置默认值，其余错误仍然致命。下例关闭了 `Filenames` 的自动加载，改由 `LoadFiles` 显式加载并单独处理 `ErrFileNotFound`：

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
`ProductionConfig` 默认启用审计（`AuditEnabled=true`）。未配置 `AuditHandler` 时，事件以 `[AUDIT]` 前缀写入 stderr；需要落盘时显式设置 `cfg.AuditHandler`。配置方式见[审计日志](./audit-logging)，落盘检查见[生产检查清单](../security/production-checklist)。
:::

### 重试模式

`LoadFiles` 默认（`FailOnMissingFile=false`）对缺失文件**静默跳过**，此时 `ErrFileNotFound` 分支不可达。要重试缺失文件，必须先把 `FailOnMissingFile` 设为 `true`（`ProductionConfig` 预设已开启）：

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

上例的退避是线性的（第 i 次重试等待 i+1 秒），且只对 `ErrFileNotFound` 重试；文件过大、解析失败等错误立即返回。

## 完整示例

下面把前面的片段组装成一个可运行程序；`handleLoadError` 只保留程序所需的两个分支，完整分流见[组合处理](#组合处理)。

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

// 完整分流（哨兵 + 结构化错误）见「组合处理」一节；
// 此处只保留程序运行所需的最小分支。
func handleLoadError(err error) {
	switch {
	case errors.Is(err, env.ErrFileNotFound):
		log.Fatal("配置文件不存在")

	case errors.Is(err, env.ErrFileTooLarge):
		var fileErr *env.FileError
		errors.As(err, &fileErr)
		log.Fatalf("文件过大: %s (%d bytes)", fileErr.Path, fileErr.Size)
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

`errors.As` 可提取全部结构化错误类型，用类型断言拿到各自字段：

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

`ExpansionError` 的 `Kind` 字段区分两类失败：

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
| `ErrNotInitialized` | 包级函数在默认加载器未初始化时调用（`Set`/`Delete`/`Validate`/`ParseInto`） |
| `ErrAlreadyInitialized` | 默认加载器已初始化，重复调用 `Load()` |
| `ErrDuplicateKey` | 同一文档内出现重复键（`DuplicateKeyPolicy = DuplicateKeyError`），或 YAML/JSON 的两个不同路径扁平化后撞到同一个键名 |

### 判断辅助函数

`IsMarshalError(err)` 用 `errors.As` 判断错误是否为 `*MarshalError`，无需手动断言。

## 相关文档

- [常量与错误](../api-reference/constants) - 完整错误列表
- [Config API](../api-reference/config) - 配置限制设置
- [安全概述](../security/) - 安全错误处理
