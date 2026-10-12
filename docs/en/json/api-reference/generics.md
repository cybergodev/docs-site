---
sidebar_label: "Generics"
title: "Generic Operations - CyberGo JSON | GetTyped[T] & Result[T]"
description: "CyberGo JSON is a Go library for generic operations: GetTyped[T], AccessResult, StreamLinesInto[T] JSONL streaming and Result[T] compile-time type safety."
sidebar_position: 110
---

# Generic Operations

The json library provides generic type-safe operations built on Go 1.18+ generics for compile-time type checking.

## GetTyped

Signature: `func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

Gets a value of the given type from JSON. Custom types are supported. Returns `T`, no error. When the path does not exist or the type conversion fails, returns the zero value or the default given via `defaultValue`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | JSON path |
| `defaultValue` | `...T` | No | Optional default, returned when the path does not exist or the conversion fails |

**Returns**

| Return value | Type | Description |
|--------------|------|-------------|
| Single return value | `T` | The retrieved value; the zero value or the default when the path does not exist or the conversion fails |

**Supported types**

- Basic types: `string`, `int`, `int64`, `float64`, `bool`
- Slice types: `[]any`
- Map types: `map[string]any`
- Custom structs

:::tip Single-element arrays are auto-unwrapped
When the target type is not a slice and the retrieved value is an **array with exactly one element**, the element is automatically unwrapped and then converted (serving distributed-path access, such as the `choices.message.content` case). No unwrapping happens when the target is a slice type.
:::

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"user": {"name": "Alice", "age": 30}}`

	// Get a string
	name := json.GetTyped[string](data, "user.name")
	fmt.Println(name) // Output: Alice

	// Get an integer
	age := json.GetTyped[int](data, "user.age")
	fmt.Println(age) // Output: 30

	// Get an array
	arrData := `{"items": [1, 2, 3]}`
	items := json.GetTyped[[]any](arrData, "items")
	fmt.Println(items) // Output: [1 2 3]

	// Use a default value
	email := json.GetTyped[string](data, "user.email", "unknown@example.com")
	fmt.Println(email) // Output: unknown@example.com
}
```

---

## AccessResult

`AccessResult` is a dynamically typed access result that provides conversion methods for dynamic type handling. Obtained via `SafeGet()`.

### Struct Definition

```go
type AccessResult struct {
    Value  any    // Result value
    Exists bool   // Whether the path exists
    Type   string // Runtime type information (for debugging)
}
```

### Methods

#### Ok

Signature: `func (r AccessResult) Ok() bool`

Checks whether the value exists.

```go
result := json.SafeGet(data, "user.name")
if result.Ok() {
    // The value exists
}
```

#### Unwrap

Signature: `func (r AccessResult) Unwrap() any`

Gets the value; returns nil when absent.

```go
value := result.Unwrap()
```

#### UnwrapOr

Signature: `func (r AccessResult) UnwrapOr(defaultValue any) any`

Gets the value or a default.

```go
value := result.UnwrapOr("default")
```

#### AsString

Signature: `func (r AccessResult) AsString() (string, error)`

Safely converts to a string. Succeeds only when the value itself is a string.

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    // Type mismatch or path not found
}
```

#### AsInt

Signature: `func (r AccessResult) AsInt() (int, error)`

Safely converts to an integer. Supports all integer types and floats with integral values. **Note: bool is not converted to int.**

#### AsFloat64

Signature: `func (r AccessResult) AsFloat64() (float64, error)`

Safely converts to a float. Supports all numeric types. **Note: bool is not converted to float64.**

#### AsBool

Signature: `func (r AccessResult) AsBool() (bool, error)`

Safely converts to a boolean. Supports bool and string types ("true", "false", "1", "0", etc.).

### Chained Conversion Methods

`AccessResult` provides the following conversion methods:

| Method | Return type | Description |
|--------|-------------|-------------|
| `AsString()` | `(string, error)` | Convert to a string (strict type check) |
| `AsStringConverted()` | `(string, error)` | Format-convert to a string |
| `AsInt()` | `(int, error)` | Convert to an integer (bool not converted) |
| `AsFloat64()` | `(float64, error)` | Convert to float64 (bool not converted) |
| `AsBool()` | `(bool, error)` | Convert to a boolean |

### AsString vs AsStringConverted

| Method | Behavior | Use case |
|--------|----------|----------|
| `AsString()` | Strict type check; only string succeeds | When the original type must be guaranteed |
| `AsStringConverted()` | Formats any type into a string | When a string representation is wanted |

```go
// Scenario: a value that may be a number or a string
result := json.SafeGet(data, "user.id")

// Strict mode - succeeds only when the value is a string
id, err := result.AsString()

// Lenient mode - numbers also become strings
idStr, err := result.AsStringConverted()
```

---

## StreamLinesInto

Signature: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

Reads JSON line by line from an `io.Reader`, parses each line as type `T`, and invokes the callback. Well suited to large JSONL files.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reader` | `io.Reader` | Yes | Data source |
| `fn` | `func(lineNum int, data T) error` | Yes | Per-line callback receiving the line number and the parsed data |
| `cfg` | `...Config` | No | Optional configuration |

**Returns**

| Return value | Type | Description |
|--------------|------|-------------|
| First | `[]T` | All successfully parsed results |
| Second | `error` | Error information |

**Behavior details** (all controlled by the JSONL-related Config fields, see [Config](./config#the-config-struct)):

- Empty lines are skipped by default (`JSONLSkipEmpty: true`); with `JSONLSkipComments: true`, lines starting with `#`/`//` are skipped
- A failing line: by default returns a `line N: <reason>` error with a nil result; with `JSONLContinueOnErr: true` the line is skipped and processing continues
- A callback error: stops immediately and returns that error (result is nil); callback panics are captured and converted into errors — the process is never taken down
- Read buffer and single-line caps are controlled by `JSONLBufferSize` (64KB) and `JSONLMaxLineSize` (1MB)
- Without cfg it uses the global default processor (affected by `SetGlobalProcessor`); with cfg, the processor is selected per that configuration

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
		fmt.Printf("Line %d: %s, %d years old\n", lineNum, data.Name, data.Age)
		return nil
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("Processed %d records in total\n", len(results))
}
```

---

## Usage Examples

### Configuration Parsing

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

	// Parse the configuration into a struct
	dbConfig := json.GetTyped[DatabaseConfig](config, "database")

	fmt.Printf("Host: %s:%d\n", dbConfig.Host, dbConfig.Port)
}
```

### Multi-Type Handling

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

	// Generic gets of different types
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

### Error Handling

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	config := `{"timeout": 30}`

	timeout := json.GetTyped[int](config, "timeout")
	fmt.Printf("Timeout: %d\n", timeout) // Output: 30

	// Missing path returns the zero value
	retries := json.GetTyped[int](config, "retries")
	fmt.Printf("Retries: %d\n", retries) // Output: 0 (zero value)

	// Missing path with a default value
	retries = json.GetTyped[int](config, "retries", 3)
	fmt.Printf("Retries: %d\n", retries) // Output: 3 (default value)
}
```

---

## Performance Notes

Conversion in `GetTyped[T]` is two-tier: **basic types** (string/int/float64/bool plus their slices and maps) go through an internal fast path that converts directly; **complex types such as custom structs** fall back to the generic "re-marshal → Unmarshal" path, so it is slightly slower than the type-specific getters (`GetString`, `GetInt`, etc.).

| Method | Performance | Recommended scenario |
|---------|-------------|------------------------|
| `GetString`, `GetInt`, etc. | Fastest (dedicated to basic types) | Performance-sensitive, type known |
| `GetTyped[T]` (basic types) | Fast (fast conversion path) | Basic-type reads in generic code |
| `GetTyped[T]` (structs) | Medium (via re-marshal) | Configuration parsing, one-off reads |
| `SafeGet` + `AccessResult` | Medium | Dynamic type handling |

:::tip
When repeatedly reading the same struct on a hot path, it is faster to `Parse`/`Unmarshal` once into the struct, or to `GetTyped` once and reuse the result — rather than calling `GetTyped[Struct]` for every path.
:::

---

## The Result[T] Type

`Result[T]` is a type-safe generic operation result for scenarios that need an explicit type and error handling.

### Struct Definition

```go
type Result[T any] struct {
    Value  T     // Result value
    Exists bool  // Whether the path was found
    Error  error // Error information
}
```

### Methods

| Method | Return type | Description |
|---------|-------------|-------------|
| `Ok()` | `bool` | Checks the result is valid (no error and found) |
| `Unwrap()` | `T` | Returns the value; the zero value on failure |
| `UnwrapOr(default T)` | `T` | Returns the value, or the default on failure |

### Usage Example

`Result[T]` has no "library function returns it directly" entry point — it is for you to **construct manually**, typically to wrap your own query functions and hand the caller a single explicit return value combining "value + exists + error":

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/json"
)

// Wrap a config reader with an explicit error using Result[T]
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
		fmt.Println("Env:", r.Unwrap()) // Output: Env: production
	}

	missing := readConfig(data, "region")
	fmt.Println(missing.Exists, errors.Is(missing.Error, nil)) // Output: false true
	fmt.Println(missing.UnwrapOr("cn-north-1"))                // Output: cn-north-1
}
```

---

## Result[T] vs AccessResult

| Feature | Result[T] | AccessResult |
|---------|-----------|--------------|
| Type safety | Generic T | `any` type |
| Existence check | `Exists bool` | `Exists bool` |
| Error handling | Built-in Error field | Conversion methods return errors |
| Chaining | Not supported | Chained type conversion supported |
| How to obtain | Manual construction (no library entry point) | `SafeGet()` |
| Best for | Wrapping your own query functions | Dynamic type handling |

### Selection Advice

- **Known type, error details irrelevant**: `GetTyped[T]` (zero-value/default fallback)
- **Dynamic types**: use `AccessResult` and `SafeGet()`
- **Chained conversions needed**: use `AccessResult`
- **A unified return shape**: use `Result[T]` as the return type of your own functions

---

## See Also

- [Package Functions](./functions/) - Type-specific getter functions
- [Type Definitions](./types) - Detailed AccessResult definition
- [Config](./config) - Configuration options
