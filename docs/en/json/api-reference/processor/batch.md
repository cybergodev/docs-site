---
sidebar_label: "Batch Operations"
title: "Processor Batch Operations - CyberGo JSON | ProcessBatch API"
description: "Processor batch operations: ProcessBatch runs get/set/delete/validate in one call with ID-linked results, plus WarmupCache for cache pre-warming."
sidebar_position: 70
---

# Batch Operation Methods

`ProcessBatch` runs multiple JSON operations (get/set/delete/validate) in a single call. Compared with the package-level [`ProcessBatch`](../functions/batch), the Processor form reuses one instance's configuration, cache and hooks, and a `cfg` can override the behavior of a single batch.

## ProcessBatch

Signature: `func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

Batch-processes multiple JSON operations. Result order matches input order, linked by the `ID` field.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo","age":25}}`
	results, err := p.ProcessBatch([]json.BatchOperation{
		{Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
		{Type: "set", JSONStr: data, Path: "user.age", Value: 30, ID: "age"},
	})
	if err != nil {
		panic(err)
	}
	for _, r := range results {
		fmt.Printf("%s: %v\n", r.ID, r.Result)
	}
}

// Output:
// name: CyberGo
// age: {"user":{"age":30,"name":"CyberGo"}}
```

### Supported Operation Types

The `Result` content and typical errors of the four operation types (`get`/`set`/`delete`/`validate`), plus the "operations do not chain" semantics, are the same as the package-level function — see [Batch Operations - Supported Operation Types](../functions/batch#supported-operation-types). The Processor-side difference is only how configuration takes effect: a passed `cfg` overrides the processor configuration for that call (next section).

### Batch Size Limit

The operation count is bounded by `Config.MaxBatchSize` (default `2000`), applied per call: a passed `cfg` overrides the processor configuration. Exceeding it fails the whole batch with `(nil, ErrSizeLimit)`.

## Examples per Operation Type

### get — batch reads

The `Result` of a `get` operation is the raw value at the path (numbers are `float64` by default, `json.Number` with `PreserveNumbers`).

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo","age":25}}`
	results, err := p.ProcessBatch([]json.BatchOperation{
		{Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
		{Type: "get", JSONStr: data, Path: "user.age", ID: "age"},
	})
	if err != nil {
		panic(err)
	}
	for _, r := range results {
		fmt.Printf("%s: %v\n", r.ID, r.Result)
	}
}

// Output:
// name: CyberGo
// age: 25
```

### set — batch modification

The `Result` of a `set` is **the complete modified JSON string** (compact form, object keys sorted lexicographically). The default `CreatePaths=true` means writing to a new path creates the intermediate nodes automatically:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo","age":25}}`
	results, err := p.ProcessBatch([]json.BatchOperation{
		{Type: "set", JSONStr: data, Path: "user.age", Value: 30, ID: "age"},
		{Type: "set", JSONStr: data, Path: "user.role", Value: "admin", ID: "role"},
	})
	if err != nil {
		panic(err)
	}
	for _, r := range results {
		fmt.Printf("%s -> %s\n", r.ID, r.Result)
	}
}

// Output:
// age -> {"user":{"age":30,"name":"CyberGo"}}
// role -> {"user":{"age":25,"name":"CyberGo","role":"admin"}}
```

:::tip How Config affects the batch
The passed `Config` is forwarded per operation, but **not every field affects the output**: `set`/`delete` results are always compact strings and ignore `Pretty` (run the result through [`Prettify`](./output#prettify) if you need formatting). The fields that do take effect per `cfg` are `MaxBatchSize` (batch cap), `CreatePaths` (whether `set` may create paths) and `PreserveNumbers` (`get` returns `float64` by default, `json.Number` when enabled).
:::

### delete — batch deletion

The `Result` of a `delete` is **the complete JSON string after deletion**.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo","age":25,"temp":"x"},"debug":true}`
	results, err := p.ProcessBatch([]json.BatchOperation{
		{Type: "delete", JSONStr: data, Path: "user.temp", ID: "drop-temp"},
		{Type: "delete", JSONStr: data, Path: "debug", ID: "drop-debug"},
	})
	if err != nil {
		panic(err)
	}
	for _, r := range results {
		fmt.Printf("%s -> %s\n", r.ID, r.Result)
	}
}

// Output:
// drop-temp -> {"debug":true,"user":{"age":25,"name":"CyberGo"}}
// drop-debug -> {"user":{"age":25,"name":"CyberGo","temp":"x"}}
```

### validate — batch validation

The `Result` of a `validate` is always `map[string]any{"valid": bool}`; when the JSON is invalid, `valid` is `false` and `Error` carries the parse error.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	results, err := p.ProcessBatch([]json.BatchOperation{
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

### Mixed Operations

A single batch can mix operation types; results come back in order:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo"},"processed":false}`
	results, err := p.ProcessBatch([]json.BatchOperation{
		{Type: "validate", JSONStr: data, ID: "check"},
		{Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
		{Type: "set", JSONStr: data, Path: "processed", Value: true, ID: "mark"},
	})
	if err != nil {
		panic(err)
	}

	for _, r := range results {
		if r.ID == "check" {
			if m, ok := r.Result.(map[string]any); ok {
				fmt.Printf("Validation result: %v\n", m["valid"])
			}
		} else {
			fmt.Printf("%s: %v\n", r.ID, r.Result)
		}
	}
}

// Output:
// Validation result: true
// name: CyberGo
// mark: {"processed":true,"user":{"name":"CyberGo"}}
```

## Error Handling and Fault Tolerance

### A single failure does not abort the batch

`ProcessBatch` **always processes every operation**: a failing operation only sets the `Error` field of its own result, later operations still run, and no configuration is needed. Judge each entry separately by checking `r.Error`:

```go
results, err := p.ProcessBatch(operations)
if err != nil {
    // err appears only when the processor is closed, the config is invalid,
    // or MaxBatchSize is exceeded
    return err
}
for _, r := range results {
    if r.Error != nil {
        log.Printf("Operation %s failed: %v", r.ID, r.Error)
        continue
    }
    // Handle r.Result ...
}
```

:::tip Difference from ContinueOnError
The `Config.ContinueOnError` field governs mid-flight tolerance of [`SetMultiple`](./modify#setmultiple) (whether to keep writing the remaining paths after one path fails); it does **not** apply to `ProcessBatch`. Per-operation isolation in `ProcessBatch` is built-in — it can be neither enabled nor disabled via that toggle.
:::

## Scenario: Batch Data Migration

Stamp a batch of records with a migration marker in one `ProcessBatch` call. A long-lived service can reuse the same instance across many batches:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	records := []string{
		`{"id":1,"name":"Alice","age":30}`,
		`{"id":2,"name":"Bob","age":25}`,
		`{"id":3,"name":"CyberGo","age":28}`,
	}

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

	results, err := p.ProcessBatch(ops)
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

Signature: `func (p *Processor) WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

Pre-evaluates hot paths of the same JSON and fills the cache, so the first later [`Get`](./query) on those paths hits the cache. Requires the processor cache to be enabled (it is by default); otherwise it returns a `JsonsError` (`Op` is `warmup_cache`, message "cache is disabled, cannot warmup cache").

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo","age":25},"meta":{"version":2}}`
	result, err := p.WarmupCache(data, []string{"user.name", "user.age", "meta.version"})
	if err != nil {
		panic(err)
	}
	fmt.Printf("Warm-up: %d/%d succeeded (%.0f%%)\n", result.Successful, result.TotalPaths, result.SuccessRate)
}

// Output:
// Warm-up: 3/3 succeeded (100%)
```

The `WarmupResult` struct:

| Field | Type | Description |
|-------|------|-------------|
| `TotalPaths` | `int` | Total number of paths to warm up |
| `Successful` | `int` | Successful count |
| `Failed` | `int` | Failed count |
| `SuccessRate` | `float64` | Success rate (percentage) |
| `FailedPaths` | `[]string` | List of failed paths (nil when nothing failed) |

When every path fails, `WarmupCache` returns the `WarmupResult` together with the error. An empty `paths` slice returns `TotalPaths=0`, `SuccessRate=100` and no error.

## Type Definitions

### BatchOperation Struct

```go
type BatchOperation struct {
    Type    string `json:"type"`     // Operation type: "get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // JSON string
    Path    string `json:"path"`     // Target path
    Value   any    `json:"value"`    // Value for Set operations
    ID      string `json:"id"`       // Operation identifier
}
```

### BatchResult Struct

```go
type BatchResult struct {
    ID     string `json:"id"`     // Matching operation ID
    Result any    `json:"result"` // Operation result (meaning varies by Type, see table above)
    Error  error  `json:"error"`  // Error of this single operation (does not affect others)
}
```

## Notes

1. Every operation runs independently; one failure does not affect the others (built-in, no configuration needed)
2. Result order matches operation order; match operations and results via `ID`
3. `MaxBatchSize` (default 2000) applies per call from `cfg`; exceeding it fails the whole batch

## See Also

- [Path Queries](./query) - The Get family of methods
- [Data Modification](./modify) - Set/Delete/SetMultiple methods
- [Package-Level Batch Operations](../functions/batch) - ProcessBatch without a Processor
