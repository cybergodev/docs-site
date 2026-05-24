---
title: "Processor Batch Operations - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor batch operation methods complete reference: ProcessBatch batch processing, BatchOperation definitions, BatchResult type, error handling strategies and ContinueOnError configuration, supporting transactional batch operations and performance optimization."
---

# Batch Operation Methods

Processor provides batch operation capabilities to process multiple JSON operations at once.

## ProcessBatch

Signature: `func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

Batch processes multiple JSON operations.

```go
operations := []json.BatchOperation{
    {Type: "get", JSONStr: data, Path: "user.name", ID: "1"},
    {Type: "set", JSONStr: data, Path: "user.age", Value: 30, ID: "2"},
    {Type: "delete", JSONStr: data, Path: "user.temporary", ID: "3"},
}

results, err := processor.ProcessBatch(operations)
if err != nil {
    panic(err)
}

for _, result := range results {
    fmt.Printf("ID: %s, Result: %v\n", result.ID, result.Result)
}
```

## BatchOperation Struct

```go
type BatchOperation struct {
    Type    string  // Operation type: "get", "set", "delete", "validate"
    JSONStr string  // JSON string
    Path    string  // Target path
    Value   any     // Value for set operations
    ID      string  // Operation identifier
}
```

| Field | Type | Description |
|-------|------|-------------|
| `Type` | `string` | Operation type: `get`, `set`, `delete`, `validate` |
| `JSONStr` | `string` | JSON string to operate on |
| `Path` | `string` | Target path |
| `Value` | `any` | Value to set (for set operations) |
| `ID` | `string` | Operation identifier for matching results |

## BatchResult Struct

```go
type BatchResult struct {
    ID     string  // Corresponding operation ID
    Result any     // Operation result
    Error  error   // Error (if any)
}
```

| Field | Type | Description |
|-------|------|-------------|
| `ID` | `string` | Corresponds to BatchOperation's ID |
| `Result` | `any` | Operation result (Get returns value, Set/Delete returns new JSON) |
| `Error` | `error` | Error for individual operation (does not affect other operations) |

## Usage Examples

### Batch Read

```go
operations := []json.BatchOperation{
    {Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
    {Type: "get", JSONStr: data, Path: "user.email", ID: "email"},
    {Type: "get", JSONStr: data, Path: "user.age", ID: "age"},
}

results, _ := processor.ProcessBatch(operations)
for _, r := range results {
    fmt.Printf("%s: %v\n", r.ID, r.Result)
}
```

### Batch Modification

```go
operations := []json.BatchOperation{
    {Type: "set", JSONStr: data, Path: "status", Value: "active", ID: "1"},
    {Type: "set", JSONStr: data, Path: "updated_at", Value: time.Now().Unix(), ID: "2"},
    {Type: "delete", JSONStr: data, Path: "temp_field", ID: "3"},
}

results, _ := processor.ProcessBatch(operations)
```

### Mixed Operations

```go
operations := []json.BatchOperation{
    {Type: "validate", JSONStr: data, ID: "check"},
    {Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
    {Type: "set", JSONStr: data, Path: "processed", Value: true, ID: "mark"},
}

results, _ := processor.ProcessBatch(operations)

// Check validation result
for _, r := range results {
    if r.ID == "check" {
        if m, ok := r.Result.(map[string]any); ok {
            fmt.Printf("Validation result: %v\n", m["valid"])
        }
    }
}
```

## Notes

1. Each operation is executed independently; one failure does not affect other operations
2. Result order matches the operation order
3. Use ID to match operations with results

## See Also

- [Path Query](./query) - Get series methods
- [Data Modification](./modify) - Set/Delete methods
