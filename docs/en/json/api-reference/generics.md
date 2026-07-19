---
sidebar_label: "Generics"
title: "Generic Operations - CyberGo JSON | API Reference"
description: "CyberGo JSON generic API: GetTyped[T] getter, Result[T] result type, and AccessResult dynamic access using Go 1.18+ generics for compile-time type safety."
sidebar_position: 10
---

# Generic Operations

The json library provides generic type-safe operations using Go 1.18+ generics for compile-time type checking.

## GetTyped

Signature: `func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

Gets a value of the specified type from JSON. Supports custom types. Returns `T` with no error. Returns the zero value or `defaultValue` when the path does not exist or type conversion fails.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | JSON path |
| `defaultValue` | `...T` | No | Optional default value, returned when path does not exist or type conversion fails |

**Return Value**

| Return Value | Type | Description |
|--------------|------|-------------|
| Single return value | `T` | Retrieved value, returns zero value or default when path does not exist or type conversion fails |

**Supported Types**

- Basic types: `string`, `int`, `int64`, `float64`, `bool`
- Slice types: `[]any`
- Map types: `map[string]any`
- Custom structs

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // Get string
    name := json.GetTyped[string](data, "user.name")
    fmt.Println(name) // Output: Alice

    // Get integer
    age := json.GetTyped[int](data, "user.age")
    fmt.Println(age) // Output: 30

    // Get array
    arrData := `{"items": [1, 2, 3]}`
    items := json.GetTyped[[]any](arrData, "items")
    fmt.Println(items) // Output: [1 2 3]

    // Use default value
    email := json.GetTyped[string](data, "user.email", "unknown@example.com")
    fmt.Println(email) // Output: unknown@example.com
}
```

---

## AccessResult

`AccessResult` is a dynamic type access result that provides type conversion methods for dynamic type handling. Obtained via `SafeGet()`.

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
    // Value exists
}
```

#### Unwrap

Signature: `func (r AccessResult) Unwrap() any`

Gets the value, returns nil if it does not exist.

```go
value := result.Unwrap()
```

#### UnwrapOr

Signature: `func (r AccessResult) UnwrapOr(defaultValue any) any`

Gets the value or a default value.

```go
value := result.UnwrapOr("default")
```

#### AsString

Signature: `func (r AccessResult) AsString() (string, error)`

Safely converts to string. Only succeeds when the value itself is a string type.

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    // Type mismatch or path does not exist
}
```

#### AsInt

Signature: `func (r AccessResult) AsInt() (int, error)`

Safely converts to integer. Supports all integer types and floats (if the value is a whole number). **Note: bool is not converted to int.**

#### AsFloat64

Signature: `func (r AccessResult) AsFloat64() (float64, error)`

Safely converts to float64. Supports all numeric types. **Note: bool is not converted to float64.**

#### AsBool

Signature: `func (r AccessResult) AsBool() (bool, error)`

Safely converts to boolean. Supports bool and string types ("true", "false", "1", "0", etc.).

### Chained Type Conversion Methods

`AccessResult` provides the following type conversion methods:

| Method | Return Type | Description |
|--------|-------------|-------------|
| `AsString()` | `(string, error)` | Convert to string (strict type checking) |
| `AsStringConverted()` | `(string, error)` | Format-convert to string |
| `AsInt()` | `(int, error)` | Convert to integer (bool not converted) |
| `AsFloat64()` | `(float64, error)` | Convert to float64 (bool not converted) |
| `AsBool()` | `(bool, error)` | Convert to boolean |

### AsString vs AsStringConverted

| Method | Behavior | Use Case |
|--------|----------|----------|
| `AsString()` | Strict type checking, only succeeds for string type | Need to ensure original type |
| `AsStringConverted()` | Format any type to string | Need string representation |

```go
// Scenario: Get a value that may be a number or string
result := json.SafeGet(data, "user.id")

// Strict mode - only succeeds when value is string
id, err := result.AsString()

// Lenient mode - numbers also convert to string
idStr, err := result.AsStringConverted()
```

---

## StreamLinesInto

Signature: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

Reads JSON line by line from an `io.Reader`, parsing each line as type `T` and calling the callback function. Suitable for processing large JSONL format files.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reader` | `io.Reader` | Yes | Data source |
| `fn` | `func(lineNum int, data T) error` | Yes | Callback function for each line, receives line number and parsed data |
| `cfg` | `...Config` | No | Optional configuration |

**Return Values**

| Return Value | Type | Description |
|--------------|------|-------------|
| First | `[]T` | All successfully parsed results |
| Second | `error` | Error information |

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
        fmt.Printf("Line %d: %s, %d years old\n", lineNum, data.Name, data.Age)
        return nil
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("Total processed %d records\n", len(results))
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

    // Parse configuration into struct
    dbConfig := json.GetTyped[DatabaseConfig](config, "database")

    fmt.Printf("Host: %s:%d\n", dbConfig.Host, dbConfig.Port)
}
```

### Multi-Type Processing

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

    // Generic gets for different types
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

    // Path does not exist, returns zero value
    retries := json.GetTyped[int](config, "retries")
    fmt.Printf("Retries: %d\n", retries) // Output: 0 (zero value)

    // Path does not exist, use default value
    retries = json.GetTyped[int](config, "retries", 3)
    fmt.Printf("Retries: %d\n", retries) // Output: 3 (default value)
}
```

---

## Performance Notes

Generic operations use reflection for type conversion at runtime, making them slightly slower than type-specific getters like `GetString` and `GetInt`. For performance-sensitive scenarios, prefer type-specific functions.

| Method | Performance | Recommended Scenario |
|--------|-------------|---------------------|
| `GetString`, `GetInt`, etc. | Fastest | Performance-sensitive, type known |
| `GetTyped[T]` | Medium | Need custom types |
| `SafeGet` + `AccessResult` | Medium | Dynamic type processing |

---

## Result[T] Type

`Result[T]` is a type-safe generic operation result for scenarios requiring a specific type and error handling.

### Struct Definition

```go
type Result[T any] struct {
    Value  T     // Result value
    Exists bool  // Whether the path was found
    Error  error // Error information
}
```

### Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `Ok()` | `bool` | Check if result is valid (no error and found) |
| `Unwrap()` | `T` | Return value, returns zero value on failure |
| `UnwrapOr(default T)` | `T` | Return value or default value on failure |

### Usage Example

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // GetTyped returns T
    name := json.GetTyped[string](data, "user.name")
    fmt.Println("Name:", name)

    // Non-existent path returns zero value
    email := json.GetTyped[string](data, "user.email")
    fmt.Println("Email:", email) // Output: "" (zero value)

    // Use default value
    email = json.GetTyped[string](data, "user.email", "none@example.com")
    fmt.Println("Email:", email) // Output: none@example.com
}
```

---

## Result[T] vs AccessResult Comparison

| Feature | Result[T] | AccessResult |
|---------|-----------|--------------|
| Type safety | Generic T | any type |
| Existence check | `Exists bool` | `Exists bool` |
| Error handling | Built-in Error field | Type conversion methods return error |
| Chained calls | Not supported | Supports chained type conversion |
| How to obtain | `GetTyped[T]` | `SafeGet()` |
| Use case | Known type retrieval | Dynamic type processing |

### Selection Guide

- **Known type**: Use `Result[T]` and `GetTyped[T]`
- **Dynamic type**: Use `AccessResult` and `SafeGet()`
- **Need chained conversion**: Use `AccessResult`
- **Need error handling**: Use `Result[T]`'s Error field or `AccessResult`'s type conversion methods

---

## See Also

- [Package Functions](./functions/) - Type-specific getter functions
- [Type Definitions](./types) - AccessResult detailed definition
- [Configuration](./config) - Config configuration options
