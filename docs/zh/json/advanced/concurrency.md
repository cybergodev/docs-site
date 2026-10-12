---
sidebar_label: "并发与并行处理"
title: "并发与并行处理 - CyberGo JSON | goroutine 安全实战"
description: "CyberGo JSON 提供线程安全的并发与并行处理能力，支持单个 Processor 实例跨 goroutine 共享、ParallelIterator 多核并行迭代与 StreamJSONLParallel 并行 JSONL 流，帮助开发者安全利用多核加速大批量数据处理并管控并发上限。"
sidebar_position: 40
---

# 并发与并行处理

CyberGo JSON 的所有操作都是**并发安全**的，并提供开箱即用的并行处理 API（`ParallelIterator`、并行 JSONL 流）。本页文档化线程安全语义、内置并行 API 与并发使用模式。

:::tip 与性能优化页的分工
[性能优化](./performance) 的「并发处理」一节展示的是**通用 Go 模式**（`sync.WaitGroup` + 信号量 + Worker Pool）手动并发处理数组；本页文档化的是**库内置**并行 API，二者互补。
:::

## 线程安全保证

`Processor` 是线程安全的主处理引擎（源码注释：`Processor is the main JSON processing engine with thread safety`）：

- **单个 Processor 实例可被多个 goroutine 共享**——所有公开方法（`Get`/`Set`/`Delete`/`Marshal` 等）内部已用原子操作与并发治理（`beginGovernedOp`/`endGovernedOp`）保护。
- **包级函数**（`json.Get`、`json.GetString` 等）共享一个全局 Processor，天然并发安全。
- **`PreParse` 返回的 `*ParsedJSON` 可被并发读取**——多个 goroutine 可同时对同一 `ParsedJSON` 调用 `GetFromParsed`。

:::warning 何时不要共享
`Processor` 可共享，但**不要跨 goroutine 共享可变的 Go 容器**（如把 `Get` 返回的 `map[string]any` 交给多个 goroutine 改写）。库返回的容器默认是拷贝（除非开启 `CacheSharedResults`），改写返回值不影响缓存，但多 goroutine 改写同一容器仍需调用方自行加锁。
:::

## ParallelIterator 并行迭代器

`ParallelIterator` 利用多核 CPU 并行处理数组，内置 worker 池、错误聚合与 panic 恢复，比手写 goroutine 池更安全。

### 基础并行遍历

```go
package main

import (
	"fmt"
	"sync"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"items":[1,2,3,4,5,6,7,8]}`
	items := json.GetArray(data, "items")

	// worker 数默认取 Config.MaxConcurrency（受数组长度裁剪）
	iter := json.NewParallelIterator(items)
	defer iter.Close()

	var mu sync.Mutex
	var sum int64
	err := iter.ForEach(func(_ int, val any) error {
		mu.Lock()
		sum += int64(val.(float64))
		mu.Unlock()
		return nil
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("总和 = %d\n", sum)
	// 输出：总和 = 36
}
```

### 并行映射 Map

`Map` 并行变换每个元素，结果**保持原始顺序**（每个 worker 写入自己的索引位，无需加锁）。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"items":[1,2,3,4]}`
	items := json.GetArray(data, "items")

	iter := json.NewParallelIterator(items)
	defer iter.Close()

	// 并行映射：每个元素 *10，结果顺序与输入一致
	doubled, err := iter.Map(func(_ int, val any) (any, error) {
		return int(val.(float64)) * 10, nil
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(doubled)
	// 输出：[10 20 30 40]
}
```

### 按批并行 ForEachBatch / ForEachBatchWithContext

单元素回调开销高（如每元素一次系统调用或网络请求）时，`ForEachBatch` 把元素切成固定大小的批次，**每批由一个 goroutine 处理**——批内串行、批间并行，摊薄调度与同步成本。

```go
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"records":[10,20,30,40,50,60,70,80,90,100]}`
	records := json.GetArray(data, "records")

	iter := json.NewParallelIterator(records)
	defer iter.Close()

	// 10 条记录按每批 3 条切分 → 4 批（末批 1 条）；按 batchIdx 写入独立下标，无需加锁
	subtotals := make([]int, 4)
	err := iter.ForEachBatch(3, func(batchIdx int, batch []any) error {
		sum := 0
		for _, v := range batch {
			sum += int(v.(float64))
		}
		subtotals[batchIdx] = sum
		return nil
	})
	if err != nil {
		panic(err)
	}

	// 全部批次完成后顺序消费（执行顺序不保证，结果按下标落位）
	for i, s := range subtotals {
		fmt.Printf("批次 %d 小计 = %d\n", i, s)
	}

	// 带超时控制的版本：ctx 到期后未派发的批次不再执行，运行中的批次检查到取消后退出
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	err = iter.ForEachBatchWithContext(ctx, 100, func(batchIdx int, batch []any) error {
		return nil // 模拟单批处理
	})
	fmt.Println("带超时批处理完成，错误：", err)
}

// 输出：
// 批次 0 小计 = 60
// 批次 1 小计 = 150
// 批次 2 小计 = 240
// 批次 3 小计 = 100
// 带超时批处理完成，错误：<nil>
```

`batchSize <= 0` 时按 100 处理。回调返回错误与 `ForEach` 相同：首个错误胜出并停止派发新批次；批次的**派发**顺序与输入一致（`batchIdx` 递增），但**执行**顺序不保证——保序输出的做法即上例：按下标落位、完成后顺序消费。

### ParallelIterator API 一览

| API | 签名 | 说明 |
|-----|------|------|
| `NewParallelIterator` | `func NewParallelIterator(data []any, cfg ...Config) *ParallelIterator` | 创建迭代器；worker 数取 `cfg.MaxConcurrency`（默认 50，超出数组长度时裁剪；`<= 0` 回退 4） |
| `ForEach` | `func (it *ParallelIterator) ForEach(fn func(int, any) error) error` | 并行遍历，返回首个错误 |
| `ForEachWithContext` | `func (it *ParallelIterator) ForEachWithContext(ctx context.Context, fn func(int, any) error) error` | 支持 context 取消 |
| `ForEachBatch` | `func (it *ParallelIterator) ForEachBatch(batchSize int, fn func(int, []any) error) error` | 按批并行处理，批内串行、批间并行 |
| `ForEachBatchWithContext` | `func (it *ParallelIterator) ForEachBatchWithContext(ctx context.Context, batchSize int, fn func(int, []any) error) error` | 按批并行 + context 取消 |
| `Map` | `func (it *ParallelIterator) Map(transform func(int, any) (any, error)) ([]any, error)` | 并行变换，保序返回 |
| `Filter` | `func (it *ParallelIterator) Filter(predicate func(int, any) bool) []any` | 并行过滤，保序返回（无错误返回值） |
| `Close` | `func (it *ParallelIterator) Close()` | 释放资源（信号运行中 goroutine 停止，可安全多次调用） |

完整签名与用法见 [迭代器类型](../api-reference/iterator#paralleliterator-类型)。

:::tip 错误与 panic 处理
`ForEach` 返回**首个**错误即停止派发新任务；worker 内的 panic 会被恢复（`recover`）并转为错误返回，不会击溃进程。需可取消时用 `ForEachWithContext`，在 `ctx.Done()` 时优雅退出。
:::

## 并行 JSONL 流处理

处理大型 JSONL（NDJSON）文件时，`StreamJSONLParallel` 用多 worker 并行处理每一行。

```go
package main

import (
	"fmt"
	"strings"
	"sync"

	"github.com/cybergodev/json"
)

func main() {
	// 模拟 JSONL 数据（每行一个 JSON 对象）
	jsonlData := `{"id":1,"score":95}
{"id":2,"score":82}
{"id":3,"score":78}
{"id":4,"score":90}`

	processor, err := json.New()
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	var mu sync.Mutex
	var total int64
	var count int64

	// 4 个 worker 并行处理每一行
	err = processor.StreamJSONLParallel(strings.NewReader(jsonlData), 4, func(lineNum int, item *json.IterableValue) error {
		score := int64(item.GetInt("score"))
		mu.Lock()
		total += score
		count++
		mu.Unlock()
		return nil
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("处理 %d 条，总分 %d\n", count, total)
	// 输出：处理 4 条，总分 345
}
```

| API | 说明 |
|-----|------|
| `StreamJSONLParallel(reader, workers, fn)` | 多 worker 并行处理 JSONL |
| `StreamJSONLParallelWithContext(ctx, reader, workers, fn)` | 同上，支持 context 取消与超时 |
| `StreamJSONLChunked(reader, chunkSize, fn)` | 按块处理，内存友好 |

完整签名与配置（`JSONLWorkers`/`JSONLChunkSize` 等）见 [JSONL 处理](../api-reference/processor/jsonl) 与 [JSONL 流式](../streaming/jsonl)。

:::tip 行顺序
并行模式下回调的 `lineNum` 仍反映原始行号，但**执行顺序不保证**。若需保序输出，在回调中按 `lineNum` 写入预分配切片的对位索引。
:::

## 全局处理器并发使用

`SetGlobalProcessor` 让所有包级函数共享同一个自定义 Processor，适合需要统一配置（缓存参数、钩子、安全限制）的多 goroutine 服务。

```go
package main

import (
	"fmt"
	"sync"

	"github.com/cybergodev/json"
)

func main() {
	// 自定义全局处理器（所有包级函数共享，并发安全）
	cfg := json.DefaultConfig()
	processor, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	json.SetGlobalProcessor(processor)   // 旧的全局 Processor 会被自动关闭
	defer json.ShutdownGlobalProcessor() // 应用退出时干净关闭

	data := `{"user":{"name":"Alice","age":30}}`

	// 多个 goroutine 并发使用包级函数（共享同一全局 Processor）
	var wg sync.WaitGroup
	results := make([]string, 3)
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			switch idx {
			case 0:
				results[idx] = json.GetString(data, "user.name")
			case 1:
				results[idx] = fmt.Sprintf("%d", json.GetInt(data, "user.age"))
			case 2:
				results[idx] = json.GetString(data, "user.name")
			}
		}(i)
	}
	wg.Wait()
	fmt.Println(results)
	// 输出：[Alice 30 Alice]
}
```

:::warning 所有权转移
`SetGlobalProcessor` 后，该 Processor 的生命周期由全局管理——**不要**再手动 `Close()` 它，否则会与全局的关闭逻辑冲突。退出时调用 `ShutdownGlobalProcessor()` 即可干净关闭并释放资源。
:::

## 并发限制 MaxConcurrency

`Config.MaxConcurrency`（默认 50）是单个 Processor 的**软并发上限**：用原子计数信号量限制在途操作数。达到上限时，新操作返回 `ErrConcurrencyLimit`（可重试）。

```go
cfg := json.DefaultConfig()
cfg.MaxConcurrency = 100 // 提高单 Processor 并发上限
```

- `ErrConcurrencyLimit` 是**可重试**的暂时性错误（见 [错误处理](./error-handling#系统错误)）。
- 并行流处理（`StreamJSONLParallel`）的 worker 数由参数显式指定，不与 `MaxConcurrency` 直接绑定，但共享同一治理槽位。
- `ParallelIterator` 的 worker 数取自 `cfg.MaxConcurrency`（默认 50），但会被数组长度裁剪。

## 最佳实践与陷阱

### 1. 复用 Processor，不要每请求新建

`Processor` 内部维护缓存、递归处理器等状态，**复用同一实例**才能命中缓存。每请求 `json.New()` 会丧失缓存收益并增加分配。

### 2. 共享实例安全，共享返回值容器要谨慎

`Processor` 可跨 goroutine 共享；但 `Get` 返回的 `map`/`slice` 若要在多 goroutine 间共享改写，调用方须自行加锁（或开启 `CacheSharedResults` 后视为只读）。

### 3. 用 Close 释放资源

长跑服务中显式 `defer processor.Close()` 与 `defer iter.Close()`，避免缓存 goroutine 与内存泄漏。`SetGlobalProcessor` 设置的实例改用 `ShutdownGlobalProcessor`。

### 4. CPU 密集型才值得并行

并行有调度与同步开销。小数组（< `ParallelThreshold` 默认 10）串行更快；JSONL 行数大、单行处理重时并行收益明显。

### 5. 并行模式注意行序

`StreamJSONLParallel` 不保证处理顺序。需要保序时按 `lineNum` 写入对位索引，处理完再顺序消费。

## 相关

- [性能优化](./performance) — 处理器复用、通用 Go 并发模式、基准测试
- [迭代器类型](../api-reference/iterator) — `ParallelIterator` 完整 API
- [JSONL 处理](../api-reference/processor/jsonl) — 并行 JSONL API 详情
- [缓存与预解析](./caching) — 缓存机制与 PreParse 预解析
- [错误处理](./error-handling) — `ErrConcurrencyLimit` 等错误分类
