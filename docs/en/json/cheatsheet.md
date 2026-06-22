---
title: "Cheatsheet - CyberGo JSON | API Quick Reference"
description: "CyberGo JSON API cheatsheet: GetString/GetInt queries, Set/Delete, Marshal/Unmarshal, config, iterators, and security functions for quick Go lookup."
---

# Cheatsheet

Quick reference for commonly used APIs and code snippets.

## Path Queries

| Operation | Function | Example |
|-----------|----------|---------|
| Get string | `GetString` | `json.GetString(data, "user.name")` |
| Get integer | `GetInt` | `json.GetInt(data, "count")` |
| Get float | `GetFloat` | `json.GetFloat(data, "price")` |
| Get boolean | `GetBool` | `json.GetBool(data, "enabled")` |
| Get array | `GetArray` | `json.GetArray(data, "items")` |
| Get object | `GetObject` | `json.GetObject(data, "user")` |
| Get any value | `Get` | `json.Get(data, "items[0].id")` |
| Generic get | `GetTyped[T]` | `json.GetTyped[User](data, "user")` |

### With Default Values

`GetString`, `GetInt`, `GetFloat`, `GetBool`, and similar functions support an optional default value parameter:

| Operation | Function | Example |
|-----------|----------|---------|
| String | `GetString` | `json.GetString(data, "name", "unknown")` |
| Integer | `GetInt` | `json.GetInt(data, "count", 0)` |
| Float | `GetFloat` | `json.GetFloat(data, "rate", 0.5)` |
| Boolean | `GetBool` | `json.GetBool(data, "debug", false)` |

## Modify Operations

| Operation | Function | Example |
|-----------|----------|---------|
| Set value | `Set` | `json.Set(data, "user.name", "Alice")` |
| Batch set | `SetMultiple` | `json.SetMultiple(data, map[string]any{"a": 1, "b": 2})` |
| Set with path creation | `SetCreate` | `json.SetCreate(data, "a.b.c", 1)` |
| Batch set with path creation | `SetMultipleCreate` | `json.SetMultipleCreate(data, updates)` |
| Delete value | `Delete` | `json.Delete(data, "user.temporary")` |
| Delete and clean | `DeleteClean` | `json.DeleteClean(data, "user.temporary")` |

```go
// Set value
result, err := json.Set(`{"user":{}}`, "user.name", "Alice")
// {"user":{"name":"Alice"}}

// Set multiple fields one by one
result, err = json.Set(data, "user.name", "Bob")
result, err = json.Set(result, "user.age", 25)

// Delete
result, err = json.Delete(data, "user.temporary")
```

## Serialization

| Operation | Function | Example |
|-----------|----------|---------|
| Encode | `Marshal` | `json.Marshal(data)` |
| Pretty encode | `MarshalIndent` | `json.MarshalIndent(data, "", "  ")` |
| Decode | `Unmarshal` | `json.Unmarshal(bytes, &v)` |
| Parse | `Parse` | `var v T; json.Parse(jsonStr, &v)` |
| Parse to any | `ParseAny` | `json.ParseAny(jsonStr)` |
| Format | `Prettify` | `json.Prettify(jsonStr)` |
| Compact | `Compact` | `json.Compact(&buf, []byte(data))` |

```go
// Encode
b, err := json.Marshal(map[string]any{"name": "test"})

// Pretty-print output
pretty, err := json.MarshalIndent(data, "", "  ")

// Parse into struct
var result map[string]any
err = json.Parse(`{"name": "test"}`, &result)

// Parse to any
parsed, err := json.ParseAny(`{"name": "test"}`)

// Format JSON string
pretty, err = json.Prettify(`{"name":"Alice","age":30}`)
```

## Validation

| Operation | Function | Example |
|-----------|----------|---------|
| Quick validate | `Valid` | `json.Valid([]byte(data))` |

```go
// Quick validate
if json.Valid([]byte(data)) {
    // Valid JSON
}

// Schema validation
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name"},
    Properties: map[string]*json.Schema{
        "name": {Type: "string"},
        "age":  {Type: "number"},
    },
}
p, err := json.New()
if err != nil {
    panic(err)
}
errors, _ := p.ValidateSchema(data, schema)
```

## Utility Functions

| Operation | Function | Example |
|-----------|----------|---------|
| Compare | `CompareJSON` | `json.CompareJSON(a, b)` |
| Merge | `MergeJSON` | `json.MergeJSON(a, b)` |
| Merge many | `MergeMany` | `json.MergeMany([]string{s1, s2, s3})` |

```go
// Compare (ignoring key order and numeric precision)
equal, _ := json.CompareJSON(`{"a":1.0,"b":2}`, `{"b":2,"a":1}`)
fmt.Println("Equal:", equal) // true (ignoring order and precision)

// Merge JSON
base := `{"database":{"host":"localhost","port":5432},"debug":false}`
override := `{"database":{"host":"prod-server","ssl":true},"monitoring":true}`

// Merge
merged, _ := json.MergeJSON(base, override)
// Result: {"database":{"host":"prod-server","port":5432,"ssl":true},"debug":false,"monitoring":true}

// Merge many
result, _ := json.MergeMany([]string{
    `{"a":1}`,
    `{"b":2}`,
    `{"c":3}`,
})
```

## Processor Methods

```go
// Create processor
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// Get value
result := processor.GetString(data, "user.profile.name")

// Safe get (returns AccessResult)
accessResult := processor.SafeGet(data, "user.age")
age, err := accessResult.AsInt()
```

### Create with Configuration

```go
// Default configuration
processor, err := json.New(json.DefaultConfig())

// Security configuration (for untrusted input)
processor, err = json.New(json.SecurityConfig())

// Custom configuration
cfg := json.DefaultConfig()
cfg.CreatePaths = true
processor, err = json.New(cfg)
```

## Stream Processing

### Processor.ForeachFile (Large Files)

```go
// Process large files
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

err = processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    // Process data items
    id := item.GetInt("id")
    name := item.GetString("name")
    return nil // Return item.Break() to interrupt
})
```

### NDJSON/JSONL

```go
// Parse JSONL
results, err := json.ParseJSONL(jsonlBytes)

// Generic parsing (using StreamLinesInto)
file, _ := os.Open("data.jsonl")
defer file.Close()
users, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    return nil
})

// Stream write
outputFile, _ := os.Create("output.jsonl")
defer outputFile.Close()
writer := json.NewJSONLWriter(outputFile)
_ = writer.Write(map[string]any{"name": "Alice"})
_ = writer.Write(map[string]any{"name": "Bob"})
```

## Configuration Options

```go
// Recommended: modify based on default configuration
cfg := json.DefaultConfig()
cfg.MaxJSONSize = 200 * 1024 * 1024 // Custom size limit
cfg.FullSecurityScan = true          // Enable full security scan
```

### Configuration Presets

```go
// Default configuration
cfg := json.DefaultConfig()

// Security configuration (for untrusted input)
// cfg = json.SecurityConfig()

// Pretty-print configuration
// cfg = json.PrettyConfig()
```

## Path Syntax

| Syntax | Description | Example |
|--------|-------------|---------|
| `.property` | Property access | `user.name` |
| `[n]` | Array index | `items[0]` |
| `[*]` | Wildcard | `items[*].id` |
| `[start:end]` | Slice | `items[0:5]` |
| `[start:end:step]` | Slice with step | `items[0:10:2]` |
| `{field1,field2}` | Field extraction | `user{name,email}` |
| `[+]` | Append | `items[+]` |
| `[-1]` | Negative index (last) | `items[-1]` |

## Common Patterns

### Safely Getting Nested Values

```go
// Use getter functions with default values
name := json.GetString(data, "user.profile.name", "unknown")

// Use Get when you need to distinguish error types
val, err := json.Get(data, "user.profile.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // Path not found
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // Type mismatch
    }
}
```

### Getting with Default Values

```go
// GetString/GetInt etc. support optional default value parameter
timeout := json.GetInt(data, "timeout", 30)
debug := json.GetBool(data, "debug", false)
name := json.GetString(data, "user.nickname", "unknown")
```

### Type Assertion

```go
val, _ := json.Get(data, "value")
switch v := val.(type) {
case string:
    fmt.Println("String:", v)
case float64:
    fmt.Println("Number:", v)
case bool:
    fmt.Println("Boolean:", v)
case []any:
    fmt.Println("Array:", len(v), "elements")
case map[string]any:
    fmt.Println("Object:", len(v), "keys")
}
```

### Configuration Merging

```go
// Default configuration + user configuration
defaults := `{"timeout": 30, "retries": 3}`
userConfig := `{"timeout": 60, "debug": true}`

merged, _ := json.MergeJSON(defaults, userConfig)
// {"timeout": 60, "retries": 3, "debug": true}
```

### Error Handling

```go
val, err := json.Get(data, path)
if err != nil {
    // Check error type
    if errors.Is(err, json.ErrPathNotFound) {
        // Path not found
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // Invalid JSON format
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // Type mismatch
    }
}
```

## Cache Management

```go
// Warm up cache
paths := []string{"user.name", "user.email", "items[*].id"}
result, _ := json.WarmupCache(data, paths)
fmt.Printf("Warmup successful: %d/%d\n", result.Successful, result.TotalPaths)

// Clear cache
json.ClearCache()

// Get statistics
stats := json.GetStats()
fmt.Printf("Cache hit rate: %.2f%%\n", stats.HitRatio * 100)
```

## Global Processor

```go
// Set a custom global processor
cfg := json.SecurityConfig()
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
json.SetGlobalProcessor(p)

// All subsequent package-level functions use this processor
name := json.GetString(data, "user.name")

// Clean up on application exit
defer json.ShutdownGlobalProcessor()
```

## Related

- [Package Functions](./api-reference/functions) - Complete API reference
- [Helper Functions](./api-reference/helpers) - Type conversion utilities
- [Processor](./api-reference/processor/) - Processor methods
- [Configuration](./api-reference/config) - Configuration options
- [Type Definitions](./api-reference/types) - AccessResult, Schema, etc.
