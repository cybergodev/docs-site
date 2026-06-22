---
title: "泛型操作 - CyberGo JSON | API 参考"
description: "CyberGo JSON 泛型 API：GetTyped[T] 泛型获取、Result[T] 结果类型、AccessResult 动态访问，利用 Go 1.18+ 泛型实现编译时类型安全检查。"
---

# 泛型操作

json 库提供泛型类型安全操作，使用 Go 1.18+ 泛型特性实现编译时类型检查。

## GetTyped

签名：`func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

从 JSON 中获取指定类型的值。支持自定义类型。返回 `T`，无 error。路径不存在或类型转换失败时返回零值或通过 `defaultValue` 指定的默认值。

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

- 基本类型：`string`, `int`, `int64`, `float64`, `bool`
- 切片类型：`[]any`
- 映射类型: `map[string]any`
- 自定义结构体

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
    fmt.Println(name) // 输出: Alice

    // 获取整数
    age := json.GetTyped[int](data, "user.age")
    fmt.Println(age) // 输出: 30

    // 获取数组
    arrData := `{"items": [1, 2, 3]}`
    items := json.GetTyped[[]any](arrData, "items")
    fmt.Println(items) // 输出: [1 2 3]

    // 使用默认值
    email := json.GetTyped[string](data, "user.email", "unknown@example.com")
    fmt.Println(email) // 输出: unknown@example.com
}
```

---

## AccessResult

`AccessResult` 是动态类型访问结果，提供类型转换方法用于动态类型处理。通过 `SafeGet()` 获取。

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

判断值是否存在且无错误。

```go
result := json.SafeGet(data, "user.name")
if result.Ok() {
    // 值存在且无错误
}
```

#### Unwrap

签名：`func (r AccessResult) Unwrap() any`

获取值，不存在时返回 nil。

```go
value := result.Unwrap()
```

#### UnwrapOr

签名：`func (r AccessResult) UnwrapOr(defaultValue any) any`

获取值或默认值。

```go
value := result.UnwrapOr("default")
```

#### AsString

签名：`func (r AccessResult) AsString() (string, error)`

安全转换为字符串。仅当值本身是 string 类型时成功。

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    // 类型不匹配或路径不存在
}
```

#### AsInt

签名：`func (r AccessResult) AsInt() (int, error)`

安全转换为整数。支持所有整数类型和 float（如果是整数值）。**注意：bool 不会转换为 int。**

#### AsFloat64

签名：`func (r AccessResult) AsFloat64() (float64, error)`

安全转换为浮点数。支持所有数值类型。**注意：bool 不会转换为 float64。**

#### AsBool

签名：`func (r AccessResult) AsBool() (bool, error)`

安全转换为布尔值。支持 bool 和 string 类型（"true", "false", "1", "0" 等）。

### 链式类型转换方法

`AccessResult` 提供以下类型转换方法：

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

从 `io.Reader` 逐行读取 JSON，将每行解析为类型 `T` 并调用回调函数。适合处理 JSONL 格式的大文件。

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

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
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
    fmt.Printf("Timeout: %d\n", timeout) // 输出: 30

    // 路径不存在，返回零值
    retries := json.GetTyped[int](config, "retries")
    fmt.Printf("Retries: %d\n", retries) // 输出: 0（零值）

    // 路径不存在，使用默认值
    retries = json.GetTyped[int](config, "retries", 3)
    fmt.Printf("Retries: %d\n", retries) // 输出: 3（默认值）
}
```

---

## 性能说明

泛型操作在运行时使用反射进行类型转换，比类型特定的 getter（如 `GetString`、`GetInt`）略慢。对于性能敏感的场景，建议使用类型特定的函数。

| 方法 | 性能 | 推荐场景 |
|------|------|----------|
| `GetString`, `GetInt` 等 | 最快 | 性能敏感、类型已知 |
| `GetTyped[T]` | 中等 | 需要自定义类型 |
| `SafeGet` + `AccessResult` | 中等 | 动态类型处理 |

---

## Result[T] 类型

`Result[T]` 是类型安全的泛型操作结果，用于需要明确类型且需要错误处理的场景。

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

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // GetTyped 返回 T
    name := json.GetTyped[string](data, "user.name")
    fmt.Println("名称:", name)

    // 不存在的路径返回零值
    email := json.GetTyped[string](data, "user.email")
    fmt.Println("邮箱:", email) // 输出: ""（零值）

    // 使用默认值
    email = json.GetTyped[string](data, "user.email", "none@example.com")
    fmt.Println("邮箱:", email) // 输出: none@example.com
}
```

---

## Result[T] 与 AccessResult 对比

| 特性 | Result[T] | AccessResult |
|------|-----------|---------------------|
| 类型安全 | 泛型 T | any 类型 |
| 存在判断 | `Exists bool` | `Exists bool` |
| 错误处理 | 内置 Error 字段 | 类型转换方法返回 error |
| 链式调用 | 不支持 | 支持链式类型转换 |
| 获取方式 | `GetTyped[T]` | `SafeGet()` |
| 适用场景 | 已知类型获取 | 动态类型处理 |

### 选择建议

- **已知类型**：使用 `Result[T]` 和 `GetTyped[T]`
- **动态类型**：使用 `AccessResult` 和 `SafeGet()`
- **需要链式转换**：使用 `AccessResult`
- **需要错误处理**：使用 `Result[T]` 的 Error 字段或 `AccessResult` 的类型转换方法

---

## 相关

- [包函数](./functions) - 类型特定的 getter 函数
- [类型定义](./types) - AccessResult 详细定义
- [配置](./config) - Config 配置选项
