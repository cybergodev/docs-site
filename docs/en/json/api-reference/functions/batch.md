---
sidebar_label: "Batch Operations"
title: "Batch Operation Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON batch operations: ProcessBatch runs multiple JSON ops at once using the BatchOperation descriptor and BatchResult struct for efficient bulk processing."
sidebar_position: 7
---

# Batch Operation Functions

The json package provides batch operation functions, supporting processing multiple JSON operations (get/set/delete/validate) at once for bulk data processing scenarios.

## Batch Operations

### ProcessBatch

Signature: `func ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

Batch processes multiple JSON operations (package-level function, no Processor required).

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

    operations := []json.BatchOperation{
        {Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
        {Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
    }

    results, err := json.ProcessBatch(operations)
    if err != nil {
        panic(err)
    }
    for _, r := range results {
        if r.Error != nil {
            fmt.Printf("Operation %s failed: %v\n", r.ID, r.Error)
        } else {
            fmt.Printf("Operation %s result: %v\n", r.ID, r.Result)
        }
    }
}
```

### BatchOperation

Batch operation descriptor structure.

```go
type BatchOperation struct {
    Type    string `json:"type"`     // Operation type: "get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // Target JSON string
    Path    string `json:"path"`     // Path expression
    Value   any    `json:"value"`    // Operation value (used for set operations)
    ID      string `json:"id"`       // Operation identifier
}
```

### BatchResult

Batch operation result structure.

```go
type BatchResult struct {
    ID     string `json:"id"`     // Operation identifier
    Result any    `json:"result"` // Operation result
    Error  error  `json:"error"`  // Error information
}
```

::: tip Processor Batch Method
The Processor instance provides an equivalent batch method `p.ProcessBatch(operations)` with the same signature as the package-level function, suitable for scenarios that reuse a Processor. See [Processor Batch Operations](../processor/batch).
:::

## See Also

- [Modify Functions](./modify) - Set, MergeJSON and other modify operations
- [Processor Batch Operations](../processor/batch) - Processor-level batch operation methods in detail
