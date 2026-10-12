---
sidebar_label: "Batch Operations"
title: "Batch Operations - CyberGo JSON | ProcessBatch Usage"
description: "CyberGo JSON is a Go library for batch processing, offering ProcessBatch get/set/delete/validate bounded by MaxBatchSize, plus WarmupCache for hot paths."
sidebar_position: 70
---

# Batch Operation Functions

Batch operation functions of the json package process multiple JSON operations (get/set/delete/validate) in one call — a good fit for bulk data-processing scenarios.

## ProcessBatch

Signature: `func ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

Processes multiple JSON operations in a batch (a package-level function — no Processor required). Result order corresponds one-to-one with the input operation order, linked by the `ID` field.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

	operations := []json.BatchOperation{
		{Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
		{Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
	}

	results, err := json.ProcessBatch(operations)
	if err != nil {
		panic(err)
	}
	for _, r := range results {
		if r.Error != nil {
			fmt.Printf("Operation %s failed: %v\n", r.ID, r.Error)
		} else {
			fmt.Printf("Operation %s result: %v\n", r.ID, r.Result)
		}
	}
}

// Output:
// Operation op1 result: CyberGo
// Operation op2 result: {"user":{"age":30,"name":"CyberGo"}}
```

### Supported Operation Types

| `Type` | Purpose | `Result` content | Typical errors |
|--------|---------|------------------|----------------|
| `get` | Read the value at a path | The value at the path (`any`) | `ErrPathNotFound`, `ErrInvalidJSON` |
| `set` | Set the value at a path | **The complete modified JSON string** | `ErrPathNotFound` (without `CreatePaths`), `ErrInvalidPath` |
| `delete` | Delete the node at a path | **The complete JSON string after deletion** | `ErrPathNotFound`, `ErrInvalidPath` |
| `validate` | Check whether the JSON is valid | `map[string]any{"valid": bool}` | On invalid JSON, `Result.valid=false` and `Error` is non-empty |

When `Type` is not one of the four above (e.g. a typo), that operation's `Error` becomes `unknown operation type: <type>` — the batch is **not aborted**, and the remaining operations run as usual.

::: warning Operations do not chain
Every `BatchOperation` acts **independently** on its own `JSONStr` input; operations are **never** chained. For example, a `set` followed by a `delete` on the same document yields two independent results, not a combined "modify then delete" state. To apply multiple transformations to a single document, feed each step's output into the next in your own code, or use a single-document multi-path method such as [`SetMultiple`](./modify#setmultiple).
:::

### Batch Size Limit

The operation count is bounded by `Config.MaxBatchSize` (default `2000`; config validation clamps it to 10–10000). When exceeded, the whole batch fails immediately with `(nil, ErrSizeLimit)`. The cap applies per the **cfg passed to this call** (the default configuration if none):

```go
// Custom cap (for very large batches)
cfg := json.DefaultConfig()
cfg.MaxBatchSize = 5000
results, err := json.ProcessBatch(ops, cfg)
```

## Examples per Operation Type

### get — batch reads

The `Result` of a `get` operation is the raw value at the path (numbers default to `float64`, booleans to `bool`, strings to `string`).

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"name":"CyberGo","age":25},"active":true}`

	results, err := json.ProcessBatch([]json.BatchOperation{
		{Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
		{Type: "get", JSONStr: data, Path: "user.age", ID: "age"},
		{Type: "get", JSONStr: data, Path: "active", ID: "active"},
	})
	if err != nil {
		panic(err)
	}

	for _, r := range results {
		if r.Error != nil {
			fmt.Printf("%s failed: %v\n", r.ID, r.Error)
			continue
		}
		fmt.Printf("%s = %v\n", r.ID, r.Result)
	}
}

// Output:
// name = CyberGo
// age = 25
// active = true
```

### set — batch modification

The `Result` of a `set` operation is **the complete modified JSON string** (note: not the written value itself). The default configuration sets `CreatePaths=true`, so writing to a new path creates the intermediate nodes automatically.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"name":"CyberGo","age":25}}`

	results, err := json.ProcessBatch([]json.BatchOperation{
		{Type: "set", JSONStr: data, Path: "user.age", Value: 30, ID: "update-age"},
		{Type: "set", JSONStr: data, Path: "user.role", Value: "admin", ID: "add-role"},
	})
	if err != nil {
		panic(err)
	}

	for _, r := range results {
		if r.Error != nil {
			fmt.Printf("%s failed: %v\n", r.ID, r.Error)
			continue
		}
		fmt.Printf("%s -> %s\n", r.ID, r.Result)
	}
}

// Output:
// update-age -> {"user":{"age":30,"name":"CyberGo"}}
// add-role -> {"user":{"age":25,"name":"CyberGo","role":"admin"}}
```

:::tip Output format notes
JSON strings returned by `set`/`delete` are in **compact form** (no extraneous whitespace), with object keys sorted lexicographically (matching `encoding/json` behavior, which keeps output deterministic). To pretty-print, run the result through [`Prettify`](./output#prettify) separately.
:::

### delete — batch deletion

The `Result` of a `delete` operation is **the complete JSON string after deletion**.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"name":"CyberGo","age":25,"temp":"x"},"debug":true}`

	results, err := json.ProcessBatch([]json.BatchOperation{
		{Type: "delete", JSONStr: data, Path: "user.temp", ID: "drop-temp"},
		{Type: "delete", JSONStr: data, Path: "debug", ID: "drop-debug"},
	})
	if err != nil {
		panic(err)
	}

	for _, r := range results {
		if r.Error != nil {
			fmt.Printf("%s failed: %v\n", r.ID, r.Error)
			continue
		}
		fmt.Printf("%s -> %s\n", r.ID, r.Result)
	}
}

// Output:
// drop-temp -> {"debug":true,"user":{"age":25,"name":"CyberGo"}}
// drop-debug -> {"user":{"age":25,"name":"CyberGo","temp":"x"}}
```

### validate — batch validation

The `Result` of a `validate` operation is always `map[string]any{"valid": bool}`; when the JSON is invalid, `valid` is `false` and `Error` carries the parse error.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	results, err := json.ProcessBatch([]json.BatchOperation{
		{Type: "validate", JSONStr: `{"name":"CyberGo"}`, ID: "ok"},
		{Type: "validate", JSONStr: `{"name":}`, ID: "broken"},
	})
	if err != nil {
		panic(err)
	}

	for _, r := range results {
		if m, ok := r.Result.(map[string]any); ok {
			fmt.Printf("%s: valid=%v\n", r.ID, m["valid"])
		}
		if r.Error != nil {
			fmt.Printf("%s error: %v\n", r.ID, r.Error)
		}
	}
}

// Output:
// ok: valid=true
// broken: valid=false
// broken error: invalid JSON: ...
```

## Error Handling and Fault Tolerance

### A single failure does not abort the batch

`ProcessBatch` **always processes every operation**: a failing operation only sets the `Error` field of its own result; subsequent operations still run, and no configuration is needed to enable this. Batch results can therefore be "partly successful, partly failed" — always check `r.Error` entry by entry:

```go
results, err := json.ProcessBatch(operations)
if err != nil {
    // err appears only when the processor is closed, the config is invalid,
    // or MaxBatchSize is exceeded
    panic(err)
}
var failed int
for _, r := range results {
    if r.Error != nil {
        failed++
        log.Printf("Operation %s failed: %v", r.ID, r.Error)
        continue
    }
    // Handle r.Result ...
}
```

:::tip Difference from ContinueOnError
The `Config.ContinueOnError` field governs mid-flight tolerance of [`SetMultiple`](./modify#setmultiple) (whether to keep writing the remaining paths after one path fails); it does **not** apply to `ProcessBatch`. Per-operation isolation in `ProcessBatch` is built-in — it can be neither enabled nor disabled via that toggle.
:::

## Real-World Scenario: Batch Data Migration

Stamp a batch of records with a migration marker: one `ProcessBatch` call performs all transformations and collects each record's output:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// Simulate records read from a data source
	records := []string{
		`{"id":1,"name":"Alice","age":30}`,
		`{"id":2,"name":"Bob","age":25}`,
		`{"id":3,"name":"CyberGo","age":28}`,
	}

	// Generate one set operation per record, stamping the migration marker
	ops := make([]json.BatchOperation, len(records))
	for i, r := range records {
		ops[i] = json.BatchOperation{
			Type:    "set",
			JSONStr: r,
			Path:    "migrated",
			Value:   true,
			ID:      fmt.Sprintf("record-%d", i),
		}
	}

	results, err := json.ProcessBatch(ops)
	if err != nil {
		panic(err)
	}

	for _, r := range results {
		if r.Error != nil {
			fmt.Printf("%s failed: %v\n", r.ID, r.Error)
			continue
		}
		fmt.Printf("%s -> %s\n", r.ID, r.Result)
	}
}

// Output:
// record-0 -> {"age":30,"id":1,"migrated":true,"name":"Alice"}
// record-1 -> {"age":25,"id":2,"migrated":true,"name":"Bob"}
// record-2 -> {"age":28,"id":3,"migrated":true,"name":"CyberGo"}
```

## Cache Warm-Up: WarmupCache

Signature: `func WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

Pre-evaluates hot paths of the same JSON and fills the cache, so the first subsequent `Get` hits the cache directly. Requires the cache to be enabled (it is by default); otherwise returns a `JsonsError` (`Op` is `warmup_cache`, message "cache is disabled, cannot warmup cache").

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"name":"CyberGo","age":25},"meta":{"version":2}}`

	result, err := json.WarmupCache(data, []string{"user.name", "user.age", "meta.version"})
	if err != nil {
		panic(err)
	}
	fmt.Printf("Warm-up: %d/%d succeeded (%.0f%%)\n", result.Successful, result.TotalPaths, result.SuccessRate)

	// The first Get after warm-up hits the cache
	name, err := json.Get(data, "user.name")
	if err != nil {
		panic(err)
	}
	fmt.Println("name:", name)
}

// Output:
// Warm-up: 3/3 succeeded (100%)
// name: CyberGo
```

The `WarmupResult` struct:

| Field | Type | Description |
|-------|------|-------------|
| `TotalPaths` | `int` | Total number of paths to warm up |
| `Successful` | `int` | Successful count |
| `Failed` | `int` | Failed count |
| `SuccessRate` | `float64` | Success rate (percentage) |
| `FailedPaths` | `[]string` | List of failed paths (nil when nothing failed) |

When every path fails, `WarmupCache` returns the `WarmupResult` together with the last error.

## Type Definitions

### BatchOperation

The batch operation descriptor.

```go
type BatchOperation struct {
    Type    string `json:"type"`     // Operation type: "get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // Target JSON string
    Path    string `json:"path"`     // Path expression
    Value   any    `json:"value"`    // Operation value (used by set)
    ID      string `json:"id"`       // Operation identifier
}
```

| Field | Type | Description |
|-------|------|-------------|
| `Type` | `string` | Operation type: `get` / `set` / `delete` / `validate` |
| `JSONStr` | `string` | Input JSON for this operation (operations are independent and never chained) |
| `Path` | `string` | Path expression (not used by `validate`) |
| `Value` | `any` | Value to write for `set` (unused by other types) |
| `ID` | `string` | Caller-defined identifier, copied verbatim into the matching `BatchResult.ID` |

### BatchResult

The batch operation result.

```go
type BatchResult struct {
    ID     string `json:"id"`     // Operation identifier
    Result any    `json:"result"` // Operation result (meaning varies by Type, see table above)
    Error  error  `json:"error"`  // Error info (per-operation level)
}
```

| Field | Type | Description |
|-------|------|-------------|
| `ID` | `string` | Matches the operation's `ID`; the result slice maps to the input operations by index order |
| `Result` | `any` | Operation result; meaning varies by `Type` (see the table above) |
| `Error` | `error` | This operation's error; `nil` means success — **always check it entry by entry** |

:::tip Processor batch methods
A Processor instance offers the equivalent `p.ProcessBatch(operations)` method, with the same signature as the package-level function — a good fit when reusing a Processor or customizing via `Config` (e.g. `Pretty` output, `PreserveNumbers`). See [Processor Batch Operations](../processor/batch).
:::

## See Also

- [Modification Functions](./modify) - Set, SetMultiple, MergeJSON and other modification operations
- [Processor Batch Operations](../processor/batch) - Processor-level batch methods in detail
- [Helper Functions](../helpers) - WarmupCache, ClearCache, GetStats and other utilities
