---
title: "接口定义 - CyberGo JSON | API 参考"
description: "CyberGo JSON 扩展接口定义完整参考：包括 CustomEncoder、TypeEncoder、Validator、Hook 接口、PathParser 和 DangerousPattern，支持灵活扩展库的编码、验证和安全防护等核心功能，满足自定义序列化和安全策略需求。"
---

# 接口定义

json 包提供多个扩展接口，允许自定义 JSON 处理行为。

## 编码器接口

### CustomEncoder

自定义 JSON 编码器接口。

```go
type CustomEncoder interface {
    // Encode 将 Go 值转换为 JSON 字符串
    Encode(value any) (string, error)
}
```

**使用示例**

```go
import stdjson "encoding/json"

type UpperCaseEncoder struct{}

func (e *UpperCaseEncoder) Encode(value any) (string, error) {
    // 自定义编码逻辑
    switch v := value.(type) {
    case string:
        return fmt.Sprintf(`"%s"`, strings.ToUpper(v)), nil
    default:
        // 使用标准编码（避免无限递归）
        data, err := stdjson.Marshal(v)
        if err != nil {
            return "", err
        }
        return string(data), nil
    }
}

// 配置使用
cfg := json.DefaultConfig()
cfg.CustomEncoder = &UpperCaseEncoder{}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### TypeEncoder

特定类型的编码器接口。

```go
type TypeEncoder interface {
    // Encode 将特定类型的值编码为 JSON 字符串
    Encode(v reflect.Value) (string, error)
}
```

**使用示例**

```go
type TimeEncoder struct{}

func (e *TimeEncoder) Encode(v reflect.Value) (string, error) {
    if v.Type() == reflect.TypeOf(time.Time{}) {
        t := v.Interface().(time.Time)
        return fmt.Sprintf(`"%s"`, t.Format(time.RFC3339)), nil
    }
    return "", fmt.Errorf("不支持的类型: %v", v.Type())
}

// 注册类型编码器
cfg := json.DefaultConfig()
cfg.CustomTypeEncoders = map[reflect.Type]json.TypeEncoder{
    reflect.TypeOf(time.Time{}): &TimeEncoder{},
}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## 验证器接口

### Validator

JSON 验证器接口。

```go
type Validator interface {
    // Validate 检查 JSON 字符串是否有问题
    // 有效返回 nil，否则返回描述问题的错误
    Validate(jsonStr string) error
}
```

**使用示例**

```go
type SizeValidator struct {
    MaxSize int64
}

func (v *SizeValidator) Validate(jsonStr string) error {
    // 检查输入数据的大小
    if int64(len(jsonStr)) > v.MaxSize {
        return fmt.Errorf("JSON 超过最大大小: %d", v.MaxSize)
    }
    return nil
}

// 设置验证器
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}} // 1MB
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## 钩子接口

### Hook

操作拦截接口，支持前置/后置处理。

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

### HookContext

钩子上下文，提供操作信息。

```go
type HookContext struct {
    Operation string        // 操作类型: "get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string        // 输入 JSON 字符串（marshal 时可能为空）
    Path      string        // 目标路径（marshal/unmarshal 时可能为空）
    Value     any           // set 操作的值
    Config    *Config       // 活动配置
    StartTime time.Time     // 操作开始时间
}
```

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

结构体适配器，允许使用函数作为钩子。

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

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

创建日志记录钩子。

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

#### TimingHook

签名：`func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook`

创建计时记录钩子。

```go
type MetricsRecorder struct{}

func (r *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.RecordDuration(op, duration)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

#### ValidationHook

签名：`func ValidationHook(validator func(jsonStr, path string) error) Hook`

创建输入验证钩子。

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

创建错误拦截钩子。

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

路径解析器接口。

```go
type PathParser interface {
    // ParsePath 将路径字符串解析为路径段
    ParsePath(path string) ([]PathSegment, error)
}
```

**使用示例**

```go
type CustomPathParser struct{}

func (p *CustomPathParser) ParsePath(path string) ([]json.PathSegment, error) {
    // 自定义路径解析逻辑
    return nil, nil // 实现自定义解析
}
```

## 基础类型

### Number

JSON 数字类型，用于保留数字精度。当处理大数字或需要精确小数时使用。

```go
type Number string
```

::: tip 兼容性说明
库的 `Number` 类型 100% 兼容 `encoding/json.Number`，可直接替换使用。
:::

**方法**：

```go
func (n Number) String() string              // 返回数字的字面文本
func (n Number) Float64() (float64, error)   // 转换为 float64
func (n Number) Int64() (int64, error)       // 转换为 int64
```

**使用示例**：

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// 获取 Number 类型（通过 Get 方法获取后类型断言）
val, err := processor.Get(data, "large_number")
if err != nil {
    panic(err)
}

// 类型断言获取 Number
if num, ok := val.(json.Number); ok {
    // Number 保留原始精度
    fmt.Println(num.String()) // "9007199254740993" (完整精度)

    // 转换为其他类型
    f, _ := num.Float64()
    i, _ := num.Int64()
}
```

## 标准库兼容接口

`json` 包导出以下与 `encoding/json` 兼容的标准接口，用于自定义类型的编码和解码行为。

### Marshaler

```go
type Marshaler interface {
    MarshalJSON() ([]byte, error)
}
```

### Unmarshaler

```go
type Unmarshaler interface {
    UnmarshalJSON(data []byte) error
}
```

### TextMarshaler

```go
type TextMarshaler interface {
    MarshalText() ([]byte, error)
}
```

### TextUnmarshaler

```go
type TextUnmarshaler interface {
    UnmarshalText(text []byte) error
}
```

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

类型安全的操作结果，提供泛型支持的结果处理。

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

```go
// 使用泛型获取值
name := json.GetTyped[string](data, "user.name")
fmt.Println(name)

// 带默认值获取
name = json.GetTyped[string](data, "user.name", "unknown")
```

---

### AccessResult

动态类型访问结果，由 Processor.SafeGet 返回。

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
| `AsString()` | 严格 | 仅接受 string 类型，非字符串返回错误 |
| `AsStringConverted()` | 格式化 | 使用 fmt.Sprintf 将任意值转为字符串表示 |
| `AsInt()` | 严格 | 不转换 bool 到 int，仅接受整数和可解析的数字 |
| `AsFloat64()` | 严格 | 不转换 bool 到 float，仅接受浮点数和可解析的数字 |
| `AsBool()` | 严格 | 仅接受 bool 和可解析的字符串（"true"/"false"/"yes"/"no" 等） |

```go
result := p.SafeGet(data, "user.age")

// 严格转换 - 如果值不是整数则返回错误
age, err := result.AsInt()

// 格式化转换 - 将任意值转为字符串
str, err := result.AsStringConverted() // 如 30 -> "30"
```

## Schema 类型

### Schema

JSON Schema 定义为结构体，支持类型安全的 Schema 定义。

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

Schema 验证配置。用于通过 `NewSchemaWithConfig` 创建 Schema 实例。

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
cfg.AdditionalProperties = ptrBool(false)
schema := json.NewSchemaWithConfig(cfg)
```

### ValidationError

Schema 验证错误。

```go
type ValidationError struct {
    Path    string // 错误路径
    Message string // 错误消息
}

func (ve *ValidationError) Error() string
```

## 相关

- [Hook 钩子系统](./hooks) - 钩子详细使用指南
- [Validator 验证器](./validator) - 验证器详细使用指南
- [CustomEncoder](./custom-encoder) - 自定义编码器指南
