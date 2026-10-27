---
sidebar_label: "Performance"
title: "Performance - CyberGo env | High-Concurrency Tuning"
description: "CyberGo env performance guide: 32-shard locks for concurrency, sync.Pool reuse of SecureValue, mlock tradeoffs, high-throughput patterns and benchmarks."
sidebar_position: 1
---

# Performance

env is built around sharded storage, an object pool for `SecureValue`, and a lock-free fast path for single-key reads. The sections below describe those mechanisms, the patterns that use them well, and the benchmark code to measure them.

## Concurrency Safety

### Thread Safety Guarantee

All `Loader` methods are thread-safe:

```go
loader, _ := env.New(env.DefaultConfig())
defer loader.Close()

var wg sync.WaitGroup

// Concurrent reads
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        loader.GetString("KEY")
    }()
}

// Concurrent writes
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func(n int) {
        defer wg.Done()
        loader.Set(fmt.Sprintf("KEY_%d", n), "value")
    }(i)
}

wg.Wait()
```

### Package-level Function Thread Safety

Package-level functions operate on the default loader and are equally thread-safe:

```go
var wg sync.WaitGroup

for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        env.GetString("KEY", "default")
    }()
}

wg.Wait()
```

### Internal Implementation

The library spreads all variables across 32 shards to reduce lock contention:

```text
┌──────────────────────────────────────────────┐
│              Loader (32 shards)              │
├──────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐        ┌──────────┐ │
│  │ Shard 0 │ │ Shard 1 │  ...   │ Shard 31 │ │
│  │  Lock   │ │  Lock   │        │   Lock   │ │
│  │  Data   │ │  Data   │        │   Data   │ │
│  └─────────┘ └─────────┘        └──────────┘ │
└──────────────────────────────────────────────┘
```

- `internal.HashKey` selects the shard: a multiplicative hash for short keys, FNV-1a sampling for longer ones
- Each shard has its own lock
- Reads and writes on different shards proceed in parallel, so contention spreads over 32 locks

## Object Pool

### Why Use Object Pooling

Frequent creation and destruction of objects raises GC pressure:

```text
Without object pool:
Create object → Use → GC collect → Create object → Use → GC collect ...

With object pool:
Create object → Use → Return to pool → Get → Use → Return to pool ...
```

### SecureValue Pool

`SecureValue` objects are pooled:

```go
// Get a SecureValue (reused from the pool when one is available, else allocated)
secret := env.GetSecure("API_KEY")

// Use (Reveal returns plaintext; String and Masked return masks)
value := secret.Reveal()

// Return to the pool
secret.Release()  // zeroes, unlocks, and returns to the pool; Close() zeroes and unlocks but does not pool it
```

### Proper Object Pool Usage

**Release promptly:**

```go
func processData() {
    secret := env.GetSecure("SECRET")
    defer secret.Release()  // release as soon as you are done

    // Use secret...
}
```

**Do not hold references:**

```go
// Wrong: keeping a reference to an object returned to the pool
var globalSecret *env.SecureValue

func init() {
    globalSecret = env.GetSecure("KEY")
    globalSecret.Release()  // zeroes and returns the object to sync.Pool
}

func later() {
    // Dangerous: another goroutine may already have taken this object from the
    // pool and written a different value into it, so the read below can return
    // someone else's data
}

// Correct: get it each time it is needed
func getSecret() string {
    secret := env.GetSecure("KEY")
    defer secret.Release()
    return secret.Reveal()
}
```

**Check closed state:**

```go
secret := env.GetSecure("KEY")

// Check before use
if secret.IsClosed() {
    // Object has been closed and cannot be used
}

// Close after use
secret.Close()

// Check after closing
if secret.IsClosed() {
    // Already closed
}
```

## Memory Safety

### Memory Locking

Memory locking prevents sensitive data from being swapped to disk:

```go
// Check platform support
if env.IsMemoryLockSupported() {
    env.SetMemoryLockEnabled(true)
}
```

**Platform support:**

| Platform | Supported |
|----------|-----------|
| Linux | ✅ |
| macOS | ✅ |
| Windows | ✅ |
| Other platforms (FreeBSD and other BSDs, Solaris, WASM) | ❌ |

:::tip
See [SecureValue API - Memory Lock Configuration](../api-reference/secure-value#memory-lock-configuration) for the complete configuration reference.
:::

### Strict Mode

By default a memory-locking failure is silent: the value stays usable but is not locked. `SetMemoryLockStrict(true)` makes the failure observable through the default handler, which writes to stderr. It does not change whether values work.

`NewSecureValueStrict` returns an error only when locking is enabled and the lock failed. The strict switch has no effect on that return value:

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("sensitive_data")
if err != nil {
    // handle the error
}
if secret != nil {
    defer secret.Release()
}
```

With locking enabled but failed, `Masked()` reports `[SECURE:N bytes lock-failed]`. On platforms other than Linux, macOS, and Windows, `IsMemoryLockSupported()` returns false, so the lock attempt fails and the error is stored on the value (`Masked()` shows `lock-failed`), while the `SecureValue` stays fully usable.

### Secure Zeroing

`SecureValue` zeros its memory when closed:

```go
secret := env.GetSecure("PASSWORD")
// Internal storage: ['p', 'a', 's', 's', ...]

secret.Close()
// Internal storage: [0, 0, 0, 0, ...]
```

Manual zeroing of byte slices:

```go
sensitiveBytes := []byte("secret")
env.ClearBytes(sensitiveBytes)
// sensitiveBytes is now all zeros
```

## Performance Patterns

### Read-only After Initialization

The most efficient pattern is to load configuration at startup and only read it afterwards:

```go
var config *Config

func init() {
    if err := env.Load(".env"); err != nil {
        panic(err)
    }

    config = &Config{}
    if err := env.ParseInto(config); err != nil {
        panic(err)
    }
}

// Safe to read from any goroutine
func getValue() string {
    return config.Key
}
```

### Dynamic Configuration Refresh

To update configuration at runtime, wrap the loader with a mutex:

```go
type ConfigManager struct {
    loader *env.Loader
    mu     sync.RWMutex
}

func (m *ConfigManager) Refresh() error {
    m.mu.Lock()
    defer m.mu.Unlock()

    return m.loader.LoadFiles(".env")
}

func (m *ConfigManager) Get(key string) string {
    m.mu.RLock()
    defer m.mu.RUnlock()

    return m.loader.GetString(key)
}
```

### Reduce Lock Hold Time

A single `GetString` takes the lock-free fast path, so latency is governed by the caller's own lock. Hold it long enough to read, then process outside it:

```go
// Not recommended: the slow work runs while the caller's lock is held
func (s *Service) ProcessValue(key string) {
    s.mu.Lock()
    value := s.loader.GetString(key)
    processValue(value) // the lock stays held for the whole call
    s.mu.Unlock()
}

// Recommended: read under the lock, process outside it
func (s *Service) ProcessValue(key string) {
    s.mu.Lock()
    value := s.loader.GetString(key)
    s.mu.Unlock()

    processValue(value)
}
```

### Batch Operations

```go
// Read all needed values in one pass
func LoadAllConfig(loader *env.Loader) *Config {
    return &Config{
        Host:    loader.GetString("HOST"),
        Port:    loader.GetInt("PORT"),
        Debug:   loader.GetBool("DEBUG"),
        Timeout: loader.GetDuration("TIMEOUT"),
    }
}
```

### Avoid Frequent Calls

A single-key read takes no loader-level lock, but every call still resolves the key name. On a hot path, cache the value in a local variable or a struct field:

```go
// Not recommended: every request repeats the key lookup
func Handler(w http.ResponseWriter, r *http.Request) {
    apiKey := env.GetString("API_KEY")  // Lookup on every request
    // ...
}

// Recommended: cache at startup
var apiKey string

func init() {
    env.Load(".env")
    apiKey = env.GetString("API_KEY")
}

func Handler(w http.ResponseWriter, r *http.Request) {
    // Use the cached value
    // ...
}
```

## Performance Impact

### Object Pool Benefits

| Operation | Without Pool | With Pool |
|-----------|-------------|-----------|
| Allocations per value | One per creation | Near zero once the pool is warm |
| GC pressure | Proportional to the creation rate | Lower |
| Latency | Varies with GC cycles | More stable |

### Memory Locking Overhead

Memory locking (Linux `mlock`, Windows `VirtualLock`) adds a one-time syscall cost when a `SecureValue` is created. Read operations (`Reveal`, `String`, `Masked`) are unaffected. Keep each `SecureValue` small and short-lived: call `Release()` as soon as you are done, which unlocks the memory, zeroes it, and returns the object to the pool. For the tradeoff between the two release methods, see [SecureValue API - Close vs. Release](../api-reference/secure-value#close-vs-release).

## Benchmarks

### Read Performance

```go
func BenchmarkConcurrentRead(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())
    loader.Set("KEY", "value")

    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            loader.GetString("KEY")
        }
    })
}
```

### Write Performance

```go
func BenchmarkConcurrentWrite(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())

    var i int64
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            n := atomic.AddInt64(&i, 1)
            loader.Set(fmt.Sprintf("KEY_%d", n), "value")
        }
    })
}
```

### Mixed Read/Write

```go
func BenchmarkMixedReadWrite(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())
    loader.Set("KEY", "value")

    b.RunParallel(func(pb *testing.PB) {
        i := 0
        for pb.Next() {
            if i%10 == 0 {
                loader.Set("KEY", "new_value")
            } else {
                loader.GetString("KEY")
            }
            i++
        }
    })
}
```

## Caveats

### Write-path lock windows

`Set`, `Delete`, `Apply`, and `LoadFiles` all take the loader write lock, so they run one at a time. A single `Set` takes a read-lock fast path only when `OverwriteExisting = true` and `AutoApply` is off; every other write waits for the write lock. Import a batch as one file load rather than a loop of `Set` calls:

```go
// Not recommended: one write-lock acquisition per key (plus one Setenv each with AutoApply)
for key, value := range values {
    if err := loader.Set(key, value); err != nil {
        return err
    }
}

// Recommended: write the file once, then import the whole batch with one LoadFiles call
if err := loader.LoadFiles("batch.env"); err != nil {
    return err
}
```

A slow value computation placed in the `Set` argument list is evaluated before `Set` is entered, so it holds no loader lock.

### Concurrent Access After Close

```go
loader, _ := env.New(cfg)

// Start goroutine
go func() {
    time.Sleep(1 * time.Second)
    loader.GetString("KEY")  // Returns an empty string (GetString has no error return)
}()

loader.Close()  // Main goroutine closes
```

### Default Loader Reset

- `ResetDefaultLoader` is safe for concurrent use and returns the `error` from closing the old loader; check it.
- Between the reset and the next `Load`, the package-level **write and validation** functions (`Set`/`Delete`/`Validate`/`ParseInto`) return `ErrNotInitialized`, while read functions return defaults or zero values; call it only during tests or startup.
- See [Package Functions](../api-reference/functions#resetdefaultloader) for the exact semantics.

## Concurrency Internals

The concurrency optimizations below are described at the source level and can be used for evaluation and tuning. The quantitative figures (the 23.6% atomic-operations hotspot, the finalizer at about 60% of creation cost) come from the v1.2.2/v1.2.3 benchmarks and profiles: the 23.6% figure is recorded in CHANGES.md, and the 60% figure comes from the object-pool comment in `secure.go`.

### Sharded storage (secureMap)

All variables are stored as `SecureValue` in **32 shards** (raised from 8 in v1.3.0). `internal.HashKey` selects the shard: a multiplicative hash for keys of 8 bytes or fewer, and FNV-1a sampling for longer keys. Each shard holds its own `sync.RWMutex`, so reads and writes on different shards proceed in parallel.

### Bucketed batch writes

`secureMap.SetAll` and `secureMap.SetAllIfAbsent` (the file-loading path) put the whole batch into a single flat allocation and then lock **each shard only once** for that batch. Existing keys are updated in place, reusing the `SecureValue` object, which avoids pool round trips and extra allocations.

### Lock optimizations on the read path

- **Lock-free single-key reads**: `Lookup` and `GetSecure` bypass the loader-level read lock through an atomic closed flag. Under high concurrency the RWMutex's own reader count is the bottleneck.
- **Zero-allocation `secureMap.Has`**: reads only the closed flag atomically and never copies the value string.
- **`Get` skips a second lock**: the shard read lock already keeps `SecureValue` data stable, so the object-level lock is skipped. That lock was once a 23.6% atomic-operations hotspot in profiles.
- **`Set` fast path**: with `OverwriteExisting=true` and `AutoApply` off, only a read lock is needed, so concurrent `Set` calls do not serialize on the loader mutex.

### Object pool and finalizer

`SecureValue` is reused through `sync.Pool`. The GC finalizer is installed **once at first creation** (about 60% of the creation cost) and pool cycles do not repay it. Overwriting an existing key resets in place, which reduces allocations further.

### Approximate snapshot semantics

`Len` is O(1) via an atomic counter. `Keys` and `ToMap` size their allocation from the counter, then sweep the shards. Each shard is read-locked individually, so the result is a **per-shard, approximate snapshot**: writes that happen during the sweep are not guaranteed to appear, and the shards are not read at a single point in time. Synchronize externally if you need an exact, cross-shard-consistent snapshot.

### Performance awareness for auditing

With auditing enabled, the load path adds `time.Now` and event-construction overhead; with auditing disabled that cost is entirely avoided. In high-throughput scenarios, enable auditing only under `ProductionConfig`, or consume events asynchronously with `ChannelAuditHandler`.

## Related Documentation

- [SecureValue API](../api-reference/secure-value) - secure value handling and memory locking
- [Loader API](../api-reference/loader) - Loader methods
- [Testing](../guides/testing) - benchmark examples
