---
sidebar_label: "批量操作"
title: "Processor 批量操作 - CyberGo JSON | ProcessBatch 方法与配置"
description: "CyberGo JSON 的 Processor 提供 ProcessBatch 批量操作，一次调用完成 get/set/delete/validate 四类任务，结果按 ID 关联且顺序一致，可借 Config 定制美化输出与批量上限，适合网关聚合、数据管道等高吞吐批处理场景。"
sidebar_position: 70
---

# 批量操作方法

Processor 提供批量操作能力，一次调用处理多个 JSON 操作（get/set/delete/validate）。相比包级 [`ProcessBatch`](../functions/batch)，Processor 形式适合复用实例、或借助 `Config` 定制每次批次的行为（美化输出、数字保留、安全限制等）。

## ProcessBatch

签名：`func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

批量处理多个 JSON 操作。返回结果顺序与输入操作顺序一致，通过 `ID` 字段关联。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo","age":25}}`
	results, err := p.ProcessBatch([]json.BatchOperation{
		{Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
		{Type: "set", JSONStr: data, Path: "user.age", Value: 30, ID: "age"},
	})
	if err != nil {
		panic(err)
	}
	for _, r := range results {
		fmt.Printf("%s: %v\n", r.ID, r.Result)
	}
}

// 输出：
// name: CyberGo
// age: {"user":{"age":30,"name":"CyberGo"}}
```

### 支持的操作类型

四类操作（`get`/`set`/`delete`/`validate`）各自的 `Result` 内容与典型错误对照，以及「操作互不链式」的语义说明，与包级函数完全一致——完整表格见[批量操作函数·支持的操作类型](../functions/batch#支持的操作类型)。Processor 侧的差异只在配置生效方式（`cfg` 按调用覆盖处理器自身配置，见下节）。

### 批量大小限制

操作数量受 `Config.MaxBatchSize` 约束（默认 `2000`）。该上限按「每次调用」生效——传入的 `cfg`（若有）覆盖 Processor 自身的配置。超出时整个批次直接失败，返回 `(nil, ErrSizeLimit)`。

## 各操作类型示例

### get — 批量读取

`get` 操作的 `Result` 是路径处的原始值（数字默认为 `float64`）。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo","age":25}}`
	results, err := p.ProcessBatch([]json.BatchOperation{
		{Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
		{Type: "get", JSONStr: data, Path: "user.age", ID: "age"},
	})
	if err != nil {
		panic(err)
	}
	for _, r := range results {
		fmt.Printf("%s: %v\n", r.ID, r.Result)
	}
}

// 输出：
// name: CyberGo
// age: 25
```

### set — 批量修改

`set` 的 `Result` 是**修改后的完整 JSON 字符串**（紧凑格式，对象键按字典序排列）。默认 `CreatePaths=true`，设置新路径会自动创建中间节点：

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo","age":25}}`
	results, err := p.ProcessBatch([]json.BatchOperation{
		{Type: "set", JSONStr: data, Path: "user.age", Value: 30, ID: "age"},
		{Type: "set", JSONStr: data, Path: "user.role", Value: "admin", ID: "role"},
	})
	if err != nil {
		panic(err)
	}
	for _, r := range results {
		fmt.Printf("%s -> %s\n", r.ID, r.Result)
	}
}

// 输出：
// age -> {"user":{"age":30,"name":"CyberGo"}}
// role -> {"user":{"age":25,"name":"CyberGo","role":"admin"}}
```

::: tip 配置如何作用于批次
传入的 `Config` 会逐操作透传，但**并非所有字段都影响输出**：`set`/`delete` 的返回值始终是紧凑字符串（不受 `Pretty` 影响，如需美化请对结果另用 [`Prettify`](./output#prettify)）；真正按 `cfg` 生效的是 `MaxBatchSize`（批次上限）、`CreatePaths`（是否允许 `set` 新建路径）以及 `PreserveNumbers`（影响 `get` 返回的数字类型：默认 `float64`，开启后为 `json.Number`）。
:::

### delete — 批量删除

`delete` 的 `Result` 是**删除后的完整 JSON 字符串**。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo","age":25,"temp":"x"},"debug":true}`
	results, err := p.ProcessBatch([]json.BatchOperation{
		{Type: "delete", JSONStr: data, Path: "user.temp", ID: "drop-temp"},
		{Type: "delete", JSONStr: data, Path: "debug", ID: "drop-debug"},
	})
	if err != nil {
		panic(err)
	}
	for _, r := range results {
		fmt.Printf("%s -> %s\n", r.ID, r.Result)
	}
}

// 输出：
// drop-temp -> {"debug":true,"user":{"age":25,"name":"CyberGo"}}
// drop-debug -> {"user":{"age":25,"name":"CyberGo","temp":"x"}}
```

### validate — 批量验证

`validate` 的 `Result` 始终是 `map[string]any{"valid": bool}`；非法 JSON 时 `valid` 为 `false` 且 `Error` 携带解析错误。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	results, err := p.ProcessBatch([]json.BatchOperation{
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

### 混合操作

同一个批次可混合不同类型的操作，结果按顺序返回：

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo"},"processed":false}`
	results, err := p.ProcessBatch([]json.BatchOperation{
		{Type: "validate", JSONStr: data, ID: "check"},
		{Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
		{Type: "set", JSONStr: data, Path: "processed", Value: true, ID: "mark"},
	})
	if err != nil {
		panic(err)
	}

	for _, r := range results {
		if r.ID == "check" {
			if m, ok := r.Result.(map[string]any); ok {
				fmt.Printf("验证结果: %v\n", m["valid"])
			}
		} else {
			fmt.Printf("%s: %v\n", r.ID, r.Result)
		}
	}
}

// 输出：
// 验证结果：true
// name: CyberGo
// mark: {"processed":true,"user":{"name":"CyberGo"}}
```

## 错误处理与容错

### 单操作失败不中断批次

`ProcessBatch` **总是处理全部操作**：某个操作失败只会写入该条结果的 `Error` 字段，不会中断后续操作，也无需任何配置开启。因此批量结果可能「部分成功、部分失败」，务必逐条检查 `r.Error`：

```go
results, err := p.ProcessBatch(operations)
if err != nil {
    // err 仅在处理器关闭、配置非法或超过 MaxBatchSize 时出现
    return err
}
for _, r := range results {
    if r.Error != nil {
        log.Printf("操作 %s 失败: %v", r.ID, r.Error)
        continue
    }
    // 处理 r.Result ...
}
```

::: tip 与 ContinueOnError 的区别
`Config.ContinueOnError` 字段控制的是 [`SetMultiple`](./modify#setmultiple) 的中途容错（某条路径写入失败时是否继续写其余路径），**并不**作用于 `ProcessBatch`。`ProcessBatch` 的逐操作隔离是内置行为，无需也无法通过该开关关闭。
:::

## 实战场景：批量数据迁移

将一批记录统一加上迁移标记，一次 `ProcessBatch` 调用完成全部转换。Processor 形式尤其适合在长驻服务中复用同一实例处理大量批次：

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	records := []string{
		`{"id":1,"name":"Alice","age":30}`,
		`{"id":2,"name":"Bob","age":25}`,
		`{"id":3,"name":"CyberGo","age":28}`,
	}

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

	results, err := p.ProcessBatch(ops)
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

签名：`func (p *Processor) WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

对同一份 JSON 的热点路径预先求值并填入缓存，使后续首次 [`Get`](./query) 直接命中缓存。要求 Processor 开启缓存（默认开启），否则返回 `JsonsError`（`Op` 为 `warmup_cache`，错误消息为 "cache is disabled, cannot warmup cache"）。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo","age":25},"meta":{"version":2}}`
	result, err := p.WarmupCache(data, []string{"user.name", "user.age", "meta.version"})
	if err != nil {
		panic(err)
	}
	fmt.Printf("预热：%d/%d 成功（%.0f%%）\n", result.Successful, result.TotalPaths, result.SuccessRate)
}

// 输出：
// 预热：3/3 成功（100%）
```

`WarmupResult` 结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| `TotalPaths` | `int` | 待预热路径总数 |
| `Successful` | `int` | 成功条数 |
| `Failed` | `int` | 失败条数 |
| `SuccessRate` | `float64` | 成功率（百分比） |
| `FailedPaths` | `[]string` | 失败的路径列表（无失败时为 nil） |

当全部路径都失败时，`WarmupCache` 在返回 `WarmupResult` 的同时附带最后一个错误。

## 类型定义

### BatchOperation 结构

```go
type BatchOperation struct {
    Type    string `json:"type"`     // 操作类型："get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // JSON 字符串
    Path    string `json:"path"`     // 目标路径
    Value   any    `json:"value"`    // Set 操作的值
    ID      string `json:"id"`       // 操作标识符
}
```

### BatchResult 结构

```go
type BatchResult struct {
    ID     string `json:"id"`     // 对应的操作 ID
    Result any    `json:"result"` // 操作结果（含义随 Type 变化，见上表）
    Error  error  `json:"error"`  // 单个操作的错误（不影响其他操作）
}
```

## 注意事项

1. 每个操作独立执行，一个失败不影响其他操作（内置行为，无需配置）
2. 结果顺序与操作顺序一致，通过 `ID` 匹配操作和结果
3. `MaxBatchSize`（默认 2000）按每次调用的 `cfg` 生效，超出则整批失败

## 相关

- [路径查询](./query) - Get 系列方法
- [数据修改](./modify) - Set/Delete/SetMultiple 方法
- [包级批量操作](../functions/batch) - 无需 Processor 的包级 ProcessBatch
