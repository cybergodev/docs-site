---
sidebar_label: "Processor Guide"
title: "Processor Guide - CyberGo JSON | When to Use a Processor"
description: "CyberGo JSON Processor guide: package functions vs Processor, PreParse and CompilePath, goroutine sharing, lifecycle, monitoring for high-frequency queries."
sidebar_position: 40
---

# Processor Guide

This guide helps you understand **when** and **how** to use a Processor, and what it offers over package-level functions.

## Package Functions vs Processor

CyberGo JSON offers two API styles:

| Dimension | Package functions | Processor |
|-----------|-------------------|-----------|
| **Typical call** | `json.GetString(data, "name")` | `p.GetString(data, "name")` |
| **Creation** | None — call directly | `p, err := json.New()` |
| **Configuration** | Pass `cfg ...Config` per call | Configure once at creation, reuse afterwards |
| **Cache** | Global shared cache | Independent cache, controllable and clearable |
| **Resource management** | Automatic (global processor) | Manual `Close()` |
| **Hook system** | Not supported | Supported via `AddHook` |
| **Pre-parsing** | Not supported | Supported via `PreParse` + `GetFromParsed` |
| **Path pre-compilation** | Not supported | Supported via `CompilePath` + `GetCompiled` |
| **Best for** | Simple operations, scripts, low-frequency calls | High-frequency operations, custom configuration, server-side |

::: tip Quick decision
- **Package functions**: occasional JSON operations, no lifecycle to manage, quick scripts
- **Processor**: custom configuration needed, high-frequency queries on the same data, hooks/auditing needed
:::

## When to Use a Processor

### Scenario 1: Custom Configuration

Package-level functions use the default configuration. For security mode, custom encoders, or hooks, use a Processor:

```go
// Package function — always the default configuration
val := json.GetString(data, "name")

// Processor — configurable
cfg := json.SecurityConfig() // Security mode
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()

// Every subsequent operation uses the security configuration
val, err := p.Get(data, "name")
```

### Scenario 2: High-Frequency Queries on the Same Data (PreParse)

When querying the same JSON many times, `PreParse` parses once and later queries reuse the parse result:

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Parse once
parsed, err := p.PreParse(largeJSON)
if err != nil {
    panic(err)
}
defer parsed.Release() // Return to the object pool when done

// Many queries — reusing the parse result, no repeated parsing
name, _ := p.GetFromParsed(parsed, "user.name")
email, _ := p.GetFromParsed(parsed, "user.email")
tags, _ := p.GetFromParsed(parsed, "tags")

// You can also take the underlying parse result directly (map[string]any / []any)
data := parsed.Data()
_ = data

// Modification can build on the pre-parsed result too: SetFromParsed returns a
// new ParsedJSON; the original is unchanged
modified, err := p.SetFromParsed(parsed, "user.age", 31)
if err != nil {
    panic(err)
}
newAge, _ := p.GetFromParsed(modified, "user.age")
```

::: warning Performance comparison
- Package function `GetString`: parses the JSON on every call (cache exists, but hit ratio depends on the workload)
- `PreParse` + `GetFromParsed`: parse once; N queries only navigate — zero repeated parsing
:::

### Scenario 3: High-Frequency Queries on the Same Path (CompilePath)

`PreParse` optimizes "one JSON queried many times"; if the scenario is "the **same path** repeatedly executed across many different JSONs", use `CompilePath` — path parsing and validation happen once, and every later query just navigates:

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

	// The path is compiled once (parsing + validation)
	compiled, err := p.CompilePath("user.name")
	if err != nil {
		panic(err)
	}
	defer compiled.Release() // Return to the object pool

	// Repeated queries on a hot path: skip path parsing, navigate only
	for _, data := range []string{
		`{"user":{"name":"Alice"}}`,
		`{"user":{"name":"Bob"}}`,
	} {
		val, err := p.GetCompiled(data, compiled)
		if err != nil {
			panic(err)
		}
		fmt.Println(val)
	}
	// Output:
	// Alice
	// Bob
}
```

::: tip Division of labor between the two optimizations
| Optimization | Overhead saved | Fits |
|--------------|----------------|------|
| `PreParse` + `GetFromParsed` | Repeatedly parsing the JSON document | One JSON queried at many different paths |
| `CompilePath` + `GetCompiled` | Repeatedly parsing the path expression | One path applied to many JSONs (hot path) |

The two are independent optimization dimensions — choose by bottleneck. Note `GetCompiled` currently has a query variant only; `Set`/`Delete` do not support pre-compiled paths yet, while modifications on the pre-parsed side go through `SetFromParsed`.
:::

### Scenario 4: Hooks and Auditing

When logging, performance monitoring, or input validation is needed, the Processor supports the hook system:

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Add a logging hook
p.AddHook(json.LoggingHook(slog.Default()))
// Add a timing hook
p.AddHook(json.TimingHook(&metricsRecorder))

// Every operation triggers the hooks automatically
result, err := p.Set(data, "user.name", "Alice")
```

See the [Hook System](../extensions/hooks).

### Scenario 5: Sharing a Processor Across Goroutines

`Processor` is concurrency-safe — the correct pattern is **create once, share with the whole group, Close once at the end**, rather than one per request (which only adds creation overhead and amplifies resource-management cost):

```go
package main

import (
	"fmt"
	"sync"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close() // Runs after all goroutines finish

	data := `{"user":{"name":"Alice","age":30}}`

	var wg sync.WaitGroup
	for i := 1; i <= 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			name := p.GetString(data, "user.name")
			age := p.GetInt(data, "user.age")
			fmt.Printf("goroutine %d: %s (%d)\n", i, name, age)
		}(i)
	}
	wg.Wait()

	stats := p.GetStats()
	fmt.Println("Total operations:", stats.OperationCount)
}

// Output (goroutine order is not deterministic):
// goroutine 5: Alice (30)
// goroutine 2: Alice (30)
// ...
// Total operations: 16
```

::: tip MaxConcurrency is a soft limit
The default `MaxConcurrency = 50`: when in-flight operations exceed it, new operations **fail immediately** with `ErrConcurrencyLimit` (no queuing). High-concurrency services should raise it as needed, or do rate limiting and retries on the caller side.
:::

### Scenario 6: Unified Global Configuration

Behind the package-level functions is a **global processor**. When you want the entire application — including old code whose call signatures cannot be changed — to run one shared configuration, `SetGlobalProcessor` swaps it once and every package-level call (`json.Get`/`json.Marshal`, etc.) takes effect immediately. For the full example and caveats see the [Global Processor](#global-processor) section below.

## Lifecycle Management

A Processor holds resources (cache, goroutines) and **must be closed** after use:

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close() // Ensure resources are released

// Use the Processor...
result, err := p.GetString(data, "name")
```

::: warning Consequences of forgetting Close
- Cache memory is never released
- Background goroutines leak
- Under high concurrency this can exhaust resources
:::

### Checking State

```go
if p.IsClosed() {
    // The Processor is closed and can no longer be used
}
```

`IsClosed` returns `true` in both states: fully closed, or closing (draining)/close-timeout. New operations are rejected with an error in either state, so treat it as the single "can I still use it" check.

## Monitoring and Diagnostics

The Processor has built-in runtime statistics and health checks, ready to plug into service monitoring:

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

	_, _ = p.Get(`{"user":{"name":"Alice"}}`, "user.name")

	// Runtime statistics: operation count, error count, cache hit ratio, memory
	stats := p.GetStats()
	fmt.Printf("operations=%d errors=%d hitRatio=%.2f cacheEntries=%d\n",
		stats.OperationCount, stats.ErrorCount, stats.HitRatio, stats.CacheSize)

	// Health check: per-item results for cache, memory, etc.
	health := p.GetHealthStatus()
	fmt.Println("Healthy:", health.Healthy)
	for name, check := range health.Checks {
		fmt.Printf("  %s: %s\n", name, check.Message)
	}

	// Read the current configuration (a copy; modifying it does not affect
	// the Processor)
	cfg := p.GetConfig()
	fmt.Println("Cache enabled:", cfg.EnableCache)
}
```

::: tip Package-level versions
The global processor also has package-level monitoring entry points: `json.GetStats()` and `json.GetHealthStatus()`, handy for global diagnostics in code that holds no Processor reference. For cache statistics and the full use of `ClearCache`/`WarmupCache` see [Caching & Pre-Parsing](../advanced/caching).
:::

## Global Processor

Package-level functions (`Get`, `Set`, `Marshal`, etc.) internally use a **global processor**. You can replace it:

```go
// Create a processor with a custom configuration
cfg := json.SecurityConfig()
p, err := json.New(cfg)
if err != nil {
    panic(err)
}

// Set it as the global processor
json.SetGlobalProcessor(p)

// All package-level functions now use the security configuration
val := json.GetString(data, "name")

// Clean up when the application exits
defer json.ShutdownGlobalProcessor()
```

Behavior details:

- `SetGlobalProcessor` is thread-safe; passing `nil` is a no-op; replacement **automatically closes the old processor**
- `ShutdownGlobalProcessor` is the full exit cleanup: besides closing the global processor, it closes the "per-config cached" processors and clears the global path/encoding caches; later package-level calls then create a fresh default processor automatically
- Package-level functions called with `cfg` (e.g. `json.Get(data, path, json.SecurityConfig())`) use the **per-config cached** processor, not the global one — the two mechanisms run in parallel without interference

::: tip Use cases
- A unified global security policy
- Custom encoders applied globally
- Replacing the default configuration without threading Config through every call
:::

## Decision Tree

```text
Need to work with JSON?
├── Occasional use, scripts and tools
│   └── -> Use package functions json.GetString / json.Set / json.Marshal
├── Occasional use, but with security/encoding configuration
│   └── -> Package function + trailing cfg: json.Get(data, path, json.SecurityConfig())
├── High-frequency use, or Processor capabilities such as hooks needed
│   └── -> Use a Processor json.New(cfg)
├── Many queries on the same JSON
│   └── -> Use a Processor + PreParse
├── One path applied across many JSONs (hot path)
│   └── -> Use a Processor + CompilePath
├── Multiple goroutines processing concurrently
│   └── -> Share one Processor (concurrency-safe); do not create one per request
├── Auditing / monitoring / logging needed
│   └── -> Use a Processor + AddHook
├── Runtime metrics / health checks needed
│   └── -> Use GetStats / GetHealthStatus (both Processor methods and package functions work)
└── Unified global configuration
    └── -> Use SetGlobalProcessor
```

## Next Steps

- [Path Expression Syntax](./path-syntax) — The complete path query syntax
- [Processor API](../api-reference/processor/) — The complete method reference
- [Performance Optimization](../advanced/performance) — Deep performance tuning
- [Cheat Sheet](./cheatsheet) — Quick API reference
