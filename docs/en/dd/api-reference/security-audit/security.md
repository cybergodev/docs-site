---
sidebar_label: "Security"
title: "Security Filtering - CyberGo DD | Sensitive Data Filtering"
description: "Complete API documentation for CyberGo DD's sensitive-data filtering, including the SensitiveDataFilter rule configuration, SecurityConfig security-policy options, and preset security configurations. Automatically detects and redacts passwords, API keys, tokens, phone numbers, SSNs, and other sensitive information in logs, effectively preventing log leakage."
sidebar_position: 2
---

# Security Filtering

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

## SecurityConfig

Security configuration struct controlling filter behavior and security level.

```go
type SecurityConfig struct {
    MaxMessageSize  int                       // Message size cap in bytes (0 means no limit; preset configs default to 5MB)
    MaxWriters      int                       // Max writer count (preset configs default to 100)
    SensitiveFilter *SensitiveDataFilter      // Sensitive-data filter
    RateLimitConfig *internal.RateLimitConfig // Rate-limit config (internal type; nil disables rate limiting; preset configs do not populate this field)
}
```

:::info About RateLimitConfig
`RateLimitConfig` controls log rate limiting, used to prevent log flooding (DoS) and keep the system stable under high load. The field is an internal type (`*internal.RateLimitConfig`) and cannot be constructed directly. All preset configs (`DefaultSecurityConfig`, `DefaultSecureConfig`, `SecurityConfigForLevel`, etc.) **do not populate** this field, i.e. rate limiting is disabled by default; the Logger initializes a rate limiter only when it is explicitly set. To disable rate limiting, set it to `nil`.
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
| `SecurityLevelBasic` | Basic filtering (passwords, tokens, API keys, credit cards, SSNs, phones, SWIFT/CVV, etc. — about 40 common sensitive-data categories) |
| `SecurityLevelStandard` | Standard filtering (recommended for production) |
| `SecurityLevelStrict` | Strict filtering (PII / financial-data environments) |
| `SecurityLevelParanoid` | Maximum filtering (high-risk environments) |

### Preset Configurations

| Function | Description | Use Case |
|----------|-------------|----------|
| `DefaultSecurityConfig()` | Basic sensitive-data filtering | Production (recommended) |
| `DefaultSecureConfig()` | Complete sensitive-data filtering | High-security needs |
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

### Clone

```go
func (c *SecurityConfig) Clone() *SecurityConfig
```

Creates a deep copy of the security configuration.

## Usage

### Configuring via Config

```go
// DefaultConfig already embeds DefaultSecurityConfig(); usually no need to assign explicitly
cfg := dd.DefaultConfig()
logger, _ := dd.New(cfg)

// To replace with a higher security-level config, override explicitly
// cfg.Security = dd.DefaultSecureConfig()
```

### Runtime Modification

```go
// Update the security config
logger.SetSecurityConfig(dd.DefaultSecureConfig())

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
