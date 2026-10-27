---
sidebar_label: "Processor 入门"
title: "Processor 入门 - CyberGo JSON | 何时使用 Processor"
description: "CyberGo JSON Processor 入门：包级函数与 Processor 的选型、PreParse 预解析、CompilePath 预编译与 goroutine 共享。"
sidebar_position: 40
---

# Processor 入门

`Processor` 是持有配置、缓存与钩子的 JSON 操作入口；包级函数则是共享一个默认全局处理器的封装层。本页说明两者的差别、Processor 的六种使用场景与生命周期管理。

## 包函数 vs Processor

CyberGo JSON 提供两种 API 风格：

| 维度 | 包级函数 | Processor |
|------|----------|-----------|
| **典型调用** | `json.GetString(data, "name")` | `p.GetString(data, "name")` |
| **创建方式** | 无需创建，直接调用 | `p, err := json.New()` |
| **配置方式** | 每次调用传入 `cfg ...Config` | 创建时统一配置，后续复用 |
| **缓存** | 全局共享缓存 | 独立缓存，可控可清理 |
| **资源管理** | 自动（全局处理器） | 手动 `Close()` |
| **钩子系统** | 不支持 | 支持 `AddHook` |
| **预解析** | 不支持 | 支持 `PreParse` + `GetFromParsed` |
| **路径预编译** | 不支持 | 支持 `CompilePath` + `GetCompiled` |
| **适用场景** | 简单操作、脚本、低频调用 | 高频操作、自定义配置、服务端 |

::: tip 快速判断
- **用包函数**：偶尔操作 JSON、不想管理生命周期、快速脚本
- **用 Processor**：需要自定义配置、高频查询同一数据、需要钩子/审计
:::

## 什么时候用 Processor

### 场景 1：自定义配置

包级函数在不传 cfg 时使用默认配置。需要安全模式、自定义编码器或钩子时，用 Processor 承载配置：

```go
// 包函数 — 尾参传 cfg（不传则走默认配置）
val := json.GetString(data, "name")

// Processor — 可自定义配置
cfg := json.SecurityConfig() // 安全模式
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()

// 后续所有操作都使用安全配置
val, err := p.Get(data, "name")
```

### 场景 2：高频查询同一数据（PreParse 优化）

对同一 JSON 多次查询时，`PreParse` 只解析一次，后续查询复用解析结果：

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 一次解析
parsed, err := p.PreParse(largeJSON)
if err != nil {
    panic(err)
}
defer parsed.Release() // 用完归还对象池

// 多次查询 — 复用解析结果，避免重复解析
name, _ := p.GetFromParsed(parsed, "user.name")
email, _ := p.GetFromParsed(parsed, "user.email")
tags, _ := p.GetFromParsed(parsed, "tags")

// 也可以直接取底层解析结果（map[string]any / []any）
data := parsed.Data()
_ = data

// 修改同样可基于预解析结果：SetFromParsed 返回新的 ParsedJSON，原对象不变
modified, err := p.SetFromParsed(parsed, "user.age", 31)
if err != nil {
    panic(err)
}
newAge, _ := p.GetFromParsed(modified, "user.age")
```

::: warning 性能对比
- 包函数 `GetString`：每次调用都会解析 JSON（有缓存但命中率取决于场景）
- `PreParse` + `GetFromParsed`：解析一次，N 次查询只做导航，零重复解析
:::

### 场景 3：同一路径高频查询（CompilePath 优化）

`PreParse` 优化的是「同一份 JSON 查询多次」；如果场景是「**同一路径**在大量不同 JSON 上反复执行」，则用 `CompilePath` 预编译路径——路径解析与校验只做一次，之后每次查询直接导航：

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

	// 路径只编译一次（解析 + 校验）
	compiled, err := p.CompilePath("user.name")
	if err != nil {
		panic(err)
	}
	defer compiled.Release() // 归还对象池

	// 热路径中反复查询：跳过路径解析，只做导航
	for _, data := range []string{
		`{"user":{"name":"Alice"}}`,
		`{"user":{"name":"Bob"}}`,
	} {
		val, err := p.GetCompiled(data, compiled)
		if err != nil {
			panic(err)
		}
		fmt.Println(val)
	}
	// 输出：
	// Alice
	// Bob
}
```

::: tip 两种优化的分工
| 优化 | 省去的开销 | 适用场景 |
|------|-----------|----------|
| `PreParse` + `GetFromParsed` | 重复解析 JSON 文档 | 同一份 JSON 查询多个不同路径 |
| `CompilePath` + `GetCompiled` | 重复解析路径表达式 | 同一路径作用于多份 JSON（热路径） |

两者是独立的优化维度，按瓶颈选择。注意 `GetCompiled` 目前只有查询变体，`Set`/`Delete` 暂不支持预编译路径；预解析侧的修改则可走 `SetFromParsed`。
:::

### 场景 4：钩子与审计

需要日志记录、性能监控或输入验证时，Processor 支持钩子系统：

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 添加日志钩子
p.AddHook(json.LoggingHook(slog.Default()))
// 添加计时钩子
p.AddHook(json.TimingHook(&metricsRecorder))

// 所有操作自动触发钩子
result, err := p.Set(data, "user.name", "Alice")
```

详见 [Hook 钩子系统](../extensions/hooks)。

### 场景 5：多 goroutine 共享 Processor

`Processor` 是并发安全的：创建一次、全组共享、最后 `Close` 一次。不要每个请求各建一个——创建有开销，资源管理成本也会被放大：

```go
package main

import (
	"fmt"
	"sync"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close() // 等全部 goroutine 结束后才执行

	data := `{"user":{"name":"Alice","age":30}}`

	var wg sync.WaitGroup
	for i := 1; i <= 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			name := p.GetString(data, "user.name")
			age := p.GetInt(data, "user.age")
			fmt.Printf("goroutine %d: %s (%d)\n", i, name, age)
		}(i)
	}
	wg.Wait()

	stats := p.GetStats()
	fmt.Println("累计操作数：", stats.OperationCount)
}

// 输出（goroutine 顺序不确定）：
// goroutine 5: Alice (30)
// goroutine 2: Alice (30)
// ...
// 累计操作数：16
```

::: tip MaxConcurrency 是软限制
默认 `MaxConcurrency = 50`：在途操作超过该值时，新操作**立即失败**并返回 `ErrConcurrencyLimit`（不排队等待）。高并发服务按需调大该值，或在调用方做限流与重试。
:::

### 场景 6：全局统一配置

包级函数背后是一个**全局处理器**。希望整个应用——包括无法改造签名的旧代码——统一走同一份配置时，用 `SetGlobalProcessor` 替换一次，所有 `json.Get`/`json.Marshal` 等包级调用立即生效。完整示例与注意事项见[全局处理器](#全局处理器)。

## 生命周期管理

Processor 持有资源（缓存、goroutine），使用后**必须关闭**：

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close() // 确保资源释放

// 使用 Processor...
result, err := p.GetString(data, "name")
```

::: warning 忘记 Close 的后果
- 缓存内存不释放
- 后台 goroutine 泄漏
- 高并发场景下资源持续累积
:::

### 检查状态

```go
if p.IsClosed() {
    // Processor 已关闭，不可再使用
}
```

`IsClosed` 在两种状态下都返回 `true`：已彻底关闭，或正在关闭（排空等待期）/关闭超时。这两种状态下新操作都会被拒绝并返回错误，因此可把它当作「还能不能用」的唯一判断。

## 监控与诊断

Processor 内置运行统计与健康检查，可直接接入服务监控：

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

	_, _ = p.Get(`{"user":{"name":"Alice"}}`, "user.name")

	// 运行统计：操作数、错误数、缓存命中率与内存占用
	stats := p.GetStats()
	fmt.Printf("操作数=%d 错误数=%d 命中率=%.2f 缓存条目=%d\n",
		stats.OperationCount, stats.ErrorCount, stats.HitRatio, stats.CacheSize)

	// 健康检查：缓存、内存等逐项检查结果
	health := p.GetHealthStatus()
	fmt.Println("健康：", health.Healthy)
	for name, check := range health.Checks {
		fmt.Printf("  %s: %s\n", name, check.Message)
	}

	// 读取当前配置（返回副本，修改不会影响 Processor）
	cfg := p.GetConfig()
	fmt.Println("缓存启用：", cfg.EnableCache)
}
```

::: tip 包级版本
全局处理器同样有包级监控入口：`json.GetStats()` 与 `json.GetHealthStatus()`，适合在不持有 Processor 引用的代码里做全局诊断。缓存统计与 `ClearCache`/`WarmupCache` 的完整用法见 [高级缓存策略](../advanced/caching)。
:::

## 全局处理器

包级函数（`Get`、`Set`、`Marshal` 等）内部使用**全局处理器**。你也可以替换它：

```go
// 创建自定义配置的处理器
cfg := json.SecurityConfig()
p, err := json.New(cfg)
if err != nil {
    panic(err)
}

// 设置为全局处理器
json.SetGlobalProcessor(p)

// 现在所有包级函数都使用安全配置
val := json.GetString(data, "name")

// 应用退出时清理
defer json.ShutdownGlobalProcessor()
```

行为细节：

- `SetGlobalProcessor` 线程安全，传 `nil` 是 no-op；替换时会**自动关闭旧处理器**
- `ShutdownGlobalProcessor` 是完整的退出清理：除关闭全局处理器外，还会关闭「按配置缓存」的处理器并清空全局路径/编码缓存；此后再调用包级函数会自动创建新的默认处理器
- 传入 `cfg` 的包级函数（如 `json.Get(data, path, json.SecurityConfig())`）走的是**按配置缓存**的处理器，不经全局处理器——两种机制并行、互不影响

::: tip 适用场景
- 全局统一安全策略
- 自定义编码器全局生效
- 替换默认配置，而不必在每个调用点传 Config
:::

## 选择决策树

```text
需要操作 JSON？
├── 偶尔使用、脚本工具
│   └── → 用包函数 json.GetString / json.Set / json.Marshal
├── 偶尔使用，但需要安全/编码配置
│   └── → 包函数 + 尾参 cfg：json.Get(data, path, json.SecurityConfig())
├── 高频使用，或需要钩子等处理器能力
│   └── → 用 Processor json.New(cfg)
├── 对同一 JSON 多次查询
│   └── → 用 Processor + PreParse
├── 同一路径作用于大量 JSON（热路径）
│   └── → 用 Processor + CompilePath
├── 多个 goroutine 并发处理
│   └── → 共享一个 Processor（并发安全），不要每请求新建
├── 需要审计/监控/日志
│   └── → 用 Processor + AddHook
├── 需要运行时指标/健康检查
│   └── → 用 GetStats / GetHealthStatus（Processor 方法与包级函数均可）
└── 全局统一配置
    └── → 用 SetGlobalProcessor
```

## 下一步

- [路径表达式语法](./path-syntax) — 路径查询完整语法
- [Processor API](../api-reference/processor/) — 完整方法参考
- [性能优化](../advanced/performance) — 深入性能调优
- [速查表](./cheatsheet) — API 快速参考
