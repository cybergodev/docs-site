---
sidebar_label: "Basic Examples"
title: "Usage Examples - CyberGo JSON | Real-World Scenario Code"
description: "CyberGo JSON examples: path queries and edits, struct Marshal/Unmarshal, generic GetTyped, Processor reuse, iteration, JSONL, hooks, and Schema checks."
sidebar_position: 10
---

# Usage Examples

The examples below cover path queries and edits, struct encoding and decoding, Processors, iteration and parallelism, JSONL, hooks, Schema validation, and error handling. Each is a standalone `main` package.

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

	// Get an array
	tags := json.GetArray(data, "tags")
	fmt.Println("Tags:", tags)

	// Get an object
	profile := json.GetObject(data, "user.profile")
	fmt.Println("Profile:", profile)

	// Get with default values
	country := json.GetString(data, "user.profile.country", "Unknown")
	phone := json.GetString(data, "user.phone", "N/A")
	fmt.Printf("Country: %s, Phone: %s\n", country, phone)
}
```

### Batch-Getting Multiple Fields

One `GetMultiple` call parses the JSON once and retrieves every path; individual `Get` calls each redo the cache-key lookup:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{
        "order": {"id": 5001, "status": "shipped"},
        "customer": {"name": "Alice"},
        "total": 129.9
    }`

	values, err := json.GetMultiple(data, []string{
		"order.id", "order.status", "customer.name", "total",
	})
	if err != nil {
		panic(err)
	}

	fmt.Println("Order:", values["order.id"])
	fmt.Println("Status:", values["order.status"])
	fmt.Println("Customer:", values["customer.name"])
	fmt.Println("Total:", values["total"])
}

// Output:
// Order: 5001
// Status: shipped
// Customer: Alice
// Total: 129.9
```

:::tip Note
`GetMultiple` returns the error of the **first** failing path (failed paths are `nil` in the result map), so every path in this example must exist; to probe optional fields, use `GetString`/`GetInt` with defaults or [`SafeGet`](./examples-advanced) instead.
:::

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

	// Set multiple fields one at a time
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

## Struct Encoding and Decoding

### Basic Encoding/Decoding

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

type User struct {
	ID       int            `json:"id"`
	Name     string         `json:"name"`
	Email    string         `json:"email"`
	Active   bool           `json:"active"`
	Tags     []string       `json:"tags"`
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

	// Pretty-printed encoding
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

	// Read a nested value straight from the JSON string
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

	// With a default value
	defaultConfig := Config{Host: "127.0.0.1", Port: 3000}
	cfg := json.GetTyped[Config](data, ".", defaultConfig)
	fmt.Printf("Config: %+v\n", cfg)
}
```

## Using a Processor

### Basic Usage

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// Create a processor
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}`

	// Operate via the processor
	users := p.GetArray(data, "users")
	fmt.Println("Users:", users)

	// Pre-parse to speed up repeated queries
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
	"github.com/cybergodev/json"
	"time"
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

	// Handle untrusted input with the security configuration
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

### Cache Warm-Up

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

	// Large JSON data (kept small here; in practice it could be thousands of lines)
	largeJSON := `{
        "users": [{"id": 1}, {"id": 2}],
        "products": [{"sku": "A-1"}],
        "orders": [{"no": 1001}]
    }`

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

## Iteration and Traversal

### Iterating an Array

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

	// Iterate the array
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
		// Stop at the first value greater than 5
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

### Processing Arrays in Parallel

`ParallelIterator` has a built-in worker pool for parallel Map/Filter/ForEach over large arrays — no hand-written goroutines or semaphores:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"scores":[62,85,94,38,71,99,55,88]}`
	scores := json.GetArray(data, "scores")

	iter := json.NewParallelIterator(scores)
	defer iter.Close()

	// Parallel filter: keep only scores >= 80 (result preserves input order)
	passed := iter.Filter(func(_ int, v any) bool {
		return v.(float64) >= 80
	})
	fmt.Println("Top scores:", passed)

	// Parallel map: convert each score to a grade (result aligns with input)
	grades, err := iter.Map(func(_ int, v any) (any, error) {
		score := v.(float64)
		switch {
		case score >= 90:
			return "A", nil
		case score >= 80:
			return "B", nil
		default:
			return "C", nil
		}
	})
	if err != nil {
		panic(err)
	}
	fmt.Println("Grades:", grades)
}

// Output:
// Top scores: [85 94 99 88]
// Grades: [C B A C C A C B]
```

The worker count comes from `Config.MaxConcurrency` (default 50, automatically clamped to the array length); panics in callbacks are recovered and converted into returned errors — the process is never killed. For batching and cancellation see [Concurrency & Parallelism](../advanced/concurrency).

## JSONL Processing

### Reading a JSONL File

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
	"github.com/cybergodev/json"
	"strings"
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

`JSONLWriter` writes any Go value line by line as JSONL (NDJSON). `Write` encodes a single value and appends a newline, `WriteRaw` writes an already-encoded line (skipping the re-encode), and `Stats` returns line and byte counts:

```go
package main

import (
	"bytes"
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	var buf bytes.Buffer
	writer := json.NewJSONLWriter(&buf)

	// Write: encode a single value as one JSON line (newline appended automatically)
	if err := writer.Write(map[string]any{"id": 1, "name": "Alice"}); err != nil {
		panic(err)
	}
	if err := writer.Write(map[string]any{"id": 2, "name": "Bob"}); err != nil {
		panic(err)
	}

	// WriteRaw: write an already-encoded line (newline appended if missing)
	if err := writer.WriteRaw([]byte(`{"id":3,"name":"Charlie"}`)); err != nil {
		panic(err)
	}

	// To write to a file, replace bytes.Buffer with *os.File from os.Create
	stats := writer.Stats()
	fmt.Printf("Wrote %d lines, %d bytes in total\n", stats.LinesProcessed, stats.BytesWritten)
	fmt.Print(buf.String())
}

// Output:
// Wrote 3 lines, 72 bytes in total
// {"id":1,"name":"Alice"}
// {"id":2,"name":"Bob"}
// {"id":3,"name":"Charlie"}
```

Bulk data can go through one `WriteAll([]any{...})` call; the first error is cached, subsequent calls return it directly, and `writer.Err()` can be queried anytime.

## Streaming

### Streaming a Large JSON File

`ForeachFile` provides callback-based item-by-item traversal, but it loads the **entire file into memory** before iterating (this holds for the whole family, `ForeachFileChunked` included); for constant-memory processing of very large files use `StreamIterator` / `StreamObjectIterator` or the JSONL streaming family (see [Large File Handling](../streaming/large-files)).

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// Create a processor
	processor, err := json.New()
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	// Traverse the file's array item by item with ForeachFile
	// (the whole file is loaded into memory first; use StreamIterator for constant memory)
	count := 0
	err = processor.ForeachFile("large-array.json", func(key any, item *json.IterableValue) error {
		count++
		if count%1000 == 0 {
			fmt.Printf("Processed %d items...\n", count)
		}
		return nil // return item.Break() to interrupt
	})

	if err != nil {
		panic(err)
	}
	fmt.Printf("Total items: %d\n", count)
}
```

### Streaming an Object File

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

	// Process a JSON object file (key-value structure)
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
	"github.com/cybergodev/json"
	"log/slog"
	"os"
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
	"github.com/cybergodev/json"
	"time"
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

	// Run some operations
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
	// Define the schema
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

### Checking Error Types

```go
package main

import (
	"errors"
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"name": 42}`
	_, err := json.Get(data, "nonexistent.path")

	if err != nil {
		// Get errors come only from input problems: missing path, invalid JSON
		if errors.Is(err, json.ErrPathNotFound) {
			fmt.Println("path not found")
		} else if errors.Is(err, json.ErrInvalidJSON) {
			fmt.Println("invalid JSON")
		}

		// Detailed context
		var jsonErr *json.JsonsError
		if errors.As(err, &jsonErr) {
			fmt.Printf("op=%s path=%s\n", jsonErr.Op, jsonErr.Path)
		}
	}

	// A type mismatch surfaces through SafeGet's conversion methods (AsString wraps ErrTypeMismatch)
	if _, err := json.SafeGet(data, "name").AsString(); err != nil {
		if errors.Is(err, json.ErrTypeMismatch) {
			fmt.Println("type mismatch")
		}
	}
	// Output:
	// path not found
	// op=get path=nonexistent.path
	// type mismatch
}
```

### Safely Handling Untrusted Input

```go
package main

import (
	"errors"
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	// Use the security configuration
	cfg := json.SecurityConfig()
	// SecurityConfig already caps at 10MB by default; tighten to 1MB here
	cfg.MaxJSONSize = 1024 * 1024 // 1MB cap
	p, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// Simulate untrusted input
	// Real-world attacks can reach 100MB+; here 2MB and 50 levels demonstrate the limits.
	// Both malicious inputs below are structurally valid JSON and genuinely
	// trigger the size and depth limits respectively.
	untrustedInputs := []string{
		`{"data": "normal"}`,
		// Valid JSON string, but ~2MB in total, above the 1MB MaxJSONSize → ErrSizeLimit
		`{"huge": "` + strings.Repeat("a", 2*1024*1024) + `"}`,
		// Valid JSON, but nested 50 levels deep, above SecurityConfig's MaxNestingDepthSecurity (30) → ErrDepthLimit
		strings.Repeat(`{"a":`, 50) + "1" + strings.Repeat(`}`, 50),
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

// Output:
// Input 0 processed successfully
// Input 1 error: JSON validate_json_input failed: size 2097164 exceeds limit 1048576 (caused by: size limit exceeded)
// Input 2 error: JSON validate_nesting_depth failed: nesting depth 31 exceeds maximum 30 (caused by: depth limit exceeded)
```

## Utility Functions

### Comparing JSON

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	json1 := `{"a": 1, "b": 2}`
	json2 := `{"b": 2, "a": 1}` // different key order

	equal, err := json.CompareJSON(json1, json2)
	if err != nil {
		panic(err)
	}
	fmt.Println("Equal:", equal) // true (semantically equal)
}
```

### Comparing Configs for Semantic Equality

`CompareJSON` parses and normalizes before comparing: different key orders and numeric-notation differences like `3` vs `3.0` count as equal. Use it to decide "did the config really change" and avoid flagging formatting differences as changes:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	deployed := `{"port": 8080, "debug": false, "retries": 3}`
	// The same config re-serialized: keys shuffled, numbers rewritten as floats
	modified := `{
        "debug": false,
        "retries": 3.0,
        "port": 8080
    }`

	equal, err := json.CompareJSON(deployed, modified)
	if err != nil {
		panic(err)
	}
	fmt.Println("Configs semantically equal:", equal)
	// Output: Configs semantically equal: true

	// For configs from untrusted sources, attach the security configuration
	// (size/depth limits plus a security scan)
	equal, err = json.CompareJSON(deployed, modified, json.SecurityConfig())
	if err != nil {
		panic(err)
	}
	fmt.Println("Equal under security mode:", equal)
	// Output: Equal under security mode: true
}
```

### Merging JSON

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

### Deep Copy (encode then decode)

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

	// Deep copy: encode, then decode again
	var deepCopy map[string]any
	json.Unmarshal(copied, &deepCopy)

	// Mutating the copy does not affect the original
	deepCopy["name"] = "Bob"
	fmt.Println("Original:", data["name"]) // Alice
	fmt.Println("Copy:", deepCopy["name"]) // Bob
}
```

## More Examples

- [Advanced Examples](./examples-advanced) — batch encoding, field selection, pre-parsing, and compiled paths
