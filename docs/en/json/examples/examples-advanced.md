---
sidebar_label: "Advanced Examples"
title: "Advanced Examples - CyberGo JSON | Advanced Usage"
description: "CyberGo JSON advanced examples: EncodeBatch, EncodeFields, PreParse, SafeGet, WarmupCache, and memory-pool techniques for production-grade Go performance."
sidebar_position: 2
---

# Advanced Examples

This document provides complete examples for advanced features such as batch encoding, pre-parsing, hooks, and advanced configuration.

## Batch Encoding

### EncodeBatch

Quickly encode multiple key-value pairs into a JSON object:

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Build JSON from scattered data
    pairs := map[string]any{
        "id":      1001,
        "name":    "Alice",
        "email":   "alice@example.com",
        "active":  true,
        "tags":    []string{"admin", "user"},
        "balance": 1250.50,
    }

    // Use EncodeBatch to batch-encode into a JSON object
    result, err := json.EncodeBatch(pairs)
    if err != nil {
        panic(err)
    }
    fmt.Println(result)

    // Use EncodeBatch with PrettyConfig for formatted output
    pretty, err := json.EncodeBatch(pairs, json.PrettyConfig())
    if err != nil {
        panic(err)
    }
    fmt.Println(pretty)
}
```

## Selective Field Encoding

### EncodeFields

Encode only specified fields of a struct, suitable for filtering sensitive information in API responses:

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type User struct {
    ID       int    `json:"id"`
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
    Salt     string `json:"salt"`
}

func main() {
    user := User{
        ID:       1,
        Name:     "Alice",
        Email:    "alice@example.com",
        Password: "secret123",
        Salt:     "randomsalt",
    }

    // Encode only public fields (excluding sensitive information)
    publicFields := []string{"id", "name", "email"}
    result, err := json.EncodeFields(user, publicFields)
    if err != nil {
        panic(err)
    }
    fmt.Println(result)
    // {"id":1,"name":"Alice","email":"alice@example.com"}
}
```

## Pre-Parse Optimization
### PreParse
Pre-parse JSON to avoid repeated parsing and improve performance for multiple queries:
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Large JSON data
    largeJSON := `{
        "users": [
            {"id": 1, "name": "Alice", "email": "alice@example.com"},
            {"id": 2, "name": "Bob", "email": "bob@example.com"},
            {"id": 3, "name": "Charlie", "email": "charlie@example.com"}
        ],
        "metadata": {
            "total": 3,
            "page": 1,
            "perPage": 10
        }
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Pre-parse (parse only once)
    parsed, err := p.PreParse(largeJSON)
    if err != nil {
        panic(err)
    }

    // Multiple queries reuse the pre-parsed result
    total, _ := p.GetFromParsed(parsed, "metadata.total")
    page, _ := p.GetFromParsed(parsed, "metadata.page")

    // Iterate over users
    for i := 0; i < 3; i++ {
        path := fmt.Sprintf("users.%d.name", i)
        name, _ := p.GetFromParsed(parsed, path)
        fmt.Printf("User %d: %v\n", i, name)
    }

    fmt.Printf("Total: %v, Page: %v\n", total, page)
}
```

## Safe Access
### SafeGet
Returns a structured result, supporting chained calls and type conversions:
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "user": {
            "id": 1001,
            "name": "Alice",
            "age": 28,
            "active": true,
            "balance": 1250.50
        }
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Safely get a single field
    nameResult := p.SafeGet(data, "user.name")
    if nameResult.Ok() {
        name, _ := nameResult.AsString()
        fmt.Println("Name:", name)
    }

    // Safely get and convert type
    ageResult := p.SafeGet(data, "user.age")
    if ageResult.Ok() {
        age, _ := ageResult.AsInt()
        fmt.Println("Age:", age)
    }

    // Safely get boolean value
    activeResult := p.SafeGet(data, "user.active")
    if activeResult.Ok() {
        active, _ := activeResult.AsBool()
        fmt.Println("Active:", active)
    }

    // Non-existent path does not panic
    emailResult := p.SafeGet(data, "user.email")
    fmt.Println("Email exists:", emailResult.Ok()) // false

    // Use default value
    email := emailResult.UnwrapOr("N/A")
    fmt.Println("Email:", email)
}
```

## Cache Warmup
### WarmupCache
Warm up caches for common paths to improve subsequent query performance:
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Large JSON data (simulated)
    largeJSON := `{
        "products": [
            {"id": 1, "name": "Product A", "price": 100},
            {"id": 2, "name": "Product B", "price": 200},
            {"id": 3, "name": "Product C", "price": 300}
        ],
        "categories": ["electronics", "books", "clothing"],
        "settings": {"currency": "USD", "taxRate": 0.1}
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Define common paths
    commonPaths := []string{
        "products",
        "products.0.id",
        "products.0.name",
        "products.1.id",
        "products.1.name",
        "categories",
        "settings.currency",
    }

    // Warm up cache
    result, err := p.WarmupCache(largeJSON, commonPaths)
    if err != nil {
        panic(err)
    }

    fmt.Printf("Warmup complete: %d/%d successful\n", result.Successful, result.TotalPaths)
    if len(result.FailedPaths) > 0 {
        fmt.Println("Failed paths:", result.FailedPaths)
    }

    // Subsequent queries will use cache
    for i := 0; i < 3; i++ {
        path := fmt.Sprintf("products.%d.name", i)
        name := p.GetString(largeJSON, path)
        fmt.Printf("Product %d: %s\n", i, name)
    }
}
```

## Batch Operations
### ProcessBatch
Execute multiple operations in batch to improve efficiency:
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}`

    // Define batch operations (ID identifies each operation in the results)
    operations := []json.BatchOperation{
        {ID: "get-name", Type: "get", Path: "users.0.name", JSONStr: data},
        {ID: "get-users", Type: "get", Path: "users", JSONStr: data},
        {ID: "set-name", Type: "set", Path: "users.0.name", Value: "Updated", JSONStr: data},
        {ID: "del-id", Type: "delete", Path: "users.0.id", JSONStr: data},
    }

    // Execute batch operations
    results, err := json.ProcessBatch(operations)
    if err != nil {
        panic(err)
    }

    // View results
    for _, r := range results {
        fmt.Printf("ID: %s\n", r.ID)
        if r.Error != nil {
            fmt.Printf("  Error: %v\n", r.Error)
        } else if r.Result != nil {
            fmt.Printf("  Value: %v\n", r.Result)
        }
    }
}
```

## Key-Value Memory Optimization

The library internally uses string interning to automatically optimize memory usage for repeated keys and values. No manual management is required.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // The library internally uses a memory pool for repeated keys and values
    // When processing large amounts of data, repeated string keys and values automatically reuse memory
    records := make([]map[string]any, 10000)
    for i := range records {
        records[i] = map[string]any{
            "status": "active",
            "type":   "user",
            "role":   "member",
        }
    }

    // During batch encoding, the library automatically optimizes memory
    result, _ := json.Marshal(map[string]any{
        "status": "active",
        "type":   "user",
    })

    fmt.Println("Sample:", string(result))
}
```

## Next Steps
- [Path Expression Syntax](../getting-started/path-syntax) — Complete path syntax reference
- [Large File Processing](../streaming/large-files) — Stream processing guide
- [API Reference](../api-reference/) — Complete API reference
