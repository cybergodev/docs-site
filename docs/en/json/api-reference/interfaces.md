---
sidebar_label: "Interfaces"
title: "Interface Definitions - CyberGo JSON | Extension & Hook APIs"
description: "CyberGo JSON extension interfaces: Hook/HookContext, LoggingHook, PathParser, DangerousPattern with PatternLevel, the deprecated CustomEncoder/Validator interfaces, and Marshaler."
sidebar_position: 70
---

# Interface Definitions

The json package provides multiple extension interfaces for customizing JSON processing behavior.

## Encoder Interfaces

::: warning Deprecated extension interfaces
The `CustomEncoder` and `TypeEncoder` interfaces are **deprecated** (marked Deprecated in the source): implementations set via `Config.CustomEncoder` / `Config.CustomTypeEncoders` are **never invoked by the encoding pipeline**, and the built-in encoder cannot be replaced. Both interfaces are kept within v1. To customize encoding, implement the `json.Marshaler` or `encoding.TextMarshaler` interfaces (see [Custom Encoders](../extensions/custom-encoder)).
:::

### CustomEncoder

<Badge type="danger" text="Deprecated" />

The custom JSON encoder interface. Implementing it and assigning to `Config.CustomEncoder` **has no effect** (see the warning above).

```go
type CustomEncoder interface {
    // Encode converts a Go value into a JSON string
    Encode(value any) (string, error)
}
```

**Replacement**: implement `MarshalJSON` on your custom type — encoding then fully takes over that type's JSON representation:

```go
type UpperString string

func (s UpperString) MarshalJSON() ([]byte, error) {
    return []byte(fmt.Sprintf(`"%s"`, strings.ToUpper(string(s)))), nil
}

out, err := json.Marshal(map[string]any{"key": UpperString("value")})
// out: {"key":"VALUE"} — no Config setup needed
```

### TypeEncoder

<Badge type="danger" text="Deprecated" />

The per-type encoder interface. Registrations in `Config.CustomTypeEncoders` are **never consulted by the encoding pipeline** (see the warning above).

```go
type TypeEncoder interface {
    // Encode encodes a value of the specific type into a JSON string
    Encode(v reflect.Value) (string, error)
}
```

**Replacement**: per-type encoding customization likewise goes through `MarshalJSON`/`MarshalText` — e.g. implement `MarshalJSON` on a custom time type to override the default RFC3339Nano output (full example in [Custom Encoders](../extensions/custom-encoder)).

## Validator Interfaces

::: warning Deprecated extension interface
The `Validator` interface is **deprecated** (marked Deprecated in the source): validators registered via `Config.CustomValidators` or `Config.AddValidator()` are **never executed by any public operation**. The interface is kept within v1. For custom pre-operation checks use `Config.AddHook` with a Before hook (e.g. [`ValidationHook`](../extensions/hooks)); for structural validation use `ValidateSchema` (see [Schema Validation](./schema)).
:::

### Validator

<Badge type="danger" text="Deprecated" />

The JSON validator interface.

```go
type Validator interface {
    // Validate checks a JSON string for problems.
    // Returns nil when valid, otherwise an error describing the problem.
    Validate(jsonStr string) error
}
```

**Replacement**: use `ValidationHook` to run custom checks before an operation; returning an error aborts it:

```go
cfg := json.DefaultConfig()
cfg.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1024*1024 { // 1MB
        return fmt.Errorf("JSON exceeds maximum size")
    }
    return nil
}))
```

## Hook Interfaces

### Hook

The operation interception interface, supporting before/after processing.

```go
type Hook interface {
    // Before is invoked before the operation.
    // Return an error to abort the operation.
    Before(ctx HookContext) error

    // After is invoked once the operation completes.
    // It may modify the result or inspect the error.
    After(ctx HookContext, result any, err error) (any, error)
}
```

**Execution order**: with multiple hooks, `Before` runs in registration order (any error aborts — later hooks and the operation itself do not run); `After` runs in **reverse registration order** (like the middleware onion model). Panics inside hooks are caught: a `Before` panic becomes an error that aborts the operation; an `After` panic is logged and that hook is skipped — neither ever takes down the processor.

### HookContext

The hook context, providing operation information.

```go
type HookContext struct {
    Operation string        // Operation type: "get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string        // Input JSON string (may be empty for marshal). Security warning: may contain sensitive data
    Path      string        // Target path (may be empty for marshal/unmarshal)
    Value     any           // Value for set operations
    Config    *Config       // Active configuration
    StartTime time.Time     // Operation start time
}
```

| Field       | Type        | Description                                                                                  |
| ----------- | ----------- | -------------------------------------------------------------------------------------------- |
| `Operation` | `string`    | Operation type: `"get"`, `"set"`, `"delete"`, `"marshal"`, `"unmarshal"`                       |
| `JSONStr`   | `string`    | Input JSON string (may be empty for marshal); **may contain sensitive data**                  |
| `Path`      | `string`    | Target path (may be empty for marshal/unmarshal)                                              |
| `Value`     | `any`       | Value to write for set operations                                                             |
| `Config`    | `*Config`   | Active configuration used by the current operation (a pooled object, valid only for this operation; hooks must not retain it beyond the call) |
| `StartTime` | `time.Time` | Operation start time (set before `After` is called)                                           |

::: warning JSONStr carries sensitive data
`JSONStr` may contain passwords, tokens, API keys, PII (personally identifiable information), and other sensitive data — do **not** write this field to logs; log only with `Operation` and `Path`, and when you must inspect the content, read only the specific paths involved.
:::

::: warning Config pointer lifetime
`Config` points to a pooled per-call configuration that is valid only for the current operation — once the operation returns, its referenced fields are cleared and it is recycled to the pool. Hooks must **not** retain the pointer beyond the call (e.g. keep using it from an async logging queue); copy the fields you need if you must retain anything.
:::

**Usage example**

```go
type LoggingHook struct {
    logger *slog.Logger
}

func (h *LoggingHook) Before(ctx json.HookContext) error {
    h.logger.Info("operation started",
        "operation", ctx.Operation,
        "path", ctx.Path,
    )
    return nil
}

func (h *LoggingHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("operation completed",
        "operation", ctx.Operation,
        "path", ctx.Path,
        "duration", time.Since(ctx.StartTime),
        "error", err,
    )
    return result, err
}

// Add the hook
cfg := json.DefaultConfig()
cfg.Hooks = []json.Hook{&LoggingHook{logger: slog.Default()}}
```

### HookFunc

A struct adapter that lets functions act as hooks. Both function fields are optional: an unset side behaves as "pass-through" (`Before` returns nil; `After` returns the result and error unchanged).

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

| Field      | Type                                                        | Description                                                                      |
| --------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `BeforeFn` | `func(ctx HookContext) error`                               | Pre-operation callback; return an error to abort the operation. When unset, `Before` passes through returning `nil` |
| `AfterFn`  | `func(ctx HookContext, result any, err error) (any, error)` | Post-operation callback; may transform the result or error. When unset, `After` returns the result and error unchanged |

**Usage example**

```go
// Only After is needed
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        log.Printf("%s completed in %v", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})

// Only Before is needed
p.AddHook(&json.HookFunc{
    BeforeFn: func(ctx json.HookContext) error {
        log.Printf("starting %s on path %s", ctx.Operation, ctx.Path)
        return nil
    },
})
```

### Predefined Hooks

#### LoggingHook

Signature: `func LoggingHook(logger interface{ Info(msg string, args ...any) }) Hook`

Creates a logging hook.

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

#### TimingHook

Signature: `func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook`

Creates a timing-recording hook.

```go
type MetricsRecorder struct{}

func (r *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.RecordDuration(op, duration)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

#### ValidationHook

Signature: `func ValidationHook(validator func(jsonStr, path string) error) Hook`

Creates an input-validation hook.

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1_000_000 {
        return errors.New("JSON too large")
    }
    return nil
}))
```

#### ErrorHook

Signature: `func ErrorHook(handler func(ctx HookContext, err error) error) Hook`

Creates an error-interception hook.

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // Return the original or a transformed error
}))
```

## Security Mode Interfaces

### PatternLevel

Severity levels for dangerous patterns.

```go
type PatternLevel int

const (
    // PatternLevelCritical - always blocks the operation
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning - blocks in strict mode, logs a warning in lenient mode
    PatternLevelWarning

    // PatternLevelInfo - logs only, never blocks
    PatternLevelInfo
)
```

**String method**: `func (pl PatternLevel) String() string` returns `"critical"` / `"warning"` / `"info"` (`"unknown"` for unrecognized values), convenient for logging.

### DangerousPattern

The dangerous-pattern struct, used to define custom security rules.

```go
type DangerousPattern struct {
    // Pattern is the substring to detect in the input
    Pattern string

    // Name is a descriptive name for the pattern
    Name string

    // Level is the severity level determining how the pattern is handled
    Level PatternLevel
}
```

| Field     | Type           | Description                                                                  |
| -------- | -------------- | ---------------------------------------------------------------------------- |
| `Pattern` | `string`       | Substring to detect in the input                                             |
| `Name`    | `string`       | Descriptive name of the security risk                                        |
| `Level`   | `PatternLevel` | Severity level, deciding how a hit is handled (block / warn / log only)      |

**Usage example**

```go
// Create a custom dangerous pattern with a struct literal
customPattern := json.DangerousPattern{
    Pattern: "eval(",
    Name:    "JavaScript eval call",
    Level:   json.PatternLevelCritical,
}

// Add via configuration
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(customPattern)
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "internal_api",
    Name:    "internal API reference",
    Level:   json.PatternLevelWarning,
})
```

## Path Parsing Interfaces

### PathParser

The path parser interface.

```go
type PathParser interface {
    // ParsePath parses a path string into path segments
    ParsePath(path string) ([]PathSegment, error)
}
```

**Usage example**

```go
type CustomPathParser struct{}

func (p *CustomPathParser) ParsePath(path string) ([]json.PathSegment, error) {
    // Custom path parsing logic
    return nil, nil // Implement custom parsing
}
```

::: tip A wired extension point
`CustomPathParser` **is wired into the path-parsing pipeline** in the current version: once set via `Config.CustomPathParser`, all path-based operations (Get/Set/Delete/iteration) call `ParsePath` as a **complete replacement** for the built-in parser; parsed results bypass the global path-segment cache, and configurations carrying a custom parser also bypass the processor configuration cache. Panics inside the parser are caught and converted to errors, never crashing the process. Unlike the deprecated, ineffective `CustomEncoder` and `CustomValidators`, this interface is ready to use.
:::

## Basic Types

### Number

The JSON number type, used to preserve numeric precision. Use it for very large numbers or when exact decimals matter.

```go
type Number string
```

:::tip Compatibility note
The library's `Number` type is 100% compatible with `encoding/json.Number` and can be used as a direct replacement.
:::

**Methods**:

```go
func (n Number) String() string              // Returns the literal number text
func (n Number) Float64() (float64, error)   // Converts to float64
func (n Number) Int64() (int64, error)       // Converts to int64
```

**Usage example**:

```go
// Get a Number (full precision preserved via Decoder.UseNumber)
decoder := json.NewDecoder(strings.NewReader(data))
decoder.UseNumber()

var obj map[string]any
if err := decoder.Decode(&obj); err != nil {
    panic(err)
}

// Obtain the Number via a type assertion
if num, ok := obj["large_number"].(json.Number); ok {
    // Number preserves the original precision
    fmt.Println(num.String()) // "9007199254740993" (full precision)

    // Convert to other types
    f, _ := num.Float64()
    i, _ := num.Int64()
}
```

## Standard Library Compatibility Interfaces

The `json` package exports the following `encoding/json`-compatible standard interfaces for customizing how custom types encode and decode: on the encoding side, `Marshaler` and `TextMarshaler` (in practice, see [Custom Encoders](../extensions/custom-encoder)); on the decoding side, `Unmarshaler` and `TextUnmarshaler`.

### Marshaler

```go
type Marshaler interface {
    MarshalJSON() ([]byte, error)
}
```

A type implementing `MarshalJSON` fully takes over its own JSON representation when encoded; the return value must be valid JSON.

### Unmarshaler

```go
type Unmarshaler interface {
    UnmarshalJSON(data []byte) error
}
```

A type implementing `UnmarshalJSON` takes over its own parsing when decoded: the decoder hands it the corresponding JSON value verbatim, the type fills in its target itself, and any error returned by the method propagates upward unchanged. Usually implemented on a **pointer receiver** (decoding needs to mutate the receiver itself).

### TextMarshaler

```go
type TextMarshaler interface {
    MarshalText() ([]byte, error)
}
```

A type implementing `MarshalText` is encoded as a JSON string whose value is the text content (quoting and escaping applied automatically).

### TextUnmarshaler

```go
type TextUnmarshaler interface {
    UnmarshalText(text []byte) error
}
```

A type implementing `UnmarshalText` parses itself from the **content** of the JSON string (the text with quotes and escapes removed) — a good fit for types fully expressible as text (custom times, IDs, etc.). If the same type also implements `Unmarshaler`, `UnmarshalJSON` wins.

**Usage example**

```go
type Person struct {
    Name string
}

// Implement the Marshaler interface
func (p Person) MarshalJSON() ([]byte, error) {
    return []byte(`{"name":"` + p.Name + `"}`), nil
}

// Implement the Unmarshaler interface
func (p *Person) UnmarshalJSON(data []byte) error {
    var v struct{ Name string `json:"name"` }
    if err := json.Unmarshal(data, &v); err != nil {
        return err
    }
    p.Name = v.Name
    return nil
}
```

For `Encoder`, `Decoder`, `Token`, `Delim`, `Number`, and other codec types, see [Type Definitions](./types#encoder-json-encoder).

## Type Definitions

### Result[T]

A type-safe operation result providing generic result handling.

```go
type Result[T any] struct {
    Value  T     // Result value
    Exists bool  // Whether the path exists
    Error  error // Error information, if any
}
```

**Methods**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `Ok` | `func (r Result[T]) Ok() bool` | Whether the result is valid (no error and exists) |
| `Unwrap` | `func (r Result[T]) Unwrap() T` | Gets the value; the zero value when invalid |
| `UnwrapOr` | `func (r Result[T]) UnwrapOr(defaultValue T) T` | Gets the value or a default |

**Usage example**:

```go
// Get a value generically
name := json.GetTyped[string](data, "user.name")
fmt.Println(name)

// Get with a default value
name = json.GetTyped[string](data, "user.name", "unknown")
```

---

### AccessResult

A dynamically typed access result, returned by Processor.SafeGet.

```go
type AccessResult struct {
    Value  any    // Result value
    Exists bool   // Whether the path exists
    Type   string // Runtime type information
}

// Methods
func (r AccessResult) Ok() bool                           // Whether it exists
func (r AccessResult) Unwrap() any                        // Gets the value
func (r AccessResult) UnwrapOr(defaultValue any) any      // Gets the value or a default
func (r AccessResult) AsString() (string, error)          // Strict conversion
func (r AccessResult) AsStringConverted() (string, error) // Format conversion
func (r AccessResult) AsInt() (int, error)                // Strict conversion
func (r AccessResult) AsFloat64() (float64, error)        // Strict conversion
func (r AccessResult) AsBool() (bool, error)              // Strict conversion
```

**Conversion method notes**:

| Method | Conversion | Description |
|--------|------------|-------------|
| `AsString()` | Strict | Accepts only the string type; non-strings return an error |
| `AsStringConverted()` | Formatting | Turns any value into its string representation via fmt.Sprintf |
| `AsInt()` | Strict | Does not convert bool to int; accepts only integers and parseable numbers |
| `AsFloat64()` | Strict | Does not convert bool to float; accepts only floats and parseable numbers |
| `AsBool()` | Strict | Accepts only bool and parseable strings (`strconv.ParseBool` rules: `1/t/true/True/TRUE`, `0/f/false/False/FALSE`) |

```go
result := p.SafeGet(data, "user.age")

// Strict conversion - errors if the value is not an integer
age, err := result.AsInt()

// Format conversion - turns any value into a string
str, err := result.AsStringConverted() // e.g. 30 -> "30"
```

## Schema Types

### Schema

The JSON Schema defined as a struct, supporting type-safe schema definitions.

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

**Usage example**:

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

The schema validation configuration. Used to create Schema instances via `NewSchema`.

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

**Usage example**:

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
additionalProperties := false
cfg.AdditionalProperties = &additionalProperties
schema := json.NewSchema(cfg)
```

### ValidationError

A schema validation error.

```go
type ValidationError struct {
    Path    string `json:"path"`    // Error path
    Message string `json:"message"` // Error message
}

func (ve *ValidationError) Error() string
```

## See Also

- [Hook System](../extensions/hooks) - Detailed hook usage guide
- [Schema Validation](./schema) - Detailed schema validation guide
- [CustomEncoder](../extensions/custom-encoder) - Custom encoder guide
