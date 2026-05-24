---
title: "Helper Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON helper utility functions reference: including CompareJSON for comparing whether two JSON strings are equivalent, ClearCache/GetStats for cache management and statistics, global processor management and security pattern helper functions, providing a convenient JSON utility function collection for everyday development."
---

# Helper Functions

The json package provides a rich set of helper functions for JSON comparison, cache management, and utility processing.

## JSON Comparison Functions

### CompareJSON

Signature: `func CompareJSON(json1, json2 string) (bool, error)`

Compares two JSON strings for equality. Handles numeric precision differences and key order differences.

```go
// Different key order but same content
equal, _ := json.CompareJSON(`{"a":1,"b":2}`, `{"b":2,"a":1}`)
fmt.Println(equal) // true

// Different numeric precision but same value
equal, _ := json.CompareJSON(`{"num":1}`, `{"num":1.0}`)
fmt.Println(equal) // true

// Different content
equal, _ := json.CompareJSON(`{"a":1}`, `{"a":2}`)
fmt.Println(equal) // false
```

---

## JSON Merge Functions

### MergeJSON

Signature: `func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

Merges two JSON objects, supports configuring merge mode via Config. See [Modify Functions](./functions/modify#mergejson) for details.

---

### MergeMany

Signature: `func MergeMany(jsons []string, cfg ...Config) (string, error)`

Merges multiple JSON objects. See [Modify Functions](./functions/modify#mergemany) for details.

---

## Cache and Statistics

### ClearCache (Package Function)

Signature: `func ClearCache()`

Clears the internal cache of the global processor.

```go
json.ClearCache()
```

---

### GetStats (Package Function)

Signature: `func GetStats() Stats`

Gets the statistics of the global processor.

```go
stats := json.GetStats()
fmt.Printf("Cache hit ratio: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("Cache size: %d\n", stats.CacheSize)
```

---

### GetHealthStatus (Package Function)

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

Warms up the cache to improve subsequent operation performance.

```go
data := `{"user": {"name": "Alice", "email": "alice@example.com"}, "items": [{"id": 1}]}`
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := json.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("Successfully warmed up %d paths\n", result.Successful)
```

---

## Global Processor Management

The global processor is used by all package-level functions (such as `Get`, `GetString`, etc.).

### SetGlobalProcessor

Signature: `func SetGlobalProcessor(processor *Processor)`

Sets a custom global processor.

```go
cfg := json.SecurityConfig()
p, err := json.New(cfg)
if err != nil {
    panic(err)
}

json.SetGlobalProcessor(p)

// All subsequent package-level functions use this processor
val := json.GetString(data, "user.name")
```

---

### ShutdownGlobalProcessor

Signature: `func ShutdownGlobalProcessor()`

Shuts down the global processor and releases resources.

```go
func main() {
    cfg := json.DefaultConfig()
    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    json.SetGlobalProcessor(p)

    defer json.ShutdownGlobalProcessor()

    // Application logic...
}
```

---

## Output Functions

::: warning API Change Notice
`Print`, `PrintPretty`, `PrintE`, `PrintPrettyE` have been converted to internal functions (lowercase naming) and are no longer exported as public APIs. Please use [Encode](./functions/encode-decode#encode), [EncodePretty](./functions/encode-decode#encodepretty), or [Prettify](./functions/encode-decode#prettify) with `fmt.Println` instead. See [Print Functions](./print) for details.
:::

---

## Buffer Compatible Functions

::: tip Note
The following functions are fully compatible with the `encoding/json` standard library while supporting additional configuration via the `cfg` parameter.
:::

### Compact

Signature: `func Compact(dst *bytes.Buffer, src []byte, cfg ...Config) error`

Writes compressed JSON to a Buffer. 100% compatible with `encoding/json.Compact`.

```go
var buf bytes.Buffer
err := json.Compact(&buf, []byte(`{"name": "test"}`))
```

### Indent

Signature: `func Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

Writes formatted JSON to a Buffer. 100% compatible with `encoding/json.Indent`.

```go
var buf bytes.Buffer
err := json.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
```

---

### HTMLEscape

Signature: `func HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

Writes HTML-escaped JSON to a Buffer. 100% compatible with `encoding/json.HTMLEscape`.

```go
var buf bytes.Buffer
json.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
```

---

## Security Pattern Functions

### Config.AddDangerousPattern

Register custom dangerous patterns via the Config's `AddDangerousPattern` method or `AdditionalDangerousPatterns` field.

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "Custom malicious keyword",
    Level:   json.PatternLevelCritical,
})
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

You can also set the `AdditionalDangerousPatterns` field after creating a Config:

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "malicious_keyword", Name: "Custom malicious keyword", Level: json.PatternLevelCritical},
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

**DangerousPattern Struct**

| Field | Type | Description |
|------|------|------|
| `Pattern` | `string` | Substring to detect |
| `Name` | `string` | Human-readable risk description |
| `Level` | `PatternLevel` | Severity level |

**PatternLevel Levels**

| Level | Description |
|------|------|
| `PatternLevelCritical` | Always blocks the operation |
| `PatternLevelWarning` | Blocks in strict mode, logs warning in permissive mode |
| `PatternLevelInfo` | Only logs, never blocks |

---

## Error Handling Functions

### SafeError

Signature: `func SafeError(err error) string`

Returns a client-safe error message without internal details. Suitable for use in API responses.

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // Returns a safe error message (without sensitive info like paths, internal state)
    fmt.Println(json.SafeError(err))
}
```

---

### RedactedPath

Signature: `func RedactedPath(path string) string`

Returns a redacted path for safe logging. Hides sensitive parts of the path.

```go
path := "users[0].ssn"
fmt.Println(json.RedactedPath(path)) // Safe path representation
```

---

## AccessResult Type Conversion Methods

`AccessResult` is the return type of `Processor.SafeGet()` and the package-level `SafeGet()`, providing type-safe conversion methods.

### AccessResult.AsString

Signature: `func (r AccessResult) AsString() (string, error)`

Safely converts to string type. Only succeeds when the value itself is a string.

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

Converts any value to a string (using fmt.Sprintf formatting).

```go
result := json.SafeGet(data, "user.age")
ageStr, err := result.AsStringConverted()
// "30" (string format)
```

---

### AccessResult.AsInt

Signature: `func (r AccessResult) AsInt() (int, error)`

Safely converts to integer. Does not support bool to int conversion.

```go
result := json.SafeGet(data, "user.age")
age, err := result.AsInt()
```

---

### AccessResult.AsFloat64

Signature: `func (r AccessResult) AsFloat64() (float64, error)`

Safely converts to float64. Does not support bool to float64 conversion.

```go
result := json.SafeGet(data, "item.price")
price, err := result.AsFloat64()
```

---

### AccessResult.AsBool

Signature: `func (r AccessResult) AsBool() (bool, error)`

Safely converts to boolean. Only supports bool and string types.

```go
result := json.SafeGet(data, "feature.enabled")
enabled, err := result.AsBool()
```

---

## Related

- [Query & Get Functions](./functions/get) - Get, GetString and other query operations
- [Modify Functions](./functions/modify) - Set, Delete and other modification operations
- [Type Definitions](./types) - AccessResult and other types
- [Configuration Options](./config) - Config configuration details
