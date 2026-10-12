---
sidebar_label: "Advanced Examples"
title: "Advanced Examples - CyberGo JSON | Batch Encoding & Warmup"
description: "CyberGo JSON advanced examples: EncodeBatch, EncodeFields, PreParse, CompilePath, WarmupCache, and ProcessBatch to speed hot-path queries and batch encoding."
sidebar_position: 50
---

# Advanced Feature Examples

This document provides complete examples of advanced features: batch encoding, pre-parsing, hooks, advanced configuration, and more.

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

	// Batch-encode into a JSON object with EncodeBatch
	result, err := json.EncodeBatch(pairs)
	if err != nil {
		panic(err)
	}
	fmt.Println(result)

	// Pretty-printed output with EncodeBatch + PrettyConfig
	pretty, err := json.EncodeBatch(pairs, json.PrettyConfig())
	if err != nil {
		panic(err)
	}
	fmt.Println(pretty)
}
```

## Encoding Selected Fields

### EncodeFields

Encode only the specified fields of a struct — good for filtering sensitive information from API responses:

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

Pre-parse JSON to avoid repeated parsing and speed up multiple queries:

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

	// Pre-parse (parse once); Release when done to drop the parse-tree reference
	parsed, err := p.PreParse(largeJSON)
	if err != nil {
		panic(err)
	}
	defer parsed.Release()

	// Reuse the pre-parsed result across queries
	total, _ := p.GetFromParsed(parsed, "metadata.total")
	page, _ := p.GetFromParsed(parsed, "metadata.page")

	// Walk the users
	for i := 0; i < 3; i++ {
		path := fmt.Sprintf("users.%d.name", i)
		name, _ := p.GetFromParsed(parsed, path)
		fmt.Printf("User %d: %v\n", i, name)
	}

	fmt.Printf("Total: %v, Page: %v\n", total, page)
}
```

## Pre-Compiling Hot Paths

### CompilePath + GetCompiled

`PreParse` optimizes "many paths against one JSON"; conversely, when the **same path** queries many different JSONs (e.g. every request reads `user.name`), use `CompilePath` to pre-compile and reuse the path-parsing result, saving the per-call path parsing:

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

	// Simulate continuously arriving, distinct JSON documents
	docs := []string{
		`{"user":{"name":"Alice","age":28}}`,
		`{"user":{"name":"Bob","age":34}}`,
		`{"user":{"name":"Carol","age":25}}`,
	}

	// Compile once; the path-parsing result enters the global compiled cache;
	// Release when done
	cp, err := p.CompilePath("user.name")
	if err != nil {
		panic(err)
	}
	defer cp.Release()

	for _, doc := range docs {
		name, err := p.GetCompiled(doc, cp)
		if err != nil {
			panic(err)
		}
		fmt.Println("name =", name)
	}
}

// Output:
// name = Alice
// name = Bob
// name = Carol
```

:::tip Division of labor with PreParse
`GetCompiled` still runs input security validation and JSON parsing on every call — **what it saves is only the path parsing**. Choose by hotspot direction: repeated queries on one document → `PreParse`; repeated use of one path → `CompilePath`. `Set`/`Delete` currently have no Compiled variants; pre-compiled paths are query-only.
:::

## Safe Access

### SafeGet

Returns a structured result supporting chained calls and type conversion:

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

	// Safely get with type conversion
	ageResult := p.SafeGet(data, "user.age")
	if ageResult.Ok() {
		age, _ := ageResult.AsInt()
		fmt.Println("Age:", age)
	}

	// Safely get a boolean
	activeResult := p.SafeGet(data, "user.active")
	if activeResult.Ok() {
		active, _ := activeResult.AsBool()
		fmt.Println("Active:", active)
	}

	// A missing path does not panic
	emailResult := p.SafeGet(data, "user.email")
	fmt.Println("Email exists:", emailResult.Ok()) // false

	// Use a default value
	email := emailResult.UnwrapOr("N/A")
	fmt.Println("Email:", email)
}
```

## Cache Warm-Up

### WarmupCache

Warm up the cache of commonly used paths to speed up later queries:

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

	// Define the common paths
	commonPaths := []string{
		"products",
		"products.0.id",
		"products.0.name",
		"products.1.id",
		"products.1.name",
		"categories",
		"settings.currency",
	}

	// Warm up the cache
	result, err := p.WarmupCache(largeJSON, commonPaths)
	if err != nil {
		panic(err)
	}

	fmt.Printf("Warm-up complete: %d/%d succeeded\n", result.Successful, result.TotalPaths)
	if len(result.FailedPaths) > 0 {
		fmt.Println("Failed paths:", result.FailedPaths)
	}

	// Subsequent queries hit the cache
	for i := 0; i < 3; i++ {
		path := fmt.Sprintf("products.%d.name", i)
		name := p.GetString(largeJSON, path)
		fmt.Printf("Product %d: %s\n", i, name)
	}
}
```

## Batch Operations

### ProcessBatch

Execute multiple operations in one batch for efficiency:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}`

	// Define the batch operations (the ID identifies each operation in the results)
	operations := []json.BatchOperation{
		{ID: "get-name", Type: "get", Path: "users.0.name", JSONStr: data},
		{ID: "get-users", Type: "get", Path: "users", JSONStr: data},
		{ID: "set-name", Type: "set", Path: "users.0.name", Value: "Updated", JSONStr: data},
		{ID: "del-id", Type: "delete", Path: "users.0.id", JSONStr: data},
	}

	// Execute the batch
	results, err := json.ProcessBatch(operations)
	if err != nil {
		panic(err)
	}

	// Inspect the results
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

## Key/Value Memory Optimization

The library internally uses a string interning pool to automatically reduce memory used by repeated keys and values. No manual management needed.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// The library automatically interns repeated key/value strings
	// When processing large volumes, repeated string keys reuse memory
	records := make([]map[string]any, 10000)
	for i := range records {
		records[i] = map[string]any{
			"status": "active",
			"type":   "user",
			"role":   "member",
		}
	}

	// Memory is optimized internally during batch encoding
	result, _ := json.Marshal(map[string]any{
		"status": "active",
		"type":   "user",
	})

	fmt.Println("Sample:", string(result))
}
```

## Next Steps

- [Path Expression Syntax](../getting-started/path-syntax) — Complete path syntax reference
- [Large File Handling](../streaming/large-files) — Streaming guide
- [API Reference](../api-reference/) — Complete API reference
