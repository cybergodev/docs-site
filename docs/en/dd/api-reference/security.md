---
title: "Security Filtering - CyberGo DD | Sensitive Data Filtering"
description: "CyberGo DD security filtering API: SensitiveDataFilter rules, SecurityConfig policies, auto-masking passwords, tokens, and API keys in logs."
---

# Security Filtering

DD has built-in sensitive data filtering that automatically detects and masks sensitive information such as passwords, keys, and tokens in logs.

## SensitiveDataFilter

Regex-based sensitive data filter with support for dynamic patterns and caching.

### Creation

| Function | Description |
|----------|-------------|
| `NewSensitiveDataFilter()` | Full pattern set |
| `NewEmptySensitiveDataFilter()` | Empty filter |
| `NewCustomSensitiveDataFilter(patterns ...string)` | Custom patterns |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `AddPattern` | `(pattern string) error` | Add regex pattern |
| `AddPatterns` | `(patterns ...string) error` | Batch add patterns |
| `ClearPatterns` | `()` | Clear all patterns |
| `PatternCount` | `() int` | Number of patterns |
| `Enable` | `()` | Enable filtering |
| `Disable` | `()` | Disable filtering |
| `IsEnabled` | `() bool` | Whether enabled |
| `Filter` | `(input string) string` | Filter string |
| `FilterFieldValue` | `(key string, value any) any` | Filter single field value |
| `FilterValueRecursive` | `(key string, value any) any` | Recursively filter nested structures |
| `GetFilterStats` | `() FilterStats` | Get filter statistics |
| `ActiveGoroutineCount` | `() int32` | Active filter goroutine count |
| `WaitForGoroutines` | `(timeout time.Duration) bool` | Wait for filter goroutines to complete |
| `Close` | `() bool` | Close filter and release cache |

### Custom Patterns

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,     // Passwords
    `(?i)api[_-]?key\s*[:=]\s*\S+`,  // API Keys
    `\b\d{16,19}\b`,                  // Credit card numbers
)
```

## SecurityConfig

Security configuration struct, controlling filter behavior and security level.

```go
type SecurityConfig struct {
    MaxMessageSize  int                       // Message size limit in bytes (0 means no limit, default 5MB in preset configs)
    MaxWriters      int                       // Maximum Writer count (default 100)
    SensitiveFilter *SensitiveDataFilter      // Sensitive data filter
    RateLimitConfig *internal.RateLimitConfig // Rate limiting config (internal type, auto-filled by preset configs; nil disables rate limiting)
}
```

:::info About RateLimitConfig
`RateLimitConfig` controls log rate limiting to prevent log flooding (DoS) and maintain system stability under load. This field is an internal type (`*internal.RateLimitConfig`) and cannot be constructed directly; it is typically auto-filled by preset configs such as `SecurityConfigForLevel` or `DefaultSecureConfig`. Set it to `nil` to disable rate limiting.
:::

### FilterStats

Filter statistics structure for monitoring and observability.

```go
type FilterStats struct {
    ActiveGoroutines  int32         // Currently active filter goroutines
    PatternCount      int32         // Registered sensitive data pattern count
    SemaphoreCapacity int           // Maximum concurrent filter operations
    MaxInputLength    int           // Input length truncation threshold
    Enabled           bool          // Whether filtering is enabled
    TotalFiltered     int64         // Total filter operations
    TotalRedactions   int64         // Total redaction count
    TotalTimeouts     int64         // Total timeout count
    AverageLatency    time.Duration // Average filter latency
    CacheHits         int64         // Cache hit count
    CacheMiss         int64         // Cache miss count
}
```

### SecurityLevel

Security level enum, used to quickly get preset configurations via `SecurityConfigForLevel`.

```go
type SecurityLevel int
```

Implements `String()` method, returns readable level name.

| Constant | Description |
|----------|-------------|
| `SecurityLevelDevelopment` | Development environment (no filtering, no rate limiting, no auditing) |
| `SecurityLevelBasic` | Basic filtering (passwords, API keys, credit cards) |
| `SecurityLevelStandard` | Standard filtering (recommended for production) |
| `SecurityLevelStrict` | Strict filtering (PII/financial data environments) |
| `SecurityLevelParanoid` | Maximum filtering (high-risk environments) |

### Preset Configurations

| Function | Description | Use Case |
|----------|-------------|----------|
| `DefaultSecurityConfig()` | Basic sensitive data filtering | Production (recommended) |
| `DefaultSecureConfig()` | Complete sensitive data filtering | High security requirements |
| `HealthcareConfig()` | HIPAA compliance | Healthcare industry |
| `FinancialConfig()` | PCI-DSS compliance | Financial industry |
| `GovernmentConfig()` | Government standards | Public sector |

### Level-based Configuration

```go
func SecurityConfigForLevel(level SecurityLevel) *SecurityConfig
```

| Level | Constant | Description |
|-------|----------|-------------|
| Development | `SecurityLevelDevelopment` | Development environment, most permissive |
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

### Via Config

```go
cfg := dd.DefaultConfig()
cfg.Security = dd.DefaultSecurityConfig()
logger, _ := dd.New(cfg)
```

### Runtime Modification

```go
// Update security configuration
logger.SetSecurityConfig(dd.DefaultSecureConfig())

// Read current configuration
sec := logger.GetSecurityConfig()
```

### Filtering Nested Structures

```go
filter := dd.NewSensitiveDataFilter()

// String filtering
filtered := filter.Filter("password=s3cr3t")
// → "password=[REDACTED]"

// Nested structures (automatic recursion, supports circular reference detection)
data := map[string]any{
    "user": map[string]any{
        "name":     "admin",
        "password": "s3cr3t",
        "token":    "eyJhbGciOi...",
    },
}
filtered := filter.FilterValueRecursive("data", data)
```

### Monitoring Filter Statistics

```go
filter := dd.NewSensitiveDataFilter()
// ... use filtering ...
stats := filter.GetFilterStats()
fmt.Printf("Total filtered: %d, Redactions: %d, Avg latency: %v\n",
    stats.TotalFiltered, stats.TotalRedactions, stats.AverageLatency)
```

## Next Steps

- [Configuration](./config) -- SecurityConfig configuration
- [Logger](./logger) -- SetSecurityConfig method
- [Audit Logging](./audit) -- Security event auditing
