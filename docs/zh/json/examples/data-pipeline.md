---
sidebar_label: "JSONL 数据管道"
title: "JSONL 数据管道 - CyberGo JSON | ETL 流式转换"
description: "CyberGo JSON 构建 JSONL 数据管道：StreamLinesInto 流式读取并在回调中转换字段、ToJSONL/ToJSONLString 批量写回、NDJSONProcessor 与 ForeachFile 迭代处理大文件，实现字段富化与级别分类，适合日志清洗与分析等流式处理场景。"
sidebar_position: 40
---

# JSONL 数据管道

本文演示如何用 CyberGo JSON 构建 JSONL（换行分隔 JSON）数据管道：流式读取、转换字段、批量格式转换，以及处理大文件。

## 流式读取并转换 JSONL

用泛型 `StreamLinesInto[T]` 逐行读取 JSONL 流并反序列化为结构体，在回调中转换字段，最后用 `ToJSONLString` 批量写回 JSONL 格式。

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

// LogEntry 表示一行 JSON 日志
type LogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
}

// EnrichedLog 是转换后的日志（重命名字段并新增分类）
type EnrichedLog struct {
	Timestamp string `json:"ts"`
	Level     string `json:"level"`
	Message   string `json:"msg"`
	Category  string `json:"category"`
}

func main() {
	// 模拟 JSONL 日志流（实际可来自文件或网络）
	jsonlStream := `{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":"服务启动"}
{"timestamp":"2024-01-01T10:00:05Z","level":"ERROR","message":"数据库连接失败"}
{"timestamp":"2024-01-01T10:00:10Z","level":"WARN","message":"响应时间超过阈值"}
{"timestamp":"2024-01-01T10:00:15Z","level":"INFO","message":"重连成功"}`

	reader := strings.NewReader(jsonlStream)

	// 1. 流式读取并转换每行日志
	var enriched []any
	entries, err := json.StreamLinesInto[LogEntry](reader, func(lineNum int, entry LogEntry) error {
		// 根据级别分类
		category := "normal"
		if entry.Level == "ERROR" {
			category = "critical"
		} else if entry.Level == "WARN" {
			category = "warning"
		}

		enriched = append(enriched, EnrichedLog{
			Timestamp: entry.Timestamp,
			Level:     entry.Level,
			Message:   entry.Message,
			Category:  category,
		})
		return nil
	})
	if err != nil {
		panic(err)
	}

	// 2. 批量转换回 JSONL 格式
	output, err := json.ToJSONLString(enriched)
	if err != nil {
		panic(err)
	}
	fmt.Printf("处理了 %d 行日志\n", len(entries))
	fmt.Print(output)
}

// 输出：
// 处理了 4 行日志
// {"ts":"2024-01-01T10:00:00Z","level":"INFO","msg":"服务启动","category":"normal"}
// {"ts":"2024-01-01T10:00:05Z","level":"ERROR","msg":"数据库连接失败","category":"critical"}
// {"ts":"2024-01-01T10:00:10Z","level":"WARN","msg":"响应时间超过阈值","category":"warning"}
// {"ts":"2024-01-01T10:00:15Z","level":"INFO","msg":"重连成功","category":"normal"}
```

## 处理 JSONL 文件

`NDJSONProcessor` 逐行处理 JSONL 文件，回调返回 `map[string]any`（适合字段不固定的场景）。聚合结果用 `ToJSONL` 批量转为 JSONL 字节。

```go
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/cybergodev/json"
)

func main() {
	// 创建临时 JSONL 文件确保示例可独立运行
	tmpDir, err := os.MkdirTemp("", "cybergo-pipeline-*")
	if err != nil {
		panic(err)
	}
	defer os.RemoveAll(tmpDir)

	jsonlPath := filepath.Join(tmpDir, "events.jsonl")
	jsonData := `{"event":"login","user":"alice","ts":"2024-01-01T10:00:00Z"}
{"event":"logout","user":"alice","ts":"2024-01-01T11:00:00Z"}
{"event":"login","user":"bob","ts":"2024-01-01T12:00:00Z"}
{"event":"purchase","user":"bob","ts":"2024-01-01T12:30:00Z"}`
	if err := os.WriteFile(jsonlPath, []byte(jsonData), 0644); err != nil {
		panic(err)
	}

	// 1. 用 NDJSONProcessor 逐行处理（每行解析为 map[string]any）
	processor := json.NewNDJSONProcessor()
	loginCount := 0
	err = processor.ProcessFile(jsonlPath, func(lineNum int, obj map[string]any) error {
		event, _ := obj["event"].(string)
		user, _ := obj["user"].(string)
		fmt.Printf("第 %d 行: %s by %s\n", lineNum, event, user)
		if event == "login" {
			loginCount++
		}
		return nil
	})
	if err != nil {
		panic(err)
	}

	// 2. 聚合结果转为 JSONL（批量格式转换）
	summary := []any{
		map[string]any{"metric": "logins", "count": loginCount},
		map[string]any{"metric": "total_events", "count": 4},
	}
	jsonlBytes, err := json.ToJSONL(summary)
	if err != nil {
		panic(err)
	}
	fmt.Printf("登录事件数: %d\n", loginCount)
	fmt.Printf("聚合结果:\n%s", string(jsonlBytes))
}

// 输出：
// 第 1 行: login by alice
// 第 2 行: logout by alice
// 第 3 行: login by bob
// 第 4 行: purchase by bob
// 登录事件数: 2
// 聚合结果:
// {"metric":"logins","count":2}
// {"metric":"total_events","count":4}
```

## 并行管道：StreamJSONLParallel + JSONLWriter 写出

行数多、单行处理重（转换、校验、富化）时，`StreamJSONLParallel` 用多 worker 并行消费流；结果按原始行序收集后，用 `JSONLWriter.WriteRaw` 免再编码写回 JSONL：

```go
package main

import (
	"bytes"
	"fmt"
	"slices"
	"strings"
	"sync"

	"github.com/cybergodev/json"
)

func main() {
	// 模拟事件日志流（实际可来自大文件，把 strings.NewReader 换成 os.Open 的 *os.File）
	jsonlStream := `{"event":"login","user":"alice","ts":"10:00"}
{"event":"page_view","user":"alice","ts":"10:01"}
{"event":"login","user":"bob","ts":"10:02"}
{"event":"purchase","user":"bob","ts":"10:03"}
{"event":"login","user":"carol","ts":"10:04"}`

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// 1. 并行过滤并转换：只保留 login 事件，改写为 {user, at} 结构。
	//    回调在多个 worker 中并发执行：写共享 map 须加锁；按 lineNum 存储，完成后恢复原顺序
	var mu sync.Mutex
	logins := make(map[int][]byte)

	err = p.StreamJSONLParallel(strings.NewReader(jsonlStream), 4, func(lineNum int, item *json.IterableValue) error {
		if item.GetString("event") != "login" {
			return nil // 跳过非目标事件；返回 item.Break() 可干净地停止整个流
		}
		encoded, err := json.Marshal(map[string]any{
			"user": item.GetString("user"),
			"at":   item.GetString("ts"),
		})
		if err != nil {
			return err // 返回错误会停止派发并原样上报
		}
		mu.Lock()
		logins[lineNum] = encoded
		mu.Unlock()
		return nil
	})
	if err != nil {
		panic(err)
	}

	// 2. 按原始行序写出结果（WriteRaw 直接写已编码行，仅补换行）
	lineNums := make([]int, 0, len(logins))
	for n := range logins {
		lineNums = append(lineNums, n)
	}
	slices.Sort(lineNums)

	var out bytes.Buffer
	writer := json.NewJSONLWriter(&out)
	for _, n := range lineNums {
		if err := writer.WriteRaw(logins[n]); err != nil {
			panic(err)
		}
	}

	fmt.Printf("筛出 %d 条登录事件（写出 %d 行）\n", len(logins), writer.Stats().LinesProcessed)
	fmt.Print(out.String())
}

// 输出：
// 筛出 3 条登录事件（写出 3 行）
// {"at":"10:00","user":"alice"}
// {"at":"10:02","user":"bob"}
// {"at":"10:04","user":"carol"}
```

:::tip 并行管道要点
- **顺序**：并行回调的执行顺序不保证，但 `lineNum` 始终对应原始行号——按行号收集、排序后写出即可保序。
- **worker 数**：由第二个参数显式指定（示例为 4）；需要超时/取消时改用 `StreamJSONLParallelWithContext(ctx, reader, workers, fn)`。
- **吞吐**：与串行 `StreamJSONL` 相比，收益取决于单行处理开销——纯提取类轻回调提升有限，富化/校验类重回调提升明显。
:::

## 遍历大型 JSON 数组文件

对于**单文件大 JSON 数组**（非 JSONL），`ForeachFile` 提供带回调的逐元素遍历。注意其内存语义：迭代前**整个文件会先载入内存**（`ForeachFileChunked` 的「分块」只改变内存中数据的迭代分组，同样整载）；需要恒定内存处理超大数组时，改用 `StreamIterator`（见[大文件处理](../streaming/large-files#流式迭代器与并行迭代器)），或将数据转为 JSONL 后走 `StreamJSONL` 家族。

```go
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/cybergodev/json"
)

func main() {
	tmpDir, err := os.MkdirTemp("", "cybergo-big-*")
	if err != nil {
		panic(err)
	}
	defer os.RemoveAll(tmpDir)

	// 创建大型 JSON 数组文件（模拟大数据集）
	arrayPath := filepath.Join(tmpDir, "records.json")
	records := []any{
		map[string]any{"id": 1, "amount": 100, "currency": "USD"},
		map[string]any{"id": 2, "amount": 250, "currency": "EUR"},
		map[string]any{"id": 3, "amount": 80, "currency": "USD"},
		map[string]any{"id": 4, "amount": 500, "currency": "GBP"},
		map[string]any{"id": 5, "amount": 120, "currency": "USD"},
	}
	if err := json.SaveToFile(arrayPath, records); err != nil {
		panic(err)
	}

	// 用 ForeachFile 逐条遍历数组元素（整个文件会先载入内存，适合能整载的数据集）
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	totalUSD := 0
	err = p.ForeachFile(arrayPath, func(key any, item *json.IterableValue) error {
		currency := item.GetString("currency")
		amount := item.GetInt("amount")
		if currency == "USD" {
			totalUSD += amount
		}
		return nil // 返回 item.Break() 可提前中断
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("USD 总额: %d\n", totalUSD)
}

// 输出：USD 总额: 320
```

:::tip 提示
- **JSONL 文件**（每行一个独立 JSON 对象）：用 `StreamJSONLFile` 或 `StreamLinesInto[T]`（遗留的 `NDJSONProcessor` 已弃用）。
- **大 JSON 数组文件**（单个 JSON 数组含大量元素）：恒定内存用 `StreamIterator` 逐元素流式解码；`ForeachFile` 亦可逐条遍历，但会先把整个文件载入内存，适合中小规模数组。
:::

## 下一步

- [JSONL 流式处理](../streaming/jsonl) — 完整 JSONL 处理指南
- [大文件处理](../streaming/large-files) — 流式处理大文件详解
- [基础示例](./index) — 基础 JSONL 读写用法
- [速查表](../getting-started/cheatsheet) — API 快速参考
