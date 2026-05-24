---
title: "Processor Data Modification - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor data modification methods complete reference: Set path values, SetMultiple batch setting, Delete path removal, CreatePaths automatic intermediate path creation, all methods return modified JSON strings, supporting chained calls and CreatePaths configuration for automatic path creation."
---

# Data Modification Methods

Processor provides data modification methods. All methods return the modified JSON string.

## Set

Signature: `func (p *Processor) Set(jsonStr, path string, value any, cfg ...Config) (string, error)`

Sets the value at the specified path and returns the modified JSON string.

```go
result, err := p.Set(data, "user.name", "NewName")
```

Supports setting values of various types:

```go
// String
result, _ := p.Set(data, "user.name", "CyberGo")

// Number
result, _ := p.Set(data, "user.age", 25)

// Boolean
result, _ := p.Set(data, "user.active", true)

// Object
result, _ := p.Set(data, "user.profile", map[string]any{
    "bio": "Developer",
    "location": "China",
})

// Array
result, _ := p.Set(data, "items", []any{"a", "b", "c"})
```

## Delete

Signature: `func (p *Processor) Delete(jsonStr, path string, cfg ...Config) (string, error)`

Deletes the value at the specified path and returns the modified JSON string.

```go
result, err := p.Delete(data, "user.temporary")
```

## DeleteClean

Signature: `func (p *Processor) DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

Deletes the specified path and automatically cleans up null values and empty arrays.

```go
result, err := p.DeleteClean(data, "user.temporary")
// After deletion, null values and empty arrays are cleaned up
```

**Difference between Delete and DeleteClean**:

```go
// Original data: {"user": {"temp": "value", "name": "test"}}

// After Delete: {"user": {"name": "test"}}
result, _ := p.Delete(data, "user.temp")

// If the parent object becomes empty after deletion, DeleteClean continues cleanup
// {"user": {}} -> {}
result, _ := p.DeleteClean(data, "user.temp")
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

## See Also

- [Path Query](./query) - Get series methods
- [Batch Operations](./batch) - ProcessBatch batch processing
