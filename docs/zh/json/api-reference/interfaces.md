---
sidebar_label: "接口定义"
title: "接口定义 - CyberGo JSON | 扩展接口与 Hook 钩子"
description: "CyberGo JSON 接口定义：Hook 钩子、PathParser 路径解析器、DangerousPattern 安全级别与已废弃的 CustomEncoder。"
sidebar_position: 70
---

# 接口定义

本页列出库导出的扩展接口、钩子接口与相关基础类型。每个接口标注了是否已挂接：`Hook`、`PathParser` 与标准库兼容接口直接生效，`CustomEncoder`、`TypeEncoder`、`Validator` 已废弃且不被调用。

## 编码器接口

::: warning 已废弃的扩展接口
`CustomEncoder` 和 `TypeEncoder` 接口**已废弃**（源码标注 Deprecated）。用 `Config.CustomEncoder` / `Config.CustomTypeEncoders` 设置的实现**从未被编码流水线调用**，内置编码器不可替换；两个接口在 v1 生命周期内保留。要自定义编码，实现 `json.Marshaler` 或 `encoding.TextMarshaler`（见[自定义编码器](../extensions/custom-encoder)）。
:::

### CustomEncoder

<Badge type="danger" text="已废弃" />

自定义 JSON 编码器接口。实现本接口并赋给 `Config.CustomEncoder` **不会生效**（见上方警告）。

```go
type CustomEncoder interface {
    // Encode 将 Go 值转换为 JSON 字符串
    Encode(value any) (string, error)
}
```

**替代写法**：在自定义类型上实现 `MarshalJSON`，编码时完全接管该类型的 JSON 形态：

```go
type UpperString string

func (s UpperString) MarshalJSON() ([]byte, error) {
    return []byte(fmt.Sprintf(`"%s"`, strings.ToUpper(string(s)))), nil
}

out, err := json.Marshal(map[string]any{"key": UpperString("value")})
// out: {"key":"VALUE"} — 无需任何 Config 设置
```

### TypeEncoder

<Badge type="danger" text="已废弃" />

特定类型的编码器接口。注册到 `Config.CustomTypeEncoders` **不会被编码流水线查询**（见上方警告）。

```go
type TypeEncoder interface {
    // Encode 将特定类型的值编码为 JSON 字符串
    Encode(v reflect.Value) (string, error)
}
```

**替代写法**：按类型定制编码同样走 `MarshalJSON`/`MarshalText`——例如给自定义时间类型实现 `MarshalJSON` 以覆盖默认的 RFC3339Nano 输出（完整示例见[自定义编码器](../extensions/custom-encoder)）。

## 验证器接口

::: warning 已废弃的扩展接口
`Validator` 接口**已废弃**（源码标注 Deprecated）：用 `Config.CustomValidators` 或 `Config.AddValidator()` 注册的验证器**从不被任何公开操作执行**，接口在 v1 生命周期内保留。操作前的自定义检查请用 `Config.AddHook` + Before 钩子（如 [`ValidationHook`](../extensions/hooks)），结构校验用 `ValidateSchema`（见[Schema 校验](./schema)）。
:::

### Validator

<Badge type="danger" text="已废弃" />

JSON 验证器接口。

```go
type Validator interface {
    // Validate 检查 JSON 字符串是否有问题
    // 有效返回 nil，否则返回描述问题的错误
    Validate(jsonStr string) error
}
```

**替代写法**：用 `ValidationHook` 在操作前执行自定义检查，返回错误即中止操作：

```go
cfg := json.DefaultConfig()
cfg.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1024*1024 { // 1MB
        return fmt.Errorf("JSON 超过最大大小")
    }
    return nil
}))
```

## 钩子接口

### Hook

操作拦截接口，分前置与后置两个钩子点。

```go
type Hook interface {
    // Before 在操作之前调用
    // 返回错误以中止操作
    Before(ctx HookContext) error

    // After 在操作完成后调用
    // 可以修改结果或检查错误
    After(ctx HookContext, result any, err error) (any, error)
}
```

**执行顺序**：多个钩子按注册顺序执行 `Before`，任一返回错误即中止，后续钩子与操作本身都不再执行。`After` 按**注册的逆序**执行，类似中间件洋葱模型。

钩子内部 panic 会被捕获：`Before` 的 panic 转为错误中止操作，`After` 的 panic 记录日志后跳过该钩子。两者都不会击穿处理器。

### HookContext

钩子上下文，携带本次操作的类型、路径、值、活动配置与开始时间。

```go
type HookContext struct {
    Operation string        // 操作类型（源码注释列为："get", "set", "delete", "marshal", "unmarshal"）
    JSONStr   string        // 输入 JSON 字符串（marshal 时可能为空）。安全警告：可能包含敏感数据
    Path      string        // 目标路径（marshal/unmarshal 时可能为空）
    Value     any           // set 操作的值
    Config    *Config       // 活动配置
    StartTime time.Time     // 操作开始时间
}
```

| 字段        | 类型       | 说明                                                            |
| ----------- | ---------- | --------------------------------------------------------------- |
| `Operation` | `string`   | 操作类型：`"get"`、`"set"`、`"delete"`、`"get_multiple"`、`"set_multiple"`（源码注释另列出 `"marshal"`、`"unmarshal"`） |
| `JSONStr`   | `string`   | 输入 JSON 字符串（marshal 时可能为空）；**可能包含敏感数据**    |
| `Path`      | `string`   | 目标路径（marshal/unmarshal 时可能为空）；批量操作时为形如 `(3 paths)` 的占位文本 |
| `Value`     | `any`      | set 操作要写入的值                                              |
| `Config`    | `*Config`  | 当前操作使用的活动配置（池化对象，仅在本操作期间有效，钩子不得保留到调用之外） |
| `StartTime` | `time.Time` | 操作开始时间（在 `After` 调用前设置）                           |

::: warning JSONStr 含敏感数据
`JSONStr` 可能包含密码、令牌、API 密钥、PII（个人身份信息）等敏感数据——**不要**将该字段写入日志；记录日志请只使用 `Operation` 与 `Path`，确需检查内容时只针对特定路径读取。
:::

::: warning Config 指针生命周期
`Config` 指向池化的 per-call 配置，仅在本次操作期间有效——操作返回后其引用字段会被清空并回池复用。钩子**不得**把该指针保留到调用之外（如放入异步日志队列继续使用）；需要留存请先复制所需字段。
:::

**使用示例**

```go
type LoggingHook struct {
    logger *slog.Logger
}

func (h *LoggingHook) Before(ctx json.HookContext) error {
    h.logger.Info("操作开始",
        "operation", ctx.Operation,
        "path", ctx.Path,
    )
    return nil
}

func (h *LoggingHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("操作完成",
        "operation", ctx.Operation,
        "path", ctx.Path,
        "duration", time.Since(ctx.StartTime),
        "error", err,
    )
    return result, err
}

// 添加钩子
cfg := json.DefaultConfig()
cfg.Hooks = []json.Hook{&LoggingHook{logger: slog.Default()}}
```

### HookFunc

结构体适配器，用函数实现钩子。两个函数字段均可选，未设置的一方按「直通」处理：`Before` 返回 `nil`，`After` 原样返回结果与错误。

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

| 字段       | 类型                                                          | 说明                                                    |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| `BeforeFn` | `func(ctx HookContext) error`                                 | 操作前回调；返回错误以中止操作。未设置时 `Before` 直通返回 `nil` |
| `AfterFn`  | `func(ctx HookContext, result any, err error) (any, error)`   | 操作后回调；可转换结果或错误。未设置时 `After` 原样返回结果与错误 |

**使用示例**

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

### 预定义钩子

#### LoggingHook

签名：`func LoggingHook(logger interface{ Info(msg string, args ...any) }) Hook`

创建日志记录钩子：`Before` 记一条开始日志，`After` 记一条完成日志，带 `duration` 与错误文本。路径与错误文本先经内部脱敏再写入，调用方无需另行处理。

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

#### TimingHook

签名：`func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook`

创建计时记录钩子：`After` 阶段把 `Operation` 与实际耗时交给 `recorder.Record`。

```go
type MetricsRecorder struct{}

func (r *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.RecordDuration(op, duration)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

#### ValidationHook

签名：`func ValidationHook(validator func(jsonStr, path string) error) Hook`

创建输入验证钩子：`Before` 阶段用 `ctx.JSONStr` 与 `ctx.Path` 调用 `validator`，返回错误即中止操作。

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1_000_000 {
        return errors.New("JSON 过大")
    }
    return nil
}))
```

#### ErrorHook

签名：`func ErrorHook(handler func(ctx HookContext, err error) error) Hook`

创建错误拦截钩子：`After` 阶段仅在 `err != nil` 时调用 `handler`，并把它的返回值作为最终错误。

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // 返回原始或转换后的错误
}))
```

## 安全模式接口

### PatternLevel

危险模式严重级别。

```go
type PatternLevel int

const (
    // PatternLevelCritical - 始终阻止操作
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning - 在严格模式下阻止，在宽松模式下记录警告
    PatternLevelWarning

    // PatternLevelInfo - 仅记录，从不阻止
    PatternLevelInfo
)
```

**String 方法**：`func (pl PatternLevel) String() string` 返回 `"critical"` / `"warning"` / `"info"`（未知值返回 `"unknown"`），可直接写入日志字段。

### DangerousPattern

危险模式结构体，用于定义自定义安全规则。

```go
type DangerousPattern struct {
    // Pattern 是要在输入中检测的子字符串
    Pattern string

    // Name 是模式的描述性名称
    Name string

    // Level 确定如何处理该模式的严重级别
    Level PatternLevel
}
```

| 字段      | 类型           | 说明                                       |
| --------- | -------------- | ------------------------------------------ |
| `Pattern` | `string`       | 要在输入中检测的子字符串                   |
| `Name`    | `string`       | 该安全风险的描述性名称                     |
| `Level`   | `PatternLevel` | 严重级别，决定命中后的处理方式（阻止/警告/仅记录） |

**使用示例**

```go
// 使用结构体字面量创建自定义危险模式
customPattern := json.DangerousPattern{
    Pattern: "eval(",
    Name:    "JavaScript eval 调用",
    Level:   json.PatternLevelCritical,
}

// 通过配置添加
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(customPattern)
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "internal_api",
    Name:    "内部 API 引用",
    Level:   json.PatternLevelWarning,
})
```

## 路径解析接口

### PathParser

路径解析器接口。实现后由 `Config.CustomPathParser` 接管全部路径解析。

```go
type PathParser interface {
    // ParsePath 将路径字符串解析为路径段
    ParsePath(path string) ([]PathSegment, error)
}
```

**使用示例**

返回的 `[]PathSegment` 由库定义：`Type` 标明段类型，`Key` / `Index` / `End` / `Step` 承载取值，`Flags` 是位打包字段。自定义解析器按下标顺序填充这些字段即可。

```go
type CustomPathParser struct{}

func (p *CustomPathParser) ParsePath(path string) ([]json.PathSegment, error) {
    // 自定义路径解析逻辑
    return nil, nil // 实现自定义解析
}
```

::: tip 已挂接的扩展点
`CustomPathParser` 已接入路径解析流水线：用 `Config.CustomPathParser` 设置后，所有路径类操作（Get/Set/Delete/迭代）都会调用 `ParsePath`，**完全替代**内置解析器。解析结果不进入全局路径段缓存；携带自定义解析器的配置也不进入处理器配置缓存。解析器 panic 会被捕获并转为错误。与已废弃、不生效的 `CustomEncoder`、`CustomValidators` 不同，本接口可直接使用。
:::

## 基础类型

### Number

JSON 数字类型，用于保留数字精度。当处理大数字或需要精确小数时使用。

```go
type Number string
```

::: tip 兼容性说明
`Number` 的方法集与 `encoding/json.Number` 一致（`String`/`Float64`/`Int64`），并额外实现了 `MarshalJSON` 与 `UnmarshalJSON`：编码时按字面量原样输出、不加引号，解码 `42` 到 `*Number` 无需 `UseNumber`。把 `encoding/json` 的 `Number` 换成这里的 `Number` 后，解码代码无需改动；非法字面量会被拒绝，不会原样写出。
:::

**方法**：

```go
func (n Number) String() string              // 返回数字的字面文本
func (n Number) Float64() (float64, error)   // 转换为 float64
func (n Number) Int64() (int64, error)       // 转换为 int64
```

**使用示例**：

```go
// 获取 Number 类型（通过 Decoder.UseNumber 保留完整精度）
decoder := json.NewDecoder(strings.NewReader(data))
decoder.UseNumber()

var obj map[string]any
if err := decoder.Decode(&obj); err != nil {
    panic(err)
}

// 类型断言获取 Number
if num, ok := obj["large_number"].(json.Number); ok {
    // Number 保留原始精度
    fmt.Println(num.String()) // "9007199254740993" (完整精度)

    // 转换为其他类型
    f, _ := num.Float64()
    i, _ := num.Int64()
}
```

## 标准库兼容接口

`json` 包导出与 `encoding/json` 兼容的四个标准接口，用于自定义类型的编解码。编码侧是 `Marshaler` 与 `TextMarshaler`（实战见[自定义编码器](../extensions/custom-encoder)），解码侧是 `Unmarshaler` 与 `TextUnmarshaler`。

### Marshaler

```go
type Marshaler interface {
    MarshalJSON() ([]byte, error)
}
```

实现 `MarshalJSON` 的类型在编码时完全接管自身的 JSON 表示，返回值必须是合法 JSON。

### Unmarshaler

```go
type Unmarshaler interface {
    UnmarshalJSON(data []byte) error
}
```

实现 `UnmarshalJSON` 的类型在解码时接管自身的解析。解码器把对应的 JSON 值原样传入，由类型自行填充目标；方法返回的错误原样向上传播。因解码要修改接收者，通常实现于**指针接收者**。

### TextMarshaler

```go
type TextMarshaler interface {
    MarshalText() ([]byte, error)
}
```

实现 `MarshalText` 的类型被编码为 JSON 字符串，字符串的值即文本内容；引号与转义由编码器补充。

### TextUnmarshaler

```go
type TextUnmarshaler interface {
    UnmarshalText(text []byte) error
}
```

实现 `UnmarshalText` 的类型从 JSON 字符串的**内容**（去掉引号与转义后的文本）自行解析，适合用文本即可完整表达的类型（自定义时间、ID 等）。同一类型同时实现 `Unmarshaler` 时，`UnmarshalJSON` 优先。

**使用示例**

```go
type Person struct {
    Name string
}

// 实现 Marshaler 接口
func (p Person) MarshalJSON() ([]byte, error) {
    return []byte(`{"name":"` + p.Name + `"}`), nil
}

// 实现 Unmarshaler 接口
func (p *Person) UnmarshalJSON(data []byte) error {
    var v struct{ Name string `json:"name"` }
    if err := json.Unmarshal(data, &v); err != nil {
        return err
    }
    p.Name = v.Name
    return nil
}
```

`Encoder`、`Decoder`、`Token`、`Delim`、`Number` 等编解码类型详见 [类型定义](./types#encoder-json-编码器)。

## 类型定义

### Result[T]

带类型参数的操作结果，把值、是否存在与错误合成一个返回值。库内没有直接返回它的函数，由你手动构造。

```go
type Result[T any] struct {
    Value  T     // 结果值
    Exists bool  // 路径是否存在
    Error  error // 错误信息（如有）
}
```

**方法**：

| 方法 | 签名 | 说明 |
|------|------|------|
| `Ok` | `func (r Result[T]) Ok() bool` | 结果是否有效（无错误且存在） |
| `Unwrap` | `func (r Result[T]) Unwrap() T` | 获取值，无效时返回零值 |
| `UnwrapOr` | `func (r Result[T]) UnwrapOr(defaultValue T) T` | 获取值或默认值 |

**使用示例**：

下面的调用展示泛型取值，返回的是 `T` 而不是 `Result[T]`；`Result[T]` 的构造场景见[泛型操作](./generics#result-t-类型)。

```go
// 使用泛型获取值
name := json.GetTyped[string](data, "user.name")
fmt.Println(name)

// 带默认值获取
name = json.GetTyped[string](data, "user.name", "unknown")
```

---

### AccessResult

动态类型访问结果，由 `SafeGet()` 返回。

```go
type AccessResult struct {
    Value  any    // 结果值
    Exists bool   // 路径是否存在
    Type   string // 运行时类型信息
}

// 方法
func (r AccessResult) Ok() bool                           // 是否存在
func (r AccessResult) Unwrap() any                        // 获取值
func (r AccessResult) UnwrapOr(defaultValue any) any      // 获取值或默认值
func (r AccessResult) AsString() (string, error)          // 严格转换
func (r AccessResult) AsStringConverted() (string, error) // 格式化转换
func (r AccessResult) AsInt() (int, error)                // 严格转换
func (r AccessResult) AsFloat64() (float64, error)        // 严格转换
func (r AccessResult) AsBool() (bool, error)              // 严格转换
```

**类型转换方法说明**：

| 方法 | 转换行为 | 说明 |
|------|----------|------|
| `AsString()` | 严格 | 仅接受 `string`，非字符串返回包装 `ErrTypeMismatch` 的错误 |
| `AsStringConverted()` | 格式化 | 用 `fmt.Sprintf("%v")` 输出任意值的字符串表示 |
| `AsInt()` | 严格 | 拒绝 `bool`；接受整数、整值浮点数与可解析的十进制字符串 |
| `AsFloat64()` | 严格 | 拒绝 `bool`；接受数值类型与可解析的字符串 |
| `AsBool()` | 严格 | 仅接受 `bool` 与 `strconv.ParseBool` 可解析的字符串 |

```go
result := p.SafeGet(data, "user.age")

// 严格转换 - 如果值不是整数则返回错误
age, err := result.AsInt()

// 格式化转换 - 将任意值转为字符串
str, err := result.AsStringConverted() // 如 30 -> "30"
```

## Schema 类型

### Schema

把 JSON Schema 定义为 Go 结构体，字段与 JSON Schema 关键字同名。约束是否生效见 [Schema 校验](./schema#schema-的创建方式)。

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

**使用示例**：

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name"},
    Properties: map[string]*json.Schema{
        "name": {Type: "string"},
        "age":  {Type: "number"},
    },
}
```

### SchemaConfig

Schema 验证配置，作为 `NewSchema` 的入参。

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

**使用示例**：

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
additionalProperties := false
cfg.AdditionalProperties = &additionalProperties
schema := json.NewSchema(cfg)
```

### ValidationError

Schema 验证错误。

```go
type ValidationError struct {
    Path    string `json:"path"`    // 错误路径
    Message string `json:"message"` // 错误消息
}

func (ve *ValidationError) Error() string
```

## 相关

- [Hook 钩子系统](../extensions/hooks)：钩子的用法与执行顺序
- [Schema 校验](./schema)：Schema 验证完整规则
- [自定义编码器](../extensions/custom-encoder)：用 `MarshalJSON`/`MarshalText` 定制编码
