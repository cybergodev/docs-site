---
sidebar_label: "Parse & Validate"
title: "Parse and Validate Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON parse and validate: Parse/ParseAny into target pointers, Processor.Parse/ParseAny methods, and Valid/ValidWithConfig/ValidateSchema with JSON Schema."
sidebar_position: 6
---

# Parse and Validate Functions

The json package provides parse and validation functions, supporting JSON parsing into target objects, parsing through Processor instances, and JSON validity validation and JSON Schema validation.

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

See [Processor Parse Methods](../processor/parse#parse-methods).

## Validation Functions

### Valid

Signature: `func Valid(data []byte, cfg ...Config) bool`

Validates whether a JSON byte slice is valid. 100% compatible with `encoding/json.Valid`: called without `cfg`, `json.Valid(data)` behaves identically to the standard library and returns a plain `bool`.

The optional trailing `Config` applies security limits (size, nesting depth, full security scan, etc.). When `cfg` is passed, `Valid` delegates to `Processor.Valid` and collapses any error into `false`.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := []byte(`{"name": "test"}`)
    // Compatible with encoding/json (no cfg)
    if json.Valid(data) {
        fmt.Println("Valid JSON")
    }

    // With configuration (non-breaking optional parameter)
    if json.Valid(data, json.SecurityConfig()) {
        fmt.Println("Passed security validation")
    }
}
```

::: tip Valid vs ValidWithConfig
- `Valid(data, cfg)` returns a single `bool` (compatible with `encoding/json`); any error is collapsed into `false`
- `ValidWithConfig(jsonStr, cfg)` returns `(bool, error)`, convenient for inspecting why validation failed

Both accept `cfg`; the naming difference is historical.
:::

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

### ValidateSchema

Signature: `func ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)`

Validates JSON data against a JSON Schema. Returns a list of all validation errors.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    schema := &json.Schema{
        Type:     "object",
        Required: []string{"name", "email"},
        Properties: map[string]*json.Schema{
            "name":  {Type: "string", MinLength: 1},
            "email": {Type: "string", Format: "email"},
            "age":   {Type: "integer", Minimum: 0},
        },
    }

    errors, err := json.ValidateSchema(`{"name":"Alice","email":"alice@example.com","age":25}`, schema)
    if err != nil {
        panic(err)
    }
    for _, e := range errors {
        fmt.Printf("Path %s: %s\n", e.Path, e.Message)
    }
}
```

::: tip See Also
For the full Schema type definition and validator usage, see [Validator](../../extensions/validator).
:::

## See Also

- [Query & Get Functions](./query) - Get, GetString and other query operations
- [Processor Parse Methods](../processor/parse) - Processor-level parse and validate methods in detail
