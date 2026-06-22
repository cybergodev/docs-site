---
title: "Getting Started - CyberGo JSON | 5-Minute Guide"
description: "CyberGo JSON quick start: install, GetString/GetInt queries, Marshal/Unmarshal, and file I/O. Master Go JSON in 5 minutes, fully standard-library compatible."
---

# Getting Started

This guide helps you quickly get started with the `github.com/cybergodev/json` library.

## Installation

```bash
go get github.com/cybergodev/json
```

## Basic Usage

### Package-Level Functions

The library provides a set of convenient package-level functions that can be used without creating a processor:

#### Getting Values

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "name": "CyberGo",
        "version": 1,
        "active": true,
        "price": 99.99,
        "tags": ["json", "go", "fast"],
        "meta": {"author": "dev"}
    }`

    // Generic get
    val, err := json.Get(data, "name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // CyberGo

    // Type-safe getters
    name := json.GetString(data, "name")
    version := json.GetInt(data, "version")
    active := json.GetBool(data, "active")
    price := json.GetFloat(data, "price")
    tags := json.GetArray(data, "tags")
    meta := json.GetObject(data, "meta")

    fmt.Println(name, version, active, price)
    fmt.Println(tags)  // [json go fast]
    fmt.Println(meta)  // map[author:dev]

    // Get with default values
    desc := json.GetString(data, "description", "N/A")
    count := json.GetInt(data, "count", 0)
    fmt.Println(desc, count) // N/A 0
}
```

#### Nested Paths

Supports dot-separated nested paths:

```go
data := `{"user": {"profile": {"name": "Alice"}}}`

name := json.GetString(data, "user.profile.name")
fmt.Println(name) // Alice
```

#### Array Indexing

Supports array index access:

```go
data := `{"items": ["a", "b", "c"]}`

// Both syntaxes are supported
item0 := json.GetString(data, "items.0")   // "a"
item1 := json.GetString(data, "items.1")   // "b"
last := json.GetString(data, "items.-1")   // "c"

// Bracket syntax
first := json.GetString(data, "items[0]")  // "a"
last2 := json.GetString(data, "items[-1]") // "c"

// Range slicing (returns array)
arr := json.GetArray(data, "items[0:2]")   // ["a", "b"]
```

::: tip More Path Syntax
Beyond basic property and array indexing, advanced syntax such as **array slicing** `[1:5]`, **wildcards** `[*]`, and **field extraction** `{name,email}` is also supported. See [Path Expression Syntax](./path-syntax) for details.
:::

#### Setting Values

```go
data := `{"name": "old"}`

// Set a new value
updated, _ := json.Set(data, "name", "new")
fmt.Println(updated) // {"name":"new"}

// Add a new field
updated, _ = json.Set(data, "version", 1)
fmt.Println(updated) // {"name":"old","version":1}

// Set multiple fields one by one
updated, _ = json.Set(data, "name", "updated")
updated, _ = json.Set(updated, "version", 2)
updated, _ = json.Set(updated, "active", true)
```

#### Deleting Values

```go
data := `{"name": "test", "temp": "remove"}`

// Delete a field
updated, _ := json.Delete(data, "temp")
fmt.Println(updated) // {"name":"test"}
```

### Encoding and Decoding

Fully compatible with the standard library:

```go
type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

// Encode
user := User{Name: "Alice", Age: 30}
bytes, _ := json.Marshal(user)
fmt.Println(string(bytes)) // {"name":"Alice","age":30}

// Pretty-print encoding
pretty, _ := json.MarshalIndent(user, "", "  ")
fmt.Println(string(pretty))
// {
//   "name": "Alice",
//   "age": 30
// }

// Decode
var u User
json.Unmarshal(bytes, &u)
fmt.Println(u.Name, u.Age) // Alice 30
```

### Validation

```go
valid := `{"key": "value"}`
invalid := `{key: value}`

fmt.Println(json.Valid([]byte(valid)))   // true
fmt.Println(json.Valid([]byte(invalid))) // false
```

### Formatting

```go
compact := `{"name":"test","nested":{"key":"value"}}`

// Pretty-print output
pretty, _ := json.Prettify(compact)
fmt.Println(pretty)
// {
//   "name": "test",
//   "nested": {
//     "key": "value"
//   }
// }

// Compact output
jsonStr := `{
  "name": "test"
}`
var buf bytes.Buffer
err := json.Compact(&buf, []byte(jsonStr))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

## Using Processor

For frequent operations, it is recommended to use `Processor` for better performance and caching:

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Create a processor with default configuration
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close() // Remember to close to release resources

    data := `{"name": "test", "value": 42}`

    // Use processor methods
    name := p.GetString(data, "name")
    value := p.GetInt(data, "value")

    fmt.Println(name, value)
}
```

## Configuration Options

```go
// Default configuration
cfg := json.DefaultConfig()

// Security-enhanced configuration (for untrusted input)
// cfg = json.SecurityConfig()

// Pretty-print configuration
// cfg = json.PrettyConfig()

// Custom configuration
cfg = json.DefaultConfig()
cfg.MaxJSONSize = 50 * 1024 * 1024 // 50MB
cfg.EnableCache = true
cfg.CacheTTL = 5 * time.Minute

// Create processor with custom configuration
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## Iteration

```go
data := `{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}`

err := json.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("User %v: %s (age %d)\n", key, name, age)
})
// User 0: Alice (age 30)
// User 1: Bob (age 25)
```

## Next Steps

- [Path Expression Syntax](./path-syntax) -- Learn the complete path query syntax
- [Large File Processing](./large-files) -- Process large JSON files
- [API Reference](./api-reference/) -- View the complete API reference
- [Usage Examples](./examples) -- Browse more practical examples
