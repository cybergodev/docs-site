---
sidebar_label: "泛型操作"
title: "泛型操作 - CyberGo JSON | GetTyped 泛型获取"
description: "CyberGo JSON 泛型操作：GetTyped[T] 类型化获取、StreamLinesInto[T] 解析 JSONL 与 Result[T] 结果类型。"
sidebar_position: 110
---

# 泛型操作

泛型操作基于 Go 1.18+ 泛型，在编译期确定目标类型 `T`。

## GetTyped

签名：`func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

从 JSON 中按路径取值并转换为 `T`，支持自定义类型。返回 `T`，**不返回 error**：路径不存在、值为 `null`、或转换失败时，返回 `defaultValue`（若给出），否则返回 `T` 的零值。

三种落默认值的情况：`Get` 返回错误（含 `ErrPathNotFound`）、取到的值是 `null`、内部类型转换失败。第三种在内部构造包装 `ErrTypeMismatch` 的 error，随后被丢弃，调用方只能看到默认值。需要区分「缺失」与「零值」时，改用 `SafeGet` 或 `Get`。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | JSON 路径 |
| `defaultValue` | `...T` | 否 | 可选默认值，路径不存在或类型转换失败时返回 |

**返回值**

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 唯一返回值 | `T` | 获取到的值，路径不存在或类型转换失败时返回零值或默认值 |

**支持的类型**

- 基本类型：`string`、`int`、`int64`、`uint64`、`float64`、`bool`
- 切片与映射：`[]any`、元素可逐个转换的 `[]T`、`map[string]any`
- 其他类型（指针 `*T`、`int8`/`int32` 等其他位宽整数、自定义结构体）：走 re-marshal 回退路径

::: tip 单元素数组自动解包
目标类型不是切片、而取到的是**恰好一个元素的数组**时，先解包该元素再转换。这条规则服务于分布式路径访问（如 `choices.message.content` 这类路径会返回单元素数组）；`GetString`、`GetInt` 等类型化 getter 同样适用，目标类型是切片时不拆包。
:::

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"user": {"name": "Alice", "age": 30}}`

	// 获取字符串
	name := json.GetTyped[string](data, "user.name")
	fmt.Println(name) // 输出：Alice

	// 获取整数
	age := json.GetTyped[int](data, "user.age")
	fmt.Println(age) // 输出：30

	// 获取数组
	arrData := `{"items": [1, 2, 3]}`
	items := json.GetTyped[[]any](arrData, "items")
	fmt.Println(items) // 输出：[1 2 3]

	// 使用默认值
	email := json.GetTyped[string](data, "user.email", "unknown@example.com")
	fmt.Println(email) // 输出：unknown@example.com
}
```

---

## AccessResult

`AccessResult` 是动态类型访问的结果，由 `SafeGet()` 返回；类型转换方法把 `any` 收敛到具体类型。

### 结构定义

```go
type AccessResult struct {
    Value  any    // 结果值
    Exists bool   // 路径是否存在
    Type   string // 运行时类型信息（调试用）
}
```

### 方法

#### Ok

签名：`func (r AccessResult) Ok() bool`

判断路径是否存在，等价于直接读 `Exists` 字段。

```go
result := json.SafeGet(data, "user.name")
if result.Ok() {
    // 值存在
}
```

#### Unwrap

签名：`func (r AccessResult) Unwrap() any`

获取值，`Exists` 为 `false` 时返回 `nil`。

```go
value := result.Unwrap()
```

#### UnwrapOr

签名：`func (r AccessResult) UnwrapOr(defaultValue any) any`

获取值，`Exists` 为 `false` 时返回 `defaultValue`。

```go
value := result.UnwrapOr("default")
```

#### AsString

签名：`func (r AccessResult) AsString() (string, error)`

安全转换为字符串。仅当值本身是 `string` 时成功；其他类型返回包装 `ErrTypeMismatch` 的错误，路径不存在返回 `ErrPathNotFound`。

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    // 类型不匹配或路径不存在
}
```

#### AsInt

签名：`func (r AccessResult) AsInt() (int, error)`

安全转换为整数。接受所有整数类型、值为整数的浮点数、可解析的十进制字符串与 `json.Number`。`bool` 不转换：`AsInt` 在进入通用转换前先拒绝 `bool` 并返回错误。

#### AsFloat64

签名：`func (r AccessResult) AsFloat64() (float64, error)`

安全转换为浮点数。接受所有数值类型与可解析的字符串。`bool` 不转换，返回错误。

#### AsBool

签名：`func (r AccessResult) AsBool() (bool, error)`

安全转换为布尔值。仅接受 `bool` 类型，以及能被 `strconv.ParseBool` 解析的字符串（`1/t/true/True/TRUE`、`0/f/false/False/FALSE`）。

### 类型转换方法一览

`AccessResult` 的转换方法都返回 `(值, error)`，需要串联时逐个接住结果：

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `AsString()` | `(string, error)` | 转换为字符串（严格类型检查） |
| `AsStringConverted()` | `(string, error)` | 格式化转换为字符串 |
| `AsInt()` | `(int, error)` | 转换为整数（bool 不转换） |
| `AsFloat64()` | `(float64, error)` | 转换为 float64（bool 不转换） |
| `AsBool()` | `(bool, error)` | 转换为布尔值 |

### AsString vs AsStringConverted

| 方法 | 行为 | 使用场景 |
|------|------|----------|
| `AsString()` | 严格类型检查，仅 string 类型成功 | 需要确保原始类型 |
| `AsStringConverted()` | 格式化任意类型为字符串 | 需要字符串表示 |

```go
// 场景：获取可能是数字或字符串的值
result := json.SafeGet(data, "user.id")

// 严格模式 - 仅当值是 string 时成功
id, err := result.AsString()

// 宽松模式 - 数字也会转为字符串
idStr, err := result.AsStringConverted()
```

---

## StreamLinesInto

签名：`func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

从 `io.Reader` 逐行读取 JSON，把每行解析为 `T` 后调用回调，最后返回全部成功解析的结果。用于 JSONL 格式的大文件。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `reader` | `io.Reader` | 是 | 数据源 |
| `fn` | `func(lineNum int, data T) error` | 是 | 每行的回调函数，接收行号和解析后的数据 |
| `cfg` | `...Config` | 否 | 可选配置 |

**返回值**

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 第一个 | `[]T` | 成功解析的所有结果 |
| 第二个 | `error` | 错误信息 |

**行为细节**（均由 JSONL 相关 Config 字段控制，见 [Config](./config#config-结构体)）：

- 空白行（仅含空白的行）始终跳过；`JSONLSkipComments: true` 时额外跳过 `#` 与 `//` 开头的行
- 某行解析失败：默认返回 `line N: <原因>` 错误且结果为 nil；`JSONLContinueOnErr: true` 时跳过该行继续
- 回调返回错误：立即停止并返回该错误（结果为 nil）；回调 panic 被捕获转为错误，不会击穿进程
- 读取缓冲与单行上限由 `JSONLBufferSize`（64KB）与 `JSONLMaxLineSize`（1MB）控制
- 累计处理的字节数上限由 `JSONLMaxMemory` 控制（未设置时回退到 `MaxMemory`；两者都为 0 则不限制），超出返回包装 `ErrSizeLimit` 的错误
- 无 cfg 时走全局默认处理器（受 `SetGlobalProcessor` 影响）；传 cfg 时按该配置选取处理器

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"strings"
)

func main() {
	jsonl := `{"name":"Alice","age":30}
{"name":"Bob","age":25}
{"name":"Charlie","age":35}`

	type Person struct {
		Name string `json:"name"`
		Age  int    `json:"age"`
	}

	reader := strings.NewReader(jsonl)
	results, err := json.StreamLinesInto[Person](reader, func(lineNum int, data Person) error {
		fmt.Printf("第 %d 行: %s, %d 岁\n", lineNum, data.Name, data.Age)
		return nil
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("共处理 %d 条记录\n", len(results))
}
```

---

## 使用示例

### 配置解析

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

type DatabaseConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	SSL      bool   `json:"ssl"`
}

func main() {
	config := `{
        "database": {
            "host": "localhost",
            "port": 5432,
            "database": "myapp",
            "ssl": true
        }
    }`

	// 解析配置到结构体
	dbConfig := json.GetTyped[DatabaseConfig](config, "database")

	fmt.Printf("Host: %s:%d\n", dbConfig.Host, dbConfig.Port)
}
```

### 多类型处理

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{
        "name": "Alice",
        "age": 30,
        "active": true,
        "score": 95.5,
        "tags": ["admin", "user"]
    }`

	// 不同类型的泛型获取
	name := json.GetTyped[string](data, "name")
	age := json.GetTyped[int](data, "age")
	active := json.GetTyped[bool](data, "active")
	score := json.GetTyped[float64](data, "score")
	tags := json.GetTyped[[]any](data, "tags")

	fmt.Printf("Name: %s\n", name)
	fmt.Printf("Age: %d\n", age)
	fmt.Printf("Active: %v\n", active)
	fmt.Printf("Score: %.1f\n", score)
	fmt.Printf("Tags: %v\n", tags)
}
```

### 错误处理

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	config := `{"timeout": 30}`

	timeout := json.GetTyped[int](config, "timeout")
	fmt.Printf("Timeout: %d\n", timeout) // 输出：30

	// 路径不存在，返回零值
	retries := json.GetTyped[int](config, "retries")
	fmt.Printf("Retries: %d\n", retries) // 输出：0（零值）

	// 路径不存在，使用默认值
	retries = json.GetTyped[int](config, "retries", 3)
	fmt.Printf("Retries: %d\n", retries) // 输出：3（默认值）
}
```

---

## 性能说明

`GetTyped[T]` 的转换分两级：基本类型（string/int/float64/bool 及其切片、映射）走内部的直接转换快速路径；自定义结构体等复杂类型回退到「重新 `Marshal` → `Unmarshal`」，因此比类型特定的 getter（`GetString`、`GetInt` 等）慢。

| 方法 | 转换路径 | 适用场景 |
|------|----------|----------|
| `GetString`、`GetInt` 等 | 直接类型断言与转换，无 re-marshal 回退 | 类型已知、调用频繁 |
| `GetTyped[T]`（基本类型） | 直接转换快速路径 | 泛型代码中的基本类型读取 |
| `GetTyped[T]`（结构体） | 一次 re-marshal + unmarshal | 配置解析、一次性读取 |
| `SafeGet` + `AccessResult` | 取值即返回，转换在调用 `As*` 时发生 | 动态类型处理 |

::: tip
热路径上反复读取同一结构体时，用 `Parse`/`Unmarshal` 一次解析到结构体，或 `GetTyped` 一次后复用结果，可省去每条路径上重复的 re-marshal 转换。
:::

---

## Result[T] 类型

`Result[T]` 是带类型参数的操作结果，把「值 + 是否存在 + 错误」合成一个返回值。

### 结构定义

```go
type Result[T any] struct {
    Value  T     // 结果值
    Exists bool  // 路径是否找到
    Error  error // 错误信息
}
```

### 方法

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `Ok()` | `bool` | 检查结果有效（无错误且找到） |
| `Unwrap()` | `T` | 返回值，失败时返回零值 |
| `UnwrapOr(default T)` | `T` | 返回值失败时返回默认值 |

### 使用示例

`Result[T]` 没有「库函数直接返回」的入口——它供你**手动构造**，常用于封装自己的查询函数，把「值 + 是否存在 + 错误」作为一个明确的返回值传给调用方：

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/json"
)

// 用 Result[T] 封装一个带明确错误的配置读取函数
func readConfig(data, path string) json.Result[string] {
	val, err := json.Get(data, path)
	if err != nil {
		return json.Result[string]{Error: err}
	}
	s, ok := val.(string)
	if !ok {
		return json.Result[string]{Error: fmt.Errorf("%s: %w", path, json.ErrTypeMismatch)}
	}
	return json.Result[string]{Value: s, Exists: true}
}

func main() {
	data := `{"env": "production"}`

	r := readConfig(data, "env")
	if r.Ok() {
		fmt.Println("环境：", r.Unwrap()) // 输出：环境：production
	}

	missing := readConfig(data, "region")
	fmt.Println(missing.Exists, errors.Is(missing.Error, nil)) // 输出：false false
	fmt.Println(missing.UnwrapOr("cn-north-1"))                // 输出：cn-north-1
}
```

---

## Result[T] 与 AccessResult 对比

| 特性 | Result[T] | AccessResult |
|------|-----------|---------------------|
| 类型安全 | 泛型 T | any 类型 |
| 存在判断 | `Exists bool` | `Exists bool` |
| 错误处理 | 内置 Error 字段 | 类型转换方法返回 error |
| 类型转换 | 无 | 内置 `AsString`/`AsInt` 等方法 |
| 获取方式 | 手动构造（无库函数入口） | `SafeGet()` |
| 适用场景 | 封装自己的查询函数 | 动态类型处理 |

### 选择建议

- **已知类型、不关心错误细节**：`GetTyped[T]`（零值/默认值兜底）
- **需要按需转换动态值**：使用 `AccessResult` + `SafeGet()`
- **封装统一返回形态**：用 `Result[T]` 作为自己函数的返回类型

---

## 相关

- [包函数](./functions/)：类型特定的 getter 函数
- [类型定义](./types)：`AccessResult` 详细定义
- [配置](./config)：`Config` 字段说明
