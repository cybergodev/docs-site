---
sidebar_label: "FAQ"
title: "FAQ - CyberGo env | Environment Variable Common Questions"
description: "CyberGo env FAQ: global vs instance mode, one-time Load, nested JSON/YAML keys, GetSlice generics, thread safety, SecureValue lifecycle, and OverwriteExisting."
sidebar_position: 2
---

# FAQ

## Basic Usage

### Should I choose Load() or New()?

**`env.Load()`** (global mode) is suitable for simple applications: load once, use package-level functions globally. It automatically applies variables to `os.Environ`.

**`env.New()`** (instance mode) is suitable for testing and multi-configuration scenarios: creates isolated instances, does not auto-apply, requires explicit `Close()`.

```go
// Simple application → global mode
env.Load(".env")
port := env.GetInt("PORT", 8080)

// Testing / multi-configuration → instance mode
loader, _ := env.New(env.TestingConfig())
defer loader.Close()
port := loader.GetInt("PORT", 8080)
```

:::tip How to choose
If unsure, start with `env.Load()`. Switch to `env.New()` when you encounter test isolation or multi-configuration needs.
:::

### Why can Load() only be called once?

`Load()` sets the global default loader (singleton pattern); repeated calls return `ErrAlreadyInitialized`. This is a design decision: avoiding accidentally overwriting already-loaded configuration at runtime.

```go
// First call — succeeds
env.Load(".env")

// Second call — returns error
err := env.Load(".env.production")
// err == env.ErrAlreadyInitialized
```

**Solutions:**

```go
// Solution 1: Load multiple files at once (recommended)
env.Load(".env", ".env.production")

// Solution 2: Reset first when re-initialization is needed
env.ResetDefaultLoader()  // Primarily for testing
env.Load(".env.production")
```

### What happens when the .env file doesn't exist?

Default behavior: **silently skips**, no error. This supports the flexible "load if present, ignore if absent" deployment pattern.

```go
// DefaultConfig — silently skips when file doesn't exist
env.Load(".env", ".env.local")
// Even if neither file exists, no error is returned
```

If you want an error when the file doesn't exist (recommended for production):

```go
cfg := env.ProductionConfig()
// FailOnMissingFile defaults to true (only for ProductionConfig)
loader, _ := env.New(cfg)
```

### How to access nested JSON/YAML values?

Nested JSON/YAML structures are automatically **flattened** to underscore-separated key names:

```json
{
  "database": {
    "host": "localhost",
    "port": 5432
  }
}
```

```text
Stored as: DATABASE_HOST=localhost, DATABASE_PORT=5432
```

The three access methods are equivalent:

```go
host := env.GetString("DATABASE_HOST")  // Flat key (recommended)
host := env.GetString("database.host")  // Dot path
host := env.GetString("DATABASE.HOST")  // Uppercase dot path
```

## Types and Generics

### Why is GetSlice a generic function instead of a method?

Go does not support type parameters on methods. `GetSlice[T]` must be a function, not a method:

```go
// ❌ Method approach — compile error (Go doesn't support this)
// loader.GetSlice[int]("PORTS")

// ✅ Function approach — works
env.GetSliceFrom[int](loader, "PORTS")

// ✅ Package-level function
env.GetSlice[int]("PORTS")
```

### How does GetSlice parse slice values?

Searches by priority:

1. **Indexed keys** (recommended): `KEY_0`, `KEY_1`, `KEY_2`...
2. **Comma-separated**: `KEY=val1,val2,val3`

```bash
# Method 1: Indexed keys
HOSTS_0=localhost
HOSTS_1=example.com

# Method 2: Comma-separated
HOSTS=localhost,example.com
```

```go
hosts := env.GetSlice[string]("HOSTS") // ["localhost", "example.com"]
```

### What boolean value formats are supported?

`GetBool` is case-insensitive and supports the following values:

| Truthy | Falsy |
|--------|-------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

## Concurrency and Thread Safety

### Can I call Get from multiple goroutines simultaneously?

**Yes.** All Loader methods are thread-safe. The library uses sharded locks to optimize read/write performance in high-concurrency scenarios.

```go
// Safe concurrent access
var wg sync.WaitGroup
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        _ = env.GetString("KEY") // Thread-safe
    }()
}
wg.Wait()
```

### What happens when calling Get after Loader.Close()?

Returns zero values, doesn't panic. The Loader enters a read-only degraded mode after closing:

```go
loader, _ := env.New()
defer loader.Close()

val := loader.GetString("KEY") // Returns normally

// After Close()
val = loader.GetString("KEY")  // Returns "" (zero value)
err := loader.Set("KEY", "v")  // Returns ErrClosed
```

## SecureValue

### What's the difference between Release and Close?

| Method | Zeros Memory | Unlocks Memory | Returns to Pool |
|--------|:------------:|:--------------:|:---------------:|
| `Release()` | ✅ | ✅ | ✅ |
| `Close()` | ✅ | ✅ | ❌ |

**Using `Release()` is recommended** — it returns the object to the pool, reducing GC pressure. `Close()` is for scenarios where pooling is not needed.

### Does SecureValue auto-zero when garbage collected?

**Yes.** SecureValue sets a finalizer that automatically zeros memory during garbage collection. However, it's recommended to explicitly call `Release()` or `Close()` to ensure timely cleanup, rather than relying on GC's non-deterministic timing.

```go
// ✅ Recommended: explicit release
sv := env.GetSecure("API_KEY")
defer sv.Release()

// ⚠️ Relying on GC — not recommended but safe
sv := env.GetSecure("API_KEY")
// Eventually zeroed by GC, but timing is uncertain
```

### How to safely log?

Use `Masked()` or masking utility functions; never directly output `Reveal()` values:

```go
sv := env.GetSecure("API_KEY")
defer sv.Release()

// ✅ Safe — masked output
log.Printf("API Key: %s", sv.Masked())    // [SECURE:32 bytes locked]
log.Printf("API Key: %s", sv)              // Same (String() returns Masked())

// ✅ Safe — masking tools
masked := env.MaskValue("API_KEY", "sk-xxx") // [MASKED:6 chars] (sensitive key → masked by value length)
clean := env.SanitizeForLog(logMessage)       // Auto-detect and mask

// ❌ Dangerous — plaintext leak
plaintext := sv.Reveal()
log.Printf("API Key: %s", plaintext) // Don't do this
```

## Configuration and Validation

### How to load only variables with a specific prefix?

Use the `Prefix` field to filter:

```go
cfg := env.DefaultConfig()
cfg.Prefix = "MYAPP_"  // Only load variables starting with MYAPP_
loader, _ := env.New(cfg)
loader.LoadFiles(".env")
```

```bash
# .env file content
MYAPP_HOST=localhost    # ✅ Loaded
MYAPP_PORT=8080         # ✅ Loaded
OTHER_KEY=value         # ❌ Ignored (no MYAPP_ prefix)
```

### How to prevent configuration overrides?

`OverwriteExisting` controls whether to overwrite existing variables:

```go
// Default: no overwriting (safe)
cfg := env.DefaultConfig()
cfg.OverwriteExisting = false

// Development: allow overwriting
cfg := env.DevelopmentConfig()
// OverwriteExisting = true
```

### When does RequiredKeys validation execute?

Only checked when `Validate()` is explicitly called, not automatically triggered during loading:

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
loader, _ := env.New(cfg)
loader.LoadFiles(".env")

// Explicit validation
if err := loader.Validate(); err != nil {
    if errors.Is(err, env.ErrMissingRequired) {
        log.Fatal("Missing required environment variables")
    }
}
```

## Testing

### How to isolate the environment in tests?

Use `TestingConfig()` + independent Loader instances:

```go
func TestConfig(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.OverwriteExisting = true

    loader, err := env.New(cfg)
    if err != nil {
        t.Fatal(err)
    }
    defer loader.Close()

    // Each test is independent, no interference
    loader.Set("KEY", "test-value")
    val := loader.GetString("KEY")
    // Test...
}
```

### How to reset global mode tests?

Use `ResetDefaultLoader()`:

```go
func TestGlobalMode(t *testing.T) {
    // Clean up previous test state
    env.ResetDefaultLoader()
    defer env.ResetDefaultLoader()

    env.Load(".env.test")
    // Test...
}
```

:::tip Full testing guide
See the [Testing](../guides/testing) guide for complete testing documentation.
:::

## Security and Lifecycle

### Are process-environment variables still there after Close?

**Yes.** `Close()` zeroes only the in-memory copies; it does not unset variables previously applied to `os.Environ` (deliberate design: the process environment may already have been inherited by child processes, so rollback semantics would be unreliable). To remove them, call `Delete` per key before closing — only keys this loader wrote get unset.

### How do I stop a configuration file from reading process secrets?

When the configuration file comes from an untrusted source (user uploads, external delivery), the default expansion scope lets `${VAR}` fall back to the process environment, risking secrets being captured into variable values. Enable the file-only scope to block it:

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
cfg.ExpansionScope = env.ExpansionFileOnly // ${VAR} resolves file-local variables only
```

See [Variable Expansion · Expansion Scope](../guides/variable-expansion).

### Why did the `$` in my value change when read back?

With variable expansion enabled by default, `$VAR`/`${VAR}` sequences are expanded at load time. If a value contains literal dollar signs (prices, template strings), load with `cfg.ExpandVariables = false`, or see [Serialization · Round-trip Pitfalls](../guides/serialization) for the analogous problem when Marshal output is read back.

## Related Documentation

- [Quick Start](../getting-started/) — 5-minute introduction
- [Cheat Sheet](../getting-started/cheatsheet) — High-frequency code snippets
- [Error Handling](../guides/error-handling) — Sentinel errors and recovery strategies
- [File Format](./file-format) — .env/JSON/YAML syntax
