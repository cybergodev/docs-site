---
sidebar_label: "基础示例"
title: "使用示例 - CyberGo JSON | 典型场景代码合集"
description: "CyberGo JSON 实战示例：路径查询与修改、结构体 Marshal/Unmarshal、泛型 API、Processor 复用与缓存预热、迭代遍历与并行处理、JSONL 流式处理、Hook 钩子、Schema 验证与错误处理，含可运行 Go 代码。"
sidebar_position: 10
---

# 使用示例

本文档提供 `github.com/cybergodev/json` 库的实战代码示例。

## 基础操作

### 路径查询

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{
        "user": {
            "id": 1001,
            "name": "Alice",
            "email": "alice@example.com",
            "active": true,
            "profile": {
                "age": 28,
                "city": "Beijing"
            }
        },
        "tags": ["go", "json", "dev"],
        "scores": [95, 88, 92]
    }`

	// 简单路径
	name := json.GetString(data, "user.name")
	fmt.Println("Name:", name)

	// 嵌套路径
	city := json.GetString(data, "user.profile.city")
	age := json.GetInt(data, "user.profile.age")
	fmt.Printf("City: %s, Age: %d\n", city, age)

	// 数组索引
	firstTag := json.GetString(data, "tags.0")
	firstScore := json.GetInt(data, "scores.0")
	fmt.Printf("First tag: %s, First score: %d\n", firstTag, firstScore)

	// 获取数组
	tags := json.GetArray(data, "tags")
	fmt.Println("Tags:", tags)

	// 获取对象
	profile := json.GetObject(data, "user.profile")
	fmt.Println("Profile:", profile)

	// 带默认值获取
	country := json.GetString(data, "user.profile.country", "Unknown")
	phone := json.GetString(data, "user.phone", "N/A")
	fmt.Printf("Country: %s, Phone: %s\n", country, phone)
}
```

### 批量获取多个字段

一次 `GetMultiple` 只解析一次 JSON 即可取回多个路径的值；逐个 `Get` 则每次都要重新走一遍缓存键查找：

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{
        "order": {"id": 5001, "status": "shipped"},
        "customer": {"name": "Alice"},
        "total": 129.9
    }`

	values, err := json.GetMultiple(data, []string{
		"order.id", "order.status", "customer.name", "total",
	})
	if err != nil {
		panic(err)
	}

	fmt.Println("订单号：", values["order.id"])
	fmt.Println("状态：", values["order.status"])
	fmt.Println("客户：", values["customer.name"])
	fmt.Println("合计：", values["total"])
}

// 输出：
// 订单号：5001
// 状态：shipped
// 客户：Alice
// 合计：129.9
```

:::tip 注意
`GetMultiple` 返回**首个**失败的路径错误（结果 map 中失败路径值为 `nil`），因此示例中所有路径都必须存在；探测可选字段时改用带默认值的 `GetString`/`GetInt` 或 [`SafeGet`](./examples-advanced)。
:::

### 修改 JSON

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"name": "old", "version": 1}`

	// 修改单个值
	updated, _ := json.Set(data, "name", "new")
	fmt.Println("After set:", updated)

	// 添加新字段
	updated, _ = json.Set(updated, "active", true)
	fmt.Println("After add:", updated)

	// 逐个设置多个字段
	updated, _ = json.Set(updated, "version", 2)
	updated, _ = json.Set(updated, "author", "CyberGo")
	updated, _ = json.Set(updated, "tags", []string{"json", "go"})
	fmt.Println("After batch:", updated)

	// 删除字段
	updated, _ = json.Delete(updated, "author")
	fmt.Println("After delete:", updated)

	// 嵌套修改
	nested := `{"config": {"database": {"host": "localhost"}}}`
	nested, _ = json.Set(nested, "config.database.host", "192.168.1.1")
	nested, _ = json.Set(nested, "config.database.port", 3306)
	fmt.Println("Nested:", nested)
}
```

## 结构体编解码

### 基本编解码

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

type User struct {
	ID       int            `json:"id"`
	Name     string         `json:"name"`
	Email    string         `json:"email"`
	Active   bool           `json:"active"`
	Tags     []string       `json:"tags"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

func main() {
	user := User{
		ID:     1001,
		Name:   "Alice",
		Email:  "alice@example.com",
		Active: true,
		Tags:   []string{"go", "json"},
		Metadata: map[string]any{
			"role":  "admin",
			"level": 5,
		},
	}

	// 编码
	data, err := json.Marshal(user)
	if err != nil {
		panic(err)
	}
	fmt.Println("Encoded:", string(data))

	// 格式化编码
	pretty, _ := json.MarshalIndent(user, "", "  ")
	fmt.Println("Pretty:\n", string(pretty))

	// 解码
	var decoded User
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Decoded: %+v\n", decoded)
}
```

### 嵌套结构体

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

type Address struct {
	City    string `json:"city"`
	Country string `json:"country"`
}

type Profile struct {
	Age     int     `json:"age"`
	Address Address `json:"address"`
}

type UserWithProfile struct {
	ID      int     `json:"id"`
	Name    string  `json:"name"`
	Profile Profile `json:"profile"`
}

func main() {
	user := UserWithProfile{
		ID:   1,
		Name: "Bob",
		Profile: Profile{
			Age: 30,
			Address: Address{
				City:    "Shanghai",
				Country: "China",
			},
		},
	}

	data, _ := json.MarshalIndent(user, "", "  ")
	fmt.Println(string(data))

	// 从 JSON 字符串直接获取嵌套值
	city := json.GetString(string(data), "profile.address.city")
	fmt.Println("City:", city)
}
```

## 泛型 API

### GetTyped

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

type Config struct {
	Host string `json:"host"`
	Port int    `json:"port"`
	TLS  struct {
		Enabled  bool   `json:"enabled"`
		CertPath string `json:"cert_path"`
	} `json:"tls"`
}

func main() {
	data := `{
        "host": "localhost",
        "port": 8080,
        "tls": {
            "enabled": true,
            "cert_path": "/etc/certs/server.crt"
        }
    }`

	// 泛型解码
	config := json.GetTyped[Config](data, ".")
	fmt.Printf("Config: %+v\n", config)

	// 带默认值
	defaultConfig := Config{Host: "127.0.0.1", Port: 3000}
	cfg := json.GetTyped[Config](data, ".", defaultConfig)
	fmt.Printf("Config: %+v\n", cfg)
}
```

## 使用 Processor

### 基本使用

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// 创建处理器
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}`

	// 使用处理器操作
	users := p.GetArray(data, "users")
	fmt.Println("Users:", users)

	// 预解析加速多次查询
	parsed, _ := p.PreParse(data)
	for i := 0; i < 2; i++ {
		name, _ := p.GetFromParsed(parsed, fmt.Sprintf("users.%d.name", i))
		fmt.Printf("User %d: %v\n", i, name)
	}
}
```

### 自定义配置

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"time"
)

func main() {
	// 自定义配置
	cfg := json.DefaultConfig()
	cfg.EnableCache = true
	cfg.CacheTTL = 10 * time.Minute
	cfg.MaxJSONSize = 50 * 1024 * 1024 // 50MB
	cfg.CreatePaths = true

	p, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// 使用安全配置处理不可信输入
	secureCfg := json.SecurityConfig()
	secureP, err := json.New(secureCfg)
	if err != nil {
		panic(err)
	}
	defer secureP.Close()

	untrusted := `{"input": "<script>alert('xss')</script>"}`
	result := secureP.GetString(untrusted, "input")
	fmt.Println("Sanitized:", result)
}
```

### 缓存预热

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

	// 大型 JSON 数据（示例从简，实际可为数千行）
	largeJSON := `{
        "users": [{"id": 1}, {"id": 2}],
        "products": [{"sku": "A-1"}],
        "orders": [{"no": 1001}]
    }`

	// 预热常用路径
	commonPaths := []string{
		"users",
		"users.0.id",
		"products",
		"orders",
	}

	result, err := p.WarmupCache(largeJSON, commonPaths)
	if err != nil {
		panic(err)
	}

	fmt.Printf("Warmup complete: %d/%d paths cached\n",
		result.Successful, result.TotalPaths)
	if len(result.FailedPaths) > 0 {
		fmt.Println("Failed paths:", result.FailedPaths)
	}
}
```

## 迭代遍历

### 遍历数组

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{
        "users": [
            {"id": 1, "name": "Alice", "score": 95},
            {"id": 2, "name": "Bob", "score": 88},
            {"id": 3, "name": "Charlie", "score": 92}
        ]
    }`

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// 遍历数组
	p.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
		id := item.GetInt("id")
		name := item.GetString("name")
		score := item.GetFloat64("score")
		fmt.Printf("User %d: %s (score: %.1f)\n", id, name, score)
	})
}
```

### 带控制流的迭代

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"numbers": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}`

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	sum := 0
	p.ForeachWithPathAndControl(data, "numbers", func(key any, value any) json.IteratorControl {
		// 遇到大于 5 的值停止
		if num, ok := value.(float64); ok {
			if num > 5 {
				return json.IteratorBreak
			}
			sum += int(num)
		}
		return json.IteratorNormal
	})
	fmt.Println("Sum of numbers <= 5:", sum) // 1+2+3+4+5 = 15
}
```

### 检查字段存在性

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{
        "users": [
            {"name": "Alice", "email": "alice@example.com"},
            {"name": "Bob"},
            {"name": "Charlie", "email": "charlie@example.com", "phone": "123-456"}
        ]
    }`

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	p.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
		name := item.GetString("name")
		email := item.GetString("email")
		phone := item.GetString("phone")

		fmt.Printf("User: %s\n", name)
		if item.Exists("email") {
			fmt.Printf("  Email: %s\n", email)
		}
		if item.Exists("phone") {
			fmt.Printf("  Phone: %s\n", phone)
		}
		if item.IsNull("nickname") {
			fmt.Println("  No nickname")
		}
	})
}
```

### 并行处理数组

`ParallelIterator` 内置 worker 池，对大数组并行执行 Map/Filter/ForEach，无需手写 goroutine 与信号量：

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"scores":[62,85,94,38,71,99,55,88]}`
	scores := json.GetArray(data, "scores")

	iter := json.NewParallelIterator(scores)
	defer iter.Close()

	// 并行过滤：只保留 >= 80 的分数（结果保持输入顺序）
	passed := iter.Filter(func(_ int, v any) bool {
		return v.(float64) >= 80
	})
	fmt.Println("优秀分数：", passed)

	// 并行映射：每个分数换算为等级（结果与输入对位）
	grades, err := iter.Map(func(_ int, v any) (any, error) {
		score := v.(float64)
		switch {
		case score >= 90:
			return "A", nil
		case score >= 80:
			return "B", nil
		default:
			return "C", nil
		}
	})
	if err != nil {
		panic(err)
	}
	fmt.Println("等级：", grades)
}

// 输出：
// 优秀分数：[85 94 99 88]
// 等级：[C B A C C A C B]
```

worker 数取 `Config.MaxConcurrency`（默认 50，超出数组长度时自动裁剪）；回调中的 panic 会被恢复并转为错误返回，不会击溃进程。批处理与取消用法见[并发与并行处理](../advanced/concurrency)。

## JSONL 处理

### 读取 JSONL 文件

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

	err = p.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
		fmt.Printf("Line %d: %v\n", lineNum, item.GetData())
		return nil
	})

	if err != nil {
		fmt.Println("Error:", err)
	}
}
```

### 泛型 JSONL 处理

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"strings"
)

type LogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
}

func main() {
	jsonlData := `{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":"Started"}
{"timestamp":"2024-01-01T10:00:01Z","level":"DEBUG","message":"Processing"}
{"timestamp":"2024-01-01T10:00:02Z","level":"ERROR","message":"Failed"}`

	reader := strings.NewReader(jsonlData)

	entries, err := json.StreamLinesInto[LogEntry](reader, func(lineNum int, entry LogEntry) error {
		fmt.Printf("[%s] %s: %s\n", entry.Level, entry.Timestamp, entry.Message)
		return nil
	})

	if err != nil {
		panic(err)
	}
	fmt.Printf("Processed %d entries\n", len(entries))
}
```

### 写入 JSONL

`JSONLWriter` 把任意 Go 值逐行写成 JSONL（NDJSON）。`Write` 编码单个值并追加换行，`WriteRaw` 直接写已编码的行（跳过再编码开销），`Stats` 返回行数与字节数：

```go
package main

import (
	"bytes"
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	var buf bytes.Buffer
	writer := json.NewJSONLWriter(&buf)

	// Write：编码单个值为一行 JSON（自动追加换行）
	if err := writer.Write(map[string]any{"id": 1, "name": "Alice"}); err != nil {
		panic(err)
	}
	if err := writer.Write(map[string]any{"id": 2, "name": "Bob"}); err != nil {
		panic(err)
	}

	// WriteRaw：写入已编码的行（末尾无换行时自动补上）
	if err := writer.WriteRaw([]byte(`{"id":3,"name":"Charlie"}`)); err != nil {
		panic(err)
	}

	// 写入文件时把 bytes.Buffer 换成 os.Create 的 *os.File 即可
	stats := writer.Stats()
	fmt.Printf("写入 %d 行，共 %d 字节\n", stats.LinesProcessed, stats.BytesWritten)
	fmt.Print(buf.String())
}

// 输出：
// 写入 3 行，共 72 字节
// {"id":1,"name":"Alice"}
// {"id":2,"name":"Bob"}
// {"id":3,"name":"Charlie"}
```

批量数据可一次性 `WriteAll([]any{...})`；首次错误会被缓存，后续调用直接返回同一错误，`writer.Err()` 可随时查询。

## 流式处理

### 流式处理大型 JSON

`ForeachFile` 提供带回调的逐条遍历，但迭代前会把**整个文件载入内存**（含 `ForeachFileChunked` 在内的全系均如此）；需要恒定内存处理超大文件时，请改用 `StreamIterator` / `StreamObjectIterator` 或 JSONL 流式家族（见[大文件处理](../streaming/large-files)）。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// 创建处理器
	processor, err := json.New()
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	// 用 ForeachFile 逐条遍历文件数组（整个文件会先载入内存；恒定内存场景用 StreamIterator）
	count := 0
	err = processor.ForeachFile("large-array.json", func(key any, item *json.IterableValue) error {
		count++
		if count%1000 == 0 {
			fmt.Printf("Processed %d items...\n", count)
		}
		return nil // 返回 item.Break() 可中断
	})

	if err != nil {
		panic(err)
	}
	fmt.Printf("Total items: %d\n", count)
}
```

### 流式处理对象

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	processor, err := json.New()
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	// 处理 JSON 对象文件（键值对结构）
	// 文件格式：{"user1": {...}, "user2": {...}, ...}
	err = processor.ForeachFile("config-map.json", func(key any, item *json.IterableValue) error {
		name := item.GetString("name")
		fmt.Printf("Key: %s, Name: %s\n", key, name)
		return nil
	})

	if err != nil {
		panic(err)
	}
}
```

## 钩子系统

### 日志钩子

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"log/slog"
	"os"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

	cfg := json.DefaultConfig()
	cfg.AddHook(json.LoggingHook(logger))

	p, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"name": "test"}`
	name := p.GetString(data, "name")
	fmt.Println("Name:", name)
}
```

### 计时钩子

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"time"
)

type TimingRecorder struct {
	records map[string]time.Duration
}

func (r *TimingRecorder) Record(op string, duration time.Duration) {
	r.records[op] = duration
}

func main() {
	recorder := &TimingRecorder{records: make(map[string]time.Duration)}

	cfg := json.DefaultConfig()
	cfg.AddHook(json.TimingHook(recorder))

	p, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// 执行一些操作
	data := `{"users": [{"id": 1}, {"id": 2}]}`
	for i := 0; i < 100; i++ {
		p.Get(data, "users")
	}

	fmt.Println("Timing records:", recorder.records)
}
```

### 自定义验证钩子

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	cfg := json.DefaultConfig()
	cfg.AddHook(json.ValidationHook(func(jsonStr, path string) error {
		// 自定义验证逻辑
		if len(jsonStr) > 10000 {
			return fmt.Errorf("JSON too large")
		}
		return nil
	}))

	p, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"name": "test"}`
	val, err := p.Get(data, "name")
	if err != nil {
		fmt.Println("Validation error:", err)
	} else {
		fmt.Println("Value:", val)
	}
}
```

## Schema 验证

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// 定义 Schema
	schema := &json.Schema{
		Type:     "object",
		Required: []string{"name", "email"},
		Properties: map[string]*json.Schema{
			"name": {
				Type:      "string",
				MinLength: 1,
				MaxLength: 100,
			},
			"email": {
				Type:   "string",
				Format: "email",
			},
			"age": {
				Type:    "number",
				Minimum: 0,
				Maximum: 150,
			},
			"tags": {
				Type:     "array",
				MinItems: 1,
				Items: &json.Schema{
					Type: "string",
				},
			},
		},
	}

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	validJSON := `{"name": "Alice", "email": "alice@example.com", "age": 25}`
	invalidJSON := `{"name": "", "email": "invalid"}`

	errors, _ := p.ValidateSchema(validJSON, schema)
	if len(errors) == 0 {
		fmt.Println("Valid JSON")
	} else {
		for _, e := range errors {
			fmt.Printf("Error at %s: %s\n", e.Path, e.Message)
		}
	}

	errors, _ = p.ValidateSchema(invalidJSON, schema)
	for _, e := range errors {
		fmt.Printf("Error at %s: %s\n", e.Path, e.Message)
	}
}
```

## 错误处理

### 错误类型判断

```go
package main

import (
	"errors"
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"name": "test"}`
	_, err := json.Get(data, "nonexistent.path")

	if err != nil {
		// 检查错误类型
		if errors.Is(err, json.ErrPathNotFound) {
			fmt.Println("Path not found")
		} else if errors.Is(err, json.ErrInvalidJSON) {
			fmt.Println("Invalid JSON")
		} else if errors.Is(err, json.ErrTypeMismatch) {
			fmt.Println("Type mismatch")
		}

		// 获取详细错误信息
		var jsonErr *json.JsonsError
		if errors.As(err, &jsonErr) {
			fmt.Printf("Op: %s, Path: %s\n", jsonErr.Op, jsonErr.Path)
		}
	}
}
```

### 安全处理不可信输入

```go
package main

import (
	"errors"
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	// 使用安全配置
	cfg := json.SecurityConfig()
	// SecurityConfig 默认已限制 10MB，此处进一步限制到 1MB
	cfg.MaxJSONSize = 1024 * 1024 // 1MB 限制
	p, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// 模拟不可信输入
	// 注意：实际攻击可能尝试更大的 payload（如 100MB+）
	// 两条恶意输入都是合法 JSON 结构，分别真实触发体积与深度限制
	untrustedInputs := []string{
		`{"data": "normal"}`,
		// 合法 JSON 字符串，但总体积约 2MB，超过 1MB 的 MaxJSONSize → ErrSizeLimit
		`{"huge": "` + strings.Repeat("a", 2*1024*1024) + `"}`,
		// 合法 JSON，但嵌套 50 层，超过 SecurityConfig 的 MaxNestingDepthSecurity（30）→ ErrDepthLimit
		strings.Repeat(`{"a":`, 50) + "1" + strings.Repeat(`}`, 50),
	}

	for i, input := range untrustedInputs {
		_, err := p.Get(input, "data")
		if err != nil {
			if errors.Is(err, json.ErrSecurityViolation) {
				fmt.Printf("Input %d blocked: security violation\n", i)
			} else {
				fmt.Printf("Input %d error: %v\n", i, err)
			}
		} else {
			fmt.Printf("Input %d processed successfully\n", i)
		}
	}
}

// 输出：
// Input 0 processed successfully
// Input 1 error: JSON validate_json_input failed: size 2097164 exceeds limit 1048576 (caused by: size limit exceeded)
// Input 2 error: JSON validate_nesting_depth failed: nesting depth 31 exceeds maximum 30 (caused by: depth limit exceeded)
```

## 辅助函数

### JSON 比较

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	json1 := `{"a": 1, "b": 2}`
	json2 := `{"b": 2, "a": 1}` // 键顺序不同

	equal, err := json.CompareJSON(json1, json2)
	if err != nil {
		panic(err)
	}
	fmt.Println("Equal:", equal) // true（语义相等）
}
```

### 比较配置是否语义一致

`CompareJSON` 解析归一化后再比较：键顺序不同、`3` 与 `3.0` 这类数值写法差异均视为相等。判断「配置是否真的变了」时用它，避免把格式化差异误报为变更：

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	deployed := `{"port": 8080, "debug": false, "retries": 3}`
	// 同一份配置重新序列化后：键序打乱、数值改写为浮点形式
	modified := `{
        "debug": false,
        "retries": 3.0,
        "port": 8080
    }`

	equal, err := json.CompareJSON(deployed, modified)
	if err != nil {
		panic(err)
	}
	fmt.Println("配置语义一致：", equal)
	// 输出：配置语义一致：true

	// 处理不可信来源的配置时，附加安全配置（限制大小/深度、执行安全扫描）
	equal, err = json.CompareJSON(deployed, modified, json.SecurityConfig())
	if err != nil {
		panic(err)
	}
	fmt.Println("安全模式下比较：", equal)
	// 输出：安全模式下比较：true
}
```

### JSON 合并

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	json1 := `{"a": 1, "b": {"x": 10}}`
	json2 := `{"b": {"y": 20}, "c": 3}`

	// 合并
	merged, _ := json.MergeJSON(json1, json2)
	fmt.Println("Merged:", merged)
	// {"a":1,"b":{"x":10,"y":20},"c":3}

	// 多个合并
	result, _ := json.MergeMany([]string{
		`{"a":1}`,
		`{"b":2}`,
		`{"d": 4}`,
	})
	fmt.Println("Merged many:", result)
}
```

### 深拷贝（编码再解码）

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := map[string]any{
		"name": "Alice",
		"tags": []string{"go", "json"},
		"meta": map[string]any{
			"level": 5,
		},
	}

	copied, err := json.Marshal(data)
	if err != nil {
		panic(err)
	}

	// 深拷贝：编码后重新解码
	var deepCopy map[string]any
	json.Unmarshal(copied, &deepCopy)

	// 修改副本不影响原数据
	deepCopy["name"] = "Bob"
	fmt.Println("Original:", data["name"]) // Alice
	fmt.Println("Copy:", deepCopy["name"]) // Bob
}
```

## 更多示例

- [高级功能示例](./examples-advanced) — 批量编码、预解析、钩子系统等高级功能
