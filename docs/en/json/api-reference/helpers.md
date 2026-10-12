---
sidebar_label: "Utility Functions"
title: "Utility Functions - CyberGo JSON | Helper Usage & Examples"
description: "CyberGo JSON utility helpers: CompareJSON, MergeJSON, ClearCache/GetStats, WarmupCache, SafeError, RedactedPath, AccessResult and RegisterDangerousPattern."
sidebar_position: 90
---

# Utility Functions

The json package provides a rich set of utility functions for JSON comparison, cache management, and general tooling.

## JSON Comparison Functions

### CompareJSON

Signature: `func CompareJSON(json1, json2 string, cfg ...Config) (bool, error)`

Compares two JSON strings for equality. Handles numeric-precision differences and key-order differences.

Without cfg, behavior matches history (no security validation; both sides are marshaled with `encoding/json`). With cfg, security validation (size/depth/dangerous-pattern limits) is applied to both inputs and the configured encoding is used for a symmetric comparison.

```go
// Different key order, same content
equal, _ := json.CompareJSON(`{"a":1,"b":2}`, `{"b":2,"a":1}`)
fmt.Println(equal) // true

// Different numeric precision, same value
equal, _ = json.CompareJSON(`{"num":1}`, `{"num":1.0}`)
fmt.Println(equal) // true

// Different content
equal, _ = json.CompareJSON(`{"a":1}`, `{"a":2}`)
fmt.Println(equal) // false

// With configuration (applies security validation and encoding control)
equal, err = json.CompareJSON(a, b, json.SecurityConfig())
```

:::tip Processor equivalent
`Processor.CompareJSON` always runs security validation (per cfg or the processor's own configuration), unlike the package-level no-cfg path. See [Processor Data Modification](./processor/modify#processor-comparejson).
:::

---

## JSON Merge Functions

### MergeJSON

Signature: `func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

Merges two JSON objects; the merge mode is configurable via Config. See [Modification Functions](./functions/modify#mergejson).

**Semantic details**:

- **Both inputs must be JSON objects** (a non-object top level reports `first/second JSON is not an object`)
- Nested objects are deep-merged recursively per `Config.MergeMode`; primitive values and arrays take the `json2` value directly
- Numbers are decoded with precision preservation, normalized to `float64`, then encoded (`1` and `1.0` are equivalent)
- **No security validation** — it is a pure structural utility: decode, merge, re-encode (unlike `CompareJSON` with cfg)

---

### MergeMany

Signature: `func MergeMany(jsons []string, cfg ...Config) (string, error)`

Merges multiple JSON objects. See [Modification Functions](./functions/modify#mergemany).

**Semantic details**: requires **at least 2** JSON strings (otherwise an error); folds left to right (equivalent to successive `MergeJSON` calls); any failing step returns a `merge failed at index N: <reason>` error.

---

## Cache and Statistics

### ClearCache (Package-Level Function)

Signature: `func ClearCache()`

Clears the internal cache of the global processor.

```go
json.ClearCache()
```

---

### GetStats (Package-Level Function)

Signature: `func GetStats() Stats`

Gets the statistics of the global processor.

```go
stats := json.GetStats()
fmt.Printf("Cache hit ratio: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("Cache size: %d\n", stats.CacheSize)
```

---

### GetHealthStatus (Package-Level Function)

Signature: `func GetHealthStatus() HealthStatus`

Gets the health status of the global processor.

```go
status := json.GetHealthStatus()
if status.Healthy {
    fmt.Println("Processor is healthy")
}
```

---

### Processor.ClearCache

Signature: `func (p *Processor) ClearCache()`

Clears the processor's internal cache.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

p.ClearCache()
```

### Processor.GetStats

Signature: `func (p *Processor) GetStats() Stats`

Gets the processor's statistics.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

stats := p.GetStats()
fmt.Printf("Cache hit ratio: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("Cache size: %d\n", stats.CacheSize)
```

### Processor.GetHealthStatus

Signature: `func (p *Processor) GetHealthStatus() HealthStatus`

Gets the processor's health status.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

status := p.GetHealthStatus()
if status.Healthy {
    fmt.Println("Processor is healthy")
}
```

### WarmupCache

Signature: `func WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

Warms up the cache to improve the performance of subsequent operations.

```go
data := `{"user": {"name": "Alice", "email": "alice@example.com"}, "items": [{"id": 1}]}`
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := json.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("Successfully warmed up %d paths\n", result.Successful)
```

**WarmupResult struct**

| Field | Type | Description |
|-------|------|-------------|
| `TotalPaths` | `int` | Total number of paths submitted for warm-up |
| `Successful` | `int` | Number of paths successfully cached |
| `Failed` | `int` | Number of failed paths |
| `SuccessRate` | `float64` | Success rate as a **percentage 0–100** (not 0–1; an empty path list yields 100) |
| `FailedPaths` | `[]string` | List of failed paths (nil when all succeed) |

::: warning Warm-up error boundaries
`WarmupCache` returns `(result, error)` only when **every path fails** (the error carries the last failure reason); when the cache is disabled (`EnableCache: false`) it returns an error directly. Partial failures appear only in the `WarmupResult` fields, with a nil error.
:::

---

## Global Processor Management

Package-level functions use a global processor internally. It can be customized or shut down via these functions:

| Function | Signature | Description |
|----------|-----------|-------------|
| `SetGlobalProcessor` | `func SetGlobalProcessor(processor *Processor)` | Set a custom global processor |
| `ShutdownGlobalProcessor` | `func ShutdownGlobalProcessor()` | Shut down the global processor and release resources |

**Behavior details**:

- `SetGlobalProcessor(nil)` is a no-op; after a successful replacement the **old processor is closed synchronously** (Close waits up to about 5 seconds internally); in-flight operations are unaffected
- `ShutdownGlobalProcessor` is thread-safe: it closes the default processor, the fallback processor, and **all processors in the config cache**, and clears global caches such as the path-type cache. The next package-level call then **creates a fresh default processor automatically** — well suited to cleanup at the end of a long-lived service

:::tip Detailed usage
For complete examples and lifecycle management of the global processor, see [Processor Overview](./processor/#global-processor-management) and the [Processor Guide](../getting-started/processor-guide#global-processor).
:::

---

## Output Functions

::: warning API change notice
Print, PrintPretty, PrintE, and PrintPrettyE have been removed from the library and are no longer provided. Use [Encode](./functions/output#encode), [EncodePretty](./functions/output#encodepretty), or [Prettify](./functions/output#prettify) together with `fmt.Println` instead (`EncodeWithConfig` is deprecated, equivalent to `Encode`). See [Formatted Output](../getting-started/print).
:::

---

## Buffer Compatibility Functions

`Compact`, `Indent`, and `HTMLEscape` are fully compatible with the `encoding/json` standard library while supporting extra configuration through the `cfg` parameter. For complete examples and Processor equivalents see [Encoding Output Functions](./functions/output#compact).

| Function | Signature | Description |
|----------|-----------|-------------|
| `Compact` | `func Compact(dst *bytes.Buffer, src []byte, cfg ...Config) error` | Removes insignificant whitespace and **writes to dst** (compatible with `encoding/json.Compact`, mirrors `Processor.CompactBuffer`) |
| `CompactString` | `func CompactString(jsonStr string, cfg ...Config) (string, error)` | String in, string out (mirrors `Processor.Compact`) — a **different function** from `Compact` |
| `Indent` | `func Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error` | Indent-formats and writes to dst (compatible with `encoding/json.Indent`) |
| `HTMLEscape` | `func HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)` | Escapes `<` `>` `&` plus U+2028/U+2029 into dst; no return value |

---

## Security Mode Functions

### Config.AddDangerousPattern

Register custom dangerous patterns via the Config `AddDangerousPattern` method or the `AdditionalDangerousPatterns` field.

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "custom malicious keyword",
    Level:   json.PatternLevelCritical,
})
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

You can also set the `AdditionalDangerousPatterns` field after creating the Config:

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "malicious_keyword", Name: "custom malicious keyword", Level: json.PatternLevelCritical},
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

**DangerousPattern struct**

| Field | Type | Description |
|-------|------|-------------|
| `Pattern` | `string` | Substring to detect |
| `Name` | `string` | Human-readable risk description |
| `Level` | `PatternLevel` | Severity level |

**PatternLevel levels**

| Level | Description |
|-------|-------------|
| `PatternLevelCritical` | Always blocks the operation |
| `PatternLevelWarning` | Blocks in strict mode; logs a warning in lenient mode |
| `PatternLevelInfo` | Logs only; never blocks |

---

## Security Mode Registration (Global Functions)

Besides the Config-level `AdditionalDangerousPatterns`, the library also maintains a **global registry** suited to process-wide uniform security policies: register once at process startup and it applies to **every Processor** in the process — validation reads the global registry in real time, so already-created Processors need no rebuilding. It is independent of each Processor's configuration (it stays in effect even when `DisableDefaultPatterns` is set), and both registration and removal are thread-safe.

The `DangerousPattern` struct and `PatternLevel` levels are defined in the [Security Mode Functions](#security-mode-functions) section above.

### RegisterDangerousPattern

```go
func RegisterDangerousPattern(pattern DangerousPattern)
```

Registers a dangerous pattern in the process-wide **global registry**; once registered, it takes part in security validation alongside the built-in patterns (substring detection, case-insensitive). Registering the same pattern string again overwrites the previous entry.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pattern` | `DangerousPattern` | Yes | The pattern to register (`Pattern` is the substring to detect, `Name` is a human-readable description, `Level` is the severity level) |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// Register once at process startup; applies to every Processor in the process
	json.RegisterDangerousPattern(json.DangerousPattern{
		Pattern: "internal_admin_token",
		Name:    "internal admin token",
		Level:   json.PatternLevelCritical,
	})

	// Globally registered patterns also apply to Processors created afterwards
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// ListDangerousPatterns returns only custom registered patterns (built-ins excluded)
	for _, dp := range json.ListDangerousPatterns() {
		fmt.Printf("%s (level=%d)\n", dp.Pattern, dp.Level)
	}
	// Output: internal_admin_token (level=0)
}
```

### UnregisterDangerousPattern

```go
func UnregisterDangerousPattern(pattern string)
```

Removes a custom pattern from the global registry by its pattern string. Removing an unregistered pattern is a harmless no-op; it has no effect on built-in patterns (see the warning at the end of this section).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pattern` | `string` | Yes | The pattern string to remove (the value of the `DangerousPattern.Pattern` field) |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	json.RegisterDangerousPattern(json.DangerousPattern{
		Pattern: "internal_admin_token",
		Name:    "internal admin token",
		Level:   json.PatternLevelCritical,
	})

	// Remove by pattern string; removing an unregistered pattern is a harmless no-op
	json.UnregisterDangerousPattern("internal_admin_token")

	// The global registry stores only custom patterns; it is empty again after removal
	fmt.Println(len(json.ListDangerousPatterns())) // Output: 0
}
```

### ListDangerousPatterns

```go
func ListDangerousPatterns() []DangerousPattern
```

Returns all patterns in the global registry, i.e. the **custom patterns** registered via `RegisterDangerousPattern` — built-in patterns are maintained by the library itself: they are neither listed nor removable. Returns an empty (non-nil) slice when the registry is empty.

**Returns**

| Type | Description |
|------|-------------|
| `[]DangerousPattern` | All registered custom patterns (an empty slice when the registry is empty) |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	json.RegisterDangerousPattern(json.DangerousPattern{
		Pattern: "internal_admin_token",
		Name:    "internal admin token",
		Level:   json.PatternLevelCritical,
	})

	patterns := json.ListDangerousPatterns()
	fmt.Println(len(patterns))     // Output: 1
	fmt.Println(patterns[0].Name)  // Output: internal admin token
	fmt.Println(patterns[0].Level) // Output: 0 (i.e. PatternLevelCritical)
}
```

::: warning Built-in critical patterns cannot be disabled
Critical patterns such as `__proto__`, `constructor[`, and `prototype.` are **always enforced** — neither `UnregisterDangerousPattern` nor `DisableDefaultPatterns` has any effect on them.
:::

For the complete Security Mode design (built-in dangerous pattern list, `SecurityConfig` presets, and `PatternLevel` blocking policy) see [Security Mode](../security/security-mode).

---

## Error Handling Functions

### SafeError

Signature: `func SafeError(err error) string`

Returns a client-safe error message without internal details. Suitable for API responses.

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // Returns a safe error message (no paths, internal state, or other sensitive info)
    fmt.Println(json.SafeError(err))
}
```

---

### RedactedPath

Signature: `func RedactedPath(path string) string`

Returns a redacted path for safe logging. Hides the sensitive parts of a path.

```go
path := "users[0].ssn"
fmt.Println(json.RedactedPath(path)) // Output: *** (non-empty paths uniformly return ***; an empty path returns an empty string)
```

---

## AccessResult Type Conversion Methods

`AccessResult` is the return type of `Processor.SafeGet()` and the package-level `SafeGet()`, providing type-safe conversion methods.

### AccessResult.AsString

Signature: `func (r AccessResult) AsString() (string, error)`

Safely converts to a string. Succeeds only when the value itself is a string.

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    return
}
fmt.Println(name)
```

---

### AccessResult.AsStringConverted

Signature: `func (r AccessResult) AsStringConverted() (string, error)`

Converts any value into a string (formatted with fmt.Sprintf).

```go
result := json.SafeGet(data, "user.age")
ageStr, err := result.AsStringConverted()
// "30" (as a string)
```

---

### AccessResult.AsInt

Signature: `func (r AccessResult) AsInt() (int, error)`

Safely converts to an integer. bool-to-int conversion is not supported.

```go
result := json.SafeGet(data, "user.age")
age, err := result.AsInt()
```

---

### AccessResult.AsFloat64

Signature: `func (r AccessResult) AsFloat64() (float64, error)`

Safely converts to float64. bool-to-float64 conversion is not supported.

```go
result := json.SafeGet(data, "item.price")
price, err := result.AsFloat64()
```

---

### AccessResult.AsBool

Signature: `func (r AccessResult) AsBool() (bool, error)`

Safely converts to a boolean. Only bool and string types are supported.

```go
result := json.SafeGet(data, "feature.enabled")
enabled, err := result.AsBool()
```

---

## See Also

- [Query & Get](./functions/query) - Get, GetString and other query operations
- [Modification Functions](./functions/modify) - Set, Delete and other modification operations
- [Type Definitions](./types) - AccessResult and other types
- [Config](./config) - Configuration options in detail
