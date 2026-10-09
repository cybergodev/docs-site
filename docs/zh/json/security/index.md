---
sidebar_label: "安全概述"
title: "安全概述 - CyberGo JSON | 安全最佳实践"
description: "CyberGo JSON 安全最佳实践：输入验证、MaxNestingDepthSecurity/MaxMemory 资源限制防御深嵌套与超大输入、路径遍历与 JSON 注入防御、敏感数据过滤，可用 SecurityConfig 预设一键收紧不可信输入全部限制。"
sidebar_position: 1
---

# 安全概述

处理 JSON 数据时的安全考虑和最佳实践。

## 常见安全风险

### 1. 资源耗尽攻击

恶意构造的 JSON 可能导致内存耗尽或 CPU 过载：超深嵌套（栈溢出）、超大单值（内存）、扁平超宽对象/数组（数百万键）。

**最小复现**（库默认即拦截深度嵌套与超大输入）：

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	// 5000 层深度嵌套，超过默认上限 200（DefaultMaxNestingDepth）
	deep := strings.Repeat(`{"a":`, 5000) + `1` + strings.Repeat(`}`, 5000)

	p, err := json.New(json.SecurityConfig()) // 嵌套上限收紧为 30
	if err != nil {
		panic(err)
	}
	defer p.Close()

	_, err = p.Get(deep, "a")
	fmt.Println("深嵌套被拦截:", err != nil)
	// 输出：深嵌套被拦截: true
}
```

**防护措施：**

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50                       // 限制嵌套深度
cfg.MaxJSONSize = 10 * 1024 * 1024             // 限制 JSON 大小 (10MB)
cfg.MaxObjectKeys = 5000                        // 限制单对象键数（默认 100000）
cfg.MaxArrayElements = 5000                     // 限制单数组元素数（默认 100000）
cfg.MaxSecurityValidationSize = 100 * 1024 * 1024 // 增大安全验证限制到 100MB（默认 10MB）
```

或直接使用预设 [`json.SecurityConfig()`](./production-checklist#检查清单模板)——已按不可信输入收紧全部限制。

### 2. 路径遍历攻击

恶意路径可能访问非预期数据。两类路径都有内置防护：**文件路径**（`LoadFromFile`/`SaveToFile` 等）在读取/写入时**无条件**做路径遍历、符号链接、平台限制与系统目录检查；**JSON 路径**（`Get`/`Set` 等）拒绝 `..`、URL 编码绕过、零宽字符等注入模式。

**最小复现**（两类路径均被默认拦截）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// 文件路径：先做 NFC 规范化 + 递归 URL 解码，再检测遍历模式
	_, err = p.LoadFromFile("../../../etc/passwd")
	fmt.Println("文件路径遍历被拦截:", err != nil)

	// JSON 路径：拒绝 ".."、URL 编码与零宽字符注入
	_, err = p.Get(`{"data": 1}`, "../../etc/passwd")
	fmt.Println("JSON 路径遍历被拦截:", err != nil)
	// 输出：
	// 文件路径遍历被拦截: true
	// JSON 路径遍历被拦截: true
}
```

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

应用层仍建议维护路径白名单；库内置校验负责拦截编码混淆等绕过手段。

### 3. JSON 注入

恶意数据可能破坏 JSON 结构，或把 `<script>`、`__proto__` 等载荷带入下游系统。库默认对所有输入做危险模式扫描（大小写不敏感 + 词边界上下文检查），命中即拒绝。

**最小复现**（默认拦截，无需配置）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	payloads := []string{
		`{"name": "Alice", "bio": "<script>alert(1)</script>"}`, // XSS
		`{"__proto__": {"isAdmin": true}}`,                      // 原型污染
	}
	for i, in := range payloads {
		_, err := p.Get(in, ".")
		fmt.Printf("载荷 %d 被拦截: %v\n", i+1, err != nil)
	}
	// 输出：
	// 载荷 1 被拦截: true
	// 载荷 2 被拦截: true
}
```

完整内置模式清单见[安全模式](./security-mode#内置危险模式)。

**防护措施：**

```go
// 始终使用库函数序列化，不要拼接字符串
data := map[string]any{
    "user": userInput, // 库会自动转义
}
bytes, _ := json.Marshal(data)
```

### 4. 敏感数据泄露

日志或错误信息可能暴露敏感数据。库内置两层防线：**结果含敏感模式（`password`、`token`、`api_key`、`ssn`、`aws_secret` 等）时不写入操作缓存**，避免敏感数据在缓存中长期驻留；`HookContext.JSONStr` 的文档注释也明确警告不要记录原始输入。

**防护措施**（用 Hook 在返回前删除敏感字段）：

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

可运行的完整落地代码见[生产检查清单·敏感数据处理](./production-checklist#敏感数据处理)。

## 安全配置建议

### 安全相关 Config 字段总览

这些限制不设独立的汇总类型，直接以 `Config` 字段提供。各字段在两种常用配置下的取值：

| Config 字段 | `DefaultConfig()` 默认 | `SecurityConfig()` 预设 | 触发的错误 |
|------------|------------------------|--------------------------|------------|
| `MaxJSONSize` | 100MB（`DefaultMaxJSONSize`） | 10MB | `ErrSizeLimit` |
| `MaxNestingDepthSecurity` | 200（`DefaultMaxNestingDepth`） | 30 | `ErrDepthLimit` |
| `MaxPathDepth` | 50（`DefaultMaxPathDepth`） | 30 | `ErrInvalidPath` |
| `MaxBatchSize` | 2000（`DefaultMaxBatchSize`） | 2000 | `ErrSizeLimit` |
| `MaxObjectKeys` | 100000（`DefaultMaxObjectKeys`） | 5000 | `ErrSizeLimit` |
| `MaxArrayElements` | 100000（`DefaultMaxArrayElements`） | 5000 | `ErrSizeLimit` |
| `MaxSecurityValidationSize` | 10MB（`DefaultMaxSecuritySize`） | 10MB | ——（阈值型） |
| `FullSecurityScan` | `false`（分层优化扫描） | `true`（全量扫描） | —— |

`Config.Validate` 会把越界值钳制回合法区间（如 `MaxNestingDepthSecurity` 钳至 10–200、`MaxObjectKeys` 钳至 100–100000），可用 `ValidateWithWarnings` 查看调整明细。

### 危险模式管理

库内置默认危险模式检测，也支持自定义模式的注册、注销和查询。

自定义模式统一用 `DangerousPattern` 结构体表达：

```go
type DangerousPattern struct {
    Pattern string       // 要在输入中检测的子字符串
    Name    string       // 模式的描述性名称
    Level   PatternLevel // 严重级别
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `Pattern` | `string` | 要在输入中检测的子字符串（匹配大小写不敏感） |
| `Name` | `string` | 人类可读的风险描述（用于日志与审计） |
| `Level` | `PatternLevel` | 严重级别，取值见下方级别表（当前仅作语义标注） |

#### RegisterDangerousPattern

签名：`func RegisterDangerousPattern(pattern DangerousPattern)`

注册全局危险模式。全局注册表中的模式对**所有 Processor 实例**生效（包括已创建的实例——扫描时实时读取注册表），在默认模式之外叠加检查。

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

列出**全局注册的自定义模式**（不含内置默认模式——内置模式始终生效、无需注册）。

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("模式: %s, 名称: %s, 级别: %s\n", p.Pattern, p.Name, p.Level)
}
```

#### 危险模式级别

| 常量 | 类型 | 值 | 说明 |
|------|------|-----|------|
| `PatternLevelCritical` | `PatternLevel` | `0` | 严重级别，语义上始终拦截 |
| `PatternLevelWarning` | `PatternLevel` | `1` | 警告级别，语义上严格模式拦截 |
| `PatternLevelInfo` | `PatternLevel` | `2` | 信息级别，语义上仅记录 |

::: warning 级别的实际拦截行为
当前实现的模式扫描对**任何命中**（通过词边界上下文检查）都会拒绝操作，`Level` 字段暂不改变拦截行为，仅作语义标注（供审计与日志区分严重度）。详见[安全模式·PatternLevel 行为矩阵](./security-mode#patternlevel-行为矩阵)。
:::

::: tip
`PatternLevel` 的 `String()` 方法返回对应的字符串表示（`"critical"`、`"warning"`、`"info"`），便于日志输出。
:::

#### 禁用默认模式

通过 `Config.DisableDefaultPatterns` 可以禁用内置的默认模式：

```go
cfg := json.DefaultConfig()
cfg.DisableDefaultPatterns = true // 禁用内置默认模式
```

::: warning 注意
`DisableDefaultPatterns=true` 时，除 3 个关键模式（`__proto__`、`constructor[`、`prototype.`，始终强制扫描）外，其余内置模式将被禁用。注意：内置模式全部为 Critical 级别。
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
- [Schema 校验](../api-reference/schema)
