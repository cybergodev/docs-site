---
sidebar_label: "Basic Examples"
title: "Usage Examples - CyberGo JSON | Practical Code Examples"
description: "CyberGo JSON examples: path queries, struct Marshal/Unmarshal, JSONL streaming, Hook callbacks, Schema validation, and error handling with runnable Go code."
sidebar_position: 1
---

# Usage Examples

This document provides practical code examples for the `github.com/cybergodev/json` library.

## Basic Operations

### Path Queries

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
            "email": "alice@example.com",
            "active": true,
            "profile": {
                "age": 28,
                "city": "Beijing"
            }
        },
        "tags": ["go", "json", "dev"],
        "scores": [95, 88, 92]
    }`

    // Simple path
    name := json.GetString(data, "user.name")
    fmt.Println("Name:", name)

    // Nested path
    city := json.GetString(data, "user.profile.city")
    age := json.GetInt(data, "user.profile.age")
    fmt.Printf("City: %s, Age: %d\n", city, age)

    // Array index
    firstTag := json.GetString(data, "tags.0")
    firstScore := json.GetInt(data, "scores.0")
    fmt.Printf("First tag: %s, First score: %d\n", firstTag, firstScore)

    // Get array
    tags := json.GetArray(data, "tags")
    fmt.Println("Tags:", tags)

    // Get object
    profile := json.GetObject(data, "user.profile")
    fmt.Println("Profile:", profile)

    // Get with default value
    country := json.GetString(data, "user.profile.country", "Unknown")
    phone := json.GetString(data, "user.phone", "N/A")
    fmt.Printf("Country: %s, Phone: %s\n", country, phone)
}
```

### Modifying JSON

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"name": "old", "version": 1}`

    // Modify a single value
    updated, _ := json.Set(data, "name", "new")
    fmt.Println("After set:", updated)

    // Add a new field
    updated, _ = json.Set(updated, "active", true)
    fmt.Println("After add:", updated)

    // Set multiple fields one by one
    updated, _ = json.Set(updated, "version", 2)
    updated, _ = json.Set(updated, "author", "CyberGo")
    updated, _ = json.Set(updated, "tags", []string{"json", "go"})
    fmt.Println("After batch:", updated)

    // Delete a field
    updated, _ = json.Delete(updated, "author")
    fmt.Println("After delete:", updated)

    // Nested modification
    nested := `{"config": {"database": {"host": "localhost"}}}`
    nested, _ = json.Set(nested, "config.database.host", "192.168.1.1")
    nested, _ = json.Set(nested, "config.database.port", 3306)
    fmt.Println("Nested:", nested)
}
```

## Struct Encoding & Decoding

### Basic Encoding & Decoding

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type User struct {
    ID       int      `json:"id"`
    Name     string   `json:"name"`
    Email    string   `json:"email"`
    Active   bool     `json:"active"`
    Tags     []string `json:"tags"`
    Metadata map[string]any `json:"metadata,omitempty"`
}

func main() {
    user := User{
        ID:     1001,
        Name:   "Alice",
        Email:  "alice@example.com",
        Active: true,
        Tags:   []string{"go", "json"},
        Metadata: map[string]any{
            "role":  "admin",
            "level": 5,
        },
    }

    // Encode
    data, err := json.Marshal(user)
    if err != nil {
        panic(err)
    }
    fmt.Println("Encoded:", string(data))

    // Pretty-print encode
    pretty, _ := json.MarshalIndent(user, "", "  ")
    fmt.Println("Pretty:\n", string(pretty))

    // Decode
    var decoded User
    err = json.Unmarshal(data, &decoded)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Decoded: %+v\n", decoded)
}
```

### Nested Structs

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type Address struct {
    City    string `json:"city"`
    Country string `json:"country"`
}

type Profile struct {
    Age     int     `json:"age"`
    Address Address `json:"address"`
}

type UserWithProfile struct {
    ID      int     `json:"id"`
    Name    string  `json:"name"`
    Profile Profile `json:"profile"`
}

func main() {
    user := UserWithProfile{
        ID:   1,
        Name: "Bob",
        Profile: Profile{
            Age: 30,
            Address: Address{
                City:    "Shanghai",
                Country: "China",
            },
        },
    }

    data, _ := json.MarshalIndent(user, "", "  ")
    fmt.Println(string(data))

    // Get nested value directly from JSON string
    city := json.GetString(string(data), "profile.address.city")
    fmt.Println("City:", city)
}
```

## Generic API

### GetTyped

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type Config struct {
    Host string `json:"host"`
    Port int    `json:"port"`
    TLS  struct {
        Enabled  bool   `json:"enabled"`
        CertPath string `json:"cert_path"`
    } `json:"tls"`
}

func main() {
    data := `{
        "host": "localhost",
        "port": 8080,
        "tls": {
            "enabled": true,
            "cert_path": "/etc/certs/server.crt"
        }
    }`

    // Generic decode
    config := json.GetTyped[Config](data, ".")
    fmt.Printf("Config: %+v\n", config)

    // With default value
    defaultConfig := Config{Host: "127.0.0.1", Port: 3000}
    cfg := json.GetTyped[Config](data, ".", defaultConfig)
    fmt.Printf("Config: %+v\n", cfg)
}
```

## Using Processor

### Basic Usage

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Create processor
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    data := `{"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}`

    // Use processor methods
    users := p.GetArray(data, "users")
    fmt.Println("Users:", users)

    // Pre-parse to accelerate multiple queries
    parsed, _ := p.PreParse(data)
    for i := 0; i < 2; i++ {
        name, _ := p.GetFromParsed(parsed, fmt.Sprintf("users.%d.name", i))
        fmt.Printf("User %d: %v\n", i, name)
    }
}
```

### Custom Configuration

```go
package main

import (
    "fmt"
    "time"
    "github.com/cybergodev/json"
)

func main() {
    // Custom configuration
    cfg := json.DefaultConfig()
    cfg.EnableCache = true
    cfg.CacheTTL = 10 * time.Minute
    cfg.MaxJSONSize = 50 * 1024 * 1024 // 50MB
    cfg.CreatePaths = true

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Use security configuration for untrusted input
    secureCfg := json.SecurityConfig()
    secureP, err := json.New(secureCfg)
    if err != nil {
        panic(err)
    }
    defer secureP.Close()

    untrusted := `{"input": "<script>alert('xss')</script>"}`
    result := secureP.GetString(untrusted, "input")
    fmt.Println("Sanitized:", result)
}
```

### Cache Warmup

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

    // Large JSON data
    largeJSON := `{"users": [...], "products": [...], "orders": [...]}`

    // Warm up common paths
    commonPaths := []string{
        "users",
        "users.0.id",
        "products",
        "orders",
    }

    result, err := p.WarmupCache(largeJSON, commonPaths)
    if err != nil {
        panic(err)
    }

    fmt.Printf("Warmup complete: %d/%d paths cached\n",
        result.Successful, result.TotalPaths)
    if len(result.FailedPaths) > 0 {
        fmt.Println("Failed paths:", result.FailedPaths)
    }
}
```

## Iteration

### Iterating Arrays

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "users": [
            {"id": 1, "name": "Alice", "score": 95},
            {"id": 2, "name": "Bob", "score": 88},
            {"id": 3, "name": "Charlie", "score": 92}
        ]
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Iterate array
    p.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
        id := item.GetInt("id")
        name := item.GetString("name")
        score := item.GetFloat64("score")
        fmt.Printf("User %d: %s (score: %.1f)\n", id, name, score)
    })
}
```

### Iteration with Control Flow

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"numbers": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    sum := 0
    p.ForeachWithPathAndControl(data, "numbers", func(key any, value any) json.IteratorControl {
        // Stop when encountering a value greater than 5
        if num, ok := value.(float64); ok {
            if num > 5 {
                return json.IteratorBreak
            }
            sum += int(num)
        }
        return json.IteratorNormal
    })
    fmt.Println("Sum of numbers <= 5:", sum) // 1+2+3+4+5 = 15
}
```

### Checking Field Existence

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "users": [
            {"name": "Alice", "email": "alice@example.com"},
            {"name": "Bob"},
            {"name": "Charlie", "email": "charlie@example.com", "phone": "123-456"}
        ]
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    p.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
        name := item.GetString("name")
        email := item.GetString("email")
        phone := item.GetString("phone")

        fmt.Printf("User: %s\n", name)
        if item.Exists("email") {
            fmt.Printf("  Email: %s\n", email)
        }
        if item.Exists("phone") {
            fmt.Printf("  Phone: %s\n", phone)
        }
        if item.IsNull("nickname") {
            fmt.Println("  No nickname")
        }
    })
}
```

## JSONL Processing

### Reading JSONL Files

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

    err = p.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
        fmt.Printf("Line %d: %v\n", lineNum, item.GetData())
        return nil
    })

    if err != nil {
        fmt.Println("Error:", err)
    }
}
```

### Generic JSONL Processing

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

type LogEntry struct {
    Timestamp string `json:"timestamp"`
    Level     string `json:"level"`
    Message   string `json:"message"`
}

func main() {
    jsonlData := `{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":"Started"}
{"timestamp":"2024-01-01T10:00:01Z","level":"DEBUG","message":"Processing"}
{"timestamp":"2024-01-01T10:00:02Z","level":"ERROR","message":"Failed"}`

    reader := strings.NewReader(jsonlData)

    entries, err := json.StreamLinesInto[LogEntry](reader, func(lineNum int, entry LogEntry) error {
        fmt.Printf("[%s] %s: %s\n", entry.Level, entry.Timestamp, entry.Message)
        return nil
    })

    if err != nil {
        panic(err)
    }
    fmt.Printf("Processed %d entries\n", len(entries))
}
```

### Writing JSONL

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, err := os.Create("output.jsonl")
    if err != nil {
        panic(err)
    }
    defer file.Close()

    writer := json.NewJSONLWriter(file)

    data := []any{
        map[string]any{"id": 1, "name": "Alice"},
        map[string]any{"id": 2, "name": "Bob"},
        map[string]any{"id": 3, "name": "Charlie"},
    }

    err = writer.WriteAll(data)
    if err != nil {
        panic(err)
    }

    fmt.Println("JSONL file written successfully")
}
```

## Stream Processing

### Streaming Large JSON

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Create processor
    processor, err := json.New()
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // Use ForeachFile to stream-process large files
    count := 0
    err = processor.ForeachFile("large-array.json", func(key any, item *json.IterableValue) error {
        count++
        if count%1000 == 0 {
            fmt.Printf("Processed %d items...\n", count)
        }
        return nil // Return item.Break() to interrupt
    })

    if err != nil {
        panic(err)
    }
    fmt.Printf("Total items: %d\n", count)
}
```

### Streaming Objects

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    processor, err := json.New()
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // Process JSON object file (key-value structure)
    // File format: {"user1": {...}, "user2": {...}, ...}
    err = processor.ForeachFile("config-map.json", func(key any, item *json.IterableValue) error {
        name := item.GetString("name")
        fmt.Printf("Key: %s, Name: %s\n", key, name)
        return nil
    })

    if err != nil {
        panic(err)
    }
}
```

## Hook System

### Logging Hook

```go
package main

import (
    "fmt"
    "log/slog"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

    cfg := json.DefaultConfig()
    cfg.AddHook(json.LoggingHook(logger))

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    data := `{"name": "test"}`
    name := p.GetString(data, "name")
    fmt.Println("Name:", name)
}
```

### Timing Hook

```go
package main

import (
    "fmt"
    "time"
    "github.com/cybergodev/json"
)

type TimingRecorder struct {
    records map[string]time.Duration
}

func (r *TimingRecorder) Record(op string, duration time.Duration) {
    r.records[op] = duration
}

func main() {
    recorder := &TimingRecorder{records: make(map[string]time.Duration)}

    cfg := json.DefaultConfig()
    cfg.AddHook(json.TimingHook(recorder))

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Perform some operations
    data := `{"users": [{"id": 1}, {"id": 2}]}`
    for i := 0; i < 100; i++ {
        p.Get(data, "users")
    }

    fmt.Println("Timing records:", recorder.records)
}
```

### Custom Validation Hook

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    cfg.AddHook(json.ValidationHook(func(jsonStr, path string) error {
        // Custom validation logic
        if len(jsonStr) > 10000 {
            return fmt.Errorf("JSON too large")
        }
        return nil
    }))

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    data := `{"name": "test"}`
    val, err := p.Get(data, "name")
    if err != nil {
        fmt.Println("Validation error:", err)
    } else {
        fmt.Println("Value:", val)
    }
}
```

## Schema Validation

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Define Schema
    schema := &json.Schema{
        Type:     "object",
        Required: []string{"name", "email"},
        Properties: map[string]*json.Schema{
            "name": {
                Type:      "string",
                MinLength: 1,
                MaxLength: 100,
            },
            "email": {
                Type:   "string",
                Format: "email",
            },
            "age": {
                Type:    "number",
                Minimum: 0,
                Maximum: 150,
            },
            "tags": {
                Type:     "array",
                MinItems: 1,
                Items: &json.Schema{
                    Type: "string",
                },
            },
        },
    }

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    validJSON := `{"name": "Alice", "email": "alice@example.com", "age": 25}`
    invalidJSON := `{"name": "", "email": "invalid"}`

    errors, _ := p.ValidateSchema(validJSON, schema)
    if len(errors) == 0 {
        fmt.Println("Valid JSON")
    } else {
        for _, e := range errors {
            fmt.Printf("Error at %s: %s\n", e.Path, e.Message)
        }
    }

    errors, _ = p.ValidateSchema(invalidJSON, schema)
    for _, e := range errors {
        fmt.Printf("Error at %s: %s\n", e.Path, e.Message)
    }
}
```

## Error Handling

### Error Type Checking

```go
package main

import (
    "errors"
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"name": "test"}`
    _, err := json.Get(data, "nonexistent.path")

    if err != nil {
        // Check error type
        if errors.Is(err, json.ErrPathNotFound) {
            fmt.Println("Path not found")
        } else if errors.Is(err, json.ErrInvalidJSON) {
            fmt.Println("Invalid JSON")
        } else if errors.Is(err, json.ErrTypeMismatch) {
            fmt.Println("Type mismatch")
        }

        // Get detailed error information
        var jsonErr *json.JsonsError
        if errors.As(err, &jsonErr) {
            fmt.Printf("Op: %s, Path: %s\n", jsonErr.Op, jsonErr.Path)
        }
    }
}
```

### Safely Handling Untrusted Input

```go
package main

import (
    "errors"
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Use security configuration
    cfg := json.SecurityConfig()
    // SecurityConfig defaults to a 10MB limit; further restrict to 1MB here
    cfg.MaxJSONSize = 1024 * 1024 // 1MB limit
    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Simulate untrusted input
    // Note: actual attacks may attempt much larger payloads (e.g., 100MB+)
    // Security configuration will block input exceeding MaxJSONSize
    untrustedInputs := []string{
        `{"data": "normal"}`,
        `{"huge": "` + string(make([]byte, 2*1024*1024)) + `"}`, // 2MB input (exceeds 1MB limit)
        `{"nested": {{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}`, // Too deeply nested
    }

    for i, input := range untrustedInputs {
        _, err := p.Get(input, "data")
        if err != nil {
            if errors.Is(err, json.ErrSecurityViolation) {
                fmt.Printf("Input %d blocked: security violation\n", i)
            } else {
                fmt.Printf("Input %d error: %v\n", i, err)
            }
        } else {
            fmt.Printf("Input %d processed successfully\n", i)
        }
    }
}
```

## Utility Functions

### JSON Comparison

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    json1 := `{"a": 1, "b": 2}`
    json2 := `{"b": 2, "a": 1}` // Different key order

    equal, err := json.CompareJSON(json1, json2)
    if err != nil {
        panic(err)
    }
    fmt.Println("Equal:", equal) // true (semantically equal)
}
```

### JSON Merging

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    json1 := `{"a": 1, "b": {"x": 10}}`
    json2 := `{"b": {"y": 20}, "c": 3}`

    // Merge
    merged, _ := json.MergeJSON(json1, json2)
    fmt.Println("Merged:", merged)
    // {"a":1,"b":{"x":10,"y":20},"c":3}

    // Merge many
    result, _ := json.MergeMany([]string{
        `{"a":1}`,
        `{"b":2}`,
        `{"d": 4}`,
    })
    fmt.Println("Merged many:", result)
}
```

### Deep Copy (Encode then Decode)

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := map[string]any{
        "name": "Alice",
        "tags": []string{"go", "json"},
        "meta": map[string]any{
            "level": 5,
        },
    }

    copied, err := json.Marshal(data)
    if err != nil {
        panic(err)
    }

    // Deep copy: encode then decode
    var deepCopy map[string]any
    json.Unmarshal(copied, &deepCopy)

    // Modifying the copy does not affect the original
    deepCopy["name"] = "Bob"
    fmt.Println("Original:", data["name"]) // Alice
    fmt.Println("Copy:", deepCopy["name"]) // Bob
}
```

## More Examples

- [Advanced Examples](./examples-advanced) — Batch encoding, pre-parsing, hook system, and other advanced features
