---
title: "安全模式 - CyberGo JSON | API 参考"
description: "CyberGo JSON 安全 API 完整参考：包括安全配置、AddDangerousPattern 危险模式配置和输入验证机制，防御 JSON 注入、深度嵌套攻击和资源耗尽等安全威胁，支持自定义安全策略与防护规则配置，保障 Go 应用安全。"
---

# 安全模式

安全模式提供危险模式检测功能，防止 JSON 注入攻击、原型污染和其他安全威胁。

## DangerousPattern 结构体

DangerousPattern 表示一个安全风险模式。它是一个结构体类型。

```go
type DangerousPattern struct {
    Pattern string       // 要在输入中检测的子字符串
    Name    string       // 模式的描述性名称
    Level   PatternLevel // 确定如何处理该模式的严重级别
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `Pattern` | `string` | 要在输入中检测的子字符串 |
| `Name` | `string` | 模式的描述性名称 |
| `Level` | `PatternLevel` | 确定如何处理该模式的严重级别 |

---

## PatternLevel 类型

PatternLevel 表示危险模式的严重级别。

```go
type PatternLevel int
```

### 常量

```go
const (
    // PatternLevelCritical 始终阻止操作
    // 用于立即构成安全风险的模式（如原型污染）
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning 在严格模式下阻止，在宽松模式下记录警告
    // 用于可能表明恶意意图但有合法用途的模式
    PatternLevelWarning

    // PatternLevelInfo 仅记录，从不阻止
    // 用于审计/跟踪目的，不中断操作
    PatternLevelInfo
)
```

### String 方法

```go
func (pl PatternLevel) String() string
```

返回 PatternLevel 的字符串表示。

---

## 内置危险模式

### 默认模式

::: warning 内部 API
内置模式列表由内部函数管理，不再作为公开 API 导出。可通过 Config 的 `AdditionalDangerousPatterns` 字段管理自定义模式。
:::

以下是内置危险模式列表，全部为 Critical 级别：

| 模式 | 名称 | 类别 |
|------|------|------|
| `__proto__` | prototype pollution | 原型污染 |
| `constructor[` | constructor access | 构造器访问 |
| `prototype.` | prototype manipulation | 原型操作 |
| `<script` | script tag injection | HTML 注入 |
| `<iframe` | iframe injection | HTML 注入 |
| `<object` | object injection | HTML 注入 |
| `<embed` | embed injection | HTML 注入 |
| `<svg` | svg injection | HTML 注入 |
| `javascript:` | javascript protocol | 协议注入 |
| `vbscript:` | vbscript protocol | 协议注入 |
| `eval(` | dynamic code execution | 代码执行 |
| `setTimeout(` | timer manipulation | 代码执行 |
| `setInterval(` | interval manipulation | 代码执行 |
| `require(` | code injection | 代码执行 |
| `new function(` | dynamic function creation | 代码执行 |
| `document.cookie` | cookie access | DOM 访问 |
| `window.location` | redirect manipulation | DOM 访问 |
| `innerhtml` | DOM manipulation | DOM 访问 |
| `onerror`, `onload`, `onclick`, `onmouseover`, `onfocus` | event handler injection | 事件处理器 |
| `fromcharcode(` | character encoding bypass | 编码绕过 |
| `atob(` | base64 decoding | 编码绕过 |
| `expression(` | CSS expression injection | CSS 注入 |
| `__defineGetter__` | getter definition | 原型污染 |
| `__defineSetter__` | setter definition | 原型污染 |

### 关键模式

::: warning 内部 API
`GetCriticalPatterns` 已转为内部函数，不再作为公开 API 导出。关键模式（`__proto__`、`constructor[`、`prototype.`）始终强制检查，无法禁用。
:::

以下关键模式始终完全扫描，无论 JSON 大小如何：

| 模式 | 说明 |
|------|------|
| `__proto__` | prototype pollution |
| `constructor[` | constructor access |
| `prototype.` | prototype manipulation |

---

## 模式注册方法

危险模式通过 `Config` 结构体进行配置，而不是全局注册函数。

### Config.AddDangerousPattern

签名：`func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

添加自定义危险模式到配置中。

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "自定义危险模式",
    Level:   json.PatternLevelCritical,
})

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Config.AdditionalDangerousPatterns

也可以直接设置 `Config.AdditionalDangerousPatterns` 字段：

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "eval(", Name: "eval-call", Level: json.PatternLevelCritical},
    {Pattern: "exec(", Name: "exec-call", Level: json.PatternLevelWarning},
}
```

---

## Config 配置方法

### AddDangerousPattern

向配置中添加安全模式。

```go
func (c *Config) AddDangerousPattern(pattern DangerousPattern)
```

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "custom_dangerous_string",
    Name:    "自定义危险字符串",
    Level:   json.PatternLevelWarning,
})
```

### 配置字段

```go
type Config struct {
    // ... 其他字段 ...

    // AdditionalDangerousPatterns 添加除默认模式外的安全模式
    AdditionalDangerousPatterns []DangerousPattern

    // DisableDefaultPatterns 禁用内置警告级别安全模式
    // 设为 true 则仅使用 AdditionalDangerousPatterns
    // 注意：关键模式（__proto__、constructor[、prototype.）始终强制执行，无法禁用
    DisableDefaultPatterns bool
}
```

---

## 全局模式注册

除了通过 `Config` 配置实例级模式外，还可以通过包级函数管理全局模式注册表。全局注册表中的模式在所有 Processor 实例中生效。

### RegisterDangerousPattern

签名：`func RegisterDangerousPattern(pattern DangerousPattern)`

向全局注册表添加自定义危险模式。注册的模式在所有 Processor 实例中生效。

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "自定义危险模式",
    Level:   json.PatternLevelCritical,
})
```

### UnregisterDangerousPattern

签名：`func UnregisterDangerousPattern(pattern string)`

从全局注册表中移除指定模式。

```go
json.UnregisterDangerousPattern("malicious_keyword")
```

### ListDangerousPatterns

签名：`func ListDangerousPatterns() []DangerousPattern`

返回全局注册表中所有自定义模式。

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("模式: %s, 名称: %s, 级别: %s\n", p.Pattern, p.Name, p.Level)
}
```

::: tip 全局模式 vs Config 模式
- **全局模式**（`RegisterDangerousPattern`）：所有 Processor 实例共享，适合应用级安全策略
- **Config 模式**（`Config.AddDangerousPattern`）：仅影响使用该 Config 的 Processor，适合实例级定制
:::

---

## 完整示例

### 自定义安全策略

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    // 方式一：通过配置字段
    cfg := json.DefaultConfig()
    cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
        {Pattern: "company_secret", Name: "公司敏感信息", Level: json.PatternLevelCritical},
    }

    // 方式二：通过配置方法
    cfg.AddDangerousPattern(json.DangerousPattern{
        Pattern: "internal_api",
        Name:    "内部 API 引用",
        Level:   json.PatternLevelWarning,
    })

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 测试危险模式检测
    _, err = p.Get(`{"data": "company_secret_info"}`, "data")
    if err != nil {
        fmt.Println("检测到危险模式:", err)
    }

    // 查看已注册的模式
    fmt.Printf("自定义模式数量: %d\n", len(cfg.AdditionalDangerousPatterns))
}
```

### 禁用默认模式

```go
cfg := json.DefaultConfig()

// 禁用内置警告级别模式，仅使用自定义模式
// 注意：关键模式（__proto__、constructor[、prototype.）始终强制执行
cfg.DisableDefaultPatterns = true

// 添加自定义模式
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "xss_payload",
    Name:    "XSS 攻击载荷",
    Level:   json.PatternLevelCritical,
})

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

### 按级别处理模式

```go
// 注册不同级别的模式
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "suspicious_but_allowed",
    Name:    "可疑但允许",
    Level:   json.PatternLevelInfo, // 仅记录，不阻止
})

// 查看已注册的自定义模式
for _, p := range cfg.AdditionalDangerousPatterns {
    fmt.Printf("模式: %s, 名称: %s, 级别: %s\n", p.Pattern, p.Name, p.Level)
}
```

---

## 安全扫描策略

### 小 JSON（< 4KB）

始终进行完整的安全扫描。

### 中等 JSON（>= 4KB）

使用 32KB 滚动窗口扫描，确保不遗漏跨边界的模式。

### 大 JSON

- 关键模式始终完全扫描
- 其他模式使用采样策略
- 检查可疑字符密度

---

## 相关

- [Config](./config) - 配置选项
- [Validator](./validator) - 验证器
- [Hook 钩子系统](./hooks) - 操作拦截
