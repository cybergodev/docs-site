---
title: "错误处理 - CyberGo JSON | 最佳实践"
description: "CyberGo JSON 错误处理最佳实践：涵盖 JsonsError 结构化错误类型判断、errors.Is/As 错误匹配、标准错误变量、恢复策略、SafeError 安全输出和 RedactedPath 路径脱敏日志记录，构建健壮异常处理机制。"
---

# 错误处理

正确处理 JSON 操作中的错误。

## 错误类型

### 标准错误

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
    ErrConcurrencyLimit   = errors.New("concurrency limit exceeded") // Deprecated
    ErrUnsupportedPath    = errors.New("unsupported path operation")
    ErrOperationTimeout   = errors.New("operation timeout")           // Deprecated
    ErrResourceExhausted  = errors.New("system resources exhausted")  // Deprecated
)
```

### 错误检查

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // 路径不存在
        return defaultName
    }
    if errors.Is(err, json.ErrTypeMismatch) {
        // 类型不匹配
        return "", fmt.Errorf("字段类型错误: %w", err)
    }
    return "", err
}
```

## JsonsError

### 结构

`JsonsError` 是库的主要错误类型，包含操作上下文信息：

```go
type JsonsError struct {
    Op      string `json:"op"`      // 操作类型: "get", "set", "delete", "marshal" 等
    Path    string `json:"path"`    // JSON 路径（如有）
    Message string `json:"message"` // 人类可读的错误消息
    Err     error  `json:"err"`     // 底层错误
}

func (e *JsonsError) Error() string
func (e *JsonsError) Unwrap() error
func (e *JsonsError) Is(target error) bool
```

### 使用

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // 使用 errors.Is 检查错误类型
    if errors.Is(err, json.ErrPathNotFound) {
        // 路径不存在
    }
    if errors.Is(err, json.ErrTypeMismatch) {
        // 类型不匹配
    }

    // 使用 errors.As 获取详细上下文
    var jsonErr *json.JsonsError
    if errors.As(err, &jsonErr) {
        fmt.Printf("操作: %s\n", jsonErr.Op)
        fmt.Printf("路径: %s\n", jsonErr.Path)
        fmt.Printf("消息: %s\n", jsonErr.Message)
    }
}
```

## 错误处理模式

### 提供默认值

```go
// 类型安全获取函数内置默认值支持
name := json.GetString(data, "user.name", "匿名")
age := json.GetInt(data, "user.age", 0)
active := json.GetBool(data, "user.active", false)
```

### 收集多个错误

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

// 使用
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

### 错误包装

```go
val, err := json.Get(data, "config.api_key")
if err != nil {
    return fmt.Errorf("读取 API 密钥失败: %w", err)
}
```

## 自定义错误

### 业务错误

```go
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("验证失败 %s: %s", e.Field, e.Message)
}

// 使用
func validateUser(data string) error {
    name := json.GetString(data, "name")
    if name == "" {
        return &ValidationError{Field: "name", Message: "必填"}
    }
    if len(name) < 2 {
        return &ValidationError{Field: "name", Message: "长度至少2个字符"}
    }
    return nil
}
```

## 日志记录

### 结构化日志

```go
val, err := json.Get(data, path)
if err != nil {
    log.Error("JSON 操作失败",
        "path", path,
        "error", err,
        "error_type", fmt.Sprintf("%T", err),
    )
    return err
}
```

### 审计日志

```go
func auditLog(op string, path string, err error) {
    if err != nil {
        log.Warn("操作失败",
            "operation", op,
            "path", path,
            "error", err,
        )
    } else {
        log.Info("操作成功",
            "operation", op,
            "path", path,
        )
    }
}
```

## 恢复策略

### SafeError 安全输出

`SafeError` 返回客户端安全的错误消息，去除内部上下文信息：

```go
// Signature: func SafeError(err error) string

val, err := json.Get(untrustedInput, "data")
if err != nil {
    // SafeError strips internal details like paths and operation context
    safeMsg := json.SafeError(err)
    http.Error(w, safeMsg, http.StatusBadRequest)
    return
}
```

### 重试

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

// 使用
err := withRetry(func() error {
    return processData(data)
}, 3)
```

### 降级

```go
func getConfig(data string) Config {
    cfg := DefaultConfig()

    // 使用类型安全获取函数，内置默认值
    strict := json.GetBool(data, "config.strict", true)

    return cfg
}
```

## 错误分类

### 用户输入错误

由用户提供的 JSON 数据或路径引起：

```go
val, err := json.Get(data, "user.name")
if err != nil {
    switch {
    case errors.Is(err, json.ErrInvalidJSON):
        // JSON 格式错误
        return fmt.Errorf("数据格式错误: %w", err)
    case errors.Is(err, json.ErrPathNotFound):
        // 路径不存在
        return fmt.Errorf("字段不存在: %w", err)
    case errors.Is(err, json.ErrTypeMismatch):
        // 类型不匹配
        return fmt.Errorf("类型错误: %w", err)
    case errors.Is(err, json.ErrInvalidPath):
        // 路径语法错误
        return fmt.Errorf("路径语法错误: %w", err)
    case errors.Is(err, json.ErrUnsupportedPath):
        // 不支持的路径操作
        return fmt.Errorf("不支持的操作: %w", err)
    }
}
```

### 安全相关错误

检测到潜在的安全威胁：

```go
val, err := json.Get(untrustedInput, "data")
if err != nil {
    if errors.Is(err, json.ErrSecurityViolation) {
        // 安全违规，记录并拒绝
        log.Warn("安全违规", "error", err)
        return errors.New("输入不合法")
    }
    if errors.Is(err, json.ErrSizeLimit) {
        return fmt.Errorf("数据超过大小限制: %w", err)
    }
    if errors.Is(err, json.ErrDepthLimit) {
        return fmt.Errorf("嵌套深度超限: %w", err)
    }
    return err
}
```

### 系统错误

系统级别的暂时性错误：

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrOperationTimeout) {
        // 操作超时，可重试 <Badge type="danger" text="已废弃" />
        return fmt.Errorf("暂时性错误，请重试: %w", err)
    }
    if errors.Is(err, json.ErrConcurrencyLimit) {
        // 并发限制 <Badge type="danger" text="已废弃" />
        return fmt.Errorf("系统繁忙，请稍后: %w", err)
    }
    if errors.Is(err, json.ErrResourceExhausted) {
        // 资源耗尽 <Badge type="danger" text="已废弃" />
        return fmt.Errorf("系统资源不足: %w", err)
    }
    if errors.Is(err, json.ErrProcessorClosed) {
        // 处理器已关闭
        return fmt.Errorf("处理器不可用: %w", err)
    }
    return err
}
```

## 错误处理最佳实践

### 1. 区分错误类型

```go
func processJSON(data string) error {
    val, err := json.Get(data, "user.name")
    if err != nil {
        // 使用 errors.Is 区分错误类型
        switch {
        case errors.Is(err, json.ErrInvalidJSON),
            errors.Is(err, json.ErrPathNotFound),
            errors.Is(err, json.ErrTypeMismatch),
            errors.Is(err, json.ErrInvalidPath):
            // 用户输入错误，返回友好提示
            return fmt.Errorf("数据格式错误: %w", err)
        case errors.Is(err, json.ErrSecurityViolation):
            // 安全错误，记录并拒绝
            log.Warn("安全违规", "error", err)
            return errors.New("输入不合法")
        case errors.Is(err, json.ErrOperationTimeout),          // Deprecated
            errors.Is(err, json.ErrConcurrencyLimit): // Deprecated
            // 可重试错误（这些错误当前不会被库返回，保留用于兼容）
            return fmt.Errorf("暂时性错误，请重试: %w", err)
        default:
            // 系统错误
            log.Error("系统错误", "error", err)
            return errors.New("内部错误")
        }
    }
    return nil
}
```

### 2. 使用 errors.As 获取上下文

```go
func handleWithDetail(data string, path string) error {
    val, err := json.Get(data, path)
    if err != nil {
        var jsonErr *json.JsonsError
        if errors.As(err, &jsonErr) {
            return fmt.Errorf("操作 %s 失败 (路径: %s): %w",
                jsonErr.Op, jsonErr.Path, jsonErr.Err)
        }
        return fmt.Errorf("操作失败: %w", err)
    }
    return nil
}
```

### 3. 错误链追踪

```go
func deepProcess(data string) error {
    if err := processLevel1(data); err != nil {
        return fmt.Errorf("深度处理失败: %w", err)
    }
    return nil
}

func processLevel1(data string) error {
    if err := processLevel2(data); err != nil {
        return fmt.Errorf("一级处理失败 (路径 data.field): %w", err)
    }
    return nil
}

func processLevel2(data string) error {
    _, err := json.Get(data, "data.field")
    return err
}

// 错误链示例:
// 深度处理失败: 一级处理失败 (路径 data.field): path not found
```

## 相关

- [常量与错误](../api-reference/constants)
- [安全概述](../security/)
- [性能优化](./performance)
