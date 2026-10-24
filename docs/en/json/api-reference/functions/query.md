---
sidebar_label: "Query & Get"
title: "Query & Get Functions - CyberGo JSON | Get/GetInt Usage"
description: "Path query: Get/GetWithContext return sentinel errors, GetString and other typed getters fall back to defaults, SafeGet keeps Exists, GetMultiple parses once."
sidebar_position: 20
---

# Query and Get Functions

Path queries, type-safe getters, safe access and batch retrieval. `Get` returns an error on failure; typed getters such as `GetString` return no error and fall back to the default. The two differ in error semantics; see the selection notes below.

## Path Query Functions

### Get

Signature: `func Get(jsonStr, path string, cfg ...Config) (any, error)`

Gets a value of any type by path. A missing key or an out-of-bounds array index returns an error matching `errors.Is(err, ErrPathNotFound)`; invalid JSON matches `ErrInvalidJSON`. The error may be the bare sentinel or a `JsonsError` wrapping it, so always test with `errors.Is`. For default-value fallback use a typed getter or `SafeGet` instead of branching on `Get`'s error.

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

Context-aware version of `Get`, supporting timeout and cancellation.

::: info Cancellation semantics: boundary-level checks
The Context is checked only **before the operation starts** and **after it finishes**, not during parsing or navigation:

- Already cancelled or timed out before the start: returns `ctx.Err()` directly (`context.Canceled` / `context.DeadlineExceeded`), with no parsing performed
- Timeout detected only after the operation completes: likewise returns `ctx.Err()`; even a successfully retrieved value is discarded
- This function therefore suits **guarding call boundaries**, avoiding wasted work on already-expired requests
- Parsing itself cannot be cut short mid-flight: for very large JSON documents a timeout does not bound the duration of a single parse
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

Type-safe getters fall back through the `defaultValue` variadic parameter: when the path does not exist, the value is null, or the conversion fails, `defaultValue` is returned; without one they return the zero value of the type. Their variadic parameter is taken by `defaultValue`, so they **do not accept a `Config`** and always use the default processor.

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

Generic get function supporting custom types. Returns `defaultValue` when the path does not exist, the value is null, or the conversion fails; without one it returns the zero value of `T`.

**Naming note**: `GetTyped[T]` means "get the JSON value and convert it to type `T`". This library exposes no GetAs-style generic alias; generic retrieval always goes through `GetTyped[T]`.

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

Performs a type-safe get and returns an `AccessResult`. When the path is missing, parsing fails, or the processor is unavailable, `Exists` is `false` and no error is returned. The result exposes `AsString`, `AsInt`, `AsFloat64`, and `AsBool` conversion methods.

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

Performs a type-safe get through a Processor instance; behaves the same as the package-level `SafeGet`.

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
- **Config support**: typed functions such as `GetString`/`GetInt`/`GetTyped[T]` **cannot take a Config**, because the variadic parameter is taken by `defaultValue` (Go allows only one variadic parameter per function); they always use the default processor. To customize security limits, validation, or caching per call, use `SafeGet(jsonStr, path, cfg)`; or create a dedicated Processor with `json.New(cfg)` and call its `GetString` and other methods.
- **Conversion leniency**: typed functions use lenient conversion (the string `"42"` becomes `int`, the boolean `true` becomes `1`). `SafeGet`'s `AsInt`/`AsFloat64` reject boolean input, and `AsString` requires the original value to already be a string; use `AsStringConverted` when you want explicit stringification.
- **Error semantics**: typed functions **silently fall back** to the default or zero value. `SafeGet` keeps both "does it exist" (`Exists`/`Ok()`) and "did the conversion fail" (the `AsInt`/`AsString` methods return an error), so the two cases can be handled separately.
:::

## Processor Extension Methods

The following methods are provided both as package-level functions and as Processor methods.

### GetMultiple (Package-Level Function)

Signature: `func GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

Batch-gets the values at multiple paths (package-level function — no Processor required).

**Return value semantics**

- The JSON is parsed only **once**, then each path is evaluated; repeated `Get` calls re-parse for every path
- The returned map is keyed by the **path string itself** (e.g. `"user.name"`), corresponding one-to-one with the input `paths`
- **Partial failure**: when a path fails, its key is `nil` in the map and the function returns the **first** error encountered (`map` and `err` are both non-nil); results of already-successful paths remain usable
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

Failures of `Get`/`GetWithContext` return sentinel errors checked with `errors.Is`. Typed getters (`GetString`, etc.) return no error and fall back to the zero value or default. Both a missing object key and an out-of-bounds array index map to `ErrPathNotFound`:

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"user": {"name": "Alice"}, "items": ["a", "b", "c"]}`

	// A missing key and an out-of-bounds index both return ErrPathNotFound
	if _, err := json.Get(data, "user.age"); errors.Is(err, json.ErrPathNotFound) {
		fmt.Println("path not found")
	}
	if _, err := json.Get(data, "items[10]"); errors.Is(err, json.ErrPathNotFound) {
		fmt.Println("index out of bounds")
	}

	// AsString on a non-string value wraps ErrTypeMismatch
	if _, err := json.SafeGet(`{"age": 30}`, "age").AsString(); errors.Is(err, json.ErrTypeMismatch) {
		fmt.Println("type mismatch: a number cannot become a string")
	}

	if _, err := json.Get(`{"name": }`, "name"); errors.Is(err, json.ErrInvalidJSON) {
		fmt.Println("input is not valid JSON")
	}
}
```

Indexing a string value (e.g. `name[0]`) returns a plain `JsonsError`: `errors.Is(err, ErrTypeMismatch)` is `false`, because type errors from `Get` do not wrap the sentinel. When you need "missing means default", use a typed getter or `SafeGet` rather than branching on `Get`'s error.

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
