---
sidebar_label: "FAQ"
title: "FAQ - CyberGo JSON | Common Questions Quick Reference"
description: "CyberGo JSON FAQ: package functions vs Processor, missing-path and out-of-range returns, float64 numbers, Set purity, stdlib migration, caching."
sidebar_position: 1
---

# FAQ

## How do I choose between package-level functions and a Processor?

**Answer:** For occasional JSON operations, scripts, or when you do not want to manage lifecycles, use package-level functions (`json.GetString` etc., backed by the global processor). When you need custom configuration (security mode, cache parameters), hooks/auditing/runtime stats, or high-frequency queries, use a Processor (`p, err := json.New(cfg)`).

| Dimension | Package functions | Processor |
|------|----------|-----------|
| Creation | None required | `json.New(cfg)` |
| Configuration | Trailing `cfg ...Config` | Configured once at creation |
| Pre-parse / path compilation | Not supported | `PreParse` / `CompilePath` |
| Resource management | Managed globally | Manual `Close()` |

For the full comparison and decision tree, see [Processor Getting Started](../getting-started/processor-guide#package-functions-vs-processor).

## What exactly is returned when a path is not found?

**Answer:** It depends on the call. Both a missing object key and an out-of-range array index return `ErrPathNotFound` from `Get`; typed functions and `SafeGet` fall back to a zero value or default instead:

| Call | Object key missing | Array index out of range |
|------|--------------|--------------|
| `json.Get` | `(nil, ErrPathNotFound)` | `(nil, ErrPathNotFound)` |
| `json.GetString` and other typed functions | Zero value or the passed default | Zero value or the passed default |
| `json.SafeGet` | `Exists: false` | `Exists: false` |

`items[10]` on a three-element array yields an error message containing `array index 10 out of bounds (length 3)`, and `errors.Is(err, json.ErrPathNotFound)` returns `true`. When you want "missing means default", use a typed function or `SafeGet` rather than an err branch on `Get`. Full rules in [Syntax Pitfalls](../getting-started/path-syntax#what-are-the-syntax-pitfalls).

## Why is the number I retrieved a float64?

**Answer:** `Get` returns `any`, and JSON numbers are always decoded as `float64`:

```go
data := `{"version": 1}`

val, _ := json.Get(data, "version") // val is float64(1), not int
i := json.GetInt(data, "version")   // use a typed function when you need int
```

Large integers beyond `float64` precision (such as snowflake IDs) get rounded — use `Config.PreserveNumbers` to keep the original number text, or `Decoder.UseNumber()` to get `json.Number`.

## Why did the original JSON not change after calling Set?

**Answer:** `Set`/`Delete` are pure-function style: they return a **new string** with the modification applied; the original is untouched. Discarding the return value is the most common beginner bug:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"name": "old"}`

	updated, err := json.Set(data, "name", "new")
	if err != nil {
		panic(err)
	}
	fmt.Println(data)    // {"name": "old"} — original unchanged
	fmt.Println(updated) // {"name":"new"}
}
```

When modifying multiple fields, use `SetMultiple` to do it in one call instead of chaining `Set`.

## What happens when Set uses an out-of-range index?

**Answer:** The query side returns `ErrPathNotFound`; the modification side differs — under the default configuration (`CreatePaths: true`), `Set` pads the array with `null` up to the target index:

```go
updated, _ := json.Set(`{"items":[1,2,3]}`, "items[5]", "x")
// {"items":[1,2,3,null,null,"x"]}
```

To append at the end, use `items[+]` (the preceding path must be an existing array); do not rely on out-of-range indices. For how index, slice, and modification each handle out-of-range values, see [Syntax Pitfalls](../getting-started/path-syntax#what-are-the-syntax-pitfalls).

## Why does a missed field extraction not report an error?

**Answer:** A "miss" in field extraction `{name,email}` is silent — `Get` returns `(nil, nil)`, with neither a value nor an error. In multi-field extraction, as long as one field exists, an object containing only the hit fields is returned. Therefore you cannot use `err != nil` to decide whether an extraction hit; check the return value itself. Also note that single-field and multi-field extraction return different shapes: `user{name}` returns the bare value, while `user{id,name}` returns an object. See [Syntax Pitfalls](../getting-started/path-syntax#what-are-the-syntax-pitfalls).

## How do I access keys containing dots or brackets?

**Answer:** A dot can be backslash-escaped or handled through JSON Pointer; paired braces and brackets only work through Pointer (in a path starting with `/`, brackets and dots are part of the key name):

```go
data := `{"a.b": 1, "c[0]": 2, "e{f}": 3}`

json.GetInt(data, "a\\.b") // 1 — the Go literal consumes one level; the path parser receives a\.b
json.GetInt(data, "/a.b")  // 1 — under Pointer mode the dot is part of the key name
json.GetInt(data, "/c[0]") // 2 — paired brackets require a Pointer
json.GetInt(data, "/e{f}") // 3 — same for paired braces
```

A key whose brackets hold a **non-numeric** value, such as `a[b]`, cannot be addressed by any path syntax; iterate the object and match the key. Note that Pointer and dot syntax cannot be mixed; Pointer negative indices follow the dot-syntax semantics (`-1` is the last element); and `Set` via Pointer cannot grow an array. See [Path Escaping](../getting-started/path-syntax#path-escaping) and [JSON Pointer](../getting-started/path-syntax#json-pointer-rfc-6901).

## How much code do I need to change to migrate from the standard library?

**Answer:** Usually just swap the import path: `"encoding/json"` → `"github.com/cybergodev/json"`, and existing code compiles and runs. `Marshal`/`Unmarshal`/`Compact` and other functions, `Encoder`/`Decoder` methods, and error types (`SyntaxError`, `UnmarshalTypeError`, etc.) are compatible one-to-one; the extra `cfg ...Config` parameters are all optional. What to watch for are the few boundary differences introduced by default input security validation (see the next question). For the migration steps and compatibility list, see [Migrating from the Standard Library](../getting-started/migration).

## Why did Unmarshal reject data containing onload or eval(?

**Answer:** That is the default input validation intercepting injection patterns: 28 built-in dangerous patterns (`<script`, `javascript:`, `eval(`, `onload`, etc.) are blocked by default. After confirming the input is trusted, you can disable the default pattern set:

```go
cfg := json.DefaultConfig()
cfg.DisableDefaultPatterns = true
err := json.Unmarshal(data, &v, cfg)
```

Note that the three critical patterns `__proto__`, `constructor[`, and `prototype.` are **always blocked**. To only add rules, use `AdditionalDangerousPatterns` instead of disabling the default set. See [What Are the Behavioral Differences from the Standard Library?](../getting-started/migration#what-are-the-behavioral-differences-from-the-standard-library).

## What should I do when a document over 100MB is rejected?

**Answer:** The default `MaxJSONSize` is 100MB; exceeding it returns `ErrSizeLimit`. Two options: raise `cfg.MaxJSONSize` if you truly need to process it as a whole; the better option is streaming — `NewStreamIterator` / `NewStreamObjectIterator` read element by element, or the JSONL family processes line by line, avoiding loading everything into memory. See [Large File Processing](../streaming/large-files).

## Why is defer p.Close() everywhere in the examples?

**Answer:** A `Processor` internally holds caches and background cleanup goroutines; `Close` drains in-flight operations and releases these resources. Creating processors frequently without closing them accumulates resources (cache memory not released, goroutine leaks). Package-level functions have their lifecycle managed by the global processor — no manual `Close` needed, and none should be attempted. The correct pattern is **create once, share across the group, Close once at the end**; see [Lifecycle Management](../getting-started/processor-guide#lifecycle-management).

## Can a Processor be shared across goroutines?

**Answer:** Yes. `Processor` is thread-safe — all public methods are internally protected for concurrency; the `*ParsedJSON` returned by `PreParse` can also be read concurrently. Two caveats: `MaxConcurrency` (default 50) is a soft concurrency cap — when in-flight operations exceed it, new operations **fail immediately** with `ErrConcurrencyLimit` (retryable), so raise it for high-concurrency services; and do not share and mutate the mutable containers returned by `Get` across goroutines. See [Concurrency and Parallel Processing](../advanced/concurrency).

## When does the cache need manual clearing?

**Answer:** Almost never. `Set`/`Delete` and other write operations **automatically invalidate** the related cache entries (the document hash clears every entry for that document). Manual `ClearCache` is only needed when the external data source changes (the same JSON content is replaced in place), or under memory pressure. Monitor the hit ratio with `GetStats()` — below 0.5, inspect the workload or adjust `CacheTTL`/`MaxCacheSize`. See [Caching and Pre-parsing](../advanced/caching).

## What is the difference between PreParse and CompilePath?

**Answer:** They are independent optimization dimensions: `PreParse` + `GetFromParsed` eliminates the overhead of **repeatedly parsing the JSON document**, suited for "one JSON document queried via many different paths"; `CompilePath` + `GetCompiled` eliminates the overhead of **repeatedly parsing the path expression**, suited for the hot path of "one path applied to many different JSON documents". Note that `GetCompiled` currently has only the query variant — `Set`/`Delete` do not support compiled paths yet; modifications on the pre-parsed side can go through `SetFromParsed`. See [Processor Getting Started](../getting-started/processor-guide#when-to-use-a-processor).

## More Resources

- [Quick Start](../getting-started/) — core features in 5 minutes
- [Common First-Hour Questions](../getting-started/#common-first-hour-questions) — concentrated answers to beginner questions
- [Path Expression Syntax](../getting-started/path-syntax) — full path syntax and pitfalls
- [Error Handling](../advanced/error-handling) — sentinel error classification and locating
- [Performance](../advanced/performance) — benchmarks and the optimization decision path
