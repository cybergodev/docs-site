---
title: "Query and Get Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON query and get functions complete reference: including Get/GetString/GetInt/GetFloat/GetBool type-safe getters, GetTyped[T] generic getter, Parse/ParseAny parsing functions, with full JSONPath expression support, providing zero-error getter mode with default values."
---

# Query and Get Functions

The json package provides query and get functions supporting path expressions, type-safe retrieval, and batch operations.

## Path Query Functions

### Get

Signature: `func Get(jsonStr, path string, cfg ...Config) (any, error)`

Gets a value of any type by path.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `cfg` | `Config` | No | Optional configuration |

**Example**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    val, err := json.Get(`{"items":[{"name":"test"}]}`, "items[0].name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // Output: test
}
```


### GetWithContext

Signature: `func GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

Path query with context. Supports timeout and cancellation. A context-aware version of `Get`.

::: info Note
Context is checked before and after operations, not during parsing/navigation. For large JSON documents, cancellation may not be responded to during the operation.
:::

```go
package main

import (
    "context"
    "fmt"
    "time"
    "github.com/cybergodev/json"
)

func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    val, err := json.GetWithContext(ctx, `{"user":{"name":"Alice"}}`, "user.name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // Output: Alice
}
```

## Type-Safe Getter Functions

Type-safe getter functions provide zero-value fallback through the `defaultValue` variadic parameter. When the path does not exist, the value is null, or type conversion fails, `defaultValue` is returned (or the zero value for that type if not provided).

### GetString

Signature: `func GetString(jsonStr, path string, defaultValue ...string) string`

Gets a string value by path.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo"}}`

    name := json.GetString(jsonStr, "user.name")
    fmt.Println(name) // Output: CyberGo

    // Non-existent path returns zero value (empty string) or custom default
    nickname := json.GetString(jsonStr, "user.nickname", "unknown")
    fmt.Println(nickname) // Output: unknown
}
```

### GetInt

Signature: `func GetInt(jsonStr, path string, defaultValue ...int) int`

Gets an integer value by path.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"pagination": {"count": 42}, "timeout": 30}`

    count := json.GetInt(jsonStr, "pagination.count")
    fmt.Println(count) // Output: 42

    timeout := json.GetInt(jsonStr, "timeout")
    fmt.Println(timeout) // Output: 30

    // Non-existent path returns custom default value
    page := json.GetInt(jsonStr, "pagination.page", 1)
    fmt.Println(page) // Output: 1
}
```

### GetFloat

Signature: `func GetFloat(jsonStr, path string, defaultValue ...float64) float64`

Gets a float value by path.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"item": {"price": 19.99}, "rate": 0.85}`

    price := json.GetFloat(jsonStr, "item.price")
    fmt.Println(price) // Output: 19.99

    rate := json.GetFloat(jsonStr, "rate")
    fmt.Println(rate) // Output: 0.85

    // Non-existent path returns custom default value
    discount := json.GetFloat(jsonStr, "item.discount", 0.0)
    fmt.Println(discount) // Output: 0
}
```

### GetBool

Signature: `func GetBool(jsonStr, path string, defaultValue ...bool) bool`

Gets a boolean value by path.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"feature": {"enabled": true}, "debug": false}`

    enabled := json.GetBool(jsonStr, "feature.enabled")
    fmt.Println(enabled) // Output: true

    debug := json.GetBool(jsonStr, "debug")
    fmt.Println(debug) // Output: false

    // Non-existent path returns custom default value
    verbose := json.GetBool(jsonStr, "feature.verbose", false)
    fmt.Println(verbose) // Output: false
}
```

### GetArray

Signature: `func GetArray(jsonStr, path string, defaultValue ...[]any) []any`

Gets an array by path.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"items": ["apple", "banana", "cherry"]}`

    items := json.GetArray(jsonStr, "items")
    for i, item := range items {
        fmt.Printf("[%d] %v\n", i, item)
    }

    // Non-existent path returns custom default value
    empty := json.GetArray(jsonStr, "tags", []any{"default"})
    fmt.Println(empty) // Output: [default]
}
```

### GetObject

Signature: `func GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

Gets an object by path.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"profile": {"name": "CyberGo", "level": 5}}}`

    profile := json.GetObject(jsonStr, "user.profile")
    fmt.Println(profile) // map[level:5 name:CyberGo]

    // Non-existent path returns custom default value
    settings := json.GetObject(jsonStr, "user.settings", map[string]any{"theme": "dark"})
    fmt.Println(settings) // Output: map[theme:dark]
}
```

## Generic Getter Function

### GetTyped[T]

Signature: `func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

Generic getter function supporting custom types. Returns `defaultValue` (or the zero value of `T` if not provided) when the path does not exist or type conversion fails.

**Naming Convention**: `GetTyped[T]` is semantically equivalent to `GetAs[T]`, meaning get and convert the JSON value to the specified type `T`.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

    // Get typed struct
    user := json.GetTyped[User](jsonStr, "user")
    fmt.Printf("Name: %s, Age: %d\n", user.Name, user.Age)

    // Built-in type examples
    name := json.GetTyped[string](jsonStr, "user.name")
    fmt.Println(name) // Output: CyberGo

    age := json.GetTyped[int](jsonStr, "user.age")
    fmt.Println(age) // Output: 30

    // Non-existent path returns custom default value
    email := json.GetTyped[string](jsonStr, "user.email", "unknown@example.com")
    fmt.Println(email) // Output: unknown@example.com
}
```

## Parse Functions

### Parse

Signature: `func Parse(jsonStr string, target any, cfg ...Config) error`

Parses a JSON string into the object pointed to by `target`. `target` must be a pointer.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `target` | `any` | Yes | Target object pointer |
| `cfg` | `Config` | No | Optional configuration |

**Basic Parsing**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    var data map[string]any
    err := json.Parse(`{"name": "test"}`, &data)
    if err != nil {
        panic(err)
    }
    fmt.Println(data) // map[name:test]
}
```

**Parse into Struct**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type Person struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

func main() {
    var person Person
    err := json.Parse(`{"name": "CyberGo", "age": 30}`, &person)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Name: %s, Age: %d\n", person.Name, person.Age)
}
```

**Using Custom Configuration**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    var data map[string]any
    err := json.Parse(`{"name": "test"}`, &data, cfg)
    if err != nil {
        panic(err)
    }
    fmt.Println(data)
}
```

### ParseAny

Signature: `func ParseAny(jsonStr string, cfg ...Config) (any, error)`

Parses a JSON string and returns the root value as `any`, without requiring a pre-declared target variable.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    result, err := json.ParseAny(`{"name": "test"}`)
    if err != nil {
        panic(err)
    }
    fmt.Println(result) // map[name:test]
}
```

::: tip Parse vs ParseAny
- `Parse(jsonStr, &target)` -- Parses into a target pointer, requires pre-declared variable
- `ParseAny(jsonStr)` -- Directly returns `any` type, no pre-declaration needed
:::

### Processor.Parse

**Signature**: `func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

Parses JSON into a target pointer through a Processor instance.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

var data map[string]any
err = p.Parse(`{"name": "test"}`, &data)
if err != nil {
    panic(err)
}
```

### Processor.ParseAny

**Signature**: `func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

Parses JSON and returns `any` type through a Processor instance, behaving identically to the package-level `ParseAny`.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

data, err := p.ParseAny(`{"name": "test"}`)
```

See [Processor Parse Methods](../processor/parse.md#parse-methods).

## Validation Functions

### Valid

Signature: `func Valid(data []byte) bool`

Validates whether a JSON byte slice is valid. 100% compatible with `encoding/json.Valid`.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := []byte(`{"name": "test"}`)
    if json.Valid(data) {
        fmt.Println("Valid JSON")
    }
}
```

### ValidWithConfig

Signature: `func ValidWithConfig(jsonStr string, cfg ...Config) (bool, error)`

Validates a JSON string using configuration and returns possible error information.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    valid, err := json.ValidWithConfig(`{"name": "test"}`, cfg)
    if err != nil {
        panic(err)
    }
    if valid {
        fmt.Println("Valid JSON")
    }
}
```

## Safe Get Functions

### SafeGet (Package-Level Function)

Signature: `func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Performs a type-safe get operation, returning an `AccessResult` with type conversion methods (`AsString`, `AsInt`, `AsFloat64`, `AsBool`).

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

    result := json.SafeGet(jsonStr, "user.age")
    if result.Exists {
        age, _ := result.AsInt()
        fmt.Println(age) // Output: 30
    }

    nameResult := json.SafeGet(jsonStr, "user.name")
    name, _ := nameResult.AsString()
    fmt.Println(name) // Output: CyberGo
}
```

### SafeGet (Processor Method)

Signature: `func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Performs a type-safe get operation through a Processor instance.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

result := p.SafeGet(jsonStr, "user.age")
if result.Exists {
    age, _ := result.AsInt()
    fmt.Println(age) // Output: 30
}
```

## Processor Extended Methods

The following methods are available as both package-level functions and Processor methods.

### GetMultiple (Package-Level Function)

Signature: `func GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

Batch gets values at multiple paths (package-level function, no Processor required).

```go
jsonStr := `{"user": {"name": "CyberGo", "age": 30, "email": "test@example.com"}}`

paths := []string{"user.name", "user.age", "user.email"}
values, err := json.GetMultiple(jsonStr, paths)
if err != nil {
    panic(err)
}
fmt.Println(values["user.name"]) // Output: CyberGo
```

### Processor.GetMultiple

Signature: `func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

Batch gets values at multiple paths.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 30, "email": "test@example.com"}}`

paths := []string{"user.name", "user.age", "user.email"}
values, err := p.GetMultiple(jsonStr, paths)
if err != nil {
    panic(err)
}
fmt.Println(values["user.name"]) // Output: CyberGo
```

### Processor.ProcessBatch

Signature: `func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

Batch processes multiple JSON operations.

**BatchOperation Fields**: `Type string`, `JSONStr string`, `Path string`, `Value any`, `ID string`

**BatchResult Fields**: `ID string`, `Result any`, `Error error`

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

operations := []json.BatchOperation{
    {Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
    {Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
}

results, err := p.ProcessBatch(operations)
if err != nil {
    panic(err)
}
for _, r := range results {
    if r.Error != nil {
        fmt.Printf("Operation %s failed: %v\n", r.ID, r.Error)
    } else {
        fmt.Printf("Operation %s result: %v\n", r.ID, r.Result)
    }
}
```

## Related Types

### AccessResult

`AccessResult` struct fields used by `SafeGet`:

| Field | Type | Description |
|-------|------|-------------|
| `Value` | `any` | Retrieved value |
| `Exists` | `bool` | Whether the path exists |
| `Type` | `string` | Detected value type |

**Methods**: `Ok()` · `Unwrap()` · `UnwrapOr()` · `AsString()` · `AsStringConverted()` · `AsInt()` · `AsFloat64()` · `AsBool()`

See [AccessResult Type](../types#accessresult---property-access-result) for details.

### Result[T]

`Result[T]` generic struct fields:

| Field | Type | Description |
|-------|------|-------------|
| `Value` | `T` | Retrieved value |
| `Exists` | `bool` | Whether the value was found |
| `Error` | `error` | Error information |

## See Also

- [Modify Functions](./modify) - Set, Delete and other modify operations
- [Encode and Decode](./encode-decode) - Marshal, Unmarshal and other serialization operations
- [Helper Functions](../helpers) - CompareJSON, MergeJSON and other utility functions
- [Configuration Options](../config) - Config configuration details
