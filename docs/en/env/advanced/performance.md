---
title: Performance - CyberGo env | Concurrency & Tuning
description: Performance optimization guide for the env library covering concurrency safety, object pooling, memory locking usage patterns, and benchmark data
---

# Performance Optimization

The env library is optimized for high-performance scenarios. This document covers concurrency safety, object pooling, memory management, and other performance-related features.

## Concurrency Safety

### Thread Safety Guarantees

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

### Package-Level Function Thread Safety

Package-level functions use a global loader and are also thread-safe:

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

The library uses sharded storage to reduce lock contention:

```text
┌─────────────────────────────────────────┐
│              Loader (8 Shards)           │
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐    ┌────────┐ │
│  │ Shard 0 │ │ Shard 1 │... │ Shard 7│ │
│  │  Lock   │ │  Lock   │    │  Lock  │ │
│  │  Data   │ │  Data   │    │  Data  │ │
│  └─────────┘ └─────────┘    └────────┘ │
└─────────────────────────────────────────┘
```

- Keys are distributed to different shards based on hash values
- Each shard has its own lock
- Reduces lock contention and improves concurrent performance

## Object Pooling

### Why Object Pooling

Frequent object creation and destruction increases GC pressure:

```text
Without pooling:
Create object → Use → GC collect → Create object → Use → GC collect ...

With pooling:
Create object → Use → Return to pool → Get → Use → Return to pool ...
```

### SecureValue Pool

`SecureValue` objects use pool management:

```go
// Get a SecureValue (may be reused from pool)
secret := env.GetSecure("API_KEY")

// Use it
value := secret.String()

// Release back to pool
secret.Close()  // or secret.Release()
```

### Using Object Pools Correctly

**Release promptly:**

```go
func processData() {
    secret := env.GetSecure("SECRET")
    if secret == nil {
        return
    }
    defer secret.Release()  // Return to pool

    // Use secret...
}
```

**Don't hold references:**

```go
// Wrong: holding a reference to a released object
var globalSecret *env.SecureValue

func init() {
    globalSecret = env.GetSecure("KEY")
    globalSecret.Release()  // After release, object may be reused
}

func later() {
    // Dangerous: globalSecret may already be in use by other code
    globalSecret.String()
}

// Correct: get fresh instance each time
func getSecret() string {
    secret := env.GetSecure("KEY")
    if secret == nil {
        return ""
    }
    defer secret.Release()
    return secret.String()
}
```

**Check closed state:**

```go
secret := env.GetSecure("KEY")
if secret == nil {
    // Key does not exist
    return
}

// Check before use
if secret.IsClosed() {
    // Object is closed, cannot be used
}

// Release after use (returns to pool)
secret.Release()

// Check after releasing
if secret.IsClosed() {
    // Already closed
}
```

## Memory Safety

### Memory Locking

Enable memory locking to prevent sensitive data from being swapped to disk:

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
| FreeBSD | ✅ |
| wasm | ❌ |

::: tip See also
[SecureValue API - Memory Locking Configuration](/en/env/api-reference/secure-value#memory-locking-configuration) for complete configuration details.
:::

### Strict Mode

In strict mode, memory locking failure causes an error:

```go
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("sensitive_data")
if err != nil {
    // Memory locking failed
}
```

### Secure Zeroing

`SecureValue` automatically zeroes memory on close:

```go
secret := env.GetSecure("PASSWORD")
// Internal storage: ['p', 'a', 's', 's', ...]

secret.Close()
// Internal storage: [0, 0, 0, 0, ...]
```

Manually zero byte slices:

```go
sensitiveBytes := []byte("secret")
env.ClearBytes(sensitiveBytes)
// sensitiveBytes is now all zeros
```

## Performance Patterns

### Read-Only After Initialization

The most efficient pattern: load configuration at startup, read-only at runtime:

```go
var config *Config

func init() {
    env.Load(".env")

    config = &Config{}
    env.ParseInto(config)
}

// Safe to read from any goroutine
func getValue() string {
    return config.Key
}
```

### Dynamic Configuration Refresh

Pattern for when dynamic configuration updates are needed:

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

```go
// Not recommended: perform expensive operations inside lock
func (l *Loader) ProcessValue(key string) {
    value := l.GetString(key)
    // Expensive operation...
    processValue(value)
}

// Recommended: read quickly, process outside lock
func ProcessValue(key string) {
    value := loader.GetString(key)  // Quick read
    go processValue(value)          // Async processing
}
```

### Batch Operations

```go
// Get all needed values at once
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

```go
// Not recommended: read on every request
func Handler(w http.ResponseWriter, r *http.Request) {
    apiKey := env.GetString("API_KEY")  // Locks on every request
    // ...
}

// Recommended: cache at startup
var apiKey string

func init() {
    env.Load(".env")
    apiKey = env.GetString("API_KEY")
}

func Handler(w http.ResponseWriter, r *http.Request) {
    // Use cached value directly
    // ...
}
```

## Performance Impact

### Object Pool Benefits

| Operation | Without Pool | With Pool |
|-----------|-------------|-----------|
| Allocations | N | ~constant |
| GC Pressure | High | Low |
| Latency | Unstable | Stable |

### Memory Locking Overhead

| Operation | Without Lock | With Lock |
|-----------|-------------|-----------|
| Create | ~100ns | ~1μs |
| Read | ~10ns | ~10ns |

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

## Important Notes

### Avoid Blocking Inside Locks

```go
// Dangerous: may cause deadlock
func (l *Loader) BadMethod() {
    // Calling potentially blocking operations inside lock
    l.Set("KEY", computeValue())  // computeValue may be slow
}

// Safe: compute first, then set
func GoodMethod() {
    value := computeValue()  // Compute outside lock
    loader.Set("KEY", value)  // Quick set
}
```

### Concurrent Access After Close

```go
loader, _ := env.New(cfg)

// Start goroutine
go func() {
    time.Sleep(1 * time.Second)
    loader.GetString("KEY")  // May return ErrClosed
}()

loader.Close()  // Main goroutine closes
```

### Global Loader Reset

```go
// Not concurrency-safe: do not call at runtime
env.ResetDefaultLoader()

// Safe: only call during tests or startup
func init() {
    env.ResetDefaultLoader()
    env.Load(".env")
}
```

## Related Documentation

- [SecureValue API](/en/env/api-reference/secure-value) - Secure value handling and memory locking
- [Loader API](/en/env/api-reference/loader) - Loader methods
- [Testing Scenarios](/en/env/guides/testing) - Benchmark examples
