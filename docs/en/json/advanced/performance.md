---
title: "Performance Optimization - CyberGo JSON | High Performance Guide"
description: "CyberGo JSON performance optimization guide: detailed coverage of caching strategies EnableCache/CacheTTL, parallel processing ParallelThreshold/MaxConcurrency, PreParse pre-parsing, WarmupCache warm-up, object pool reuse, and benchmark analysis for comprehensively improving high-frequency JSON processing performance."
---

# Performance Optimization

Strategies and techniques for optimizing JSON processing performance.

## Processor Reuse

### Reuse Processor Instances

```go
// Package-level functions automatically reuse the global Processor
for _, item := range dataList {
    val := json.GetString(item, "name")
}

// Or explicitly reuse instances (suitable for custom configuration)
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()
for _, item := range dataList {
    val := processor.GetString(item, "name")
}
```

## Memory Optimization

### Reduce Allocations

```go
// Use Marshal to return a byte slice
bytes, _ := json.Marshal(data)

// Use Encode to return a string
s, _ := json.Encode(data)
```

### Pre-allocate Buffers

```go
// Pre-allocate when processing large amounts of data
buf := make([]byte, 0, 1024*1024)
```

## File Processing

### Use Structured Iteration for Large Files

```go
// Bad: load everything at once
data, _ := os.ReadFile("large.json")
parsed, _ := json.ParseAny(string(data))

// Good: structured iteration (note: still loads the full file into memory)
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()
processor.ForeachFile("large.json", func(key any, item *json.IterableValue) error {
    processItem(item)
    return nil
})
```

### NDJSON Processing

```go
// Use StreamLinesInto for stream processing
file, _ := os.Open("data.jsonl")
defer file.Close()
entries, err := json.StreamLinesInto[LogEntry](file, func(lineNum int, entry LogEntry) error {
    // Process each JSON line
    return nil
})
```

## Concurrent Processing

### Parallel Array Processing

```go
items := json.GetArray(data, "items")

var wg sync.WaitGroup
sem := make(chan struct{}, runtime.NumCPU())

for _, item := range items {
    wg.Add(1)
    go func(item any) {
        defer wg.Done()
        sem <- struct{}{}
        defer func() { <-sem }()

        processItem(item)
    }(item)
}
wg.Wait()
```

### Using a Worker Pool

```go
pool := workerpool.New(10)

items := json.GetArray(data, "items")
for _, item := range items {
    item := item
    pool.Submit(func() {
        processItem(item)
    })
}

pool.StopWait()
```

## Configuration Optimization

### Adjust Configuration Based on Scenario

```go
// Small data: relaxed configuration
smallCfg := json.DefaultConfig()
smallCfg.MaxNestingDepthSecurity = 200 // Maximum allowed value (validation range 10-200)

// Untrusted input: security configuration
safeCfg := json.SecurityConfig()
safeCfg.MaxJSONSize = 1024 * 1024
```

### Disable Unnecessary Features

```go
// If you don't need Hooks, don't configure them
cfg := json.DefaultConfig() // Minimal configuration
```

## Caching Strategies

### Cache Parse Results

```go
var cache sync.Map

func getOrParse(key string, data []byte) (any, error) {
    if val, ok := cache.Load(key); ok {
        return val, nil
    }

    result, err := json.ParseAny(string(data))
    if err != nil {
        return nil, err
    }

    cache.Store(key, result)
    return result, nil
}
```

### Cache Path Queries

```go
// Pre-compile commonly used paths (using Processor)
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
path1, _ := p.CompilePath("user.name")
path2, _ := p.CompilePath("user.email")
path3, _ := p.CompilePath("items[*].id")
```

## Benchmarking

### Performance Testing Example

```go
func BenchmarkParse(b *testing.B) {
    data := []byte(`{"name": "test", "items": [1, 2, 3]}`)

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = json.ParseAny(string(data))
    }
}

func BenchmarkGetString(b *testing.B) {
    data := `{"user": {"name": "CyberGo", "email": "test@example.com"}}`

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        json.GetString(data, "user.name")
    }
}
```

### Memory Analysis

```go
func TestMemoryUsage(t *testing.T) {
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    before := m.Alloc

    // Execute operation
    data := generateLargeJSON()
    _, _ = json.ParseAny(data)

    runtime.ReadMemStats(&m)
    after := m.Alloc

    fmt.Printf("Memory usage: %d bytes\n", after-before)
}
```

## Performance Comparison

| Operation | Small Data (<1KB) | Medium Data (1MB) | Large Data (>10MB) |
|-----------|-------------------|-------------------|---------------------|
| `Parse` | Recommended | Recommended | Not recommended |
| `ForeachFile` | Unnecessary | Optional | Recommended |

## See Also

- [Large File Processing API](../api-reference/large-file)
- [Error Handling](./error-handling)
- [Large File Processing](../large-files)
