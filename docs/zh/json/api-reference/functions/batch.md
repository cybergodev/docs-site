---
sidebar_label: "批量操作"
title: "批量操作函数 - CyberGo JSON | ProcessBatch 用法与示例"
description: "批量操作：ProcessBatch 执行 get/set/delete/validate，单条失败不中断批次，上限 MaxBatchSize（默认 2000），WarmupCache 预热。"
sidebar_position: 70
---

# 批量操作函数

json 包的批量操作函数，一次处理多个 JSON 操作（get/set/delete/validate），另含缓存预热。

## ProcessBatch

签名：`func ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

批量处理多个 JSON 操作（包级函数，无需创建 Processor）。结果顺序与输入操作一一对应，用 `ID` 字段关联。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

	operations := []json.BatchOperation{
		{Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
		{Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
	}

	results, err := json.ProcessBatch(operations)
	if err != nil {
		panic(err)
	}
	for _, r := range results {
		if r.Error != nil {
			fmt.Printf("操作 %s 失败: %v\n", r.ID, r.Error)
		} else {
			fmt.Printf("操作 %s 结果: %v\n", r.ID, r.Result)
		}
	}
}

// 输出：
// 操作 op1 结果：CyberGo
// 操作 op2 结果：{"user":{"age":30,"name":"CyberGo"}}
```

### 支持的操作类型

| `Type` | 作用 | `Result` 内容 | 典型错误 |
|--------|------|---------------|----------|
| `get` | 读取路径上的值 | 路径处的值（`any`） | `ErrPathNotFound`、`ErrInvalidJSON` |
| `set` | 设置路径的值 | **修改后的完整 JSON 字符串** | `ErrPathNotFound`（未开 `CreatePaths`）、`ErrInvalidPath` |
| `delete` | 删除路径上的节点 | **删除后的完整 JSON 字符串** | `ErrPathNotFound`、`ErrInvalidPath` |
| `validate` | 验证 JSON 是否合法 | `map[string]any{"valid": bool}` | 无效 JSON 时 `Result.valid=false` 且 `Error` 非空 |

`Type` 不是上述四者之一时（如拼写错误），该条操作的 `Error` 为 `unknown operation type: <type>`，批次**不中断**，其余操作照常执行。

::: warning 操作互不链式
每个 `BatchOperation` 都**独立**作用于各自的 `JSONStr` 输入，操作之间**不会**链式叠加。例如对同一文档先 `set` 再 `delete`，得到的是两个独立结果，而不是「先改再删」的叠加态。若需对单个文档做多步变换，请在代码中将上一步的输出喂给下一步，或改用 [`SetMultiple`](./modify#setmultiple) 等单文档多路径方法。
:::

### 批量大小限制

操作数量受 `Config.MaxBatchSize` 约束（默认 `2000`，`Validate` 将其钳制在 10–10000）。超出时整个批次直接失败，返回 `(nil, JsonsError)` 且 `Err` 为 `ErrSizeLimit`。上限取**本次调用传入的 cfg**；未传 cfg 时用处理器自身的配置：

```go
// 自定义上限（适用于超大批量场景）
cfg := json.DefaultConfig()
cfg.MaxBatchSize = 5000
results, err := json.ProcessBatch(ops, cfg)
```

## 各操作类型示例

### get — 批量读取

`get` 操作的 `Result` 是路径处的原始值（数字默认为 `float64`，布尔为 `bool`，字符串为 `string`）。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"name":"CyberGo","age":25},"active":true}`

	results, err := json.ProcessBatch([]json.BatchOperation{
		{Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
		{Type: "get", JSONStr: data, Path: "user.age", ID: "age"},
		{Type: "get", JSONStr: data, Path: "active", ID: "active"},
	})
	if err != nil {
		panic(err)
	}

	for _, r := range results {
		if r.Error != nil {
			fmt.Printf("%s 失败: %v\n", r.ID, r.Error)
			continue
		}
		fmt.Printf("%s = %v\n", r.ID, r.Result)
	}
}

// 输出：
// name = CyberGo
// age = 25
// active = true
```

### set — 批量修改

`set` 操作的 `Result` 是**修改后的完整 JSON 字符串**，不是写入的值本身。默认配置 `CreatePaths=true`，因此设置新路径会自动创建中间节点。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"name":"CyberGo","age":25}}`

	results, err := json.ProcessBatch([]json.BatchOperation{
		{Type: "set", JSONStr: data, Path: "user.age", Value: 30, ID: "update-age"},
		{Type: "set", JSONStr: data, Path: "user.role", Value: "admin", ID: "add-role"},
	})
	if err != nil {
		panic(err)
	}

	for _, r := range results {
		if r.Error != nil {
			fmt.Printf("%s 失败: %v\n", r.ID, r.Error)
			continue
		}
		fmt.Printf("%s -> %s\n", r.ID, r.Result)
	}
}

// 输出：
// update-age -> {"user":{"age":30,"name":"CyberGo"}}
// add-role -> {"user":{"age":25,"name":"CyberGo","role":"admin"}}
```

::: tip 输出格式说明
`set`/`delete` 返回的 JSON 字符串为**紧凑格式**（无多余空白），且对象键按字典序排列（与 `encoding/json` 行为一致，保证输出确定）。若需美化输出，请对结果另用 [`Prettify`](./output#prettify)。
:::

### delete — 批量删除

`delete` 操作的 `Result` 是**删除后的完整 JSON 字符串**。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"name":"CyberGo","age":25,"temp":"x"},"debug":true}`

	results, err := json.ProcessBatch([]json.BatchOperation{
		{Type: "delete", JSONStr: data, Path: "user.temp", ID: "drop-temp"},
		{Type: "delete", JSONStr: data, Path: "debug", ID: "drop-debug"},
	})
	if err != nil {
		panic(err)
	}

	for _, r := range results {
		if r.Error != nil {
			fmt.Printf("%s 失败: %v\n", r.ID, r.Error)
			continue
		}
		fmt.Printf("%s -> %s\n", r.ID, r.Result)
	}
}

// 输出：
// drop-temp -> {"debug":true,"user":{"age":25,"name":"CyberGo"}}
// drop-debug -> {"user":{"age":25,"name":"CyberGo","temp":"x"}}
```

### validate — 批量验证

`validate` 操作的 `Result` 始终是 `map[string]any{"valid": bool}`；JSON 非法时 `valid` 为 `false`，`Error` 携带解析错误。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	results, err := json.ProcessBatch([]json.BatchOperation{
		{Type: "validate", JSONStr: `{"name":"CyberGo"}`, ID: "ok"},
		{Type: "validate", JSONStr: `{"name":}`, ID: "broken"},
	})
	if err != nil {
		panic(err)
	}

	for _, r := range results {
		if m, ok := r.Result.(map[string]any); ok {
			fmt.Printf("%s: valid=%v\n", r.ID, m["valid"])
		}
		if r.Error != nil {
			fmt.Printf("%s 错误: %v\n", r.ID, r.Error)
		}
	}
}

// 输出：
// ok: valid=true
// broken: valid=false
// broken 错误：invalid JSON: ...
```

## 错误处理与容错

### 单操作失败不中断批次

`ProcessBatch` **总是执行全部操作**：某个操作失败只写入该条结果的 `Error` 字段，不中断后续操作，也无需任何配置开启。因此批量结果可能「部分成功、部分失败」，必须逐条检查 `r.Error`：

```go
results, err := json.ProcessBatch(operations)
if err != nil {
    // err 仅在处理器关闭、配置非法或超过 MaxBatchSize 时出现
    panic(err)
}
var failed int
for _, r := range results {
    if r.Error != nil {
        failed++
        log.Printf("操作 %s 失败: %v", r.ID, r.Error)
        continue
    }
    // 处理 r.Result ...
}
```

::: tip 与 ContinueOnError 的区别
`Config.ContinueOnError` 字段控制的是 [`SetMultiple`](./modify#setmultiple) 的中途容错（某条路径写入失败时是否继续写其余路径），**不**作用于 `ProcessBatch`。`ProcessBatch` 的逐操作隔离是内置行为，无法通过该开关关闭。
:::

## 实战场景：批量数据迁移

将一批记录统一加上迁移标记，一次 `ProcessBatch` 调用完成全部转换，并收集每条记录的输出：

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// 模拟从数据源读取的多条记录
	records := []string{
		`{"id":1,"name":"Alice","age":30}`,
		`{"id":2,"name":"Bob","age":25}`,
		`{"id":3,"name":"CyberGo","age":28}`,
	}

	// 为每条记录生成一个 set 操作，统一打上迁移标记
	ops := make([]json.BatchOperation, len(records))
	for i, r := range records {
		ops[i] = json.BatchOperation{
			Type:    "set",
			JSONStr: r,
			Path:    "migrated",
			Value:   true,
			ID:      fmt.Sprintf("record-%d", i),
		}
	}

	results, err := json.ProcessBatch(ops)
	if err != nil {
		panic(err)
	}

	for _, r := range results {
		if r.Error != nil {
			fmt.Printf("%s 失败: %v\n", r.ID, r.Error)
			continue
		}
		fmt.Printf("%s -> %s\n", r.ID, r.Result)
	}
}

// 输出：
// record-0 -> {"age":30,"id":1,"migrated":true,"name":"Alice"}
// record-1 -> {"age":25,"id":2,"migrated":true,"name":"Bob"}
// record-2 -> {"age":28,"id":3,"migrated":true,"name":"CyberGo"}
```

## 缓存预热 WarmupCache

签名：`func WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

对同一份 JSON 的热点路径预先求值并填入缓存，使后续首次 `Get` 命中缓存。要求处理器开启缓存（默认开启）；未开启时返回 `JsonsError`（`Op` 为 `warmup_cache`，消息为 `cache is disabled, cannot warmup cache`）。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"name":"CyberGo","age":25},"meta":{"version":2}}`

	result, err := json.WarmupCache(data, []string{"user.name", "user.age", "meta.version"})
	if err != nil {
		panic(err)
	}
	fmt.Printf("预热：%d/%d 成功（%.0f%%）\n", result.Successful, result.TotalPaths, result.SuccessRate)

	// 预热后首次 Get 命中缓存
	name, err := json.Get(data, "user.name")
	if err != nil {
		panic(err)
	}
	fmt.Println("name:", name)
}

// 输出：
// 预热：3/3 成功（100%）
// name: CyberGo
```

`WarmupResult` 结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| `TotalPaths` | `int` | 待预热路径总数 |
| `Successful` | `int` | 成功条数 |
| `Failed` | `int` | 失败条数 |
| `SuccessRate` | `float64` | 成功率（百分比） |
| `FailedPaths` | `[]string` | 失败的路径列表（无失败时为 nil） |

当全部路径都失败时，`WarmupCache` 返回 `WarmupResult` 的同时附带最后一个错误（`err` 非 nil，`Successful` 为 0）。

## 类型定义

### BatchOperation

批量操作描述结构。

```go
type BatchOperation struct {
    Type    string `json:"type"`     // 操作类型："get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // 目标 JSON 字符串
    Path    string `json:"path"`     // 路径表达式
    Value   any    `json:"value"`    // 操作值（set 操作使用）
    ID      string `json:"id"`       // 操作标识
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `Type` | `string` | 操作类型：`get` / `set` / `delete` / `validate` |
| `JSONStr` | `string` | 该操作的输入 JSON（各操作相互独立，不链式叠加） |
| `Path` | `string` | 路径表达式（`validate` 不使用） |
| `Value` | `any` | `set` 要写入的值（其余类型不使用） |
| `ID` | `string` | 调用方自定义标识，原样复制到对应结果的 `BatchResult.ID` |

### BatchResult

批量操作结果结构。

```go
type BatchResult struct {
    ID     string `json:"id"`     // 操作标识
    Result any    `json:"result"` // 操作结果（含义随 Type 变化，见上表）
    Error  error  `json:"error"`  // 错误信息（单操作级别）
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `ID` | `string` | 对应操作的 `ID`；结果切片与输入操作按下标顺序一一对应 |
| `Result` | `any` | 操作结果，含义随 `Type` 变化（见上方表格） |
| `Error` | `error` | 该条操作的错误，`nil` 表示成功；必须逐条检查 |

::: tip Processor 批量方法
Processor 实例提供等价的批量方法 `p.ProcessBatch(operations)`，签名与包级函数一致，适合复用 Processor、或需要按 `Config` 定制（如 `Pretty` 输出、`PreserveNumbers`）的场景。详见 [Processor 批量操作](../processor/batch)。
:::

## 相关

- [修改函数](./modify) - Set, SetMultiple, MergeJSON 等修改操作
- [Processor 批量操作](../processor/batch) - Processor 级批量操作方法详解
- [辅助工具](../helpers) - WarmupCache、ClearCache、GetStats 等工具函数
