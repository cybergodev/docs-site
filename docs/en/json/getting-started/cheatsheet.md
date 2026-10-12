---
sidebar_label: "Cheat Sheet"
title: "Cheat Sheet - CyberGo JSON | Common Functions & Examples"
description: "CyberGo JSON cheat sheet: all package functions — path queries, Set/Delete, batch operations, serialization, file I/O, validation, iteration, JSONL streaming."
sidebar_position: 50
---

# Cheat Sheet

Quickly find common APIs and code snippets.

## Path Queries

| Operation | Function | Example |
|-----------|----------|---------|
| Get a string | `GetString` | `json.GetString(data, "user.name")` |
| Get an integer | `GetInt` | `json.GetInt(data, "count")` |
| Get a float | `GetFloat` | `json.GetFloat(data, "price")` |
| Get a boolean | `GetBool` | `json.GetBool(data, "enabled")` |
| Get an array | `GetArray` | `json.GetArray(data, "items")` |
| Get an object | `GetObject` | `json.GetObject(data, "user")` |
| Get any value | `Get` | `json.Get(data, "items[0].id")` |
| Generic get | `GetTyped[T]` | `json.GetTyped[User](data, "user")` |
| Safe get (no panic) | `SafeGet` | `json.SafeGet(data, "user.age")` |
| Batch get | `GetMultiple` | `json.GetMultiple(data, []string{"a", "b"})` |
| Cancellable get | `GetWithContext` | `json.GetWithContext(ctx, data, "user.name")` |

### With Default Values

`GetString`, `GetInt`, `GetFloat`, `GetBool`, and friends accept an optional default-value parameter:

| Operation | Function | Example |
|-----------|----------|---------|
| String | `GetString` | `json.GetString(data, "name", "unknown")` |
| Integer | `GetInt` | `json.GetInt(data, "count", 0)` |
| Float | `GetFloat` | `json.GetFloat(data, "rate", 0.5)` |
| Boolean | `GetBool` | `json.GetBool(data, "debug", false)` |

## Modification Operations

| Operation | Function | Example |
|-----------|----------|---------|
| Set a value | `Set` | `json.Set(data, "user.name", "Alice")` |
| Batch set | `SetMultiple` | `json.SetMultiple(data, map[string]any{"a": 1, "b": 2})` |
| Set with path creation | `SetCreate` | `json.SetCreate(data, "a.b.c", 1)` |
| Batch set with path creation | `SetMultipleCreate` | `json.SetMultipleCreate(data, updates)` |
| Delete a value | `Delete` | `json.Delete(data, "user.temporary")` |
| Delete and clean up | `DeleteClean` | `json.DeleteClean(data, "user.temporary")` |

```go
// Set a value
result, err := json.Set(`{"user":{}}`, "user.name", "Alice")
// {"user":{"name":"Alice"}}

// Set multiple fields one at a time
result, err = json.Set(data, "user.name", "Bob")
result, err = json.Set(result, "user.age", 25)

// Delete
result, err = json.Delete(data, "user.temporary")
```

### Batch Operations (multiple operation kinds in one call)

```go
data := `{"user":{"name":"Alice","temp":true}}`

results, err := json.ProcessBatch([]json.BatchOperation{
    {ID: "n", Type: "get", JSONStr: data, Path: "user.name"},
    {ID: "a", Type: "set", JSONStr: data, Path: "user.age", Value: 30},
    {ID: "d", Type: "delete", JSONStr: data, Path: "user.temp"},
    {ID: "v", Type: "validate", JSONStr: data},
})
if err != nil {
    panic(err)
}
for _, r := range results {
    fmt.Println(r.ID, r.Result, r.Error)
}
```

::: tip
`BatchOperation.Type` supports the four kinds `get` / `set` / `delete` / `validate`, each operation carrying its data via `JSONStr`; `BatchResult` returns `Result` and `Error` keyed by `ID`. See [Batch Operations](../api-reference/functions/batch).
:::

## Serialization and Encoding

| Operation | Function | Example |
|-----------|----------|---------|
| Encode (`[]byte` output) | `Marshal` | `json.Marshal(data)` |
| Encode (`string` output) | `Encode` | `json.Encode(data)` |
| Pretty encoding (`[]byte`) | `MarshalIndent` | `json.MarshalIndent(data, "", "  ")` |
| Pretty encoding (`string`) | `EncodePretty` | `json.EncodePretty(data)` |
| Decode | `Unmarshal` | `json.Unmarshal(bytes, &v)` |
| Parse | `Parse` | `var v T; json.Parse(jsonStr, &v)` |
| Parse into any | `ParseAny` | `json.ParseAny(jsonStr)` |
| Pretty-print JSON text | `Prettify` | `json.Prettify(jsonStr)` |
| Compact JSON text (buffer) | `Compact` | `json.Compact(&buf, []byte(data))` |
| Compact JSON text (string) | `CompactString` | `json.CompactString(jsonStr)` |
| Re-indent | `Indent` | `json.Indent(&buf, src, "", "  ")` |
| HTML-escape | `HTMLEscape` | `json.HTMLEscape(&buf, src)` |
| Encode key-value pairs into an object | `EncodeBatch` | `json.EncodeBatch(map[string]any{"a": 1})` |
| Encode selected fields | `EncodeFields` | `json.EncodeFields(user, []string{"name"})` |
| Encode a value list into an array | `EncodeStream` | `json.EncodeStream([]any{1, 2})` |

`json.EncodeWithConfig` is deprecated (equivalent to `Encode`; retained within v1) — use `Encode` or `Marshal` in new code. For detailed formatting-function choices see [Formatted Output](./print).

```go
// Encode
b, err := json.Marshal(map[string]any{"name": "test"})

// Pretty output
pretty, err := json.MarshalIndent(data, "", "  ")

// Parse into a map
var result map[string]any
err = json.Parse(`{"name": "test"}`, &result)

// Parse into any
parsed, err := json.ParseAny(`{"name": "test"}`)

// Pretty-print a JSON string
pretty, err = json.Prettify(`{"name":"Alice","age":30}`)
```

## File Reading and Writing

| Operation | Function | Example |
|-----------|----------|---------|
| Read a JSON file as text | `LoadFromFile` | `json.LoadFromFile("config.json")` |
| Read from any Reader | `LoadFromReader` | `json.LoadFromReader(resp.Body)` |
| Write a value to a file | `SaveToFile` | `json.SaveToFile("out.json", data)` |
| Encode and write to a file | `MarshalToFile` | `json.MarshalToFile("out.json", v)` |
| Read a file and decode | `UnmarshalFromFile` | `json.UnmarshalFromFile("in.json", &v)` |
| Write a value to a Writer | `SaveToWriter` | `json.SaveToWriter(w, data)` |

```go
// Read and query
data, err := json.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
env := json.GetString(data, "env", "dev")

// One step into a struct
var cfg Config
if err := json.UnmarshalFromFile("config.json", &cfg); err != nil {
    panic(err)
}
```

::: tip
File paths go through security validation (rejecting directory traversal and symlink attacks); untrusted paths are intercepted too. See [File I/O](../api-reference/functions/file-io).
:::

## Validation

| Operation | Function | Example |
|-----------|----------|---------|
| Quick validation | `Valid` | `json.Valid([]byte(data))` |
| Validate and get the reason | `ValidWithConfig` | `json.ValidWithConfig(data)` |
| Schema validation | `ValidateSchema` | `json.ValidateSchema(data, schema)` |

```go
// Quick validation
if json.Valid([]byte(data)) {
    // Valid JSON
}

// When the failure reason is needed
ok, err := json.ValidWithConfig(data)
if !ok {
    fmt.Println("Invalid JSON:", err)
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
fmt.Println("Equal:", equal) // true (order and precision ignored)

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
// Create a processor
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// Get a value
result := processor.GetString(data, "user.profile.name")

// Safe get (returns an AccessResult)
accessResult := processor.SafeGet(data, "user.age")
age, err := accessResult.AsInt()
```

### Creating with Configuration

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

## Streaming

### Iteration Function Family

| Operation | Function | Characteristics |
|-----------|----------|-----------------|
| Traverse array/object | `Foreach` | Simplest; no error return |
| Traverse with interruption | `ForeachWithError` | Callback returns `error` / `item.Break()` |
| Traverse at a given path | `ForeachWithPath` | The explicit-path version of `Foreach(data, path, ...)` |
| Deep nested traversal | `ForeachNested` | Recurses all levels |
| Deep traversal with interruption | `ForeachNestedWithError` | The error-returning version of `ForeachNested` |
| Traverse and rewrite | `ForeachReturn` | Returns modified new JSON |
| Carries the current path | `ForeachWithPathAndIterator` | Callback gets `currentPath`; can break |
| Raw-value traversal control | `ForeachWithPathAndControl` | Callback receives raw values; `IteratorControl` steers the flow |
| Traverse large files | `ForeachFile` | Loads the whole file first; use StreamIterator for constant memory |
| Traverse a path inside a file | `ForeachFileWithPath` | Iterates the collection at a given path in the file (whole file loaded) |
| Chunked file traversal | `ForeachFileChunked` | Batched callbacks of `chunkSize` (file still fully loaded) |
| Recursive file traversal | `ForeachFileNested` | Recurses all nested structures in the file (whole file loaded) |

Twelve iteration functions in total: the first eight operate on JSON strings in memory, the last four (`ForeachFile*`) operate on files (loaded fully before iterating, bounded by the `MaxJSONSize` cap).

```go
data := `{"users":[{"name":"Alice"},{"name":"Bob"}]}`

// Simple traversal
err := json.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
    fmt.Println(key, item.GetString("name"))
})

// Use the WithError variant when early termination is needed
// (returning item.Break() interrupts)
err = json.ForeachWithError(data, "users", func(key any, item *json.IterableValue) error {
    if item.GetString("name") == "Bob" {
        return item.Break() // stop iterating
    }
    return nil
})
```

### Concurrent Processing (ParallelIterator)

```go
items, _ := json.GetArray(`[1,2,3,4,5,6]`, ".")
it := json.NewParallelIterator(items)

// Parallel map
doubled, err := it.Map(func(i int, v any) (any, error) {
    return v.(float64) * 2, nil
})

// Parallel filter / traversal (automatic batching)
_ = it.Filter(func(i int, v any) bool { return v.(float64) > 2 })
_ = it.ForEach(func(i int, v any) error { return nil })
```

### Streaming Iterators (StreamIterator / StreamObjectIterator)

```go
f, _ := os.Open("huge.json")
defer f.Close()

// Stream a large array element by element
it, err := json.NewStreamIterator(f)
if err != nil {
    panic(err)
}
for it.Next() {
    val := it.Value() // per-element processing, constant memory
    _ = val
    _ = it.Index()
}
if err := it.Err(); err != nil {
    panic(err) // parse errors encountered in the stream
}

// Stream a large object key by key
oit, err := json.NewStreamObjectIterator(f)
for oit.Next() {
    fmt.Println(oit.Key(), oit.Value())
}
```

### Processor.ForeachFile (large files)

```go
// Process a large file
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

err = processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    // Process the data item
    id := item.GetInt("id")
    name := item.GetString("name")
    return nil // return item.Break() to interrupt
})
```

### NDJSON/JSONL

```go
// Parse JSONL
results, err := json.ParseJSONL(jsonlBytes)

// Generic parsing (with StreamLinesInto)
file, _ := os.Open("data.jsonl")
defer file.Close()
users, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    return nil
})

// Streaming write
outputFile, _ := os.Create("output.jsonl")
defer outputFile.Close()
writer := json.NewJSONLWriter(outputFile)
_ = writer.Write(map[string]any{"name": "Alice"})
_ = writer.Write(map[string]any{"name": "Bob"})

// Multi-worker parallel line-by-line processing
err = json.StreamJSONLParallel(file, 4, func(lineNum int, item *json.IterableValue) error {
    return nil
})

// NDJSONProcessor: line numbers, per-object callbacks (deprecated; use the StreamJSONL family in new code)
np := json.NewNDJSONProcessor()
err = np.ProcessFile("events.ndjson", func(lineNum int, obj map[string]any) error {
    fmt.Println(lineNum, obj)
    return nil
})
```

## Configuration Options

```go
// Recommended: start from the default configuration and modify
cfg := json.DefaultConfig()
cfg.MaxJSONSize = 50 * 1024 * 1024 // Custom size limit (validation range 1MB-100MB; larger values are clamped back to 100MB)
cfg.FullSecurityScan = true        // Enable full security scanning
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
| `[start:end:step]` | Stepped slice | `items[0:10:2]` |
| `{field1,field2}` | Field extraction | `user{name,email}` |
| `{flat:field}` | Flat extraction | `groups{flat:tags}` |
| `[+]` | Append | `items[+]` |
| `[-1]` | Negative index (last) | `items[-1]` |
| `/key/key` | JSON Pointer (RFC 6901) | `/user/name` |

## Common Patterns

### Safely Getting Nested Values

```go
// Use getters with default values
name := json.GetString(data, "user.profile.name", "unknown")

// Use Get when error types must be distinguished
val, err := json.Get(data, "user.profile.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // Key does not exist
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // Malformed JSON
    }
    // Other errors (type conflicts, limit overruns) are contextual
    // JsonsError values — just log them
}
```

### Getting with Default Values

```go
// GetString/GetInt and friends accept an optional default parameter
timeout := json.GetInt(data, "timeout", 30)
debug := json.GetBool(data, "debug", false)
name := json.GetString(data, "user.nickname", "unknown")
```

### Type Assertion

```go
val, _ := json.Get(data, "value")
switch v := val.(type) {
case string:
    fmt.Println("string:", v)
case float64:
    fmt.Println("number:", v)
case bool:
    fmt.Println("boolean:", v)
case []any:
    fmt.Println("array:", len(v), "elements")
case map[string]any:
    fmt.Println("object:", len(v), "keys")
}
```

### Read File → Modify Field → Write Back

`Set` returns a new string, and `SaveToFile` parses a JSON string before encoding (no double quoting); combined with `PrettyConfig` the file stays readable:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data, err := json.LoadFromFile("config.json")
	if err != nil {
		panic(err)
	}

	updated, err := json.Set(data, "server.port", 8080)
	if err != nil {
		panic(err)
	}

	if err := json.SaveToFile("config.json", updated, json.PrettyConfig()); err != nil {
		panic(err)
	}
	fmt.Println("Updated")
}
```

### Batch Field Extraction from an API Response

A single field can be collected with a wildcard; multiple distinct paths go through `GetMultiple` (parses only once):

```go
resp := `{"code":0,"data":{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}}`

// Single field: collect with a wildcard
names, _ := json.GetArray(resp, "data.users[*].name") // ["Alice", "Bob"]

// Multiple distinct paths: one parse, batch retrieval
vals, err := json.GetMultiple(resp, []string{"code", "data.users[0].id"})
if err != nil {
    panic(err)
}
fmt.Println(names, vals["data.users[0].id"]) // [Alice Bob] 1
```

### Per-Element Rewriting (ForeachReturn)

Inside the callback, `item.GetData()` yields a reference to the working copy; mutating map/slice contents is reflected in the returned new JSON (`ForeachReturn` iterates the root container):

```go
data := `[{"name":"Alice","active":false},{"name":"Bob","active":false}]`

updated, err := json.ForeachReturn(data, func(key any, item *json.IterableValue) {
	m, ok := item.GetData().(map[string]any)
	if !ok {
		return
	}
	m["active"] = true
})
if err != nil {
	panic(err)
}
// Both elements' active becomes true (output field order may differ from the source)
```

::: tip Scalars cannot be replaced in place
The `GetData()` reference trick suits mutating map fields and array elements; when a whole element is a scalar it cannot be replaced in place via IterableValue — use `Set(data, "items[*]", v)` or per-item `Set` instead.
:::

### Config Merging

```go
// Default config + user config
defaults := `{"timeout": 30, "retries": 3}`
userConfig := `{"timeout": 60, "debug": true}`

merged, _ := json.MergeJSON(defaults, userConfig)
// {"timeout": 60, "retries": 3, "debug": true}
```

### Error Handling

```go
val, err := json.Get(data, path)
if err != nil {
    // Common sentinels: key missing / malformed JSON / size limit / depth limit
    // (type conflicts return a descriptive JsonsError, not the ErrTypeMismatch sentinel)
    switch {
    case errors.Is(err, json.ErrPathNotFound):
    case errors.Is(err, json.ErrInvalidJSON):
    case errors.Is(err, json.ErrSizeLimit):
    case errors.Is(err, json.ErrDepthLimit):
    default:
        // Log the full error (includes operation name and path)
        fmt.Println(err)
    }

    // When returning to a client, sanitize with SafeError to avoid leaking
    // paths and internal details
    _ = json.SafeError(err)
}
```

## Cache Management

```go
// Warm up the cache
paths := []string{"user.name", "user.email", "items[*].id"}
result, _ := json.WarmupCache(data, paths)
fmt.Printf("Warm-up succeeded: %d/%d\n", result.Successful, result.TotalPaths)

// Clear the cache
json.ClearCache()

// Get statistics
stats := json.GetStats()
fmt.Printf("Cache hit ratio: %.2f%%\n", stats.HitRatio * 100)

// Health check (per-item checks of cache, memory, etc.)
health := json.GetHealthStatus()
fmt.Println("Healthy:", health.Healthy)
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

// Every package-level function now uses this processor
name := json.GetString(data, "user.name")

// Clean up when the application exits
defer json.ShutdownGlobalProcessor()
```

## Security and Extensions

```go
// Dangerous-pattern management (<script>, javascript:, etc. blocked by default)
for _, p := range json.ListDangerousPatterns() {
    fmt.Println(p.Pattern, p.Level) // Pattern is substring matching; Level is the severity
}

// Register a custom pattern (substring match, three-level handling):
//   PatternLevelCritical always blocks / Warning blocks in strict mode / Info logs only
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "disable eval calls",
    Level:   json.PatternLevelCritical,
})

// Unregister by the Pattern string
json.UnregisterDangerousPattern("eval(")

// Hook factories: logging / timing / error transformation / input validation
p, _ := json.New()
p.AddHook(json.LoggingHook(slog.Default()))
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    return fmt.Errorf("op %s: %w", ctx.Operation, err)
}))
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    return nil // return non-nil to reject this input
}))

// Config chained methods
cfg := json.SecurityConfig()
cfg.AddHook(json.LoggingHook(slog.Default()))
cfg.AddDangerousPattern(json.DangerousPattern{Pattern: "exec("})
if err := cfg.Validate(); err != nil {
    panic(err) // Config self-check surfaces out-of-range values early
}
clone := cfg.Clone() // Deep copy, safe to share
```

## See Also

- [Package Functions](../api-reference/functions/) - Complete API reference
- [Utility Functions](../api-reference/helpers) - Type conversion utilities
- [Processor](../api-reference/processor/) - Processor methods
- [Config](../api-reference/config) - Configuration options
- [Type Definitions](../api-reference/types) - AccessResult, Schema, and more
