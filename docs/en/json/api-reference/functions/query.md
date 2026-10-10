---
sidebar_label: "Query & Get"
title: "Query & Get Functions - CyberGo JSON | Get/GetInt Usage"
description: "CyberGo JSON is a Go library for JSONPath queries, offering type-safe Get/GetInt, GetTyped[T], SafeGet, GetWithContext and GetMultiple for nested values."
sidebar_position: 20
---

# Query and Get Functions

Query and get functions of the json package, supporting path expressions, type-safe access, and batch operations.

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

Context-aware get by path. Supports timeout and cancellation. The context-aware version of `Get`.

::: info Cancellation semantics: boundary-level checks
The Context is checked only **before the operation starts** and **after it finishes**, not during parsing/navigation:

- Already cancelled/timed out before the start: returns `ctx.Err()` directly (`context.Canceled` / `context.DeadlineExceeded`), with no parsing performed
- Timeout detected only after the operation completes: likewise returns `ctx.Err()` — even a successfully retrieved value is discarded
- This function is therefore suited as a **guard at call boundaries** — avoiding wasted work on already-expired requests; but parsing itself cannot be cut short mid-flight, so for extremely large JSON documents a timeout does not bound the duration of a single parse
:::

```go
package main

import (
	"context"
	"fmt"
	"github.com/cybergodev/json"
	"time"
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

## Type-Safe Get Functions

Type-safe get functions provide zero-value fallbacks through the `defaultValue` variadic parameter. When the path does not exist, the value is null, or the type conversion fails, `defaultValue` is returned (or the zero value of the type when not provided).

### GetString

Signature: `func GetString(jsonStr, path string, defaultValue ...string) string`

Gets a string value by path.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `defaultValue` | `...string` | No | Optional default, returned when the path does not exist, the value is null, or the conversion fails |

**Returns**

| Return value | Type | Description |
|--------------|------|-------------|
| Single return value | `string` | The string at the path; the default when the path does not exist, the value is null, or the conversion fails (zero value `""` when no default is given) |

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

	// A missing path returns the zero value (empty string) or a custom default
	nickname := json.GetString(jsonStr, "user.nickname", "unknown")
	fmt.Println(nickname) // Output: unknown
}
```

### GetInt

Signature: `func GetInt(jsonStr, path string, defaultValue ...int) int`

Gets an integer value by path.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `defaultValue` | `...int` | No | Optional default, returned when the path does not exist, the value is null, or the conversion fails |

**Returns**

| Return value | Type | Description |
|--------------|------|-------------|
| Single return value | `int` | The integer at the path (lenient conversion, e.g. the string `"42"` converts to `42`); the default when the path does not exist, the value is null, or the conversion fails (zero value `0` when no default is given) |

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

	// A missing path returns the custom default
	page := json.GetInt(jsonStr, "pagination.page", 1)
	fmt.Println(page) // Output: 1
}
```

### GetFloat

Signature: `func GetFloat(jsonStr, path string, defaultValue ...float64) float64`

Gets a float value by path.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `defaultValue` | `...float64` | No | Optional default, returned when the path does not exist, the value is null, or the conversion fails |

**Returns**

| Return value | Type | Description |
|--------------|------|-------------|
| Single return value | `float64` | The float at the path (integers are widened to `float64`); the default when the path does not exist, the value is null, or the conversion fails (zero value `0` when no default is given) |

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

	// A missing path returns the custom default
	discount := json.GetFloat(jsonStr, "item.discount", 0.0)
	fmt.Println(discount) // Output: 0
}
```

### GetBool

Signature: `func GetBool(jsonStr, path string, defaultValue ...bool) bool`

Gets a boolean value by path.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `defaultValue` | `...bool` | No | Optional default, returned when the path does not exist, the value is null, or the conversion fails |

**Returns**

| Return value | Type | Description |
|--------------|------|-------------|
| Single return value | `bool` | The boolean at the path; the default when the path does not exist, the value is null, or the conversion fails (zero value `false` when no default is given) |

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

	// A missing path returns the custom default
	verbose := json.GetBool(jsonStr, "feature.verbose", false)
	fmt.Println(verbose) // Output: false
}
```

### GetArray

Signature: `func GetArray(jsonStr, path string, defaultValue ...[]any) []any`

Gets an array by path.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `defaultValue` | `...[]any` | No | Optional default, returned when the path does not exist, the value is null, or the conversion fails |

**Returns**

| Return value | Type | Description |
|--------------|------|-------------|
| Single return value | `[]any` | The array at the path (elements keep their parsed native types, numbers default to `float64`); the default when the path does not exist, the value is null, or the conversion fails (zero value `nil` when no default is given) |

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

	// A missing path returns the custom default
	empty := json.GetArray(jsonStr, "tags", []any{"default"})
	fmt.Println(empty) // Output: [default]
}
```

### GetObject

Signature: `func GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

Gets an object by path.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `defaultValue` | `...map[string]any` | No | Optional default, returned when the path does not exist, the value is null, or the conversion fails |

**Returns**

| Return value | Type | Description |
|--------------|------|-------------|
| Single return value | `map[string]any` | The object at the path (numbers default to `float64`); the default when the path does not exist, the value is null, or the conversion fails (zero value `nil` when no default is given) |

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

	// A missing path returns the custom default
	settings := json.GetObject(jsonStr, "user.settings", map[string]any{"theme": "dark"})
	fmt.Println(settings) // Output: map[theme:dark]
}
```

## Generic Get Functions

### GetTyped[T]

Signature: `func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

Generic get function supporting custom types. When the path does not exist, the value is null, or the type conversion fails, `defaultValue` is returned (or the zero value of `T` when not provided).

**Naming note**: `GetTyped[T]` has the same semantics as `GetAs[T]` — it gets the JSON value and converts it to the given type `T`.

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

	// Get as a typed struct
	user := json.GetTyped[User](jsonStr, "user")
	fmt.Printf("Name: %s, Age: %d\n", user.Name, user.Age)

	// Built-in type examples
	name := json.GetTyped[string](jsonStr, "user.name")
	fmt.Println(name) // Output: CyberGo

	age := json.GetTyped[int](jsonStr, "user.age")
	fmt.Println(age) // Output: 30

	// A missing path returns the custom default
	email := json.GetTyped[string](jsonStr, "user.email", "unknown@example.com")
	fmt.Println(email) // Output: unknown@example.com
}
```

## Safe Get Functions

### SafeGet (Package-Level Function)

Signature: `func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Performs a type-safe get and returns an `AccessResult` providing conversion methods (`AsString`, `AsInt`, `AsFloat64`, `AsBool`).

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

Performs a type-safe get through a Processor instance.

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

:::tip Choosing: the GetTyped family or SafeGet
- **Config support**: typed functions such as `GetString`/`GetInt`/`GetTyped[T]` **cannot take a Config** — the variadic parameter is already occupied by `defaultValue` (Go allows only one variadic parameter per function) — so they always use the default processor. To customize security limits, validation, or caching per call, use `SafeGet(jsonStr, path, cfg)` instead, or create a dedicated Processor with `json.New(cfg)` and call its `GetString` and other methods.
- **Conversion leniency**: typed functions use lenient conversion (the string `"42"` converts to `int`, the boolean `true` to `1`); `SafeGet`'s `AsInt`/`AsFloat64` reject boolean input, and `AsString` requires the original value to already be a string (use `AsStringConverted` when you need explicit stringification).
- **Error semantics**: typed functions **silently fall back** to the default/zero value; `SafeGet` preserves both "does it exist" (`Exists`/`Ok()`) and "did the conversion fail" (the `AsInt`/`AsString` conversion methods return an error), which makes the two cases easy to handle separately.
:::

## Processor Extension Methods

The following methods are provided both as package-level functions and as Processor methods.

### GetMultiple (Package-Level Function)

Signature: `func GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

Batch-gets the values at multiple paths (package-level function — no Processor required).

**Return value semantics**

- The JSON is parsed only **once**, then each path is evaluated (more efficient than repeated `Get` calls)
- The returned map is keyed by the **path string itself** (e.g. `"user.name"`), corresponding one-to-one with the input `paths`
- **Partial failure**: when a path fails, its key is `nil` in the map and the function returns the **first** error encountered (`map` and `err` are both non-nil) — results of the already-successful paths remain usable
- If any path has **illegal syntax**, the whole call fails (returns `nil, err`); an empty `paths` slice returns an empty map and `nil`

```go
jsonStr := `{"user": {"name": "CyberGo", "age": 30, "email": "test@example.com"}}`

paths := []string{"user.name", "user.age", "user.email"}
values, err := json.GetMultiple(jsonStr, paths)
if err != nil {
    panic(err)
}
fmt.Println(values["user.name"]) // Output: CyberGo
```

**Partial failure example** (the failed path is nil, but successful paths remain usable):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"user": {"name": "CyberGo", "age": 30}}`

	values, err := json.GetMultiple(data, []string{"user.name", "user.missing"})
	fmt.Println(values["user.name"])    // Output: CyberGo (successful paths unaffected)
	fmt.Println(values["user.missing"]) // Output: <nil> (failed paths are nil)
	fmt.Println(err != nil)             // Output: true (err is non-nil on partial failure)
}
```

### Processor.GetMultiple

Signature: `func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

Batch-gets the values at multiple paths.

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

## Error Handling

Failures of `Get`/`GetWithContext` are distinguished by sentinel errors, checked with `errors.Is`; typed functions (`GetString`, etc.) return no error and silently fall back to the zero value/default:

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"user": {"name": "Alice"}}`

	if _, err := json.Get(data, "user.age"); errors.Is(err, json.ErrPathNotFound) {
		fmt.Println("Path not found; fall back to default-value logic")
	}
	if _, err := json.Get(`{"name": "x"}`, "name[0]"); errors.Is(err, json.ErrTypeMismatch) {
		fmt.Println("Type mismatch: strings do not support indexing")
	}
	if _, err := json.Get(`{"name": }`, "name"); errors.Is(err, json.ErrInvalidJSON) {
		fmt.Println("Input is not valid JSON")
	}
}
```

:::tip Performance entry points
For repeated queries on the same path use [`CompilePath`/`GetCompiled`](../processor/query#compilepath); for multi-path queries on the same JSON use [`PreParse`/`GetFromParsed`](../processor/query#preparse) — both in the Processor query reference.
:::

## Related Types

### AccessResult

Fields of the `AccessResult` struct used by `SafeGet`:

| Field | Type | Description |
|-------|------|-------------|
| `Value` | `any` | The retrieved value |
| `Exists` | `bool` | Whether the path exists |
| `Type` | `string` | The detected value type |

**Methods**: `Ok()` · `Unwrap()` · `UnwrapOr()` · `AsString()` · `AsStringConverted()` · `AsInt()` · `AsFloat64()` · `AsBool()`

See [AccessResult Type](../types#accessresult-property-access-result).

### Result[T]

Fields of the `Result[T]` generic struct:

| Field | Type | Description |
|-------|------|-------------|
| `Value` | `T` | The retrieved value |
| `Exists` | `bool` | Whether the value was found |
| `Error` | `error` | Error information |

## See Also

- [Parse & Validate](./parse) - Parse, Valid, ValidateSchema and other parse/validate operations
- [Batch Operation Functions](./batch) - ProcessBatch batch processing
- [Modification Functions](./modify) - Set, Delete and other modification operations
- [Encoding Output](./output) - Marshal, Unmarshal and other serialization operations
- [Utility Functions](../helpers) - CompareJSON, MergeJSON and other utilities
- [Config](../config) - Configuration options in detail
