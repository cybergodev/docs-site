---
sidebar_label: "Parse & Validate"
title: "Parse & Validate Functions - CyberGo JSON | Valid & Parse"
description: "Parsing and validation: Parse/ParseAny decode into structs or any, Valid checks validity with security limits, ValidateSchema returns every ValidationError."
sidebar_position: 60
---

# Parse and Validate Functions

Parse and validate functions of the json package: decoding JSON into target objects, parsing through a Processor instance, JSON validity checking, and JSON Schema validation.

## Parse Functions

### Parse

Signature: `func Parse(jsonStr string, target any, cfg ...Config) error`

Parses a JSON string into the object pointed to by `target`. `target` must be a **non-nil pointer**; passing `nil` or a non-pointer returns an argument error. Like `Get`, `Parse` runs security validation on the input before parsing (size, nesting depth, dangerous patterns), bounded by `cfg` and the processor configuration.

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

Parses a JSON string and returns the root as `any`, with no target variable to declare.

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

Checks whether a JSON byte slice is valid and returns a plain `bool`. The signature matches `encoding/json.Valid`, so existing code compiles after swapping the import; however, a no-cfg call does **not** stop at syntax. It routes through the default processor's security validation, so input that is syntactically valid still returns `false` when it exceeds `MaxJSONSize` (default 100MB), contains invalid UTF-8, or has a dangerous pattern (e.g. `__proto__`, `<script`) in a string value.

The optional trailing `Config` applies security limits (size, nesting depth, full security scanning, etc.). With cfg, `Valid` delegates to `Processor.Valid` and folds any error into `false`. For a syntax-only check like the standard library, use `encoding/json.Valid`; or pass a `Config` with `SkipValidation: true` to `ValidWithConfig` (which keeps only basic size and depth checks).

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := []byte(`{"name": "test"}`)
	// Same signature as encoding/json (no cfg)
	if json.Valid(data) {
		fmt.Println("Valid JSON")
	}

	// With configuration (optional trailing argument)
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

Parses JSON data against a JSON Schema and returns every validation error. A non-nil second return value means the check itself failed (e.g. input is not valid JSON, or the schema is nil), in which case the error list is meaningless.

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
