---
sidebar_label: "Performance Optimization"
title: "Performance Optimization - CyberGo JSON | Zero-Allocation"
description: "CyberGo JSON performance: CompilePath pre-compiled paths, PreParse, object pools, ParallelThreshold parallelism, benchmarks, and GetStats hit ratios."
sidebar_position: 20
---

# Performance Optimization

JSON performance comes down to four levers: processor reuse, path pre-compilation, pre-parsing, and parallelism. The sections below give the signal for each mechanism, how to write the benchmarks, and the configuration file.

## Processor Reuse

### Reuse the Processor Instance

```go
// OK: package-level functions automatically reuse the global Processor
for _, item := range dataList {
    val := json.GetString(item, "name")
}

// OK: or reuse an instance explicitly (good for custom configuration)
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()
for _, item := range dataList {
    val := processor.GetString(item, "name")
}
```

## Built-in Performance Mechanisms

Know what the library already optimizes, and avoid reinventing the wheel:

| Mechanism | Effect | What you do |
|-----------|--------|-------------|
| Fast-path detection | Single-key property access (e.g. `name`, path with only letters/digits/underscores) is recognized via a lookup table; with the cache off it reads straight from the root object, bypassing the recursive processor | Nothing — automatic; with the cache on (default), such access is accelerated by the parse/result cache |
| FastEncoder | Reflection-free encoding of simple types (maps/slices/primitives) | Nothing — automatic |
| Result cache | Repeated queries of the same (JSON, path) hit the cache | On by default; tune `CacheTTL`/`MaxCacheSize` for scale |
| Object pools | Reuse of `IterableValue`, encoding buffers, Config, etc., reducing GC pressure | Return via `parsed.Release()` / `cp.Release()` |
| Compiled-path cache | Globally cached parse results for common paths | Use [`CompilePath`](../api-reference/processor/query#compilepath) for hot paths |

:::tip CacheSharedResults: the zero-copy switch for read-heavy workloads
With `Config.CacheSharedResults = true`, cache hits in `Get` return the shared value directly, **skipping the defensive deep copy** — repeated reads of a large subtree avoid one copy allocation per call. The contract: **callers must not mutate** the returned `map[string]any`/`[]any` (primitives are always safe). Off by default (copy-on-read); enable explicitly to match your workload.
:::

## Optimization Decision Path

When performance issues appear, proceed in a fixed order, letting **measurements** decide each step:

| Step | Technique | Signal it fits |
|------|-----------|----------------|
| 1. Measure first | Benchmarks + memory profiling (below), `GetStats()` for cache hit ratio | Before any optimization — no data, no direction |
| 2. Reuse | Package-level functions or a shared `Processor` instance (reuses cache and pools) | Per-request `json.New()`, frequent processor rebuilds |
| 3. Pre-compile paths | [`CompilePath`](../api-reference/processor/query#compilepath) + `GetCompiled` | The **same path** queried across many JSONs (path parsing becomes repeated overhead) |
| 4. Pre-parse | [`PreParse`](../api-reference/processor/query#preparse) + `GetFromParsed` | The **same JSON** queried at many paths in a row (repeated parsing is the hotspot) |
| 5. Parallelize | `NewParallelIterator` / `StreamJSONLParallel` (see [Concurrency](./concurrency)) | CPU-bound batch processing; many lines with heavy per-line work |

:::tip Measure before optimizing
The default configuration (cache on + object pools + fast paths) already covers most scenarios. Locate hotspots with benchmarks and confirm where the bottleneck belongs before reaching for the explicit optimizations in steps 3-5 — each trades some flexibility for speed. Small arrays (below the `ParallelThreshold` default of 10) run slower in parallel.
:::

## Memory Optimization

### Reduce Allocations

```go
// OK: use Marshal, which returns a byte slice
bytes, _ := json.Marshal(data)

// OK: use Encode, which returns a string
s, _ := json.Encode(data)
```

### Pre-allocate Buffers

```go
// Pre-allocate when processing large volumes
buf := make([]byte, 0, 1024*1024)
```

## File Processing

### Structured Iteration for Large Files

```go
// Not ideal: load everything at once
data, _ := os.ReadFile("large.json")
parsed, _ := json.ParseAny(string(data))

// OK: structured iteration (note: the whole file still loads into memory)
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
// Stream with StreamLinesInto
file, _ := os.Open("data.jsonl")
defer file.Close()
entries, err := json.StreamLinesInto[LogEntry](file, func(lineNum int, entry LogEntry) error {
    // Process each JSON line
    return nil
})
```

## Concurrent Processing

### Prefer the Built-in ParallelIterator

The library ships a parallel iterator that spares you hand-written semaphores and goroutine pools, batches automatically, and supports cancellation:

```go
items, _ := json.GetArray(data, "items")
it := json.NewParallelIterator(items)
defer it.Close()

// Parallel map
doubled, err := it.Map(func(i int, v any) (any, error) {
    return processItem(v), nil
})

// Or parallel traversal / filtering (WithContext variants respond to cancellation)
_ = it.ForEach(func(i int, v any) error { return nil })
_ = it.ForEachWithContext(ctx, func(i int, v any) error { return nil })
filtered := it.Filter(func(i int, v any) bool { return v != nil })
```

### When you need full control: a hand-rolled Worker Pool

```go
items := json.GetArray(data, "items")
jobs := make(chan any, len(items))

// Start a fixed number of workers, reusing goroutines to avoid churn
var wg sync.WaitGroup
workers := runtime.NumCPU()
for w := 0; w < workers; w++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        for item := range jobs {
            processItem(item)
        }
    }()
}

// Distribute tasks, then close the channel to signal workers to exit
for _, item := range items {
    jobs <- item
}
close(jobs)
wg.Wait()
```

:::tip Parallel thresholds
`Config.ParallelThreshold` (default 10) sets the lower bound for the library's internal parallel paths; the JSONL parallel worker count comes from the `workers` argument of `StreamJSONLParallel(reader, workers, ...)` — `Config.JSONLWorkers` is not read. See [Concurrency](./concurrency).
:::

## Configuration Tuning

### Adjust Configuration per Scenario

```go
// Small payloads: lenient configuration
smallCfg := json.DefaultConfig()
smallCfg.MaxNestingDepthSecurity = 200 // Maximum allowed (validation range 10-200)

// Untrusted input: security configuration
safeCfg := json.SecurityConfig()
safeCfg.MaxJSONSize = 1024 * 1024
```

### Disable Unneeded Features

```go
// If you don't need Hooks, don't configure any
cfg := json.DefaultConfig() // Minimal configuration
```

## Caching Strategies

### Caching Parse Results

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

### Caching Path Queries

```go
// Pre-compile common paths (with a Processor)
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
path1, _ := p.CompilePath("user.name")
path2, _ := p.CompilePath("user.email")
path3, _ := p.CompilePath("items[*].id")
```

## Benchmarks

### Performance Test Examples

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

### A/B Comparison of Optimizations

The most reliable way to verify an optimization is to write "before / after" as a pair of benchmarks. `b.ReportAllocs()` outputs `B/op` and `allocs/op` alongside; run with `go test -bench=. -benchmem`:

```go
// Baseline: repeated Get (each with its own cache-key lookup + navigation)
func BenchmarkRepeatGet(b *testing.B) {
    data := `{"user": {"name": "CyberGo"}, "items": [1, 2, 3]}`
    b.ReportAllocs()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = json.Get(data, "user.name")
        _, _ = json.Get(data, "items")
    }
}

// Candidate optimization: PreParse once, GetFromParsed for each query
func BenchmarkPreParse(b *testing.B) {
    data := `{"user": {"name": "CyberGo"}, "items": [1, 2, 3]}`
    p, err := json.New()
    if err != nil {
        b.Fatal(err)
    }
    defer p.Close()

    b.ReportAllocs()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        parsed, err := p.PreParse(data)
        if err != nil {
            b.Fatal(err)
        }
        _, _ = p.GetFromParsed(parsed, "user.name")
        _, _ = p.GetFromParsed(parsed, "items")
        parsed.Release()
    }
}
```

:::tip Reading the results
Compare `ns/op` and `allocs/op` across the two benchmarks: if the pre-parse benchmark is clearly lower, the hotspot's cost is dominated by repeated parsing/cache-key lookup and pre-parsing is worth adopting; if the gap is negligible, continue down the [optimization decision path](#optimization-decision-path) to the next layer (e.g. encoding, lock contention).
:::

### Memory Profiling

```go
func TestMemoryUsage(t *testing.T) {
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    before := m.Alloc

    // Perform operations
    data := generateLargeJSON()
    _, _ = json.ParseAny(data)

    runtime.ReadMemStats(&m)
    after := m.Alloc

    fmt.Printf("Memory usage: %d bytes\n", after-before)
}
```

## Running Your Own Benchmarks

Performance conclusions depend on data shape and hardware, so no specific numbers are quoted here — measure on your own workload instead. The library's `benchmark_test.go` covers hot-path comparisons against `encoding/json` (the fast encoder, path-based `Get`, array slicing, field extraction) plus scenarios such as `StreamIterator` streaming, `PreParse` pre-parsing, and concurrent `Get`/`Set`/`Marshal`:

```bash
# Run the full benchmark suite with allocation stats from the library source root
go test -run='^$' -bench=. -benchmem ./...
```

- `-benchmem` reports bytes and counts allocated per operation (`B/op`, `allocs/op`), which together with `ns/op` drive API choices;
- the comparison groups are named `BenchmarkStdLib_*` / `BenchmarkComparison_*` and can be compared directly with same-scenario benchmarks such as `BenchmarkFastEncoder_*`;
- for choosing APIs by data size (e.g. `ForeachFile` for the 10-100MB full-load range, `StreamIterator` for larger files) see the [large-file selection guide](../streaming/large-files#selection-guide).

## See Also

- [Large File Handling](../streaming/large-files)
- [Error Handling](./error-handling)
