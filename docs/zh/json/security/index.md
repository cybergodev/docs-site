---
title: "安全概述 - CyberGo JSON | 安全最佳实践"
description: "CyberGo JSON 安全最佳实践：输入验证与清洗、MaxNestingDepthSecurity/MaxMemory 资源限制、路径遍历与 JSON 注入防御、敏感数据过滤与审计日志，保障生产安全。"
---

# 安全概述

处理 JSON 数据时的安全考虑和最佳实践。

## 常见安全风险

### 1. 资源耗尽攻击

恶意构造的 JSON 可能导致内存耗尽或 CPU 过载。

**防护措施：**

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50                       // 限制嵌套深度
cfg.MaxJSONSize = 10 * 1024 * 1024             // 限制 JSON 大小 (10MB)
cfg.MaxSecurityValidationSize = 100 * 1024 * 1024 // 增大安全验证限制到 100MB（默认 10MB）
```

### 2. 路径遍历攻击

恶意路径可能访问非预期数据。

**防护措施：**

```go
// 验证用户输入的路径
func safePath(path string) bool {
    // 禁止特殊字符
    if strings.ContainsAny(path, `<>:"|\`) {
        return false
    }
    return true
}
```

### 3. JSON 注入

恶意数据可能破坏 JSON 结构。

**防护措施：**

```go
// 始终使用库函数序列化，不要拼接字符串
data := map[string]any{
    "user": userInput, // 库会自动转义
}
bytes, _ := json.Marshal(data)
```

### 4. 敏感数据泄露

日志或错误信息可能暴露敏感数据。

**防护措施：**

```go
// 使用自定义 Hook 过滤敏感字段
type FilterFieldsHook struct {
    fields map[string]bool
}

func (h *FilterFieldsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *FilterFieldsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if m, ok := result.(map[string]any); ok {
        for field := range h.fields {
            delete(m, field)
        }
    }
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&FilterFieldsHook{fields: map[string]bool{
    "password": true,
    "token":    true,
    "secret":   true,
}})
```

## 安全配置建议

### 危险模式管理

库内置默认危险模式检测，也支持自定义模式的注册、注销和查询。

#### RegisterDangerousPattern

签名：`func RegisterDangerousPattern(pattern DangerousPattern)`

注册全局危险模式。注册后的模式将在所有使用默认安全配置的操作中生效。

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "eval-call",
    Level:   json.PatternLevelCritical,
})
```

#### UnregisterDangerousPattern

签名：`func UnregisterDangerousPattern(pattern string)`

按模式字符串注销全局危险模式。参数 `pattern` 为要注销的危险模式子字符串（对应 `DangerousPattern.Pattern` 字段）。

```go
json.UnregisterDangerousPattern("eval(")
```

#### ListDangerousPatterns

签名：`func ListDangerousPatterns() []DangerousPattern`

列出所有已注册的危险模式（包括默认模式和自定义模式）。

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("模式: %s, 名称: %s, 级别: %s\n", p.Pattern, p.Name, p.Level)
}
```

#### 危险模式级别

| 常量 | 类型 | 值 | 说明 |
|------|------|-----|------|
| `PatternLevelCritical` | `int` | `0` | 严重级别，匹配时拒绝操作 |
| `PatternLevelWarning` | `int` | `1` | 警告级别，严格模式下拒绝操作 |
| `PatternLevelInfo` | `int` | `2` | 信息级别，仅记录日志 |

::: tip
`PatternLevel` 的 `String()` 方法返回对应的字符串表示（`"critical"`、`"warning"`、`"info"`），便于日志输出。
:::

#### 禁用默认模式

通过 `Config.DisableDefaultPatterns` 可以禁用内置的默认警告级模式：

```go
cfg := json.DefaultConfig()
cfg.DisableDefaultPatterns = true // 禁用默认警告级模式
```

::: warning 注意
`DisableDefaultPatterns` 仅禁用默认的警告级（`PatternLevelWarning`）模式。严重级别（`PatternLevelCritical`）的默认模式不受影响。
:::

### 生产环境配置

```go
func ProductionConfig() json.Config {
    cfg := json.SecurityConfig()
    cfg.AddHook(&AuditHook{logger: prodLogger})
    return cfg
}
```

### 开发环境配置

```go
func DevelopmentConfig() json.Config {
    cfg := json.DefaultConfig()
    cfg.MaxNestingDepthSecurity = 100
    cfg.AddHook(json.LoggingHook(devLogger))
    return cfg
}
```

## 输入验证

### 自定义验证器

实现 `Validator` 接口（`Validate(jsonStr string) error`）进行输入验证：

```go
// 实现自定义验证器
type EmailValidator struct{}

func (v *EmailValidator) Validate(jsonStr string) error {
    // 验证 JSON 字符串内容
    var data map[string]any
    if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
        return err
    }
    email, ok := data["email"].(string)
    if !ok {
        return nil
    }
    if !strings.Contains(email, "@") {
        return errors.New("invalid email format")
    }
    return nil
}

// 使用自定义验证器
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&EmailValidator{}}
```

### Schema 验证

Schema 是结构体类型，可用于验证 JSON 结构：

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"id", "name", "email"},
    Properties: map[string]*json.Schema{
        "id":    {Type: "string", Pattern: `^[a-zA-Z0-9]+$`},
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
        "age":   {Type: "number", Minimum: 0, Maximum: 150},
    },
}
```

## 错误处理

### 安全的错误消息

```go
val, err := json.Get(data, path)
if err != nil {
    // 不要暴露内部错误细节
    return errors.New("数据格式无效")
}
```

## 审计日志

### 记录关键操作

使用 `Hook` 接口（`Before` 返回 `error`，`After` 接收 `(HookContext, any, error)` 并返回 `(any, error)`）记录审计日志：

```go
type AuditHook struct {
    logger *slog.Logger
}

func (h *AuditHook) Before(ctx json.HookContext) error {
    h.logger.Info("JSON 操作开始", "op", ctx.Operation, "path", ctx.Path)
    return nil
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("JSON 操作完成", "op", ctx.Operation)
    return result, err
}
```

## 相关

- [生产检查清单](./production-checklist)
- [Config 配置](../api-reference/config)
- [Validator](../api-reference/validator)
