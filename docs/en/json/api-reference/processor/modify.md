---
sidebar_label: "Modify"
title: "Processor Data Modification - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor modify methods: Set, SetMultiple batching, SetCreate auto-path creation, SetMultipleCreate batch creation, all supporting chained calls."
sidebar_position: 3
---

# Data Modification Methods

Processor provides data modification methods. All methods return the modified JSON string. Deletion methods are documented in [Delete Operations](./delete).

## Set

Signature: `func (p *Processor) Set(jsonStr, path string, value any, cfg ...Config) (result string, err error)`

Sets the value at the specified path and returns the modified JSON string.

```go
result, err := p.Set(data, "user.name", "NewName")
```

Supports setting values of various types:

```go
// String
result, _ := p.Set(data, "user.name", "CyberGo")

// Number
result, _ = p.Set(data, "user.age", 25)

// Boolean
result, _ = p.Set(data, "user.active", true)

// Object
result, _ = p.Set(data, "user.profile", map[string]any{
    "bio": "Developer",
    "location": "China",
})

// Array
result, _ = p.Set(data, "items", []any{"a", "b", "c"})
```

## SetMultiple

Signature: `func (p *Processor) SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

Batch sets values at multiple paths and returns the modified JSON string.

```go
result, err := p.SetMultiple(data, map[string]any{
    "user.name": "CyberGo",
    "user.age":  25,
    "user.active": true,
})
```

## SetCreate

Signature: `func (p *Processor) SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

Sets a value and automatically creates intermediate paths that don't exist. Equivalent to `Set` with `Config.CreatePaths = true`.

```go
// Intermediate path user.profile is automatically created if it doesn't exist
result, err := p.SetCreate(data, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

## SetMultipleCreate

Signature: `func (p *Processor) SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

Batch sets multiple values and automatically creates intermediate paths.

```go
result, err := p.SetMultipleCreate(data, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

## Chained Modifications

Modification methods support chained calls:

```go
processor, _ := json.New()

result1, _ := processor.Set(data, "user.name", "CyberGo")
result2, _ := processor.Set(result1, "user.version", "1.0.0")
finalResult, _ := processor.Delete(result2, "user.temporary")
```

## Processor Merge Methods

Processor provides instance methods corresponding to the package-level [MergeJSON](../functions/modify#mergejson), [MergeMany](../functions/modify#mergemany), and [CompareJSON](../helpers#comparejson).

### Processor.MergeJSON

Signature: `func (p *Processor) MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

Resolves options from `cfg` (**when `cfg` is omitted it uses `DefaultConfig`, not the processor's own configuration** — if the processor was created with a custom `MergeMode`, you must pass `cfg` explicitly to apply that mode), deeply merges the two objects according to `Config.MergeMode`, then re-encodes the result with this processor.

Like the package-level function, `Processor.MergeJSON` performs no security validation — it is a structural tool that only decodes, deep-merges, and re-encodes. When security validation is required, use `CompareJSON` (which always performs security validation; per `cfg` when passed, otherwise per the processor's own configuration).

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Union merge (default)
result, err := p.MergeJSON(base, override)

// Intersection merge
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err = p.MergeJSON(base, override, cfg)
```

### Processor.MergeMany

Signature: `func (p *Processor) MergeMany(jsons []string, cfg ...Config) (string, error)`

Folds the slice from left to right via `MergeJSON`; the merge strategy is determined by `Config.MergeMode` (default `MergeUnion`). Returns an error when fewer than 2 JSON strings are provided, and returns an error carrying the failing index if any merge step fails.

```go
result, err := p.MergeMany([]string{config1, config2, config3})
```

### Processor.CompareJSON

Signature: `func (p *Processor) CompareJSON(json1, json2 string, cfg ...Config) (bool, error)`

Compares two JSON strings for equality (number normalization, key-order independent).

::: warning Difference from package-level CompareJSON
The package-level `CompareJSON` performs no security validation when called without `cfg` and marshals both sides with `encoding/json`; the Processor method **always** performs security validation (per `cfg` when passed, otherwise per the processor's own configuration) and symmetrically marshals both sides with the library encoder, so configured encoding (such as `EscapeHTML`) applies symmetrically.
:::

```go
equal, err := p.CompareJSON(a, b)
equal, err = p.CompareJSON(a, b, json.SecurityConfig())
```

## See Also

- [Path Query](./query) - Get series methods
- [Delete Operations](./delete) - Delete/DeleteClean methods
- [Batch Operations](./batch) - ProcessBatch batch processing
