---
sidebar_label: "工具函数"
title: "工具函数 - CyberGo JSON | 辅助函数用法与示例"
description: "CyberGo JSON 提供丰富辅助函数：CompareJSON/MergeJSON 比较与合并、ClearCache/GetStats 缓存统计、WarmupCache 预热与 RegisterDangerousPattern 全局危险模式注册，辅以 SafeError/RedactedPath 脱敏和 AccessResult 类型转换处理，帮助开发者完成 JSON 比较、缓存管理与安全监控等日常操作。"
sidebar_position: 90
---

# 工具函数

json 包提供丰富的辅助函数，用于 JSON 比较、缓存管理和工具处理。

## JSON 比较函数

### CompareJSON

签名：`func CompareJSON(json1, json2 string, cfg ...Config) (bool, error)`

比较两个 JSON 字符串是否相等。处理数字精度差异和键顺序差异。

无 cfg 时行为与历史一致（不做安全验证，两侧均用 `encoding/json` 编组）。传入 cfg 时，对两个输入应用安全验证（大小/深度/危险模式限制），并使用配置中的编码进行对称比较。

```go
// 键顺序不同但内容相同
equal, _ := json.CompareJSON(`{"a":1,"b":2}`, `{"b":2,"a":1}`)
fmt.Println(equal) // true

// 数字精度不同但值相同
equal, _ = json.CompareJSON(`{"num":1}`, `{"num":1.0}`)
fmt.Println(equal) // true

// 内容不同
equal, _ = json.CompareJSON(`{"a":1}`, `{"a":2}`)
fmt.Println(equal) // false

// 带配置（应用安全验证与编码控制）
equal, err = json.CompareJSON(a, b, json.SecurityConfig())
```

::: tip Processor 等价方法
`Processor.CompareJSON` 始终执行安全验证（按 cfg 或处理器自身配置），与包级函数的无 cfg 路径行为不同。详见 [Processor 数据修改](./processor/modify#processor-comparejson)。
:::

---

## JSON 合并函数

### MergeJSON

签名：`func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

合并两个 JSON 对象，支持通过 Config 配置合并模式。详见 [修改函数](./functions/modify#mergejson)。

**语义细节**：

- **两个入参都必须是 JSON 对象**（顶层非对象时报 `first/second JSON is not an object` 错误）
- 嵌套对象按 `Config.MergeMode` 递归深合并；原始值与数组直接取 `json2` 的值
- 数字以保精度方式解码后归一化为 `float64` 再编码（`1` 与 `1.0` 等价）
- **不做安全验证**——它是纯结构工具，只解码、合并、再编码（与传入 cfg 时的 `CompareJSON` 不同）

---

### MergeMany

签名：`func MergeMany(jsons []string, cfg ...Config) (string, error)`

合并多个 JSON 对象。详见 [修改函数](./functions/modify#mergemany)。

**语义细节**：要求**至少 2 个** JSON 字符串（否则报错）；从左到右折叠（等价于依次调用 `MergeJSON`），任一步失败返回 `merge failed at index N: <原因>` 错误。

---

## 缓存和统计

### ClearCache（包级函数）

签名：`func ClearCache()`

清除全局处理器的内部缓存。

```go
json.ClearCache()
```

---

### GetStats（包级函数）

签名：`func GetStats() Stats`

获取全局处理器的统计信息。

```go
stats := json.GetStats()
fmt.Printf("缓存命中率：%.2f%%\n", stats.HitRatio * 100)
fmt.Printf("缓存大小：%d\n", stats.CacheSize)
```

---

### GetHealthStatus（包级函数）

签名：`func GetHealthStatus() HealthStatus`

获取全局处理器的健康状态。

```go
status := json.GetHealthStatus()
if status.Healthy {
    fmt.Println("处理器健康")
}
```

---

### Processor.ClearCache

签名：`func (p *Processor) ClearCache()`

清除处理器的内部缓存。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

p.ClearCache()
```

### Processor.GetStats

签名：`func (p *Processor) GetStats() Stats`

获取处理器的统计信息。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

stats := p.GetStats()
fmt.Printf("缓存命中率：%.2f%%\n", stats.HitRatio * 100)
fmt.Printf("缓存大小：%d\n", stats.CacheSize)
```

### Processor.GetHealthStatus

签名：`func (p *Processor) GetHealthStatus() HealthStatus`

获取处理器的健康状态。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

status := p.GetHealthStatus()
if status.Healthy {
    fmt.Println("处理器健康")
}
```

### WarmupCache

签名：`func WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

预热缓存以提高后续操作性能。

```go
data := `{"user": {"name": "Alice", "email": "alice@example.com"}, "items": [{"id": 1}]}`
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := json.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("成功预热 %d 个路径\n", result.Successful)
```

**WarmupResult 结构**

| 字段 | 类型 | 说明 |
|------|------|------|
| `TotalPaths` | `int` | 提交预热的路径总数 |
| `Successful` | `int` | 成功缓存的路径数 |
| `Failed` | `int` | 失败的路径数 |
| `SuccessRate` | `float64` | 成功率，**百分比 0–100**（非 0–1；空路径列表为 100） |
| `FailedPaths` | `[]string` | 失败路径清单（全部成功时为 nil） |

::: warning 预热的错误边界
`WarmupCache` 在**全部路径都失败**时返回 `(result, error)`（error 携带最后一条失败原因）；缓存被禁用（`EnableCache: false`）时直接返回错误。部分失败只体现在 `WarmupResult` 字段中，error 为 nil。
:::

---

## 全局处理器管理

包级函数内部使用全局处理器。可通过以下函数自定义或关闭：

| 函数 | 签名 | 说明 |
|------|------|------|
| `SetGlobalProcessor` | `func SetGlobalProcessor(processor *Processor)` | 设置自定义全局处理器 |
| `ShutdownGlobalProcessor` | `func ShutdownGlobalProcessor()` | 关闭全局处理器并释放资源 |

**行为细节**：

- `SetGlobalProcessor(nil)` 是空操作；替换成功后**旧处理器会被同步 Close**（Close 内部最多等待约 5 秒），期间正在进行的操作不受影响
- `ShutdownGlobalProcessor` 线程安全：关闭默认处理器、备用处理器与**配置缓存中的全部处理器**，并清理路径类型缓存等全局缓存。此后包级函数首次调用会**自动创建新的默认处理器**，适合长生命周期服务的收尾清理

::: tip 详细用法
全局处理器的完整使用示例和生命周期管理详见 [Processor 概述](./processor/#全局处理器管理) 和 [Processor 入门指南](../getting-started/processor-guide#全局处理器)。
:::

---

## 输出函数

::: warning API 变更说明
Print、PrintPretty、PrintE、PrintPrettyE 已从库中移除，不再提供。请使用 [Encode](./functions/output#encode)、[EncodePretty](./functions/output#encodepretty) 或 [Prettify](./functions/output#prettify) 配合 `fmt.Println` 代替（`EncodeWithConfig` 已废弃，与 `Encode` 等价）。详见 [格式化输出](../getting-started/print)。
:::

---

## Buffer 兼容函数

`Compact`、`Indent`、`HTMLEscape` 与 `encoding/json` 标准库完全兼容，同时通过 `cfg` 参数支持额外配置。完整示例和 Processor 等价方法详见 [编码输出函数](./functions/output#compact)。

| 函数 | 签名 | 说明 |
|------|------|------|
| `Compact` | `func Compact(dst *bytes.Buffer, src []byte, cfg ...Config) error` | 去除无意义空白，**写入 dst**（兼容 `encoding/json.Compact`，镜像 `Processor.CompactBuffer`） |
| `CompactString` | `func CompactString(jsonStr string, cfg ...Config) (string, error)` | 字符串入、字符串出（镜像 `Processor.Compact`），与 `Compact` 是**两个不同函数** |
| `Indent` | `func Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error` | 缩进格式化后写入 dst（兼容 `encoding/json.Indent`） |
| `HTMLEscape` | `func HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)` | 转义 `<` `>` `&` 及 U+2028/U+2029 后写入 dst，无返回值 |

---

## 安全模式函数

### Config.AddDangerousPattern

通过 Config 的 `AddDangerousPattern` 方法或 `AdditionalDangerousPatterns` 字段注册自定义危险模式。

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "自定义恶意关键字",
    Level:   json.PatternLevelCritical,
})
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

也可以在创建 Config 后设置 `AdditionalDangerousPatterns` 字段：

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "malicious_keyword", Name: "自定义恶意关键字", Level: json.PatternLevelCritical},
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

**DangerousPattern 结构体**

| 字段 | 类型 | 说明 |
|------|------|------|
| `Pattern` | `string` | 要检测的子字符串 |
| `Name` | `string` | 人类可读的风险描述 |
| `Level` | `PatternLevel` | 严重级别 |

**PatternLevel 级别**

| 级别 | 说明 |
|------|------|
| `PatternLevelCritical` | 始终阻止操作 |
| `PatternLevelWarning` | 严格模式下阻止，宽松模式下记录警告 |
| `PatternLevelInfo` | 仅记录，永不阻止 |

---

## 安全模式注册（全局函数）

除 Config 级别的 `AdditionalDangerousPatterns` 外，库还维护一个**全局注册表**，适合进程级统一安全策略：进程启动时注册一次，对进程内**所有 Processor** 生效——校验时实时读取全局注册表，已创建的 Processor 无需重建；它与各 Processor 的配置无关（即使设置了 `DisableDefaultPatterns` 也仍然生效），注册与移除均为线程安全操作。

`DangerousPattern` 结构体与 `PatternLevel` 级别定义见上方的[安全模式函数](#安全模式函数)小节。

### RegisterDangerousPattern

```go
func RegisterDangerousPattern(pattern DangerousPattern)
```

向进程级**全局注册表**注册危险模式，注册后与内置模式一并参与安全校验（按子串检测，大小写不敏感）。同一模式字符串重复注册会覆盖旧条目。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `pattern` | `DangerousPattern` | 是 | 要注册的模式（`Pattern` 为要检测的子串，`Name` 为人类可读描述，`Level` 为严重级别） |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// 进程启动时注册一次，对进程内所有 Processor 生效
	json.RegisterDangerousPattern(json.DangerousPattern{
		Pattern: "internal_admin_token",
		Name:    "内部管理令牌",
		Level:   json.PatternLevelCritical,
	})

	// 全局注册的模式对后续创建的 Processor 同样生效
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// ListDangerousPatterns 仅返回自定义注册的模式（不含内置模式）
	for _, dp := range json.ListDangerousPatterns() {
		fmt.Printf("%s（level=%d）\n", dp.Pattern, dp.Level)
	}
	// 输出：internal_admin_token（level=0）
}
```

### UnregisterDangerousPattern

```go
func UnregisterDangerousPattern(pattern string)
```

按模式字符串从全局注册表移除自定义模式。移除未注册的模式是无害的空操作；对内置模式无效（见本节末尾的警告）。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `pattern` | `string` | 是 | 要移除的模式字符串（即 `DangerousPattern.Pattern` 字段的值） |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	json.RegisterDangerousPattern(json.DangerousPattern{
		Pattern: "internal_admin_token",
		Name:    "内部管理令牌",
		Level:   json.PatternLevelCritical,
	})

	// 按模式字符串移除；移除未注册的模式是无害的空操作
	json.UnregisterDangerousPattern("internal_admin_token")

	// 全局注册表只保存自定义模式，移除后重新为空
	fmt.Println(len(json.ListDangerousPatterns())) // 输出：0
}
```

### ListDangerousPatterns

```go
func ListDangerousPatterns() []DangerousPattern
```

返回全局注册表中的全部模式，即通过 `RegisterDangerousPattern` 注册的**自定义模式**——内置模式由库自身维护，不在其中列出、也无法移除。注册表为空时返回空（非 nil）切片。

**返回值**

| 类型 | 说明 |
|------|------|
| `[]DangerousPattern` | 已注册的全部自定义模式（注册表为空时为空切片） |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	json.RegisterDangerousPattern(json.DangerousPattern{
		Pattern: "internal_admin_token",
		Name:    "内部管理令牌",
		Level:   json.PatternLevelCritical,
	})

	patterns := json.ListDangerousPatterns()
	fmt.Println(len(patterns))     // 输出：1
	fmt.Println(patterns[0].Name)  // 输出：内部管理令牌
	fmt.Println(patterns[0].Level) // 输出：0（即 PatternLevelCritical）
}
```

::: warning 内置关键模式不可禁用
`__proto__`、`constructor[`、`prototype.` 等关键模式**始终强制执行**，`UnregisterDangerousPattern` 与 `DisableDefaultPatterns` 对它们均无效。
:::

安全模式的完整设计（内置危险模式清单、`SecurityConfig` 预设与 `PatternLevel` 阻断策略）见[安全模式](../security/security-mode)。

---

## 错误处理函数

### SafeError

签名：`func SafeError(err error) string`

返回客户端安全的错误消息，不包含内部详细信息。适合在 API 响应中使用。

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // 返回安全的错误消息（不含路径、内部状态等敏感信息）
    fmt.Println(json.SafeError(err))
}
```

---

### RedactedPath

签名：`func RedactedPath(path string) string`

返回已编辑的路径，用于安全日志记录。隐藏路径中的敏感部分。

```go
path := "users[0].ssn"
fmt.Println(json.RedactedPath(path)) // 输出：***（非空路径统一返回 ***，空路径返回空字符串）
```

---

## AccessResult 类型转换方法

`AccessResult` 是 `Processor.SafeGet()` 和包级 `SafeGet()` 的返回类型，提供类型安全的转换方法。

### AccessResult.AsString

签名：`func (r AccessResult) AsString() (string, error)`

安全转换为字符串类型。仅当值本身是字符串时成功。

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    return
}
fmt.Println(name)
```

---

### AccessResult.AsStringConverted

签名：`func (r AccessResult) AsStringConverted() (string, error)`

将任意值转换为字符串（使用 fmt.Sprintf 格式化）。

```go
result := json.SafeGet(data, "user.age")
ageStr, err := result.AsStringConverted()
// "30" (字符串格式)
```

---

### AccessResult.AsInt

签名：`func (r AccessResult) AsInt() (int, error)`

安全转换为整数。不支持 bool 到 int 的转换。

```go
result := json.SafeGet(data, "user.age")
age, err := result.AsInt()
```

---

### AccessResult.AsFloat64

签名：`func (r AccessResult) AsFloat64() (float64, error)`

安全转换为 float64。不支持 bool 到 float64 的转换。

```go
result := json.SafeGet(data, "item.price")
price, err := result.AsFloat64()
```

---

### AccessResult.AsBool

签名：`func (r AccessResult) AsBool() (bool, error)`

安全转换为布尔值。仅支持 bool 和 string 类型。

```go
result := json.SafeGet(data, "feature.enabled")
enabled, err := result.AsBool()
```

---

## 相关

- [查询获取函数](./functions/query) - Get, GetString 等查询操作
- [修改函数](./functions/modify) - Set, Delete 等修改操作
- [类型定义](./types) - AccessResult 等类型
- [配置选项](./config) - Config 配置详解
