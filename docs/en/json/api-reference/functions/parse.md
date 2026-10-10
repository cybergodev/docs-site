---
sidebar_label: "Parse & Validate"
title: "Parse & Validate Functions - CyberGo JSON | Valid & Parse"
description: "CyberGo JSON is a Go library for parsing and validation, offering Parse/ParseAny, Valid, ValidWithConfig and ValidateSchema to handle untrusted input."
sidebar_position: 60
---

# Parse and Validate Functions

Parse and validate functions of the json package: parsing JSON into target objects, parsing through a Processor instance, JSON validity checking, and JSON Schema validation.

## Parse Functions

### Parse

Signature: `func Parse(jsonStr string, target any, cfg ...Config) error`

Parses a JSON string into the object pointed to by `target`. `target` must be a **non-nil pointer** (passing `nil` or a non-pointer returns an argument error). Consistent with `Get`, `Parse` runs security validation on the input before parsing (size, nesting depth, dangerous patterns, bounded by `cfg` and the processor configuration).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `target` | `any` | Yes | Pointer to the target object |
| `cfg` | `Config` | No | Optional configuration |

**Basic parsing**

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

**Parsing into a struct**

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

**Using a custom configuration**

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

Parses a JSON string and returns the root value as `any` — no target variable needs to be declared up front.

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

:::tip Parse vs ParseAny
- `Parse(jsonStr, &target)` — parses into a target pointer; requires a declared variable
- `ParseAny(jsonStr)` — directly returns `any`; no declaration needed
:::

### Processor.Parse

Signature: `func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

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

Signature: `func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

Parses JSON through a Processor instance and returns `any`; behaves the same as the package-level `ParseAny`.

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

Checks whether a JSON byte slice is valid. 100% compatible with `encoding/json.Valid`: calling `json.Valid(data)` without cfg is fully identical to the standard library and returns a plain `bool`.

The optional trailing `Config` applies security limits (size, nesting depth, full security scanning, etc.). When cfg is passed, `Valid` delegates to `Processor.Valid` and folds any error into `false`.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := []byte(`{"name": "test"}`)
	// encoding/json compatible (no cfg)
	if json.Valid(data) {
		fmt.Println("Valid JSON")
	}

	// With configuration (non-breaking optional parameter)
	if json.Valid(data, json.SecurityConfig()) {
		fmt.Println("Passed security validation")
	}
}
```

:::tip Valid vs ValidWithConfig
- `Valid(data, cfg)` returns a single `bool` (compatible with `encoding/json`); any error folds into `false`
- `ValidWithConfig(jsonStr, cfg)` returns `(bool, error)`, convenient for inspecting why validation failed

Both accept `cfg`; the naming difference is historical.
:::

### ValidWithConfig

Signature: `func ValidWithConfig(jsonStr string, cfg ...Config) (bool, error)`

Validates a JSON string with a configuration and returns any error information.

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

Validates JSON data against a JSON Schema. Returns the list of all validation errors.

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
			"name":  {Type: "string"},
			"email": {Type: "string", Format: "email"},
			"age":   {Type: "number"}, // numbers may use "number" or "integer"
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

::: warning Two things to note
- `Type` supports `"number"` and `"integer"`: `"number"` accepts every number; `"integer"` follows JSON Schema semantics and accepts values that are **mathematically integers** (`1`, `1.0`, and `1e2` all pass, while `1.5` fails with an `expected type integer` error). Numeric constraints such as `Minimum`/`Maximum`/`MultipleOf` apply to both; see the [Schema Constraint Fields Overview](../schema#schema-constraint-fields-overview).
- **Length/range constraints** such as `MinLength`/`Minimum` do not take effect when written directly in an `&json.Schema{...}` literal; the schema must be created with [`NewSchema`](../schema#creating-a-schema). See [Schema Validation](../schema) for details.
:::

:::tip Further reading
For the complete Schema type definitions and validator usage, see [Schema Validation](../schema).
:::

## See Also

- [Query & Get](./query) - Get, GetString and other query operations
- [Processor Parse Methods](../processor/parse) - Processor-level parse and validate methods in detail
