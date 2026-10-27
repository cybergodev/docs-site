---
sidebar_label: "Query & Get"
title: "Processor Path Queries - CyberGo JSON | Get/GetString Usage"
description: "Processor path queries: Get/GetString/GetInt typed reads, SafeGet, GetMultiple batch reads, plus CompilePath pre-compilation and PreParse parsed-tree reuse."
sidebar_position: 20
---

# Path Query Methods

Path syntax, return types and error semantics match the [package-level query functions](../functions/query); the difference is where configuration comes from. Without `cfg` the processor's baked configuration applies; with `cfg` that call's configuration applies.

:::tip Mirror of the package-level functions
`Get`, `GetString`, `SafeGet` and `GetMultiple` share their source with the package-level query functions one by one; see the package-level page for function-level examples.
:::

## Basic Queries

### Get

Signature: `func (p *Processor) Get(jsonStr, path string, cfg ...Config) (result any, err error)`

Gets a value of any type from the specified path. A missing object key and an out-of-range array index both return an error wrapping `ErrPathNotFound`, testable with `errors.Is(err, json.ErrPathNotFound)`. When you need "missing means default", use the typed getters or `SafeGet` instead of the `Get` error branch.

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
The variadic parameter of `GetString`/`GetInt` and the other typed getters is the **default value**, not a `Config` (Go allows only one variadic parameter per function). For typed reads under a specific `Config`, build the processor with `New(cfg)` and call its typed methods, or use `SafeGet` plus the `AsInt()`-style conversion methods.
:::

### GetWithContext

Signature: `func (p *Processor) GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

Context-aware get by path — the context-aware version of `Get`.

::: info Cancellation only happens before and after the operation
`GetWithContext` checks `ctx.Done()` once before calling `Get` and once after it returns. Parsing and path navigation never check the context.

- Already cancelled or timed out on entry: it returns `ctx.Err()` immediately and runs no query.
- Timed out during the operation: `Get` still runs to completion, its result is discarded, and `ctx.Err()` is returned.
- When `Get` itself fails, that error is returned without a further context check.

A context timeout therefore **cannot** cut short a single parse or a single query.
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

Safely gets a value, returning the `AccessResult` struct. Use it when you need to test existence first and convert afterwards; a missing path and an out-of-range array index both return `Exists=false`.

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

:::tip Only AsString wraps ErrTypeMismatch
When conversion fails, `AccessResult.AsString()` returns an error matching `errors.Is(err, ErrTypeMismatch)`. `AsInt()`, `AsFloat64()` and `AsBool()` return plain errors on failure, so `errors.Is` does not match that sentinel. Check `Ok()` first, then handle each method's error.
:::

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

Gets the values at multiple paths in one call, returning a path-to-value map. A failing path yields a `nil` entry and the first error is returned, while the remaining paths are still evaluated.

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

Pre-compiles a path expression for repeated `GetCompiled` calls. Repeated paths hit a global compile cache; call `cp.Release()` when done to return it to the pool, after which the `cp` must not be used.

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

Gets a value using a pre-compiled path. Suits repeatedly querying the same path across many JSON documents.

::: warning Two differences from Get
- **No per-call `cfg`**: input validation (size, depth, dangerous patterns) always follows the processor's own configuration.
- **No result-cache lookup**: what is saved is path parsing; the JSON passed in is still parsed every time. To reuse parsing as well, use [`PreParse`](#preparse) + `GetFromParsed`.
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

Pre-parses a JSON document and returns a reusable `*ParsedJSON`. Repeated queries on the same JSON parse only once; later queries navigate the tree. `Data()` returns that cached tree, so do not mutate it; use `SetFromParsed` for changes.

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

Container results (`map[string]any` / `[]any`) are defensively deep-copied before returning by default, while primitives return directly; when the processor enables `Config.CacheSharedResults` (callers promise not to mutate returned values), the copy is skipped. `GetFromParsed` itself **does not write the result cache**: pre-parsing reuses the parse tree, not query results.

**ParsedJSON methods**

| Method | Description |
|--------|-------------|
| `Data() any` | Gets the underlying parse result (`map[string]any` / `[]any`) |
| `Release()` | Nulls the internal data reference so the parse tree can be GC'd (afterwards `Data()` returns `nil`; use with `defer`) |

:::tip Division of labor with CompilePath
`PreParse` saves repeated parsing of the same JSON; `CompilePath` saves repeated parsing of the same path. `SetFromParsed` (see [Parse & Validate](./parse#setfromparsed)) continues modifying pre-parsed results. For how to choose, see the [Processor Guide](../../getting-started/processor-guide).
:::

## See Also

- [Data Modification](./modify) - Set/Delete methods
- [Batch Operations](./batch) - ProcessBatch batch processing
- [Generic Operations](../generics) - GetTyped[T] generic gets
