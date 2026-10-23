---
sidebar_label: "安全模式"
title: "安全模式 - CyberGo JSON | 危险模式检测与防护"
description: "CyberGo JSON 安全模式指南：安全配置、AddDangerousPattern 注册自定义危险模式、PatternLevel 三级严重度与内置危险模式，配合输入验证防御 JSON 注入、原型污染与 XSS 等威胁，命中即拒绝且匹配大小写不敏感。"
sidebar_position: 20
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

返回 PatternLevel 的字符串表示（`"critical"`、`"warning"`、`"info"`、未知值返回 `"unknown"`）。

### PatternLevel 行为矩阵

| 级别 | 语义意图（接口文档） | 当前实现的实际行为 |
|------|----------------------|--------------------|
| `PatternLevelCritical` | 始终阻止操作 | 命中即拒绝（`ErrSecurityViolation`） |
| `PatternLevelWarning` | 严格模式下阻止，宽松模式记录警告 | **同样命中即拒绝**——`StrictMode` 字段已废弃、不被任何解析器读取，不参与模式拦截决策 |
| `PatternLevelInfo` | 仅记录，从不阻止 | **同样命中即拒绝** |

::: warning 请按「会拦截」规划 Warning/Info 模式
当前版本的模式扫描（内置模式、`Config.AdditionalDangerousPatterns`、全局注册模式三者走同一扫描路径）对任何通过词边界上下文检查的命中都会拒绝操作，`Level` 不改变拦截结果，仅作为语义标注供审计/日志区分严重度。因此**不要**注册一个「只想记录、不想拦截」的 `PatternLevelInfo` 级模式并放行含该模式的输入——它今天会拦截。所有匹配均为大小写不敏感。
:::

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
GetCriticalPatterns 已转为内部函数，不再作为公开 API 导出。关键模式（`__proto__`、`constructor[`、`prototype.`）始终强制检查，无法禁用。
:::

以下关键模式始终完全扫描，无论 JSON 大小如何：

| 模式 | 说明 |
|------|------|
| `__proto__` | prototype pollution |
| `constructor[` | constructor access |
| `prototype.` | prototype manipulation |

---

## 自定义模式注册

自定义危险模式有两条注册途径：**Config 追加**（实例级，构造时固化进处理器的安全校验器）与**全局注册**（进程级，对所有 Processor 生效）。两者的作用域、移除方式与适用场景对照见[全局注册 vs Config 追加](#全局注册-vs-config-追加)。

### Config 追加（实例级）

`Config.AddDangerousPattern` 方法向配置添加自定义危险模式：

签名：`func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

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

也可以一次传入多个模式——直接设置 `Config.AdditionalDangerousPatterns` 字段：

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "eval(", Name: "eval-call", Level: json.PatternLevelCritical},
    {Pattern: "exec(", Name: "exec-call", Level: json.PatternLevelWarning},
}
```

相关配置字段：

```go
type Config struct {
    // ... 其他字段 ...

    // AdditionalDangerousPatterns 添加除默认模式外的安全模式
    AdditionalDangerousPatterns []DangerousPattern

    // DisableDefaultPatterns 禁用内置默认安全模式（关键模式除外）
    // 设为 true 则仅使用 AdditionalDangerousPatterns
    // 注意：关键模式（__proto__、constructor[、prototype.）始终强制执行，无法禁用
    DisableDefaultPatterns bool
}
```

### 全局注册（进程级）

除了通过 `Config` 配置实例级模式外，还可以通过包级函数管理全局模式注册表。全局注册表中的模式在所有 Processor 实例中生效。

#### RegisterDangerousPattern

签名：`func RegisterDangerousPattern(pattern DangerousPattern)`

向全局注册表添加自定义危险模式。注册的模式在所有 Processor 实例中生效。

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "自定义危险模式",
    Level:   json.PatternLevelCritical,
})
```

#### UnregisterDangerousPattern

签名：`func UnregisterDangerousPattern(pattern string)`

从全局注册表中移除指定模式。

```go
json.UnregisterDangerousPattern("malicious_keyword")
```

#### ListDangerousPatterns

签名：`func ListDangerousPatterns() []DangerousPattern`

返回全局注册表中所有自定义模式。

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("模式: %s, 名称: %s, 级别: %s\n", p.Pattern, p.Name, p.Level)
}
```

### 全局注册 vs Config 追加

| 维度 | 全局注册（`RegisterDangerousPattern`） | Config 追加（`AddDangerousPattern` / `AdditionalDangerousPatterns`） |
|------|----------------------------------------|---------------------------------------------------------------------|
| 作用域 | 进程内**所有** Processor，含已创建的实例（扫描时实时读取注册表） | 仅使用该 Config 创建的 Processor（构造时固化进安全校验器） |
| 移除方式 | `UnregisterDangerousPattern(pattern)` 即时生效 | 无运行期移除，需换新 Config 重建 Processor |
| 查询方式 | `ListDangerousPatterns()` | 读取 `cfg.AdditionalDangerousPatterns` 字段 |
| 与 `DisableDefaultPatterns` 的关系 | 不受影响（显式加入的模式始终扫描） | 不受影响（同左） |
| 典型用途 | 应用级安全策略、合规黑名单，`main` 启动时注册 | 单个实例的业务定制（如仅某个租户的 Processor 拦截特定关键词） |

完整对比示例：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// 全局注册：对所有 Processor 生效（含已创建的实例）
	json.RegisterDangerousPattern(json.DangerousPattern{
		Pattern: "internal_only",
		Name:    "内部标识符",
		Level:   json.PatternLevelCritical,
	})
	defer json.UnregisterDangerousPattern("internal_only")

	// Config 追加：仅影响使用该 Config 的 Processor
	cfg := json.DefaultConfig()
	cfg.AddDangerousPattern(json.DangerousPattern{
		Pattern: "project_secret",
		Name:    "项目机密",
		Level:   json.PatternLevelCritical,
	})

	withCfg, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer withCfg.Close()

	withoutCfg, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer withoutCfg.Close()

	_, err1 := withCfg.Get(`{"v": "project_secret"}`, "v")
	_, err2 := withoutCfg.Get(`{"v": "project_secret"}`, "v")
	_, err3 := withoutCfg.Get(`{"v": "internal_only"}`, "v")

	fmt.Println("局部模式拦截配置处理器：", err1 != nil)
	fmt.Println("局部模式拦截普通处理器：", err2 != nil)
	fmt.Println("全局模式拦截普通处理器：", err3 != nil)
	// 输出：
	// 局部模式拦截配置处理器：true
	// 局部模式拦截普通处理器：false
	// 全局模式拦截普通处理器：true
}
```

---

## 完整示例

### 自定义安全策略

```go
package main

import (
	"fmt"
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

	// 测试危险模式检测（模式作为整词匹配：两侧不能紧邻字母/数字/下划线）
	_, err = p.Get(`{"data": "company_secret"}`, "data")
	fmt.Println("检测到危险模式：", err != nil)
	// 输出：检测到危险模式：true

	// 查看已注册的模式
	fmt.Printf("自定义模式数量：%d\n", len(cfg.AdditionalDangerousPatterns))
}
```

::: tip 匹配是「整词」的
模式命中后会做词边界上下文检查：模式两侧紧邻字母、数字或下划线时视为普通标识符的一部分而不拦截。例如模式 `company_secret` 在 `"company_secret"` 中触发，在 `"company_secret_info"` 中不触发（后跟 `_` 属词内字符）；以 `(`、`[`、`:`、`.` 等分隔符结尾的模式（如 `eval(`）则不受后缀影响。这也是库内置模式（如 `eval(`、`__proto__`）的匹配方式。
:::

### 禁用默认模式

```go
cfg := json.DefaultConfig()

// 禁用内置默认模式（关键模式除外），仅使用自定义模式
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
    Level:   json.PatternLevelInfo, // 语义标注；当前实现命中同样会拦截（见 PatternLevel 行为矩阵）
})

// 查看已注册的自定义模式
for _, p := range cfg.AdditionalDangerousPatterns {
    fmt.Printf("模式: %s, 名称: %s, 级别: %s\n", p.Pattern, p.Name, p.Level)
}
```

---

## 扫描开关

三个 Config 字段控制「怎么扫」：

| 字段 | 默认 | 作用 |
|------|------|------|
| `FullSecurityScan` | `false` | `true` 时对所有输入不分大小做全量扫描；`false` 时小输入（< 4KB）全量、大输入走分层优化扫描（见下节，同样保证 100% 覆盖）。全量模式对 >100KB 输入约有 10–30% 额外开销 |
| `DisableDefaultPatterns` | `false` | `true` 时跳过内置的非关键模式（HTML 标签、事件处理器等），仅保留 3 个关键模式 + 自定义模式 |
| `AdditionalDangerousPatterns` | `nil` | 在内置模式之外叠加自定义模式（见上文） |

```go
cfg := json.SecurityConfig() // 已开启 FullSecurityScan 并收紧各项限制
// 等价于手动设置：
// cfg := json.DefaultConfig()
// cfg.FullSecurityScan = true
```

开启建议：处理**不可信输入**（公网 API、用户提交、外部 webhook）、涉及敏感数据（认证、金融、个人信息）或有合规全量审计要求时启用 `FullSecurityScan`；可信内部服务的大报文可保持默认的分层扫描以兼顾吞吐。

---

## 安全扫描策略

### 小 JSON（< 4KB）

始终进行完整的安全扫描，逐一检查全部危险模式。

### 较大 JSON（≥ 4KB）

采用多层级优化扫描，**保证 100% 覆盖**（无采样盲区）：

- 关键模式（`__proto__`、`constructor[`、`prototype.`）始终完全扫描
- 先做指示字符检查：若无任何危险字符则快速跳过
- 检测可疑字符密度：密度过高时回退全量扫描，防止攻击者把恶意内容藏在密集区
- 其余模式使用 32KB **滚动窗口**扫描（窗口带重叠），确保跨边界模式不遗漏

---

## 相关

- [Config](../api-reference/config) - 配置选项
- [Schema 校验](../api-reference/schema) - Schema 验证
- [Hook 钩子系统](../extensions/hooks) - 操作拦截
