---
sidebar_label: "Query & Get"
title: "Processor Path Queries - CyberGo JSON | Get/GetString Usage"
description: "CyberGo JSON Processor path queries: Get/GetString/GetInt, GetMultiple, SafeGet, GetTyped[T], CompilePath and JSONPath — ideal for extracting nested values."
sidebar_position: 20
---

# Path Query Methods

The Processor provides a variety of type-safe path query methods.

:::tip Mirror of the package-level functions
The methods on this page and the [package-level query functions](../functions/query) are two entry points to the same behavior: path syntax, return types, and error semantics are identical. This page focuses on the Processor-side configuration semantics and reuse patterns; for full function-level examples see the package-level page.
:::

## Basic Queries

### Get

Signature: `func (p *Processor) Get(jsonStr, path string, cfg ...Config) (result any, err error)`

Gets a value of any type from the specified path.

```go
val, err := p.Get(data, "items[0]")
if err != nil {
    panic(err)
}
```

### GetString

Signature: `func (p *Processor) GetString(jsonStr, path string, defaultValue ...string) string`

Gets a string value from the specified path. Returns the empty string or `defaultValue` when the path is missing, the value is null, or the conversion fails.

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
// Without a default value
name := p.GetString(data, "user.name")

// With a default value
email := p.GetString(data, "user.email", "unknown@example.com")
```

### GetInt

Signature: `func (p *Processor) GetInt(jsonStr, path string, defaultValue ...int) int`

Gets an integer value from the specified path. Returns 0 or `defaultValue` when the path is missing, the value is null, or the conversion fails.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `defaultValue` | `...int` | No | Optional default, returned when the path does not exist, the value is null, or the conversion fails |

**Returns**

| Return value | Type | Description |
|--------------|------|-------------|
| Single return value | `int` | The integer at the path (lenient conversion); the default when the path does not exist, the value is null, or the conversion fails (zero value `0` when no default is given) |

```go
count := p.GetInt(data, "count")
timeout := p.GetInt(data, "timeout", 30)
```

### GetFloat

Signature: `func (p *Processor) GetFloat(jsonStr, path string, defaultValue ...float64) float64`

Gets a float value from the specified path. Returns 0 or `defaultValue` when the path is missing, the value is null, or the conversion fails.

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
price := p.GetFloat(data, "price")
rate := p.GetFloat(data, "rate", 0.5)
```

### GetBool

Signature: `func (p *Processor) GetBool(jsonStr, path string, defaultValue ...bool) bool`

Gets a boolean value from the specified path. Returns false or `defaultValue` when the path is missing, the value is null, or the conversion fails.

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
enabled := p.GetBool(data, "enabled")
debug := p.GetBool(data, "debug", false)
```

:::tip Typed getters take no cfg
The variadic parameter of `GetString`/`GetInt` and other typed getters is the **default value**, not a `Config` (Go allows only one variadic parameter per function — one of the three official-design exceptions). For typed reads controlled by `Config`, build the processor with `New(cfg)` and call its `GetString`/`GetInt` typed methods, or use `SafeGet` + `AsInt()` conversion methods instead.
:::

### GetWithContext

Signature: `func (p *Processor) GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

Context-aware get by path. Supports timeout and cancellation — the context-aware version of `Get`.

::: info Note
The Context is checked before and after the operation, not during parsing/navigation. For very large JSON documents, cancellation may not be honored mid-operation.
:::

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

val, err := p.GetWithContext(ctx, data, "items[0].name")
if err != nil {
    panic(err)
}
fmt.Println(val)
```

## Safe Queries

### SafeGet

Signature: `func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Safely gets a value, returning the AccessResult struct. Suited to scenarios needing type conversion.

```go
result := p.SafeGet(data, "user.age")
if result.Ok() {
    age, err := result.AsInt()
    if err != nil {
        // Type conversion failed
    }
    fmt.Println(age)
}

// Other types can be fetched too
name, err := result.AsString()
price, err := result.AsFloat64()
enabled, err := result.AsBool()
```

**AccessResult methods**:

| Method | Description |
|--------|-------------|
| `Ok() bool` | Checks whether the value exists |
| `Unwrap() any` | Gets the raw value |
| `UnwrapOr(defaultValue any) any` | Gets the value or a default |
| `AsString() (string, error)` | Safely converts to a string |
| `AsStringConverted() (string, error)` | Format-converts to a string |
| `AsInt() (int, error)` | Safely converts to an integer |
| `AsFloat64() (float64, error)` | Safely converts to a float |
| `AsBool() (bool, error)` | Safely converts to a boolean |

## Collection Getters

### GetArray

Signature: `func (p *Processor) GetArray(jsonStr, path string, defaultValue ...[]any) []any`

Gets an array from the specified path. Returns nil or `defaultValue` when the path is missing, the value is null, or the conversion fails.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `defaultValue` | `...[]any` | No | Optional default, returned when the path does not exist, the value is null, or the conversion fails |

**Returns**

| Return value | Type | Description |
|--------------|------|-------------|
| Single return value | `[]any` | The array at the path (elements keep their parsed native types); the default when the path does not exist, the value is null, or the conversion fails (zero value `nil` when no default is given) |

```go
items := p.GetArray(data, "items")
tags := p.GetArray(data, "tags", []any{"default"})
```

### GetObject

Signature: `func (p *Processor) GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

Gets an object from the specified path. Returns nil or `defaultValue` when the path is missing, the value is null, or the conversion fails.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `defaultValue` | `...map[string]any` | No | Optional default, returned when the path does not exist, the value is null, or the conversion fails |

**Returns**

| Return value | Type | Description |
|--------------|------|-------------|
| Single return value | `map[string]any` | The object at the path; the default when the path does not exist, the value is null, or the conversion fails (zero value `nil` when no default is given) |

```go
profile := p.GetObject(data, "user.profile")
config := p.GetObject(data, "config", map[string]any{"timeout": 30})
```

## Generic Getters

:::tip Package-level function
`GetTyped[T]` is a package-level function, not a Processor method. See [Generic Operations](../generics#gettyped).
:::

```go
// Use the package-level GetTyped
user := json.GetTyped[User](data, "user")

// With a default value
user = json.GetTyped[User](data, "user", User{Name: "unknown"})
```

## Batch Queries

### GetMultiple

Signature: `func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

Gets the values at multiple paths in one call, returning a path-to-value mapping.

```go
results, err := p.GetMultiple(data, []string{"user.name", "user.age", "user.email"})
if err != nil {
    panic(err)
}
fmt.Println(results["user.name"]) // Alice
fmt.Println(results["user.age"])  // 30
```

## Compiled Paths

### CompilePath

Signature: `func (p *Processor) CompilePath(path string) (*CompiledPath, error)`

Pre-compiles a path expression for fast repeated operations later.

```go
cp, err := p.CompilePath("users[0].name")
if err != nil {
    panic(err)
}
defer cp.Release()

// Repeated queries with the compiled path
value, err := p.GetCompiled(data1, cp)
value, err = p.GetCompiled(data2, cp)
```

### GetCompiled

Signature: `func (p *Processor) GetCompiled(jsonStr string, cp *CompiledPath) (any, error)`

Gets a value using a pre-compiled path. Suited to repeatedly querying the same path across many JSON documents.

::: warning Two differences from Get
- **No per-call `cfg`**: input validation (size, depth, dangerous patterns) always follows the processor's own configuration.
- **No result-cache lookup**: what is saved is the path-parsing cost — the JSON itself is still parsed every time; to reuse parsing as well, combine with [`PreParse`](#preparse).
:::

**Full example: repeated queries on one path across a batch of documents**

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	cp, err := p.CompilePath("user.name")
	if err != nil {
		panic(err)
	}
	defer cp.Release()

	docs := []string{
		`{"user":{"name":"Alice"}}`,
		`{"user":{"name":"Bob"}}`,
	}
	for _, doc := range docs {
		name, err := p.GetCompiled(doc, cp)
		if err != nil {
			panic(err)
		}
		fmt.Println(name)
	}
}

// Output:
// Alice
// Bob
```

## Pre-Parsed Queries

### PreParse

Signature: `func (p *Processor) PreParse(jsonStr string, cfg ...Config) (*ParsedJSON, error)`

Pre-parses a JSON document and returns a reusable `*ParsedJSON`. Multiple queries on the same JSON parse only once; later queries just navigate.

```go
parsed, err := p.PreParse(largeJSON)
if err != nil {
    panic(err)
}
defer parsed.Release() // Release the parse-tree reference when done

// Multiple queries reuse the parse result
name, _ := p.GetFromParsed(parsed, "user.name")
email, _ := p.GetFromParsed(parsed, "user.email")
tags, _ := p.GetFromParsed(parsed, "tags")
```

### GetFromParsed

Signature: `func (p *Processor) GetFromParsed(parsed *ParsedJSON, path string, cfg ...Config) (any, error)`

Gets a value by path from the pre-parsed result, skipping the JSON-parsing step.

Container results (`map[string]any` / `[]any`) are defensively deep-copied before returning by default, while primitives return directly; when the processor enables `Config.CacheSharedResults` (callers promise not to mutate returned values), the copy is skipped. `GetFromParsed` itself **does not write the result cache** — what pre-parsing reuses is the parse tree itself, not query results.

**ParsedJSON methods**

| Method | Description |
|--------|-------------|
| `Data() any` | Gets the underlying parse result (`map[string]any` / `[]any`) |
| `Release()` | Nulls the internal data reference so the parse tree can be GC'd (afterwards `Data()` returns `nil`; use with `defer`) |

:::tip Division of labor with CompilePath
`PreParse` saves "repeated parsing of the same JSON"; `CompilePath` saves "repeated parsing of the same path"; `SetFromParsed` (see [Parse & Validate](./parse#setfromparsed)) supports chained modification on pre-parsed results. For how to choose, see the [Processor Guide](../../getting-started/processor-guide).
:::

## See Also

- [Data Modification](./modify) - Set/Delete methods
- [Batch Operations](./batch) - ProcessBatch batch processing
- [Generic Operations](../generics) - GetTyped[T] generic gets
