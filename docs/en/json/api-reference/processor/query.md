---
title: "Processor Path Query - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor path queries: Get/GetString/GetInt getters, GetMultiple batching, SafeGet with AccessResult, and GetTyped[T] with JSONPath."
---

# Path Query Methods

Processor provides multiple type-safe path query methods.

## Basic Query

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

Gets a string value from the specified path. Returns an empty string or `defaultValue` when the path does not exist, the value is null, or type conversion fails.

```go
// Without default value
name := p.GetString(data, "user.name")

// With default value
email := p.GetString(data, "user.email", "unknown@example.com")
```

### GetInt

Signature: `func (p *Processor) GetInt(jsonStr, path string, defaultValue ...int) int`

Gets an integer value from the specified path. Returns 0 or `defaultValue` when the path does not exist, the value is null, or type conversion fails.

```go
count := p.GetInt(data, "count")
timeout := p.GetInt(data, "timeout", 30)
```

### GetFloat

Signature: `func (p *Processor) GetFloat(jsonStr, path string, defaultValue ...float64) float64`

Gets a float value from the specified path. Returns 0 or `defaultValue` when the path does not exist, the value is null, or type conversion fails.

```go
price := p.GetFloat(data, "price")
rate := p.GetFloat(data, "rate", 0.5)
```

### GetBool

Signature: `func (p *Processor) GetBool(jsonStr, path string, defaultValue ...bool) bool`

Gets a boolean value from the specified path. Returns false or `defaultValue` when the path does not exist, the value is null, or type conversion fails.

```go
enabled := p.GetBool(data, "enabled")
debug := p.GetBool(data, "debug", false)
```


### GetWithContext

Signature: `func (p *Processor) GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

Path query with context. Supports timeout and cancellation. A context-aware version of `Get`.

::: info Note
Context is checked before and after operations, not during parsing/navigation. For large JSON documents, cancellation may not be responded to during the operation.
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

## Safe Query

### SafeGet

Signature: `func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Safely gets a value, returning an AccessResult struct. Suitable for scenarios requiring type conversion.

```go
result := p.SafeGet(data, "user.age")
if result.Ok() {
    age, err := result.AsInt()
    if err != nil {
        // Type conversion failed
    }
    fmt.Println(age)
}

// Also supports other types
name, err := result.AsString()
price, err := result.AsFloat64()
enabled, err := result.AsBool()
```

**AccessResult Methods**:

| Method | Description |
|--------|-------------|
| `Ok() bool` | Check if the value exists |
| `Unwrap() any` | Get the raw value |
| `UnwrapOr(defaultValue any) any` | Get value or default |
| `AsString() (string, error)` | Safe conversion to string |
| `AsStringConverted() (string, error)` | Format conversion to string |
| `AsInt() (int, error)` | Safe conversion to int |
| `AsFloat64() (float64, error)` | Safe conversion to float64 |
| `AsBool() (bool, error)` | Safe conversion to bool |

## Collection Getters

### GetArray

Signature: `func (p *Processor) GetArray(jsonStr, path string, defaultValue ...[]any) []any`

Gets an array from the specified path. Returns nil or `defaultValue` when the path does not exist, the value is null, or type conversion fails.

```go
items := p.GetArray(data, "items")
tags := p.GetArray(data, "tags", []any{"default"})
```

### GetObject

Signature: `func (p *Processor) GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

Gets an object from the specified path. Returns nil or `defaultValue` when the path does not exist, the value is null, or type conversion fails.

```go
profile := p.GetObject(data, "user.profile")
config := p.GetObject(data, "config", map[string]any{"timeout": 30})
```

## Generic Getter

::: tip Package-Level Function
`GetTyped[T]` is a package-level function, not a Processor method. See [Generics](../generics#gettyped) for details.
:::

```go
// Using package-level GetTyped
user := json.GetTyped[User](data, "user")

// With default value
user = json.GetTyped[User](data, "user", User{Name: "unknown"})
```

## Batch Query

### GetMultiple

Signature: `func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

Gets values at multiple paths at once, returning a path-to-value mapping.

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

Pre-compiles a path expression for subsequent fast repeated operations.

```go
cp, err := p.CompilePath("users[0].name")
if err != nil {
    panic(err)
}
defer cp.Release()

// Use compiled path for multiple queries
value, err := p.GetCompiled(data1, cp)
value, err = p.GetCompiled(data2, cp)
```

### GetCompiled

Signature: `func (p *Processor) GetCompiled(jsonStr string, cp *CompiledPath) (any, error)`

Gets a value using a pre-compiled path. Suitable for repeatedly querying the same path across multiple JSON strings.

```go
cp, _ := p.CompilePath("items[0].id")
defer cp.Release()

for _, jsonStr := range jsonStrings {
    id, err := p.GetCompiled(jsonStr, cp)
    if err != nil {
        continue
    }
    fmt.Println(id)
}
```

## See Also

- [Data Modification](./modify) - Set/Delete methods
- [Batch Operations](./batch) - ProcessBatch batch processing
- [Generics](../generics) - GetTyped[T] generic getter
