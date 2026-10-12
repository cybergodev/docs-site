---
sidebar_label: "Security"
title: "Security Filtering - CyberGo DD | Sensitive Data Filtering"
description: "CyberGo DD sensitive-data filtering: SensitiveDataFilter rules, SecurityConfig options, and presets that auto-redact passwords, API keys, and tokens in logs."
sidebar_position: 2
---

# Security Filtering

> 🔧 **API Reference** · For a hands-on tutorial see [Sensitive Data Filtering](../../guides/security/sensitive-filtering)

DD has built-in sensitive-data filtering that automatically detects and redacts passwords, keys, tokens, and other sensitive information in logs.

## SensitiveDataFilter

Regex-based sensitive-data filter supporting dynamic patterns and caching.

### Creation

| Function | Signature | Description |
|----------|-----------|-------------|
| `NewSensitiveDataFilter` | `() *SensitiveDataFilter` | Full pattern set |
| `NewEmptySensitiveDataFilter` | `() *SensitiveDataFilter` | Empty filter |
| `NewCustomSensitiveDataFilter` | `(patterns ...string) (*SensitiveDataFilter, error)` | Custom patterns |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `AddPattern` | `(pattern string) error` | Add a regex pattern |
| `AddPatterns` | `(patterns ...string) error` | Add patterns in batch |
| `ClearPatterns` | `()` | Clear all patterns |
| `PatternCount` | `() int` | Pattern count |
| `Enable` | `()` | Enable filtering |
| `Disable` | `()` | Disable filtering |
| `IsEnabled` | `() bool` | Whether enabled |
| `Filter` | `(input string) string` | Filter a string |
| `FilterFieldValue` | `(key string, value any) any` | Filter a single field value |
| `FilterString` | `(key, value string) string` | Filter a string value (keyed context) |
| `FilterValueRecursive` | `(key string, value any) any` | Recursively filter nested structures |
| `GetFilterStats` | `() FilterStats` | Get filtering statistics |
| `ActiveGoroutineCount` | `() int32` | Active filter goroutines |
| `WaitForGoroutines` | `(timeout time.Duration) bool` | Wait for filter goroutines to finish |
| `Close` | `() bool` | Close the filter and release caches |

### Custom Patterns

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,     // Password
    `(?i)api[_-]?key\s*[:=]\s*\S+`,  // API Key
    `\b\d{16,19}\b`,                  // Credit card number
)
```

#### Errors

The pattern-registration APIs (`NewCustomSensitiveDataFilter` / `AddPattern` / `AddPatterns`) can return the following errors:

| Error | Trigger |
|-------|---------|
| `ErrEmptyPattern` | The pattern is an empty string (`AddPatterns` skips empty patterns instead of erroring) |
| `ErrPatternTooLong` | The pattern exceeds 1000 characters |
| `ErrInvalidPattern` | The regex fails to compile (wraps the underlying `regexp.Compile` error) |
| `ErrReDoSPattern` | The pattern contains dangerous nested quantifiers (ReDoS protection) |
| `ErrNilFilter` | The method receiver is `nil` |
| `ErrPatternFailed` | Outer wrapper returned by `AddPatterns` on failure, with the specific cause inside (both match via `errors.Is`) |

## SecurityConfig

Security configuration struct controlling filter behavior and security level.

```go
type SecurityConfig struct {
    MaxMessageSize  int                  // Message size cap in bytes (0 means no limit; preset configs default to 5MB)
    MaxWriters      int                  // Max writer count (preset configs default to 100; currently informational — the cap is a fixed 100 enforced by Logger.AddWriter, not by this value)
    SensitiveFilter *SensitiveDataFilter // Sensitive-data filter
    RateLimitConfig *RateLimitConfig     // Rate-limit config (type alias exported by the dd package; nil disables rate limiting; preset configs do not populate this field)
}
```

### RateLimitConfig

Rate-limit configuration, used to prevent log flooding (DoS) and keep the system stable under high load. The `dd` package exports the type alias `type RateLimitConfig = internal.RateLimitConfig`, which can be constructed and modified directly; it takes effect when attached to [`SecurityConfig.RateLimitConfig`](#securityconfig).

```go
type RateLimitConfig struct {
    MaxMessagesPerSecond int               // Max messages per second (0 means no limit)
    MaxBytesPerSecond    int64             // Max bytes per second (0 means no limit)
    BurstSize            int               // Burst capacity (allows transient spikes above the per-second message quota)
    Strategy             RateLimitStrategy // Over-limit handling strategy
    SamplingRate         int               // Sampling keep rate (with the Sample strategy, keeps 1 in N messages)
}
```

#### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `MaxMessagesPerSecond` | `int` | `10000` | Max messages per second; `0` means no limit |
| `MaxBytesPerSecond` | `int64` | `10MB` | Max bytes written per second; `0` means no limit |
| `BurstSize` | `int` | `1000` | Burst capacity, tolerating transient spikes in log volume |
| `Strategy` | `RateLimitStrategy` | `RateLimitStrategyDrop` | Over-limit handling strategy (see the next section) |
| `SamplingRate` | `int` | `100` | With `RateLimitStrategySample`, keeps 1 in 100 messages |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Clone` | `func (c *RateLimitConfig) Clone() *RateLimitConfig` | Copy the config (a nil receiver returns `nil`) |

:::info Rate limiting disabled by default
All preset configs (`DefaultSecurityConfig`, `SecurityConfigForLevel`, etc.) **do not populate** the `RateLimitConfig` field, i.e. rate limiting is disabled by default; the Logger initializes a rate limiter only when it is explicitly set. To enable it, start from the factory `DefaultRateLimitConfig()` and adjust the fields as needed; to disable it, set it to `nil`. When over-limit messages are dropped or sampled, a `RATE_LIMIT_EXCEEDED` audit event is emitted if auditing is configured (`Config.Audit`).
:::

### RateLimitStrategy

Rate-limit strategy enum that determines how over-limit messages are handled (the `dd` package exports the type alias `type RateLimitStrategy = internal.RateLimitStrategy`); set it via the `RateLimitConfig.Strategy` field:

| Constant | Description |
|----------|-------------|
| `RateLimitStrategyDrop` | Drops messages when the rate limit is exceeded (default strategy) |
| `RateLimitStrategySample` | When rate limited, keeps 1 in `SamplingRate` messages |
| `RateLimitStrategyThrottle` | Accepted for API completeness; currently behaves the same as `RateLimitStrategyDrop` (see the note below) |

:::warning Current status of the Throttle strategy
`RateLimitStrategyThrottle` is a non-blocking implementation and currently behaves exactly like `RateLimitStrategyDrop` — over-limit messages are dropped outright, not delayed or back-pressured. The logger hot path must never block, so internally this strategy falls through to the drop branch; the constant is retained only for future non-blocking throttle strategies. Do not rely on it for true backpressure.
:::

### FilterStats

Filter statistics struct, used for monitoring and observability.

```go
type FilterStats struct {
    ActiveGoroutines  int32         // Currently active filter goroutines
    PatternCount      int32         // Number of registered sensitive-data patterns
    SemaphoreCapacity int           // Max concurrent filter operations
    MaxInputLength    int           // Input length truncation threshold
    Enabled           bool          // Whether filtering is enabled
    TotalFiltered     int64         // Total filter operations
    TotalRedactions   int64         // Total redactions
    TotalTimeouts     int64         // Total timeouts
    AverageLatency    time.Duration // Average filter latency
    CacheHits         int64         // Cache hits
    CacheMiss         int64         // Cache misses
}
```

### SecurityLevel

Security level enum, used with `SecurityConfigForLevel` to quickly obtain preset configurations.

```go
type SecurityLevel int
```

Implements a `String()` method returning a readable level name.

| Constant | Description |
|----------|-------------|
| `SecurityLevelDevelopment` | Development (no sensitive filtering, no rate limiting) |
| `SecurityLevelBasic` | Basic filtering (passwords, tokens, API keys, credit cards, SSNs, phones, SWIFT/CVV, etc. — 38 common sensitive-data categories; the full pattern library has 69) |
| `SecurityLevelStandard` | Standard filtering (recommended for production) |
| `SecurityLevelStrict` | Strict filtering (PII / financial-data environments) |
| `SecurityLevelParanoid` | Maximum filtering (high-risk environments) |

### Preset Configurations

| Function | Description | Use Case |
|----------|-------------|----------|
| `DefaultSecurityConfig()` | Basic sensitive-data filtering | Production (recommended) |
| `DefaultSecureConfig()` <Badge type="warning" text="Deprecated" /> | Complete sensitive-data filtering (a near-homonym of `DefaultSecurityConfig` with a different filtering strength, easy to confuse; **use `SecurityConfigForLevel(dd.SecurityLevelStandard)` instead**) | High-security needs |
| `HealthcareConfig()` | HIPAA compliance | Medical industry |
| `FinancialConfig()` | PCI-DSS compliance | Financial industry |
| `GovernmentConfig()` | Government standard | Public sector |

### Configuration by Level

```go
func SecurityConfigForLevel(level SecurityLevel) *SecurityConfig
```

| Level | Constant | Description |
|-------|----------|-------------|
| Development | `SecurityLevelDevelopment` | Development, most permissive |
| Basic | `SecurityLevelBasic` | Basic filtering |
| Standard | `SecurityLevelStandard` | Standard filtering |
| Strict | `SecurityLevelStrict` | Strict filtering |
| Paranoid | `SecurityLevelParanoid` | Maximum filtering |

:::tip Level presets only select the filter
A security level only determines the filtering strength of `SensitiveFilter`: rate limiting (`RateLimitConfig`), audit logging (`Config.Audit`), and integrity signing (`Config.Audit.IntegritySigner`) are separate settings that no level preset enables — configure them explicitly when needed.
:::

### Clone

```go
func (sc *SecurityConfig) Clone() *SecurityConfig
```

Creates a deep copy of the security configuration: both `SensitiveFilter` and `RateLimitConfig` are copied into independent instances; a nil receiver returns `nil`.

## Usage

### Configuring via Config

```go
// DefaultConfig already embeds DefaultSecurityConfig(); usually no need to assign explicitly
cfg := dd.DefaultConfig()
logger, _ := dd.New(cfg)

// To replace with a higher security-level config, override explicitly
// cfg.Security = dd.SecurityConfigForLevel(dd.SecurityLevelStandard)
```

### Runtime Modification

```go
// Update the security config
logger.SetSecurityConfig(dd.SecurityConfigForLevel(dd.SecurityLevelStandard))

// Read the current config
sec := logger.GetSecurityConfig()
```

### Filtering Nested Structures

```go
filter := dd.NewSensitiveDataFilter()

// String filtering
filtered := filter.Filter("password=s3cr3t")
// -> "password=[REDACTED]"

// Nested structures (auto-recursive, supports cycle detection)
data := map[string]any{
    "user": map[string]any{
        "name":     "admin",
        "password": "s3cr3t",
        "token":    "eyJhbGciOi...",
    },
}
filteredData := filter.FilterValueRecursive("data", data)
```

### Monitoring Filter Statistics

```go
filter := dd.NewSensitiveDataFilter()
// ... use the filter ...
stats := filter.GetFilterStats()
fmt.Printf("Total filtered: %d, redactions: %d, avg latency: %v\n",
    stats.TotalFiltered, stats.TotalRedactions, stats.AverageLatency)
```

## Next Steps

- [Config](../core/config) -- SecurityConfig configuration
- [Logger](../core/logger) -- SetSecurityConfig method
- [Audit Logging](./audit) -- Security event auditing
