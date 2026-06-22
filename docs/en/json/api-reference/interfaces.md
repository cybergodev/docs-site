---
title: "Interface Definitions - CyberGo JSON | API Reference"
description: "CyberGo JSON extension interfaces: CustomEncoder, TypeEncoder, Validator, Hook, PathParser, and DangerousPattern to extend encoding, validation, and security."
---

# Interface Definitions

The json package provides multiple extension interfaces for customizing JSON processing behavior.

## Encoder Interfaces

### CustomEncoder

Custom JSON encoder interface.

```go
type CustomEncoder interface {
    // Encode converts a Go value to a JSON string
    Encode(value any) (string, error)
}
```

**Usage Example**

```go
import stdjson "encoding/json"

type UpperCaseEncoder struct{}

func (e *UpperCaseEncoder) Encode(value any) (string, error) {
    // Custom encoding logic
    switch v := value.(type) {
    case string:
        return fmt.Sprintf(`"%s"`, strings.ToUpper(v)), nil
    default:
        // Use standard encoding (avoid infinite recursion)
        data, err := stdjson.Marshal(v)
        if err != nil {
            return "", err
        }
        return string(data), nil
    }
}

// Configure usage
cfg := json.DefaultConfig()
cfg.CustomEncoder = &UpperCaseEncoder{}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### TypeEncoder

Type-specific encoder interface.

```go
type TypeEncoder interface {
    // Encode encodes a value of a specific type to a JSON string
    Encode(v reflect.Value) (string, error)
}
```

**Usage Example**

```go
type TimeEncoder struct{}

func (e *TimeEncoder) Encode(v reflect.Value) (string, error) {
    if v.Type() == reflect.TypeOf(time.Time{}) {
        t := v.Interface().(time.Time)
        return fmt.Sprintf(`"%s"`, t.Format(time.RFC3339)), nil
    }
    return "", fmt.Errorf("unsupported type: %v", v.Type())
}

// Register type encoder
cfg := json.DefaultConfig()
cfg.CustomTypeEncoders = map[reflect.Type]json.TypeEncoder{
    reflect.TypeOf(time.Time{}): &TimeEncoder{},
}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## Validator Interface

### Validator

JSON validator interface.

```go
type Validator interface {
    // Validate checks if the JSON string has issues
    // Returns nil if valid, otherwise returns an error describing the problem
    Validate(jsonStr string) error
}
```

**Usage Example**

```go
type SizeValidator struct {
    MaxSize int64
}

func (v *SizeValidator) Validate(jsonStr string) error {
    // Check input data size
    if int64(len(jsonStr)) > v.MaxSize {
        return fmt.Errorf("JSON exceeds maximum size: %d", v.MaxSize)
    }
    return nil
}

// Set validator
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}} // 1MB
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## Hook Interface

### Hook

Operation interception interface, supporting before/after processing.

```go
type Hook interface {
    // Before is called before the operation
    // Return an error to abort the operation
    Before(ctx HookContext) error

    // After is called after the operation completes
    // Can modify the result or check for errors
    After(ctx HookContext, result any, err error) (any, error)
}
```

### HookContext

Hook context, providing operation information.

```go
type HookContext struct {
    Operation string        // Operation type: "get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string        // Input JSON string (may be empty during marshal). Security warning: may contain sensitive data
    Path      string        // Target path (may be empty during marshal/unmarshal)
    Value     any           // Value for set operations
    Config    *Config       // Active configuration
    StartTime time.Time     // Operation start time
}
```

**Usage Example**

```go
type LoggingHook struct {
    logger *slog.Logger
}

func (h *LoggingHook) Before(ctx json.HookContext) error {
    h.logger.Info("Operation started",
        "operation", ctx.Operation,
        "path", ctx.Path,
    )
    return nil
}

func (h *LoggingHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("Operation completed",
        "operation", ctx.Operation,
        "path", ctx.Path,
        "duration", time.Since(ctx.StartTime),
        "error", err,
    )
    return result, err
}

// Add hook
cfg := json.DefaultConfig()
cfg.Hooks = []json.Hook{&LoggingHook{logger: slog.Default()}}
```

### HookFunc

Struct adapter that allows using functions as hooks.

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

**Usage Example**

```go
// Only need After
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        log.Printf("%s completed in %v", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})

// Only need Before
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

Creates a timing hook.

```go
type MetricsRecorder struct{}

func (r *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.RecordDuration(op, duration)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

#### ValidationHook

Signature: `func ValidationHook(validator func(jsonStr, path string) error) Hook`

Creates an input validation hook.

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

Creates an error interception hook.

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // Return original or transformed error
}))
```

## Security Pattern Interfaces

### PatternLevel

Dangerous pattern severity level.

```go
type PatternLevel int

const (
    // PatternLevelCritical - Always blocks operation
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning - Blocks in strict mode, logs warning in lenient mode
    PatternLevelWarning

    // PatternLevelInfo - Only logs, never blocks
    PatternLevelInfo
)
```

### DangerousPattern

Dangerous pattern struct for defining custom security rules.

```go
type DangerousPattern struct {
    // Pattern is the substring to detect in input
    Pattern string

    // Name is a descriptive name for the pattern
    Name string

    // Level determines the severity and how to handle this pattern
    Level PatternLevel
}
```

**Usage Example**

```go
// Create a custom dangerous pattern using struct literal
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
    Name:    "Internal API reference",
    Level:   json.PatternLevelWarning,
})
```

## Path Parser Interface

### PathParser

Path parser interface.

```go
type PathParser interface {
    // ParsePath parses a path string into path segments
    ParsePath(path string) ([]PathSegment, error)
}
```

**Usage Example**

```go
type CustomPathParser struct{}

func (p *CustomPathParser) ParsePath(path string) ([]json.PathSegment, error) {
    // Custom path parsing logic
    return nil, nil // Implement custom parsing
}
```

## Basic Types

### Number

JSON number type for preserving number precision. Use when handling large numbers or needing exact decimals.

```go
type Number string
```

::: tip Compatibility Note
The library's `Number` type is 100% compatible with `encoding/json.Number` and can be used as a direct replacement.
:::

**Methods**:

```go
func (n Number) String() string              // Returns the literal text of the number
func (n Number) Float64() (float64, error)   // Converts to float64
func (n Number) Int64() (int64, error)       // Converts to int64
```

**Usage Example**:

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// Get Number type (via Get method then type assertion)
val, err := processor.Get(data, "large_number")
if err != nil {
    panic(err)
}

// Type assertion to get Number
if num, ok := val.(json.Number); ok {
    // Number preserves original precision
    fmt.Println(num.String()) // "9007199254740993" (full precision)

    // Convert to other types
    f, _ := num.Float64()
    i, _ := num.Int64()
}
```

## Standard Library Compatible Interfaces

The `json` package exports the following standard interfaces compatible with `encoding/json` for customizing encoding and decoding behavior of custom types.

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

**Usage Example**

```go
type Person struct {
    Name string
}

// Implement Marshaler interface
func (p Person) MarshalJSON() ([]byte, error) {
    return []byte(`{"name":"` + p.Name + `"}`), nil
}

// Implement Unmarshaler interface
func (p *Person) UnmarshalJSON(data []byte) error {
    var v struct{ Name string `json:"name"` }
    if err := json.Unmarshal(data, &v); err != nil {
        return err
    }
    p.Name = v.Name
    return nil
}
```

`Encoder`, `Decoder`, `Token`, `Delim`, `Number` and other encoding/decoding types are detailed in [Type Definitions](./types#encoder-json-encoder).

## Type Definitions

### Result[T]

Type-safe operation result with generic result handling.

```go
type Result[T any] struct {
    Value  T     // Result value
    Exists bool  // Whether the path exists
    Error  error // Error information (if any)
}
```

**Methods**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `Ok` | `func (r Result[T]) Ok() bool` | Whether result is valid (no error and exists) |
| `Unwrap` | `func (r Result[T]) Unwrap() T` | Get value, returns zero value if invalid |
| `UnwrapOr` | `func (r Result[T]) UnwrapOr(defaultValue T) T` | Get value or default value |

**Usage Example**:

```go
// Use generic getter
name := json.GetTyped[string](data, "user.name")
fmt.Println(name)

// Get with default value
name = json.GetTyped[string](data, "user.name", "unknown")
```

---

### AccessResult

Dynamic type access result, returned by Processor.SafeGet.

```go
type AccessResult struct {
    Value  any    // Result value
    Exists bool   // Whether the path exists
    Type   string // Runtime type information
}

// Methods
func (r AccessResult) Ok() bool                           // Whether exists
func (r AccessResult) Unwrap() any                        // Get value
func (r AccessResult) UnwrapOr(defaultValue any) any      // Get value or default
func (r AccessResult) AsString() (string, error)          // Strict conversion
func (r AccessResult) AsStringConverted() (string, error) // Format conversion
func (r AccessResult) AsInt() (int, error)                // Strict conversion
func (r AccessResult) AsFloat64() (float64, error)        // Strict conversion
func (r AccessResult) AsBool() (bool, error)              // Strict conversion
```

**Type Conversion Method Details**:

| Method | Conversion Behavior | Description |
|--------|---------------------|-------------|
| `AsString()` | Strict | Only accepts string type, non-strings return an error |
| `AsStringConverted()` | Format | Uses fmt.Sprintf to convert any value to string representation |
| `AsInt()` | Strict | Does not convert bool to int, only accepts integers and parseable numbers |
| `AsFloat64()` | Strict | Does not convert bool to float, only accepts floats and parseable numbers |
| `AsBool()` | Strict | Only accepts bool and strings accepted by `strconv.ParseBool` ("1"/"t"/"T"/"TRUE"/"true"/"True", "0"/"f"/"F"/"FALSE"/"false"/"False") |

```go
result := p.SafeGet(data, "user.age")

// Strict conversion - returns error if value is not an integer
age, err := result.AsInt()

// Format conversion - converts any value to string
str, err := result.AsStringConverted() // e.g., 30 -> "30"
```

## Schema Type

### Schema

JSON Schema defined as a struct, supporting type-safe schema definitions.

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

**Usage Example**:

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

Schema validation configuration. Used to create Schema instances via `NewSchemaWithConfig`.

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

**Usage Example**:

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
additionalProperties := false
cfg.AdditionalProperties = &additionalProperties
schema := json.NewSchemaWithConfig(cfg)
```

### ValidationError

Schema validation error.

```go
type ValidationError struct {
    Path    string `json:"path"`    // Error path
    Message string `json:"message"` // Error message
}

func (ve *ValidationError) Error() string
```

## See Also

- [Hook System](./hooks) - Detailed hook usage guide
- [Validator](./validator) - Detailed validator usage guide
- [CustomEncoder](./custom-encoder) - Custom encoder guide
