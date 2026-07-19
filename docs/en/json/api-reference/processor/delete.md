---
sidebar_label: "Delete Operations"
title: "Processor Delete Methods - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor delete methods: Delete removes a value at a path, DeleteClean removes and auto-cleans empty values and arrays, both chainable."
sidebar_position: 4
---

# Delete Methods

Processor provides methods to delete values at a path, returning the modified JSON string.

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

// DeleteClean also removes user.temp; here user still contains name and does not become empty
// Result: {"user": {"name": "test"}}
result, _ = p.DeleteClean(data, "user.temp")
```

## See Also

- [Modify](./modify) - Set/SetCreate chained modifications
- [Delete Functions](../functions/delete) - Package-level Delete functions
