---
title: "类型定义 - CyberGo JSON | API 参考"
description: "CyberGo JSON 核心类型：Result[T] 泛型结果、AccessResult 动态访问、BatchOperation、BatchResult、Schema、Stats、HealthStatus 与 IterableValue，构成完整类型系统。"
---

# 类型定义

json 包提供多种类型安全的类型，用于处理 JSON 操作结果。

## Result[T] - 统一结果类型

`Result[T]` 是泛型操作结果类型，提供类型安全的错误处理和值访问。

### 结构定义

```go
type Result[T any] struct {
    Value  T     // 结果值
    Exists bool  // 值是否被找到
    Error  error // 错误（如有）
}
```

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Ok()` | `func (r Result[T]) Ok() bool` | 检查结果是否有效（无错误且已找到） |
| `Unwrap()` | `func (r Result[T]) Unwrap() T` | 返回值，失败时返回零值 |
| `UnwrapOr()` | `func (r Result[T]) UnwrapOr(defaultValue T) T` | 返回值或默认值 |

### 使用示例

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // 使用 GetTyped 获取类型化值
    name := json.GetTyped[string](data, "user.name")
    fmt.Printf("姓名: %s\n", name)

    // 使用 defaultValue 参数提供默认值
    nickname := json.GetTyped[string](data, "user.nickname", "未设置")
    fmt.Printf("昵称: %s\n", nickname)

    age := json.GetTyped[int](data, "user.age", 0)
    fmt.Printf("年龄: %d\n", age)
}
```

::: tip 命名约定
- **GetTyped[T]** - 获取指定类型的值，返回 `T`，支持 `defaultValue` 参数
- **Result[T]** - 内部结果类型，用于需要精细错误处理的场景
:::

---

## CompiledPath - 预编译路径

`CompiledPath` 是预编译的 JSON 路径类型别名，用于在频繁访问同一路径时避免重复解析路径字符串，提升性能。

### 类型定义

```go
type CompiledPath = internal.CompiledPath
```

### 使用场景

当需要对同一个路径进行大量重复操作时（如循环中批量查询），可以预先编译路径，避免每次调用时重复解析路径字符串。

### 编译函数

#### Processor.CompilePath

签名：`func (p *Processor) CompilePath(path string) (*CompiledPath, error)`

通过 Processor 预编译 JSON 路径，返回可在后续操作中复用的 `*CompiledPath` 实例。

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

compiled, err := processor.CompilePath("user.profile.name")
if err != nil {
    panic(err)
}
// 可在后续操作中重复使用 compiled
val, err := processor.GetCompiled(data, compiled)
```

::: tip 性能提示
对于高频重复路径访问，预编译路径可显著减少路径解析开销。适用于批量操作、循环查询等场景。
:::

---

## AccessResult - 属性访问结果

`AccessResult` 是安全属性访问结果，提供链式类型转换。

### 结构定义

```go
type AccessResult struct {
    Value  any    // 结果值
    Exists bool   // 路径是否存在
    Type   string // 运行时类型信息（用于调试）
}
```

### 创建方法

#### Processor.SafeGet

签名：`func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

安全获取属性，返回 `AccessResult` 用于链式类型转换。

也可以使用包级函数 `SafeGet`：

签名：`func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

result := processor.SafeGet(data, "user.age")

if !result.Exists {
    fmt.Println("路径不存在")
    return
}

// 检查类型
fmt.Println("类型:", result.Type)
```

### 链式类型转换方法

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `Unwrap()` | `any` | 返回值，不存在时返回 nil |
| `UnwrapOr(defaultValue)` | `any` | 返回值或默认值 |
| `AsString()` | `(string, error)` | 转换为字符串（严格类型检查） |
| `AsStringConverted()` | `(string, error)` | 格式化转换为字符串 |
| `AsInt()` | `(int, error)` | 转换为整数（bool 不转换） |
| `AsFloat64()` | `(float64, error)` | 转换为 float64（bool 不转换） |
| `AsBool()` | `(bool, error)` | 转换为布尔值 |
| `Ok()` | `bool` | 检查路径是否存在 |

::: warning 注意
`AsInt64()`, `AsArray()`, `AsObject()` 方法已移除。请使用 `GetTyped[T]` 获取这些类型。
:::

```go
result := processor.SafeGet(data, "user.profile")

// 链式调用
name, _ := result.AsString()
email, _ := result.AsString()
age, _ := result.AsInt()
price, _ := result.AsFloat64()
active, _ := result.AsBool()

// 需要数组或对象类型时使用 GetTyped
arr := json.GetTyped[[]any](data, "items")
obj := json.GetTyped[map[string]any](data, "user.profile")
```

### 使用示例

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

    data := `{"user": {"name": "Alice", "age": 30, "active": true}}`

    // 安全获取并转换
    result := processor.SafeGet(data, "user.age")

    // 直接使用 AccessResult 方法
    age, err := result.AsInt()
    if err != nil {
        panic(err)
    }
    fmt.Printf("年龄: %d\n", age)

    // 获取不存在的路径
    missing := processor.SafeGet(data, "user.nickname")
    if !missing.Exists {
        fmt.Println("昵称不存在")
    }
}
```

---

## Schema - JSON Schema 类型

`Schema` 用于定义 JSON 数据的结构验证规则，支持 JSON Schema Draft 7 的子集。

### 结构定义

```go
type Schema struct {
    Type                 string            `json:"type,omitempty"`
    Properties           map[string]*Schema `json:"properties,omitempty"`
    Items                *Schema           `json:"items,omitempty"`
    Required             []string          `json:"required,omitempty"`
    MinLength            int               `json:"minLength,omitempty"`
    MaxLength            int               `json:"maxLength,omitempty"`
    Minimum              float64           `json:"minimum,omitempty"`
    Maximum              float64           `json:"maximum,omitempty"`
    Pattern              string            `json:"pattern,omitempty"`
    Format               string            `json:"format,omitempty"`
    AdditionalProperties bool              `json:"additionalProperties,omitempty"`
    MinItems             int               `json:"minItems,omitempty"`
    MaxItems             int               `json:"maxItems,omitempty"`
    UniqueItems          bool              `json:"uniqueItems,omitempty"`
    Enum                 []any             `json:"enum,omitempty"`
    Const                any               `json:"const,omitempty"`
    MultipleOf           float64           `json:"multipleOf,omitempty"`
    ExclusiveMinimum     bool              `json:"exclusiveMinimum,omitempty"`
    ExclusiveMaximum     bool              `json:"exclusiveMaximum,omitempty"`
    Title                string            `json:"title,omitempty"`
    Description          string            `json:"description,omitempty"`
    Default              any               `json:"default,omitempty"`
    Examples             []any             `json:"examples,omitempty"`
}
```

### 创建 Schema

#### 直接构造

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name", "email"},
    Properties: map[string]*json.Schema{
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
        "age":   {Type: "integer", Minimum: 0},
    },
}
```

#### 使用 NewSchemaWithConfig

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
schema := json.NewSchemaWithConfig(cfg)
```

#### 使用 DefaultSchema

签名：`func DefaultSchema() *Schema`

返回包含默认配置的空 Schema 实例。

```go
schema := json.DefaultSchema()
schema.Type = "object"
schema.Required = []string{"id"}
```

### SchemaConfig 结构

```go
type SchemaConfig struct {
    Type                 string
    Properties           map[string]*Schema
    Items                *Schema
    Required             []string
    MinLength            *int
    MaxLength            *int
    Minimum              *float64
    Maximum              *float64
    Pattern              string
    Format               string
    AdditionalProperties *bool
    MinItems             *int
    MaxItems             *int
    UniqueItems          bool
    Enum                 []any
    Const                any
    MultipleOf           *float64
    ExclusiveMinimum     *bool
    ExclusiveMaximum     *bool
    Title                string
    Description          string
    Default              any
    Examples             []any
}
```

### 使用示例

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 使用结构体字面量定义 Schema
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
                Type:    "integer",
                Minimum: 0,
                Maximum: 150,
            },
        },
        AdditionalProperties: false,
    }

    // 验证 JSON
    data := `{"name": "Alice", "email": "alice@example.com", "age": 30}`
    errors, err := json.ValidateSchema(data, schema)
    if err != nil {
        panic(err)
    }

    if len(errors) > 0 {
        for _, e := range errors {
            fmt.Printf("验证错误 [%s]: %s\n", e.Path, e.Message)
        }
    } else {
        fmt.Println("验证通过")
    }
}
```

---

## ValidationError

Schema 验证错误类型。

### 结构定义

```go
type ValidationError struct {
    Path    string `json:"path"`    // 错误发生的路径
    Message string `json:"message"` // 错误消息
}
```

### 方法

#### Error

签名：`func (ve *ValidationError) Error() string`

实现 error 接口。

```go
for _, e := range errors {
    fmt.Println(e.Error())
}
```

---

## BatchOperation

批量操作定义。

### 结构定义

```go
type BatchOperation struct {
    Type    string `json:"type"`     // 操作类型: "get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // JSON 数据字符串
    Path    string `json:"path"`     // 目标路径
    Value   any    `json:"value"`    // Set 操作的值
    ID      string `json:"id"`       // 操作标识
}
```

---

## BatchResult

批量操作结果。

### 结构定义

```go
type BatchResult struct {
    ID     string `json:"id"`     // 操作标识（对应 BatchOperation.ID）
    Result any    `json:"result"` // 操作结果
    Error  error  `json:"error"`  // 错误（如有）
}
```

---

## WarmupResult

缓存预热结果。

### 结构定义

```go
type WarmupResult struct {
    TotalPaths  int      `json:"total_paths"`            // 总路径数
    Successful  int      `json:"successful"`             // 成功预热数
    Failed      int      `json:"failed"`                 // 失败数
    SuccessRate float64  `json:"success_rate"`           // 成功率
    FailedPaths []string `json:"failed_paths,omitempty"` // 失败路径列表
}
```

---

## ParsedJSON

预解析的 JSON 文档，可复用于多次查询操作。

### 结构定义

`ParsedJSON` 的内部字段不导出，通过方法访问。

```go
type ParsedJSON struct {
    // 内部字段（不导出）
    // 使用 Data() 方法获取已解析数据
}
```

### Data 方法

签名：`func (p *ParsedJSON) Data() any`

返回底层已解析的数据。

### Release 方法

签名：`func (p *ParsedJSON) Release()`

释放已解析数据持有的资源。当不再需要 `ParsedJSON` 时调用，允许底层资源被垃圾回收。

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// 预解析 JSON
parsed, err := processor.PreParse(`{"user": {"name": "Alice", "age": 30}}`)
if err != nil {
    panic(err)
}

// 多次查询预解析结果
name, _ := processor.GetFromParsed(parsed, "user.name")
age, _ := processor.GetFromParsed(parsed, "user.age")
```

### 使用场景

| 场景 | 说明 |
|------|------|
| 高频查询 | 同一 JSON 多次查询时避免重复解析 |
| 批量路径获取 | 使用 `GetMultiple` 批量获取多个路径 |
| 性能优化 | 预解析后查询性能提升显著 |

::: tip 性能提示
对于需要多次查询同一 JSON 字符串的场景，使用 `PreParse` 预解析可显著提升性能，避免重复解析开销。
:::

---

## Stats

处理器统计信息。

### 结构定义

```go
type Stats struct {
    CacheSize        int64         `json:"cache_size"`        // 当前缓存大小
    CacheMemory      int64         `json:"cache_memory"`      // 缓存内存占用（字节）
    MaxCacheSize     int           `json:"max_cache_size"`    // 最大缓存大小
    HitCount         int64         `json:"hit_count"`         // 缓存命中数
    MissCount        int64         `json:"miss_count"`        // 缓存未命中数
    HitRatio         float64       `json:"hit_ratio"`         // 缓存命中率
    CacheTTL         time.Duration `json:"cache_ttl"`         // 缓存过期时间
    CacheEnabled     bool          `json:"cache_enabled"`     // 缓存是否启用
    IsClosed         bool          `json:"is_closed"`         // 处理器是否已关闭
    MemoryEfficiency float64       `json:"memory_efficiency"` // 内存效率
    OperationCount   int64         `json:"operation_count"`   // 操作总数
    ErrorCount       int64         `json:"error_count"`       // 错误总数
}
```

---

## HealthStatus

健康状态信息。

### 结构定义

```go
type HealthStatus struct {
    Timestamp time.Time              `json:"timestamp"` // 检查时间戳
    Healthy   bool                   `json:"healthy"`   // 是否健康
    Checks    map[string]CheckResult `json:"checks"`    // 各检查项结果
}
```

### CheckResult 结构

```go
type CheckResult struct {
    Healthy bool   `json:"healthy"` // 该检查项是否健康
    Message string `json:"message"` // 检查消息
}
```

---

## IterableValue

迭代值封装。

### 方法概览

**基础访问**

| 方法 | 说明 |
|------|------|
| `Get(path)` | 按路径获取值 |
| `GetString(path)` | 获取字符串 |
| `GetInt(path)` | 获取整数 |
| `GetFloat64(path)` | 获取浮点数 |
| `GetBool(path)` | 获取布尔值 |
| `GetArray(path)` | 获取数组 |
| `GetObject(path)` | 获取对象 |

**带默认值获取**

| 方法 | 说明 |
|------|------|
| `GetWithDefault(path, defaultValue)` | 获取值，不存在时返回默认值 |
| `GetStringWithDefault(path, defaultValue)` | 获取字符串，不存在时返回默认值 |
| `GetIntWithDefault(path, defaultValue)` | 获取整数，不存在时返回默认值 |
| `GetFloat64WithDefault(path, defaultValue)` | 获取浮点数，不存在时返回默认值 |
| `GetBoolWithDefault(path, defaultValue)` | 获取布尔值，不存在时返回默认值 |

**检查与遍历**

| 方法 | 说明 |
|------|------|
| `Exists(path)` | 检查字段是否存在 |
| `IsNull(path)` | 检查指定路径是否为 null |
| `IsNullData()` | 检查底层值是否为 null |
| `IsEmpty(path)` | 检查指定路径是否为空 |
| `IsEmptyData()` | 检查底层值是否为空 |
| `GetData()` | 获取底层原始数据 |
| `Break()` | 返回中断信号，停止迭代 |
| `ForeachNested(path, fn)` | 遍历嵌套结构 |
| `Release()` | 释放资源 |

详见 [迭代器](./iterator) 文档。

---

## 编码错误类型

json 包导出以下编码/解码过程中的错误类型，用于精细化的错误处理。

### SyntaxError - 语法错误

JSON 语法解析错误，表示输入数据不是合法的 JSON 格式。

#### 结构定义

```go
type SyntaxError struct {
    Offset int64 // 错误发生的位置（字节偏移量）
    // 包含其他未导出字段
}
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Error` | `func (e *SyntaxError) Error() string` | 返回错误描述，包含偏移位置 |

```go
data := `{invalid json}`
_, err := json.ParseAny(data)
if syntaxErr, ok := err.(*json.SyntaxError); ok {
    fmt.Printf("语法错误，偏移量: %d\n", syntaxErr.Offset)
}
```

---

### UnmarshalTypeError - 反序列化类型错误

当 JSON 值无法转换为目标 Go 类型时返回此错误。

#### 结构定义

```go
type UnmarshalTypeError struct {
    Value  string       // JSON 值的描述（如 "string", "number"）
    Type   reflect.Type // 目标 Go 类型
    Offset int64        // 错误发生的位置（字节偏移量）
    Struct string       // 包含该字段的结构体名称（如有）
    Field  string       // 字段名（如有）
    Err    error        // 内部错误（如有）
}
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Error` | `func (e *UnmarshalTypeError) Error() string` | 返回类型不匹配的错误描述 |
| `Unwrap` | `func (e *UnmarshalTypeError) Unwrap() error` | 返回内部错误 |

```go
type User struct {
    Age int `json:"age"`
}
var user User
err := json.Unmarshal([]byte(`{"age": "not_a_number"}`), &user)
if typeErr, ok := err.(*json.UnmarshalTypeError); ok {
    fmt.Printf("类型错误: JSON 值 %s 无法转换为 %v\n", typeErr.Value, typeErr.Type)
}
```

---

### UnsupportedTypeError - 不支持的类型错误

当尝试编码 Go 中不支持的类型时返回此错误。

#### 结构定义

```go
type UnsupportedTypeError struct {
    Type reflect.Type // 不支持的 Go 类型
}
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Error` | `func (e *UnsupportedTypeError) Error() string` | 返回不支持的类型描述 |

```go
type Chan chan int
data := Chan(make(chan int))
_, err := json.Marshal(data)
if unsupportedErr, ok := err.(*json.UnsupportedTypeError); ok {
    fmt.Printf("不支持的类型: %v\n", unsupportedErr.Type)
}
```

---

### UnsupportedValueError - 不支持的值错误

当尝试编码不支持的值时返回此错误（如 NaN、Infinity）。

#### 结构定义

```go
type UnsupportedValueError struct {
    Value reflect.Value // 不支持的值
    Str   string        // 错误描述
}
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Error` | `func (e *UnsupportedValueError) Error() string` | 返回不支持的值描述 |

```go
val := math.NaN()
_, err := json.Marshal(val)
if valErr, ok := err.(*json.UnsupportedValueError); ok {
    fmt.Printf("不支持的值: %s\n", valErr.Str)
}
```

---

### InvalidUnmarshalError - 无效的反序列化目标错误

当 `Unmarshal` 的目标参数不是指针或 nil 时返回此错误。

#### 结构定义

```go
type InvalidUnmarshalError struct {
    Type reflect.Type // 目标参数的类型
}
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Error` | `func (e *InvalidUnmarshalError) Error() string` | 返回无效目标的错误描述 |

```go
var target string // 应传指针
err := json.Unmarshal([]byte(`"hello"`), target) // 错误：未传指针
if invalidErr, ok := err.(*json.InvalidUnmarshalError); ok {
    fmt.Printf("无效的反序列化目标: %v\n", invalidErr.Type)
}
```

---

### MarshalerError - 编码器错误

当类型的 `MarshalJSON` 或 `MarshalText` 方法返回错误时包装此错误。

#### 结构定义

```go
type MarshalerError struct {
    Type reflect.Type // 实现 MarshalJSON 或 MarshalText 的类型
    Err  error        // MarshalJSON 或 MarshalText 返回的错误
    // 包含其他未导出字段
}
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Error` | `func (e *MarshalerError) Error() string` | 返回编码器错误描述 |
| `Unwrap` | `func (e *MarshalerError) Unwrap() error` | 返回内部错误 |

```go
type BadMarshaler struct{}

func (BadMarshaler) MarshalJSON() ([]byte, error) {
    return nil, errors.New("marshal failed")
}

_, err := json.Marshal(BadMarshaler{})
if marshalErr, ok := err.(*json.MarshalerError); ok {
    fmt.Printf("编码器错误 (类型: %v): %v\n", marshalErr.Type, marshalErr.Err)
}
```

---

## Encoder - JSON 编码器

`Encoder` 将 JSON 值写入输出流。100% 兼容 `encoding/json.Encoder`。

### 创建

签名：`func NewEncoder(w io.Writer, cfg ...Config) *Encoder`

创建写入 `w` 的编码器。支持可选 `Config` 参数自定义编码行为。

```go
file, _ := os.Create("output.json")
defer file.Close()

encoder := json.NewEncoder(file)
err := encoder.Encode(map[string]any{"name": "Alice"})
```

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Encode` | `func (enc *Encoder) Encode(v any) error` | 将 Go 值编码为 JSON 写入流 |
| `SetEscapeHTML` | `func (enc *Encoder) SetEscapeHTML(on bool)` | 设置是否转义 HTML 特殊字符 |
| `SetIndent` | `func (enc *Encoder) SetIndent(prefix, indent string)` | 设置缩进格式 |

### 使用示例

```go
package main

import (
    "bytes"
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    var buf bytes.Buffer
    encoder := json.NewEncoder(&buf)
    encoder.SetIndent("", "  ")
    encoder.SetEscapeHTML(true)

    err := encoder.Encode(map[string]any{
        "name":  "Alice",
        "email": "alice@example.com",
    })
    if err != nil {
        panic(err)
    }
    fmt.Println(buf.String())
}
```

---

## Decoder - JSON 解码器

`Decoder` 从输入流读取并解码 JSON 值。100% 兼容 `encoding/json.Decoder`。

### 创建

签名：`func NewDecoder(r io.Reader, cfg ...Config) *Decoder`

创建从 `r` 读取的解码器。支持可选 `Config` 参数。

```go
file, _ := os.Open("data.json")
defer file.Close()

decoder := json.NewDecoder(file)
for decoder.More() {
    var obj map[string]any
    if err := decoder.Decode(&obj); err != nil {
        break
    }
    fmt.Println(obj)
}
```

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Decode` | `func (dec *Decoder) Decode(v any) error` | 从流中读取下一个 JSON 值并解码 |
| `UseNumber` | `func (dec *Decoder) UseNumber()` | 使解码器将数字解析为 `Number` 而非 `float64` |
| `DisallowUnknownFields` | `func (dec *Decoder) DisallowUnknownFields()` | 解码时遇到未知字段返回错误 |
| `Buffered` | `func (dec *Decoder) Buffered() io.Reader` | 返回解码器缓冲区中剩余数据的 Reader |
| `InputOffset` | `func (dec *Decoder) InputOffset() int64` | 返回当前输入位置的偏移量 |
| `More` | `func (dec *Decoder) More() bool` | 检查流中是否还有更多 JSON 值 |
| `Token` | `func (dec *Decoder) Token() (Token, error)` | 读取下一个 JSON token |

### 使用示例

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

func main() {
    input := `{"name":"Alice","age":30}{"name":"Bob","age":25}`
    decoder := json.NewDecoder(strings.NewReader(input))

    for decoder.More() {
        var person map[string]any
        if err := decoder.Decode(&person); err != nil {
            break
        }
        fmt.Printf("姓名: %s, 年龄: %v\n", person["name"], person["age"])
    }
}
```

### 流式解码示例

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

func main() {
    // 解码 JSON 流中的多个值
    input := `[1,2,3][4,5,6]`
    decoder := json.NewDecoder(strings.NewReader(input))

    for decoder.More() {
        var arr []any
        if err := decoder.Decode(&arr); err != nil {
            panic(err)
        }
        fmt.Println(arr)
    }
}
```

### Token 读取示例

```go
decoder := json.NewDecoder(strings.NewReader(`{"name":"Alice"}`))
for {
    token, err := decoder.Token()
    if err != nil {
        break
    }
    switch v := token.(type) {
    case json.Delim:
        fmt.Printf("分隔符: %s\n", string(v))
    case string:
        fmt.Printf("字符串: %s\n", v)
    case float64:
        fmt.Printf("数字: %v\n", v)
    case bool:
        fmt.Printf("布尔: %v\n", v)
    case nil:
        fmt.Println("null")
    }
}
```

---

## Token - JSON Token

`Token` 是 JSON token 值，保存以下类型之一：

- `Delim`，表示四个 JSON 分隔符 `[ ] { }`
- `bool`，表示 JSON 布尔值
- `float64`，表示 JSON 数字
- `Number`，表示启用 `UseNumber` 时的 JSON 数字
- `string`，表示 JSON 字符串
- `nil`，表示 JSON null

```go
type Token any
```

通过 `Decoder.Token()` 获取。

---

## Number - JSON 数字

`Number` 表示 JSON 数字字符串，在启用 `UseNumber` 模式时由 Decoder 使用。

```go
type Number string
```

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `String` | `func (n Number) String() string` | 返回数字的字符串表示 |
| `Float64` | `func (n Number) Float64() (float64, error)` | 转换为 float64 |
| `Int64` | `func (n Number) Int64() (int64, error)` | 转换为 int64 |

```go
decoder := json.NewDecoder(strings.NewReader(`{"price": 19.99}`))
decoder.UseNumber()
var obj map[string]any
decoder.Decode(&obj)

if num, ok := obj["price"].(json.Number); ok {
    f, _ := num.Float64()
    fmt.Println(f) // 19.99
}
```

---

## Delim - JSON 分隔符

`Delim` 是 JSON 分隔符类型，对应 `[`、`]`、`{`、`}` 四个字符。

```go
type Delim rune
```

### 方法

#### String

签名：`func (d Delim) String() string`

返回分隔符的字符串表示。

```go
token, _ := decoder.Token()
if delim, ok := token.(json.Delim); ok {
    fmt.Println(delim.String()) // "[" 或 "{" 等
}
```

---

## 相关

- [包函数](./functions) - 包级函数参考
- [Config](./config) - 配置选项
- [Processor](./processor/) - 处理器方法
- [接口定义](./interfaces) - 扩展接口
