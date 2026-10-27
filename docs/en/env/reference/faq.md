---
sidebar_label: "FAQ"
title: "FAQ - CyberGo env | Environment Variable Common Questions"
description: "CyberGo env FAQ: global vs instance mode, one-time Load, nested JSON/YAML keys, GetSlice generics, thread safety, SecureValue lifecycle, and OverwriteExisting."
sidebar_position: 2
---

# FAQ

## Basic Usage

### Should I choose Load() or New()?

**`env.Load()`** (global mode) suits simple applications: load once, then use package-level functions. It applies variables to the process environment.

**`env.New()`** (instance mode) suits tests and multi-configuration programs: it creates an isolated instance, applies nothing unless `cfg.AutoApply = true`, and requires an explicit `Close()`.

```go
// Simple application → global mode
env.Load(".env")
port := env.GetInt("PORT", 8080)

// Testing / multi-configuration → instance mode
loader, _ := env.New(env.TestingConfig())
defer loader.Close()
loaderPort := loader.GetInt("PORT", 8080)
```

:::tip How to choose
Start with `env.Load()`. Switch to `env.New()` when you need test isolation or more than one configuration at a time.
:::

### Why can Load() only be called once?

`Load()` sets the default loader, and a second call returns `ErrAlreadyInitialized`. The restriction prevents a later load from silently replacing configuration that is already in use.

```go
// First call: succeeds
env.Load(".env")

// Second call: returns an error
err := env.Load(".env.production")
// err == env.ErrAlreadyInitialized
```

**Solutions:**

```go
// Solution 1: Load multiple files at once (recommended)
env.Load(".env", ".env.production")

// Solution 2: Reset first when re-initialization is needed (mainly for tests)
if err := env.ResetDefaultLoader(); err != nil {
    log.Printf("warning: failed to reset loader: %v", err)
}
env.Load(".env.production")
```

### What happens when the .env file doesn't exist?

The default is to **skip a missing file without an error**, which supports the "load if present, ignore if absent" deployment pattern.

```go
// DefaultConfig: skips a missing file
env.Load(".env", ".env.local")
// No error even when neither file exists
```

To get an error instead (recommended in production):

```go
cfg := env.ProductionConfig()
// FailOnMissingFile is true in this preset
loader, _ := env.New(cfg)
```

### How to access nested JSON/YAML values?

Nested JSON/YAML structures are **flattened** to underscore-separated key names:

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

The three forms are equivalent; distinct names only illustrate them:

```go
nameFlat := env.GetString("DATABASE_HOST")  // Flat key (recommended)
nameDot := env.GetString("database.host")   // Dot path
nameUpper := env.GetString("DATABASE.HOST") // Uppercase dot path
```

The full conversion table is in [Multi-format Config · Key Resolution](../guides/multi-format#key-resolution).

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

Two sources are tried in order:

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

`GetBool` is case-insensitive and accepts these values:

| Truthy | Falsy |
|--------|-------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

An empty string parses as `false` rather than falling back to the default. Any other value is audited and returns the default.

## Concurrency and Thread Safety

### Can I call Get from multiple goroutines simultaneously?

**Yes.** All Loader methods are thread-safe. Sharded locks keep read and write contention low under concurrency.

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

A `Loader` instance (not just the package-level functions) can be shared the same way; see [Concurrency & Lifecycle](../guides/concurrency).

### What happens when calling Get after Loader.Close()?

Getters return zero values and do not panic. Writes return `ErrClosed`.

```go
loader, _ := env.New()
defer loader.Close()

val := loader.GetString("KEY") // Returns a value

// After Close()
val = loader.GetString("KEY")  // Returns "" (zero value)
err := loader.Set("KEY", "v")  // Returns ErrClosed
_ = val
_ = err
```

## SecureValue

### What's the difference between Release and Close?

`Release()` zeroes the value, unlocks the memory, and returns the object to the pool; `Close()` zeroes and unlocks but does not return it to the pool. Use `Release()` by default. For the full comparison see [Memory Locking · Prefer Release Over Close](../security/memory-locking#prefer-release-over-close).

### Does SecureValue auto-zero when garbage collected?

**Yes.** `SecureValue` installs a finalizer that zeroes the memory during garbage collection. Call `Release()` or `Close()` explicitly anyway, so cleanup happens at a known time instead of whenever the GC runs.

```go
// ✅ Recommended: explicit release
sv := env.GetSecure("API_KEY")
defer sv.Release()

// ⚠️ Relying on GC: safe but not timely
svNoRelease := env.GetSecure("API_KEY")
_ = svNoRelease // no Release call; the GC finalizer zeroes it eventually
```

### How to safely log?

Use `Masked()` or the masking functions, and never print a `Reveal()` value:

```go
sv := env.GetSecure("API_KEY")
defer sv.Release()

// ✅ Safe: masked output
log.Printf("API Key: %s", sv.Masked())    // [SECURE:32 bytes]
log.Printf("API Key: %s", sv)              // Same (String() returns Masked())
// With memory locking disabled there is no status suffix; locking enabled and
// successful yields [SECURE:32 bytes locked]

// ✅ Safe: masking functions
masked := env.MaskValue("API_KEY", "sk-xxx") // [MASKED] (sensitive key → fixed mask)
clean := env.SanitizeForLog(logMessage)       // Auto-detect and mask

// ❌ Dangerous: plaintext leak
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

`OverwriteExisting` controls whether `Set` and file loads replace a key that already exists:

```go
// Default: no overwriting (safe)
cfg := env.DefaultConfig()
cfg.OverwriteExisting = false

// Development: allow overwriting
cfg = env.DevelopmentConfig()
// OverwriteExisting = true
```

### When does RequiredKeys validation execute?

Required keys are checked once when parsing or loading finishes: `loader.LoadFiles(...)` returns `validation error on field "required_keys": missing required keys: ...` when a key is missing, and `env.New(cfg)` returns the same error when `Filenames` is non-empty. `Validate()` then checks the current store again, which is useful after setting extra values post-load:

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.Filenames = nil // loaded explicitly below

loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}

// Checked when loading finishes
if err := loader.LoadFiles(".env"); err != nil {
    if errors.Is(err, env.ErrMissingRequired) {
        log.Fatal("Missing required environment variables")
    }
}

// Explicit validation: checks the current store again
if err := loader.Validate(); err != nil {
    if errors.Is(err, env.ErrMissingRequired) {
        log.Fatal("Missing required environment variables")
    }
}
```

## Testing

### How to isolate the environment in tests?

Use `TestingConfig()` with an independent Loader instance per test:

```go
func TestConfig(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.OverwriteExisting = true

    loader, err := env.New(cfg)
    if err != nil {
        t.Fatal(err)
    }
    defer loader.Close()

    // Each test gets its own loader
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
    if err := env.ResetDefaultLoader(); err != nil {
        t.Logf("reset default loader: %v", err)
    }
    defer func() {
        if err := env.ResetDefaultLoader(); err != nil {
            t.Logf("reset default loader: %v", err)
        }
    }()

    env.Load(".env.test")
    // Test...
}
```

:::tip Full testing guide
See the [Testing](../guides/testing) guide.
:::

## Security and Lifecycle

### Are process-environment variables still there after Close?

**Yes.** `Close()` zeroes and unlocks the in-memory copies; it does not unset variables previously applied to the process environment. Removing them is deliberate caller work: the environment may already have been inherited by child processes, so automatic rollback is not attempted. Call `Delete` per key before closing; only keys this loader wrote get unset. `ResetDefaultLoader()` also leaves applied variables in place.

### How do I stop a configuration file from reading process secrets?

When a configuration file comes from an untrusted source (user uploads, external delivery), an expansion scope that lets `${VAR}` fall back to the process environment can capture secrets into variable values. `DefaultConfig()` already selects the file-only scope (`ExpansionFileOnly`), which blocks that fallback; the assignment below states the default explicitly:

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
cfg.ExpansionScope = env.ExpansionFileOnly // ${VAR} resolves file-local variables only (already the default)
```

See [Variable Expansion · Expansion Scope](../guides/variable-expansion).

### Why did the `$` in my value change when read back?

`ExpandVariables` is enabled by default, so `$VAR` and `${VAR}` sequences are expanded at load time. If a value contains literal dollar signs (prices, template strings), load it with `cfg.ExpandVariables = false`. `Marshal` output is not affected by this: the library escapes `$` as `\$`, so a Marshal → load round trip does not re-expand. See [Serialization](../guides/serialization#round-trip-behavior-and-format-auto-detection).

## Related Documentation

- [Quick Start](../getting-started/) - 5-minute introduction
- [Cheat Sheet](../getting-started/cheatsheet) - high-frequency snippets
- [Error Handling](../guides/error-handling) - sentinel errors and recovery strategies
- [File Format](./file-format) - .env/JSON/YAML syntax
