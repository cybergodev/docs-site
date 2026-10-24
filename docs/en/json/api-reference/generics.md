---
sidebar_label: "Generics"
title: "Generic Operations - CyberGo JSON | GetTyped[T] & Result[T]"
description: "CyberGo JSON generic APIs: GetTyped[T] with default fallback, StreamLinesInto[T] for JSONL streams, and the Result[T] and AccessResult types."
sidebar_position: 110
---

# Generic Operations

Generic operations build on Go 1.18+ generics so the target type `T` is fixed at compile time.

## GetTyped

Signature: `func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

Reads a value at a path and converts it to `T`; custom types are supported. It returns `T` and **no error**: when the path is missing, the value is `null`, or the conversion fails, you get `defaultValue` if supplied, otherwise the zero value of `T`.

Three cases fall back to the default: `Get` returns an error (including `ErrPathNotFound`), the resolved value is `null`, and the internal type conversion fails. The third builds an error wrapping `ErrTypeMismatch` internally, which is then discarded, so the caller only sees the default. To tell "missing" from "zero value", use `SafeGet` or `Get`.

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

- Basic types: `string`, `int`, `int64`, `uint64`, `float64`, `bool`
- Slices and maps: `[]any`, `[]T` whose elements convert one by one, `map[string]any`
- Other types (pointer `*T`, other integer widths such as `int8`/`int32`, custom structs): go through the re-marshal fallback

:::tip Single-element arrays are auto-unwrapped
When the target type is not a slice and the resolved value is an **array with exactly one element**, that element is unwrapped first and then converted. The rule serves distributed-path access (`choices.message.content` and similar paths yield a single-element array) and applies to the typed getters such as `GetString` and `GetInt` as well. A slice target is not unwrapped.
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

`AccessResult` is the result of a dynamically typed access, returned by `SafeGet()`; its conversion methods narrow `any` to a concrete type.

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

Reports whether the path exists; equivalent to reading the `Exists` field directly.

```go
result := json.SafeGet(data, "user.name")
if result.Ok() {
    // The value exists
}
```

#### Unwrap

Signature: `func (r AccessResult) Unwrap() any`

Gets the value; returns `nil` when `Exists` is `false`.

```go
value := result.Unwrap()
```

#### UnwrapOr

Signature: `func (r AccessResult) UnwrapOr(defaultValue any) any`

Gets the value, or `defaultValue` when `Exists` is `false`.

```go
value := result.UnwrapOr("default")
```

#### AsString

Signature: `func (r AccessResult) AsString() (string, error)`

Safely converts to a string. Succeeds only when the value itself is a `string`; other types return an error wrapping `ErrTypeMismatch`, and a missing path returns `ErrPathNotFound`.

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    // Type mismatch or path not found
}
```

#### AsInt

Signature: `func (r AccessResult) AsInt() (int, error)`

Safely converts to an integer. Accepts all integer types, floats with integral values, parseable decimal strings, and `json.Number`. `bool` is not converted: `AsInt` rejects it with an error before entering the general conversion.

#### AsFloat64

Signature: `func (r AccessResult) AsFloat64() (float64, error)`

Safely converts to a float. Accepts all numeric types and parseable strings. `bool` is rejected with an error.

#### AsBool

Signature: `func (r AccessResult) AsBool() (bool, error)`

Safely converts to a boolean. Accepts only `bool`, plus strings that `strconv.ParseBool` parses (`1/t/true/True/TRUE`, `0/f/false/False/FALSE`).

### Conversion Methods at a Glance

Every `AccessResult` conversion returns `(value, error)`, so chaining means capturing each result in turn:

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

Reads JSON line by line from an `io.Reader`, parses each line as `T`, invokes the callback, and returns every successfully parsed value. Used for large JSONL files.

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

- Blank lines (whitespace only) are always skipped; with `JSONLSkipComments: true`, lines starting with `#` or `//` are skipped as well
- A failing line: by default returns a `line N: <reason>` error with a nil result; with `JSONLContinueOnErr: true` the line is skipped and processing continues
- A callback error: stops immediately and returns that error (result is nil); callback panics are captured and converted into errors — the process is never taken down
- Read buffer and single-line caps are controlled by `JSONLBufferSize` (64KB) and `JSONLMaxLineSize` (1MB)
- The cumulative byte budget comes from `JSONLMaxMemory` (falling back to `MaxMemory`; when both are 0 the budget is unlimited); exceeding it returns an error wrapping `ErrSizeLimit`
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

Conversion in `GetTyped[T]` is two-tier: basic types (string/int/float64/bool plus their slices and maps) take an internal direct-conversion fast path; complex types such as custom structs fall back to re-`Marshal` → `Unmarshal`, so they are slower than the type-specific getters (`GetString`, `GetInt`, etc.).

| Method | Conversion path | Best for |
|--------|-----------------|----------|
| `GetString`, `GetInt`, etc. | Direct type assertion and conversion, no re-marshal fallback | Known types, frequent calls |
| `GetTyped[T]` (basic types) | Direct conversion fast path | Basic-type reads in generic code |
| `GetTyped[T]` (structs) | One re-marshal plus unmarshal | Configuration parsing, one-off reads |
| `SafeGet` + `AccessResult` | Returns the value as-is; conversion happens when you call `As*` | Dynamic type handling |

:::tip
When repeatedly reading the same struct on a hot path, `Parse`/`Unmarshal` once into the struct, or `GetTyped` once and reuse the result, avoids repeating the re-marshal conversion on every path.
:::

---

## The Result[T] Type

`Result[T]` is an operation result carrying a type parameter; it combines "value + whether it exists + error" in one return value.

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

`Result[T]` has no library function that returns it directly — you **construct it manually**, typically to wrap your own query functions and hand the caller one explicit return value combining "value + exists + error":

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
	fmt.Println(missing.Exists, errors.Is(missing.Error, nil)) // Output: false false
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
| Type conversion | None | Built-in `AsString`/`AsInt` and friends |
| How to obtain | Manual construction (no library entry point) | `SafeGet()` |
| Best for | Wrapping your own query functions | Dynamic type handling |

### Selection Advice

- **Known type, error details irrelevant**: `GetTyped[T]` (zero-value/default fallback)
- **Need to convert a dynamic value on demand**: use `AccessResult` with `SafeGet()`
- **A unified return shape**: use `Result[T]` as the return type of your own functions

---

## See Also

- [Package Functions](./functions/): type-specific getter functions
- [Type Definitions](./types): detailed `AccessResult` definition
- [Config](./config): `Config` field reference
