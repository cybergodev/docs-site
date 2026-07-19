---
sidebar_label: "Security Mode"
title: "Security - CyberGo JSON | API Reference"
description: "CyberGo JSON security API: security config, AddDangerousPattern dangerous patterns, and input validation against JSON injection, prototype pollution, and XSS."
sidebar_position: 2
---

# Security

Security mode provides dangerous pattern detection functionality to prevent JSON injection attacks, prototype pollution, and other security threats.

## DangerousPattern Struct

DangerousPattern represents a security risk pattern. It is a struct type.

```go
type DangerousPattern struct {
    Pattern string       // Substring to detect in input
    Name    string       // Descriptive name of the pattern
    Level   PatternLevel // Severity level determining how to handle the pattern
}
```

### Field Descriptions

| Field | Type | Description |
|------|------|------|
| `Pattern` | `string` | Substring to detect in input |
| `Name` | `string` | Descriptive name of the pattern |
| `Level` | `PatternLevel` | Severity level determining how to handle the pattern |

---

## PatternLevel Type

PatternLevel represents the severity level of a dangerous pattern.

```go
type PatternLevel int
```

### Constants

```go
const (
    // PatternLevelCritical always blocks the operation
    // Used for patterns that pose an immediate security risk (e.g., prototype pollution)
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning blocks in strict mode, logs a warning in permissive mode
    // Used for patterns that may indicate malicious intent but have legitimate uses
    PatternLevelWarning

    // PatternLevelInfo only logs, never blocks
    // Used for audit/tracking purposes without interrupting operations
    PatternLevelInfo
)
```

### String Method

```go
func (pl PatternLevel) String() string
```

Returns the string representation of PatternLevel.

---

## Built-in Dangerous Patterns

### Default Patterns

::: warning Internal API
The built-in pattern list is managed by internal functions and is no longer exported as a public API. Custom patterns can be managed via the Config's `AdditionalDangerousPatterns` field.
:::

The following are built-in dangerous patterns, all at Critical level:

| Pattern | Name | Category |
|------|------|------|
| `__proto__` | prototype pollution | Prototype Pollution |
| `constructor[` | constructor access | Constructor Access |
| `prototype.` | prototype manipulation | Prototype Manipulation |
| `<script` | script tag injection | HTML Injection |
| `<iframe` | iframe injection | HTML Injection |
| `<object` | object injection | HTML Injection |
| `<embed` | embed injection | HTML Injection |
| `<svg` | svg injection | HTML Injection |
| `javascript:` | javascript protocol | Protocol Injection |
| `vbscript:` | vbscript protocol | Protocol Injection |
| `eval(` | dynamic code execution | Code Execution |
| `setTimeout(` | timer manipulation | Code Execution |
| `setInterval(` | interval manipulation | Code Execution |
| `require(` | code injection | Code Execution |
| `new function(` | dynamic function creation | Code Execution |
| `document.cookie` | cookie access | DOM Access |
| `window.location` | redirect manipulation | DOM Access |
| `innerhtml` | DOM manipulation | DOM Access |
| `onerror`, `onload`, `onclick`, `onmouseover`, `onfocus` | event handler injection | Event Handlers |
| `fromcharcode(` | character encoding bypass | Encoding Bypass |
| `atob(` | base64 decoding | Encoding Bypass |
| `expression(` | CSS expression injection | CSS Injection |
| `__defineGetter__` | getter definition | Prototype Pollution |
| `__defineSetter__` | setter definition | Prototype Pollution |

### Critical Patterns

::: warning Internal API
GetCriticalPatterns has been converted to an internal function and is no longer exported as a public API. Critical patterns (`__proto__`, `constructor[`, `prototype.`) are always enforced and cannot be disabled.
:::

The following critical patterns are always fully scanned regardless of JSON size:

| Pattern | Description |
|------|------|
| `__proto__` | prototype pollution |
| `constructor[` | constructor access |
| `prototype.` | prototype manipulation |

---

## Pattern Registration Methods

Dangerous patterns are configured via the `Config` struct rather than global registration functions.

### Config.AddDangerousPattern

Signature: `func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

Adds a custom dangerous pattern to the configuration.

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "Custom dangerous pattern",
    Level:   json.PatternLevelCritical,
})

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Config.AdditionalDangerousPatterns

You can also directly set the `Config.AdditionalDangerousPatterns` field:

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "eval(", Name: "eval-call", Level: json.PatternLevelCritical},
    {Pattern: "exec(", Name: "exec-call", Level: json.PatternLevelWarning},
}
```

---

## Config Configuration Methods

### AddDangerousPattern

Adds a security pattern to the configuration.

```go
func (c *Config) AddDangerousPattern(pattern DangerousPattern)
```

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "custom_dangerous_string",
    Name:    "Custom dangerous string",
    Level:   json.PatternLevelWarning,
})
```

### Configuration Fields

```go
type Config struct {
    // ... other fields ...

    // AdditionalDangerousPatterns adds security patterns beyond the defaults
    AdditionalDangerousPatterns []DangerousPattern

    // DisableDefaultPatterns disables built-in default security patterns (except critical ones)
    // When true, only AdditionalDangerousPatterns are used
    // Note: Critical patterns (__proto__, constructor[, prototype.) are always enforced and cannot be disabled
    DisableDefaultPatterns bool
}
```

---

## Global Pattern Registration

In addition to instance-level patterns configured via `Config`, you can manage global pattern registries via package-level functions. Patterns in the global registry are effective across all Processor instances.

### RegisterDangerousPattern

Signature: `func RegisterDangerousPattern(pattern DangerousPattern)`

Adds a custom dangerous pattern to the global registry. Registered patterns are effective across all Processor instances.

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "Custom dangerous pattern",
    Level:   json.PatternLevelCritical,
})
```

### UnregisterDangerousPattern

Signature: `func UnregisterDangerousPattern(pattern string)`

Removes the specified pattern from the global registry.

```go
json.UnregisterDangerousPattern("malicious_keyword")
```

### ListDangerousPatterns

Signature: `func ListDangerousPatterns() []DangerousPattern`

Returns all custom patterns in the global registry.

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("Pattern: %s, Name: %s, Level: %s\n", p.Pattern, p.Name, p.Level)
}
```

::: tip Global Patterns vs Config Patterns
- **Global patterns** (`RegisterDangerousPattern`): Shared across all Processor instances, suitable for application-level security policies
- **Config patterns** (`Config.AddDangerousPattern`): Only affect Processors using that Config, suitable for instance-level customization
:::

---

## Complete Example

### Custom Security Policy

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Method 1: Via config field
    cfg := json.DefaultConfig()
    cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
        {Pattern: "company_secret", Name: "Company sensitive information", Level: json.PatternLevelCritical},
    }

    // Method 2: Via config method
    cfg.AddDangerousPattern(json.DangerousPattern{
        Pattern: "internal_api",
        Name:    "Internal API reference",
        Level:   json.PatternLevelWarning,
    })

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Test dangerous pattern detection
    _, err = p.Get(`{"data": "company_secret_info"}`, "data")
    if err != nil {
        fmt.Println("Dangerous pattern detected:", err)
    }

    // View registered patterns
    fmt.Printf("Custom pattern count: %d\n", len(cfg.AdditionalDangerousPatterns))
}
```

### Disabling Default Patterns

```go
cfg := json.DefaultConfig()

// Disable built-in default patterns (except critical ones), use only custom patterns
// Note: Critical patterns (__proto__, constructor[, prototype.) are always enforced
cfg.DisableDefaultPatterns = true

// Add custom patterns
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "xss_payload",
    Name:    "XSS attack payload",
    Level:   json.PatternLevelCritical,
})

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

### Handling Patterns by Level

```go
// Register patterns at different levels
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "suspicious_but_allowed",
    Name:    "Suspicious but allowed",
    Level:   json.PatternLevelInfo, // Only log, do not block
})

// View registered custom patterns
for _, p := range cfg.AdditionalDangerousPatterns {
    fmt.Printf("Pattern: %s, Name: %s, Level: %s\n", p.Pattern, p.Name, p.Level)
}
```

---

## Security Scanning Strategy

### Small JSON (< 4KB)

Always performs a full security scan, checking each dangerous pattern one by one.

### Larger JSON (≥ 4KB)

Uses a multi-level optimized scan that **guarantees 100% coverage** (no sampling blind spots):

- Critical patterns (`__proto__`, `constructor[`, `prototype.`) are always fully scanned
- An indicator-character check is performed first: if no dangerous characters are present, the scan is skipped quickly
- Suspicious character density is detected: when the density is too high, a full scan is performed to prevent attackers from hiding malicious content in dense regions
- The remaining patterns use a 32KB **sliding window** scan (with overlap) to ensure cross-boundary patterns are not missed

---

## Related

- [Config](../api-reference/config) - Configuration options
- [Validator](../extensions/validator) - Validator
- [Hook System](../extensions/hooks) - Operation interception
