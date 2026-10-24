---
sidebar_label: "Hook 钩子系统"
title: "Hook 钩子系统 - CyberGo JSON | 拦截、监控与审计指南"
description: "CyberGo JSON 钩子系统：Hook 接口、LoggingHook/TimingHook/ValidationHook/ErrorHook 工厂与 HookFunc 适配器。"
sidebar_position: 20
---

# Hook 钩子系统

Hook 在 JSON 操作前后插入自定义逻辑，用于日志记录、性能监控与输入验证。

::: tip 接口签名参考
Hook 接口的完整类型签名（`Hook`、`HookContext`、`HookFunc`）参阅 [接口定义](../api-reference/interfaces#钩子接口)。下面的内容侧重使用方式与执行顺序。
:::

## Hook 接口

```go
type Hook interface {
    Before(ctx HookContext) error
    After(ctx HookContext, result any, err error) (any, error)
}
```

### 方法说明

| 方法 | 说明 |
|------|------|
| `Before(ctx HookContext) error` | 操作前调用，返回错误可中止操作 |
| `After(ctx HookContext, result any, err error) (any, error)` | 操作后调用，可修改结果或返回错误 |

---

## HookContext 结构

HookContext 提供操作的上下文信息。

```go
type HookContext struct {
    Operation string      // 操作类型："get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string      // 输入 JSON 字符串（marshal 时可能为空）。安全警告：可能包含敏感数据
    Path      string      // 目标路径（marshal/unmarshal 时可能为空）
    Value     any         // set 操作的值
    Config    *Config     // 活动配置
    StartTime time.Time   // 操作开始时间
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `Operation` | `string` | 操作类型，取值见下方说明 |
| `JSONStr` | `string` | 输入 JSON 字符串（**安全警告：可能包含敏感数据**） |
| `Path` | `string` | 目标路径表达式 |
| `Value` | `any` | set 操作的值 |
| `Config` | `*Config` | 当前使用的配置 |
| `StartTime` | `time.Time` | 操作开始时间（`After` 触发前设置，可用于计算耗时） |

::: warning 当前触发点
钩子当前在 **`Get` / `Set` / `Delete`**（含包级封装 `json.Get`/`json.Set`/`json.Delete`，它们内部走同一 Processor 路径）上触发。`Encode`/`Marshal`/`Unmarshal` 路径**暂不触发**钩子——`Operation` 的 `marshal`/`unmarshal` 取值为预留，请勿依赖。
:::

::: tip 不要记录 JSONStr
`JSONStr` 可能包含密码、令牌、PII。日志中只使用 `Operation` 与 `Path`；确需检查内容时按特定路径解析后再判断。
:::

---

## HookFunc 适配器

HookFunc 是一个结构体适配器，允许使用函数作为 Hook。适用于只需要 Before 或 After 其中之一的场景。

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

### 示例

```go
// 只需要 After
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        log.Printf("%s completed in %v", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})

// 只需要 Before
p.AddHook(&json.HookFunc{
    BeforeFn: func(ctx json.HookContext) error {
        log.Printf("starting %s on path %s", ctx.Operation, ctx.Path)
        return nil
    },
})
```

### Hook 与 HookFunc 如何选择

| 维度 | 自定义类型实现 `Hook` | `HookFunc` 适配器 |
|------|----------------------|-------------------|
| 状态携带 | 结构体字段（logger、计数器、缓冲区） | 闭包捕获 |
| 只需单侧拦截 | 仍须实现两个方法（另一侧返回原值） | 只填 `BeforeFn` 或 `AfterFn` 之一 |
| 复用与测试 | 独立类型，便于单测与多处实例化 | 就地定义，适合一次性逻辑 |
| 适用 | 复杂/有状态钩子（审计、指标聚合） | 轻量钩子（打点、简单校验） |

`HookFunc` 未设置的函数为空操作：缺 `BeforeFn` 时 Before 阶段直接放行，缺 `AfterFn` 时原样返回结果与错误。

---

## Hook 工厂函数

### LoggingHook

创建日志记录 Hook。参数只需实现 `Info(msg string, args ...any)`——`*slog.Logger` 天然满足，也可传入任何自有日志门面。

```go
func LoggingHook(logger interface{ Info(msg string, args ...any) }) Hook
```

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

完整示例（用最小接口自定义 logger，验证一次操作触发 Before + After 两次日志）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

// CountingLogger 只需实现 Info 方法即可作为 LoggingHook 的 logger
type CountingLogger struct{ calls int }

func (l *CountingLogger) Info(msg string, args ...any) {
	l.calls++
}

func main() {
	logger := &CountingLogger{}

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()
	p.AddHook(json.LoggingHook(logger))

	_, err = p.Get(`{"name": "Alice"}`, "name")
	if err != nil {
		panic(err)
	}

	fmt.Println("日志调用次数：", logger.calls)
	// 输出：日志调用次数：2（Before 与 After 各一次）
}
```

### TimingHook

创建计时 Hook，记录操作耗时。参数只需实现 `Record(op string, duration time.Duration)`，便于对接自有指标系统。

```go
func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook
```

```go
p.AddHook(json.TimingHook(myMetricsRecorder))
```

完整示例（按操作类型聚合调用次数）：

```go
package main

import (
	"fmt"
	"sync"
	"time"

	"github.com/cybergodev/json"
)

// MetricsRecorder 实现 Record 接口，按操作类型计数
type MetricsRecorder struct {
	mu    sync.Mutex
	count map[string]int
}

func (m *MetricsRecorder) Record(op string, duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.count[op]++
}

func main() {
	recorder := &MetricsRecorder{count: make(map[string]int)}

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()
	p.AddHook(json.TimingHook(recorder))

	if _, err := p.Get(`{"a": 1}`, "a"); err != nil {
		panic(err)
	}
	if _, err := p.Set(`{"a": 1}`, "b", 2); err != nil {
		panic(err)
	}

	fmt.Println("get 计时记录：", recorder.count["get"])
	fmt.Println("set 计时记录：", recorder.count["set"])
	// 输出：
	// get 计时记录：1
	// set 计时记录：1
}
```

### ValidationHook

创建验证 Hook，在操作前验证输入。验证函数收到 `(jsonStr, path)`，返回错误即**中止操作**（操作本体不执行）。

```go
func ValidationHook(validator func(jsonStr, path string) error) Hook
```

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1_000_000 {
        return errors.New("JSON too large")
    }
    return nil
}))
```

完整示例（拦截对敏感路径的访问）：

```go
package main

import (
	"errors"
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
		if strings.HasPrefix(path, "secret.") {
			return errors.New("禁止访问敏感路径：" + path)
		}
		return nil
	}))

	_, err = p.Get(`{"name": "Alice", "secret": {"token": "t"}}`, "name")
	fmt.Println("普通路径被拒绝：", err != nil)

	_, err = p.Get(`{"name": "Alice", "secret": {"token": "t"}}`, "secret.token")
	fmt.Println("敏感路径被拒绝：", err != nil)
	// 输出：
	// 普通路径被拒绝：false
	// 敏感路径被拒绝：true
}
```

### ErrorHook

`ErrorHook` 基于 `HookFunc` 的 After 阶段实现，拦截并处理错误：仅当操作**确实出错**（`err != nil`）时调用 handler，操作成功时直通放行。

handler 返回的错误会**替换**原错误向上传播（可用于上报后原样返回，或转换为对外安全的错误）。返回 `nil` 会吞掉本次错误（调用方视为成功），仅在明确需要时使用。

```go
func ErrorHook(handler func(ctx HookContext, err error) error) Hook
```

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // 返回原始或转换后的错误
}))
```

完整示例（为错误附加操作上下文）：

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
		return fmt.Errorf("[audit] op=%s path=%s: %w", ctx.Operation, ctx.Path, err)
	}))

	_, err = p.Get(`{"name": "Alice"}`, "missing")
	fmt.Println("出错：", err != nil)
	fmt.Println("已附加上下文：", strings.HasPrefix(err.Error(), "[audit] op=get path=missing"))
	// 输出：
	// 出错：true
	// 已附加上下文：true
}
```

---

## 自定义 Hook 实现

### 完整示例

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"log/slog"
	"time"
)

// 日志 Hook
type LoggingHook struct {
	logger *slog.Logger
}

func (h *LoggingHook) Before(ctx json.HookContext) error {
	h.logger.Info("operation starting", "op", ctx.Operation, "path", ctx.Path)
	return nil
}

func (h *LoggingHook) After(ctx json.HookContext, result any, err error) (any, error) {
	h.logger.Info("operation completed",
		"op", ctx.Operation,
		"path", ctx.Path,
		"duration", time.Since(ctx.StartTime),
		"error", err)
	return result, err
}

func main() {
	cfg := json.DefaultConfig()
	p, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// 添加自定义 Hook
	p.AddHook(&LoggingHook{logger: slog.Default()})

	// 使用 processor...
	val, err := p.Get(`{"name": "test"}`, "name")
	if err != nil {
		panic(err)
	}
	fmt.Println(val)
}
```

### 使用 HookFunc 简化

```go
// 只需要记录完成时间
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        fmt.Printf("%s took %v\n", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})
```

---

## 配置 Hook

### 在 Config 中添加

```go
cfg := json.DefaultConfig()
cfg.Hooks = []json.Hook{
    json.LoggingHook(slog.Default()),
    json.TimingHook(myRecorder),
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### 在 Processor 上添加

```go
p, err := json.New()
if err != nil {
    panic(err)
}
p.AddHook(json.LoggingHook(slog.Default()))
p.AddHook(json.TimingHook(myRecorder))
```

### 两种途径的差异

| 维度 | `Config.Hooks` / `cfg.AddHook` | `Processor.AddHook` |
|------|--------------------------------|---------------------|
| 生效时机 | `json.New(cfg)` **构造时**一次性装载（做防御性拷贝） | 运行期随时追加 |
| 构造后再改 `Config` | 不影响已创建的 Processor | —— |
| 并发安全 | 构造前单线程配置即可 | 并发调用受互斥锁保护 |
| 生命周期 | 随 Processor | `Close()` 时钩子引用被清空释放 |

静态装配（启动时就知道全部钩子）用 `Config`；运行期按需启用/禁用（如灰度开关）用 `Processor.AddHook`。

---

## 执行顺序

### Before 钩子

- 按**添加顺序**执行
- 任一 Hook 返回错误则中止操作

### After 钩子

- 按**添加逆序**执行
- 每个 Hook 都会执行（即使前面的返回错误）

```go
// 添加顺序：A, B, C
p.AddHook(hookA)
p.AddHook(hookB)
p.AddHook(hookC)

// 执行顺序：
// Before: A.Before → B.Before → C.Before
// After:  C.After → B.After → A.After
```

### 结果改写与异常安全

- `Get` 的 `After` 可以返回任意类型的新结果；`Set`/`Delete` 的结果是 JSON **字符串**，`After` 若返回非字符串值会被视为未修改（保留原字符串），错误仍正常传播。
- 钩子 **panic 不会拖垮操作**：`Before` 阶段的 panic 被转换为 `hook panicked: ...` 错误并中止本次操作；`After` 阶段的 panic 被记录到结构化日志（slog）后跳过，不影响操作结果。
- 未注册钩子的 Processor 走无锁快速路径，钩子机制不引入额外开销。

---

## 最佳实践

### 1. 日志记录

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

### 2. 性能监控

```go
type MetricsRecorder struct{}

func (m *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.Histogram("json_operation_duration", duration, "op", op)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

### 3. 输入验证

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 10*1024*1024 { // 10MB
        return errors.New("JSON payload too large")
    }
    return nil
}))
```

### 4. 错误追踪

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    if err != nil {
        sentry.WithTags(map[string]string{
            "operation": ctx.Operation,
            "path":      ctx.Path,
        }).CaptureException(err)
    }
    return err
}))
```

### 5. 审计日志（完整实战）

只记录写操作（`set`/`delete`）的操作类型、路径与结果，不记录 `JSONStr` 内容本身：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

// AuditHook 记录写操作审计条目（演示用内存切片，生产替换为 slog/数据库）
type AuditHook struct {
	entries []string
}

func (h *AuditHook) Before(ctx json.HookContext) error {
	return nil // 审计只观察，不拦截
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
	switch ctx.Operation {
	case "set", "delete":
		h.entries = append(h.entries,
			fmt.Sprintf("op=%s path=%s ok=%v", ctx.Operation, ctx.Path, err == nil))
	}
	return result, err
}

func main() {
	audit := &AuditHook{}

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()
	p.AddHook(audit)

	data := `{"env": "prod", "password": "hunter2", "token": "t-1"}`

	data, err = p.Set(data, "password", nil)
	if err != nil {
		panic(err)
	}
	data, err = p.Delete(data, "token")
	if err != nil {
		panic(err)
	}

	for _, e := range audit.entries {
		fmt.Println(e)
	}
	// 输出：
	// op=set path=password ok=true
	// op=delete path=token ok=true
}
```

生产落地建议：把 `entries` 换成 `*slog.Logger`（`slog.Info("data modification", "op", ..., "path", ..., "success", ...)`）或异步写入审计存储；需要耗时信息时叠加一个 [`TimingHook`](#timinghook)。

---

## 相关

- [接口定义](../api-reference/interfaces) - 扩展接口
- [Schema 校验](../api-reference/schema) - Schema 验证
- [Config](../api-reference/config) - 配置选项
