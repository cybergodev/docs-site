---
title: "Type Definitions - CyberGo JSON | API Reference"
description: "CyberGo JSON core type definitions reference: including Result[T] generic result, AccessResult dynamic access result, BatchOperation, BatchResult, Schema validation schema, Stats, HealthStatus, IterableValue, and encoding error types, providing a complete type system foundation."
---

# Type Definitions

The json package provides multiple type-safe types for handling JSON operation results.

## Result[T] - Unified Result Type

`Result[T]` is a generic operation result type that provides type-safe error handling and value access.

### Struct Definition

```go
type Result[T any] struct {
    Value  T     // Result value
    Exists bool  // Whether the value was found
    Error  error // Error (if any)
}
```

### Methods

| Method | Signature | Description |
|------|------|------|
| `Ok()` | `func (r Result[T]) Ok() bool` | Check if the result is valid (no error and found) |
| `Unwrap()` | `func (r Result[T]) Unwrap() T` | Return the value, or zero value on failure |
| `UnwrapOr()` | `func (r Result[T]) UnwrapOr(defaultValue T) T` | Return the value or a default value |

### Usage Example

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // Use GetTyped to get a typed value
    name := json.GetTyped[string](data, "user.name")
    fmt.Printf("Name: %s\n", name)

    // Use defaultValue parameter to provide a default
    nickname := json.GetTyped[string](data, "user.nickname", "not set")
    fmt.Printf("Nickname: %s\n", nickname)

    age := json.GetTyped[int](data, "user.age", 0)
    fmt.Printf("Age: %d\n", age)
}
```

::: tip Naming Convention
- **GetTyped[T]** - Gets a value of the specified type, returns `T`, supports `defaultValue` parameter
- **Result[T]** - Internal result type, for scenarios requiring fine-grained error handling
:::

---

## CompiledPath - Pre-compiled Path

`CompiledPath` is a type alias for a pre-compiled JSON path, used to avoid repeatedly parsing path strings when frequently accessing the same path, improving performance.

### Type Definition

```go
type CompiledPath = internal.CompiledPath
```

### Use Case

When performing a large number of repeated operations on the same path (e.g., batch queries in a loop), you can pre-compile the path to avoid repeated parsing of the path string on each call.

### Compile Function

#### Processor.CompilePath

Signature: `func (p *Processor) CompilePath(path string) (*CompiledPath, error)`

Pre-compiles a JSON path via the Processor, returning a `*CompiledPath` instance that can be reused in subsequent operations.

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
// compiled can be reused in subsequent operations
val, err := processor.GetCompiled(data, compiled)
```

::: tip Performance Tip
For high-frequency repeated path access, pre-compiling paths can significantly reduce path parsing overhead. Suitable for batch operations, loop queries, and similar scenarios.
:::

---

## AccessResult - Property Access Result

`AccessResult` is a safe property access result that provides chained type conversion.

### Struct Definition

```go
type AccessResult struct {
    Value  any    // Result value
    Exists bool   // Whether the path exists
    Type   string // Runtime type information (for debugging)
}
```

### Creation Method

#### Processor.SafeGet

Signature: `func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Safely gets a property, returning an `AccessResult` for chained type conversion.

You can also use the package-level function `SafeGet`:

Signature: `func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

result := processor.SafeGet(data, "user.age")

if !result.Exists {
    fmt.Println("Path does not exist")
    return
}

// Check type
fmt.Println("Type:", result.Type)
```

### Chained Type Conversion Methods

| Method | Return Type | Description |
|------|----------|------|
| `Unwrap()` | `any` | Return the value, or nil if not present |
| `UnwrapOr(defaultValue)` | `any` | Return the value or a default value |
| `AsString()` | `(string, error)` | Convert to string (strict type checking) |
| `AsStringConverted()` | `(string, error)` | Format-convert to string |
| `AsInt()` | `(int, error)` | Convert to integer (bool not converted) |
| `AsFloat64()` | `(float64, error)` | Convert to float64 (bool not converted) |
| `AsBool()` | `(bool, error)` | Convert to boolean |
| `Ok()` | `bool` | Check if result is valid (path exists and no error) |

::: warning Note
`AsInt64()`, `AsArray()`, `AsObject()` methods have been removed. Please use `GetTyped[T]` to get these types.
:::

```go
result := processor.SafeGet(data, "user.profile")

// Chained calls
name, _ := result.AsString()
email, _ := result.AsString()
age, _ := result.AsInt()
price, _ := result.AsFloat64()
active, _ := result.AsBool()

// Use GetTyped for array or object types
arr := json.GetTyped[[]any](data, "items")
obj := json.GetTyped[map[string]any](data, "user.profile")
```

### Usage Example

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

    // Safe get and convert
    result := processor.SafeGet(data, "user.age")

    // Use AccessResult methods directly
    age, err := result.AsInt()
    if err != nil {
        panic(err)
    }
    fmt.Printf("Age: %d\n", age)

    // Get a non-existent path
    missing := processor.SafeGet(data, "user.nickname")
    if !missing.Exists {
        fmt.Println("Nickname does not exist")
    }
}
```

---

## Schema - JSON Schema Type

`Schema` is used to define structural validation rules for JSON data, supporting a subset of JSON Schema Draft 7.

### Struct Definition

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

### Creating a Schema

#### Direct Construction

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

#### Using NewSchemaWithConfig

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
schema := json.NewSchemaWithConfig(cfg)
```


#### Using DefaultSchema

Signature: `func DefaultSchema() *Schema`

Returns an empty Schema instance with default configuration.

```go
schema := json.DefaultSchema()
schema.Type = "object"
schema.Required = []string{"id"}
```

### SchemaConfig Struct

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

### Usage Example

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Define Schema using struct literal
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

    // Validate JSON
    data := `{"name": "Alice", "email": "alice@example.com", "age": 30}`
    errors, err := json.ValidateSchema(data, schema)
    if err != nil {
        panic(err)
    }

    if len(errors) > 0 {
        for _, e := range errors {
            fmt.Printf("Validation error [%s]: %s\n", e.Path, e.Message)
        }
    } else {
        fmt.Println("Validation passed")
    }
}
```

---

## ValidationError

Schema validation error type.

### Struct Definition

```go
type ValidationError struct {
    Path    string // Path where the error occurred
    Message string // Error message
}
```

### Methods

#### Error

Signature: `func (ve *ValidationError) Error() string`

Implements the error interface.

```go
for _, e := range errors {
    fmt.Println(e.Error())
}
```

---

## BatchOperation

Batch operation definition.

### Struct Definition

```go
type BatchOperation struct {
    Type    string // Operation type: "get", "set", "delete", "validate"
    JSONStr string // JSON data string
    Path    string // Target path
    Value   any    // Value for Set operation
    ID      string // Operation identifier
}
```

---

## BatchResult

Batch operation result.

### Struct Definition

```go
type BatchResult struct {
    ID     string // Operation identifier (corresponds to BatchOperation.ID)
    Result any    // Operation result
    Error  error  // Error (if any)
}
```

---

## WarmupResult

Cache warmup result.

### Struct Definition

```go
type WarmupResult struct {
    TotalPaths  int      // Total path count
    Successful  int      // Successful warmup count
    Failed      int      // Failed count
    SuccessRate float64  // Success rate
    FailedPaths []string // List of failed paths
}
```

---

## ParsedJSON

A pre-parsed JSON document that can be reused for multiple query operations.

### Struct Definition

The internal fields of `ParsedJSON` are not exported; access is via methods.

```go
type ParsedJSON struct {
    // Internal fields (not exported)
    // Use the Data() method to get the parsed data
}
```

### Data Method

Signature: `func (p *ParsedJSON) Data() any`

Returns the underlying parsed data.


### Release Method

Signature: `func (p *ParsedJSON) Release()`

Releases the resources held by the parsed data. Call when `ParsedJSON` is no longer needed, allowing underlying resources to be garbage collected.

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// Pre-parse JSON
parsed, err := processor.PreParse(`{"user": {"name": "Alice", "age": 30}}`)
if err != nil {
    panic(err)
}

// Query the pre-parsed result multiple times
name, _ := processor.GetFromParsed(parsed, "user.name")
age, _ := processor.GetFromParsed(parsed, "user.age")
```

### Use Cases

| Scenario | Description |
|------|------|
| High-frequency queries | Avoid repeated parsing when querying the same JSON multiple times |
| Batch path retrieval | Use `GetMultiple` to get multiple paths at once |
| Performance optimization | Query performance improves significantly after pre-parsing |

::: tip Performance Tip
For scenarios that require multiple queries on the same JSON string, using `PreParse` pre-parsing can significantly improve performance by avoiding repeated parsing overhead.
:::

---

## Stats

Processor statistics.

### Struct Definition

```go
type Stats struct {
    CacheSize        int64         // Current cache size
    CacheMemory      int64         // Cache memory usage (bytes)
    MaxCacheSize     int           // Maximum cache size
    HitCount         int64         // Cache hit count
    MissCount        int64         // Cache miss count
    HitRatio         float64       // Cache hit ratio
    CacheTTL         time.Duration // Cache expiration time
    CacheEnabled     bool          // Whether cache is enabled
    IsClosed         bool          // Whether the processor is closed
    MemoryEfficiency float64       // Memory efficiency
    OperationCount   int64         // Total operation count
    ErrorCount       int64         // Total error count
}
```

---

## HealthStatus

Health status information.

### Struct Definition

```go
type HealthStatus struct {
    Timestamp time.Time              // Check timestamp
    Healthy   bool                   // Whether healthy
    Checks    map[string]CheckResult // Results of each check
}
```

### CheckResult Struct

```go
type CheckResult struct {
    Healthy bool   // Whether this check is healthy
    Message string // Check message
}
```

---

## IterableValue

Iterator value wrapper.

### Method Overview

**Basic Access**

| Method | Description |
|------|------|
| `Get(path)` | Get value by path |
| `GetString(path)` | Get string |
| `GetInt(path)` | Get integer |
| `GetFloat64(path)` | Get float64 |
| `GetBool(path)` | Get boolean |
| `GetArray(path)` | Get array |
| `GetObject(path)` | Get object |

**Get with Default Values**

| Method | Description |
|------|------|
| `GetWithDefault(path, defaultValue)` | Get value, returns default when not present |
| `GetStringWithDefault(path, defaultValue)` | Get string, returns default when not present |
| `GetIntWithDefault(path, defaultValue)` | Get integer, returns default when not present |
| `GetFloat64WithDefault(path, defaultValue)` | Get float, returns default when not present |
| `GetBoolWithDefault(path, defaultValue)` | Get boolean, returns default when not present |

**Check and Traverse**

| Method | Description |
|------|------|
| `Exists(path)` | Check if field exists |
| `IsNull(path)` | Check if the specified path is null |
| `IsEmpty(path)` | Check if the specified path is empty |
| `Break()` | Return break signal, stop iteration |

See the [Iterator](./iterator) documentation for details.

---

## Encoding Error Types

The json package exports the following encoding/decoding error types for fine-grained error handling.

### SyntaxError - Syntax Error

JSON syntax parsing error, indicating the input data is not valid JSON format.

#### Struct Definition

```go
type SyntaxError struct {
    Offset int64 // Position where the error occurred (byte offset)
    // contains other unexported fields
}
```

#### Methods

| Method | Signature | Description |
|------|------|------|
| `Error` | `func (e *SyntaxError) Error() string` | Returns error description including offset position |

```go
data := `{invalid json}`
_, err := json.ParseAny(data)
if syntaxErr, ok := err.(*json.SyntaxError); ok {
    fmt.Printf("Syntax error at offset: %d\n", syntaxErr.Offset)
}
```

---

### UnmarshalTypeError - Unmarshal Type Error

This error is returned when a JSON value cannot be converted to the target Go type.

#### Struct Definition

```go
type UnmarshalTypeError struct {
    Value  string       // Description of the JSON value (e.g., "string", "number")
    Type   reflect.Type // Target Go type
    Offset int64        // Position where the error occurred (byte offset)
    Struct string       // Struct name containing the field (if any)
    Field  string       // Field name (if any)
    Err    error        // Internal error (if any)
}
```

#### Methods

| Method | Signature | Description |
|------|------|------|
| `Error` | `func (e *UnmarshalTypeError) Error() string` | Returns type mismatch error description |
| `Unwrap` | `func (e *UnmarshalTypeError) Unwrap() error` | Returns the internal error |

```go
type User struct {
    Age int `json:"age"`
}
var user User
err := json.Unmarshal([]byte(`{"age": "not_a_number"}`), &user)
if typeErr, ok := err.(*json.UnmarshalTypeError); ok {
    fmt.Printf("Type error: JSON value %s cannot convert to %v\n", typeErr.Value, typeErr.Type)
}
```

---

### UnsupportedTypeError - Unsupported Type Error

This error is returned when attempting to encode an unsupported Go type.

#### Struct Definition

```go
type UnsupportedTypeError struct {
    Type reflect.Type // Unsupported Go type
}
```

#### Methods

| Method | Signature | Description |
|------|------|------|
| `Error` | `func (e *UnsupportedTypeError) Error() string` | Returns unsupported type description |

```go
type Chan chan int
data := Chan(make(chan int))
_, err := json.Marshal(data)
if unsupportedErr, ok := err.(*json.UnsupportedTypeError); ok {
    fmt.Printf("Unsupported type: %v\n", unsupportedErr.Type)
}
```

---

### UnsupportedValueError - Unsupported Value Error

This error is returned when attempting to encode an unsupported value (e.g., NaN, Infinity).

#### Struct Definition

```go
type UnsupportedValueError struct {
    Value reflect.Value // Unsupported value
    Str   string        // Error description
}
```

#### Methods

| Method | Signature | Description |
|------|------|------|
| `Error` | `func (e *UnsupportedValueError) Error() string` | Returns unsupported value description |

```go
val := math.NaN()
_, err := json.Marshal(val)
if valErr, ok := err.(*json.UnsupportedValueError); ok {
    fmt.Printf("Unsupported value: %s\n", valErr.Str)
}
```

---

### InvalidUnmarshalError - Invalid Unmarshal Target Error

This error is returned when the target parameter of `Unmarshal` is not a pointer or is nil.

#### Struct Definition

```go
type InvalidUnmarshalError struct {
    Type reflect.Type // Type of the target parameter
}
```

#### Methods

| Method | Signature | Description |
|------|------|------|
| `Error` | `func (e *InvalidUnmarshalError) Error() string` | Returns invalid target error description |

```go
var target string // Should pass a pointer
err := json.Unmarshal([]byte(`"hello"`), target) // Error: pointer not passed
if invalidErr, ok := err.(*json.InvalidUnmarshalError); ok {
    fmt.Printf("Invalid unmarshal target: %v\n", invalidErr.Type)
}
```

---

### MarshalerError - Marshaler Error

This error wraps the error returned by a type's `MarshalJSON` or `MarshalText` method.

#### Struct Definition

```go
type MarshalerError struct {
    Type reflect.Type // Type implementing MarshalJSON or MarshalText
    Err  error        // Error returned by MarshalJSON or MarshalText
    // contains other unexported fields
}
```

#### Methods

| Method | Signature | Description |
|------|------|------|
| `Error` | `func (e *MarshalerError) Error() string` | Returns marshaler error description |
| `Unwrap` | `func (e *MarshalerError) Unwrap() error` | Returns the internal error |

```go
type BadMarshaler struct{}

func (BadMarshaler) MarshalJSON() ([]byte, error) {
    return nil, errors.New("marshal failed")
}

_, err := json.Marshal(BadMarshaler{})
if marshalErr, ok := err.(*json.MarshalerError); ok {
    fmt.Printf("Marshaler error (type: %v): %v\n", marshalErr.Type, marshalErr.Err)
}
```

---

## Encoder - JSON Encoder

`Encoder` writes JSON values to an output stream. 100% compatible with `encoding/json.Encoder`.

### Creation

Signature: `func NewEncoder(w io.Writer, cfg ...Config) *Encoder`

Creates an encoder that writes to `w`. Supports an optional `Config` parameter to customize encoding behavior.

```go
file, _ := os.Create("output.json")
defer file.Close()

encoder := json.NewEncoder(file)
err := encoder.Encode(map[string]any{"name": "Alice"})
```

### Methods

| Method | Signature | Description |
|------|------|------|
| `Encode` | `func (enc *Encoder) Encode(v any) error` | Encode a Go value as JSON and write to the stream |
| `SetEscapeHTML` | `func (enc *Encoder) SetEscapeHTML(on bool)` | Set whether to escape HTML special characters |
| `SetIndent` | `func (enc *Encoder) SetIndent(prefix, indent string)` | Set indentation format |

### Usage Example

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

## Decoder - JSON Decoder

`Decoder` reads and decodes JSON values from an input stream. 100% compatible with `encoding/json.Decoder`.

### Creation

Signature: `func NewDecoder(r io.Reader, cfg ...Config) *Decoder`

Creates a decoder that reads from `r`. Supports an optional `Config` parameter.

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

### Methods

| Method | Signature | Description |
|------|------|------|
| `Decode` | `func (dec *Decoder) Decode(v any) error` | Read the next JSON value from the stream and decode it |
| `UseNumber` | `func (dec *Decoder) UseNumber()` | Make the decoder parse numbers as `Number` instead of `float64` |
| `DisallowUnknownFields` | `func (dec *Decoder) DisallowUnknownFields()` | Return error when unknown fields are encountered during decoding |
| `Buffered` | `func (dec *Decoder) Buffered() io.Reader` | Return a Reader for remaining data in the decoder buffer |
| `InputOffset` | `func (dec *Decoder) InputOffset() int64` | Return the current input position offset |
| `More` | `func (dec *Decoder) More() bool` | Check if there are more JSON values in the stream |
| `Token` | `func (dec *Decoder) Token() (Token, error)` | Read the next JSON token |

### Usage Example

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
        fmt.Printf("Name: %s, Age: %v\n", person["name"], person["age"])
    }
}
```

### Stream Decoding Example

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

func main() {
    // Decode multiple values from a JSON stream
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

### Token Reading Example

```go
decoder := json.NewDecoder(strings.NewReader(`{"name":"Alice"}`))
for {
    token, err := decoder.Token()
    if err != nil {
        break
    }
    switch v := token.(type) {
    case json.Delim:
        fmt.Printf("Delimiter: %s\n", string(v))
    case string:
        fmt.Printf("String: %s\n", v)
    case float64:
        fmt.Printf("Number: %v\n", v)
    case bool:
        fmt.Printf("Boolean: %v\n", v)
    case nil:
        fmt.Println("null")
    }
}
```

---

## Token - JSON Token

`Token` is a JSON token value that holds one of the following types:

- `Delim`, representing the four JSON delimiters `[ ] { }`
- `bool`, representing a JSON boolean
- `float64`, representing a JSON number
- `Number`, representing a JSON number when `UseNumber` is enabled
- `string`, representing a JSON string
- `nil`, representing JSON null

```go
type Token any
```

Obtained via `Decoder.Token()`.

---


---

## Number - JSON Number

`Number` represents a JSON number string, used by the Decoder when `UseNumber` mode is enabled.

```go
type Number string
```

### Methods

| Method | Signature | Description |
|------|------|------|
| `String` | `func (n Number) String() string` | Returns string representation of the number |
| `Float64` | `func (n Number) Float64() (float64, error)` | Converts to float64 |
| `Int64` | `func (n Number) Int64() (int64, error)` | Converts to int64 |

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

## Delim - JSON Delimiter

`Delim` is the JSON delimiter type, corresponding to the four characters `[`, `]`, `{`, `}`.

```go
type Delim rune
```

### Methods

#### String

Signature: `func (d Delim) String() string`

Returns the string representation of the delimiter.

```go
token, _ := decoder.Token()
if delim, ok := token.(json.Delim); ok {
    fmt.Println(delim.String()) // "[" or "{" etc.
}
```

---

## Related

- [Package Functions](./functions) - Package-level function reference
- [Config](./config) - Configuration options
- [Processor](./processor/) - Processor methods
- [Interface Definitions](./interfaces) - Extension interfaces
