---
sidebar_label: "Security Mode"
title: "Security Mode - CyberGo JSON | Pattern Detection & Defense"
description: "CyberGo JSON security mode: DangerousPattern and AddDangerousPattern registration, PatternLevel severity, the built-in pattern table, and scan strategy."
sidebar_position: 20
---

# Security Mode

Security mode is the configuration surface for dangerous-pattern detection: a built-in pattern table plus two routes for registering custom patterns. A hit is rejected, and matching is case-insensitive.

## The DangerousPattern Struct

DangerousPattern describes one security risk pattern:

```go
type DangerousPattern struct {
    Pattern string       // Substring to detect in the input
    Name    string       // Descriptive name of the pattern
    Level   PatternLevel // Severity level determining how the pattern is handled
}
```

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `Pattern` | `string` | Substring to detect in the input |
| `Name` | `string` | Descriptive name of the pattern |
| `Level` | `PatternLevel` | Severity level determining how the pattern is handled |

---

## The PatternLevel Type

PatternLevel represents the severity level of a dangerous pattern.

```go
type PatternLevel int
```

### Constants

```go
const (
    // PatternLevelCritical always blocks the operation.
    // For patterns that pose an immediate security risk (e.g. prototype pollution).
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning blocks in strict mode, logs a warning in lenient mode.
    // For patterns that may signal malicious intent but have legitimate uses.
    PatternLevelWarning

    // PatternLevelInfo logs only, never blocks.
    // For audit/tracking purposes, without interrupting operations.
    PatternLevelInfo
)
```

### The String Method

```go
func (pl PatternLevel) String() string
```

Returns the string form of a PatternLevel (`"critical"`, `"warning"`, `"info"`; `"unknown"` for unrecognized values).

### PatternLevel Behavior Matrix

| Level | Semantic intent (interface docs) | Actual behavior of the current implementation |
|-------|----------------------------------|-----------------------------------------------|
| `PatternLevelCritical` | Always blocks the operation | Rejects on any hit (`ErrSecurityViolation`) |
| `PatternLevelWarning` | Blocks in strict mode, logs in lenient mode | **Also rejects on any hit** — the `StrictMode` field is deprecated and not read by any parser, so it plays no part in pattern-blocking decisions |
| `PatternLevelInfo` | Logs only, never blocks | **Also rejects on any hit** |

::: warning Plan for Warning/Info patterns as "will block"
The current pattern scanning (built-in patterns, `Config.AdditionalDangerousPatterns`, and globally registered patterns all share one scanning path) rejects the operation on any hit that passes the word-boundary context check; `Level` does not change the blocking outcome and serves only as a semantic label distinguishing severity in audits/logs. So do **not** register a `PatternLevelInfo` pattern expecting "log but don't block" and then feed input containing it — today it blocks. All matching is case-insensitive.
:::

---

## Built-in Dangerous Patterns

### Default Patterns

::: warning Internal API
The built-in pattern list is managed by internal functions and no longer exported as public API. Manage custom patterns via the Config `AdditionalDangerousPatterns` field.
:::

The built-in dangerous patterns, all Critical level:

| Pattern | Name | Category |
|---------|------|----------|
| `__proto__` | prototype pollution | Prototype pollution |
| `constructor[` | constructor access | Constructor access |
| `prototype.` | prototype manipulation | Prototype manipulation |
| `<script` | script tag injection | HTML injection |
| `<iframe` | iframe injection | HTML injection |
| `<object` | object injection | HTML injection |
| `<embed` | embed injection | HTML injection |
| `<svg` | svg injection | HTML injection |
| `javascript:` | javascript protocol | Protocol injection |
| `vbscript:` | vbscript protocol | Protocol injection |
| `eval(` | dynamic code execution | Code execution |
| `setTimeout(` | timer manipulation | Code execution |
| `setInterval(` | interval manipulation | Code execution |
| `require(` | code injection | Code execution |
| `new function(` | dynamic function creation | Code execution |
| `document.cookie` | cookie access | DOM access |
| `window.location` | redirect manipulation | DOM access |
| `innerhtml` | DOM manipulation | DOM access |
| `onerror`, `onload`, `onclick`, `onmouseover`, `onfocus` | event handler injection | Event handlers |
| `fromcharcode(` | character encoding bypass | Encoding bypass |
| `atob(` | base64 decoding | Encoding bypass |
| `expression(` | CSS expression injection | CSS injection |
| `__defineGetter__` | getter definition | Prototype pollution |
| `__defineSetter__` | setter definition | Prototype pollution |

### Critical Patterns

::: warning Internal API
GetCriticalPatterns has become an internal function and is no longer exported as public API. The critical patterns (`__proto__`, `constructor[`, `prototype.`) are always enforced and cannot be disabled.
:::

The following critical patterns are always fully scanned regardless of JSON size:

| Pattern | Description |
|---------|-------------|
| `__proto__` | prototype pollution |
| `constructor[` | constructor access |
| `prototype.` | prototype manipulation |

---

## Custom Pattern Registration

There are two routes for registering custom dangerous patterns: **Config append** (instance-level, fixed into the processor's security validator at construction) and **global registration** (process-level, effective for all Processors). For their scope, removal, and typical use cases see [Global Registration vs Config Append](#global-registration-vs-config-append).

### Config Append (Instance-Level)

The `Config.AddDangerousPattern` method adds a custom dangerous pattern to the configuration:

Signature: `func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "custom dangerous pattern",
    Level:   json.PatternLevelCritical,
})

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

You can also pass several patterns at once by setting the `Config.AdditionalDangerousPatterns` field directly:

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "eval(", Name: "eval-call", Level: json.PatternLevelCritical},
    {Pattern: "exec(", Name: "exec-call", Level: json.PatternLevelWarning},
}
```

Related configuration fields:

```go
type Config struct {
    // ... other fields ...

    // AdditionalDangerousPatterns adds security patterns beyond the defaults
    AdditionalDangerousPatterns []DangerousPattern

    // DisableDefaultPatterns disables the built-in default security patterns
    // (except the critical ones). When true, only AdditionalDangerousPatterns
    // are used. Note: the critical patterns (__proto__, constructor[, prototype.)
    // are always enforced and cannot be disabled.
    DisableDefaultPatterns bool
}
```

### Global Registration (Process-Level)

Beyond instance-level patterns configured via `Config`, package-level functions manage a global pattern registry. Patterns in the global registry apply to all Processor instances.

#### RegisterDangerousPattern

Signature: `func RegisterDangerousPattern(pattern DangerousPattern)`

Adds a custom dangerous pattern to the global registry. Registered patterns take effect across all Processor instances.

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "custom dangerous pattern",
    Level:   json.PatternLevelCritical,
})
```

#### UnregisterDangerousPattern

Signature: `func UnregisterDangerousPattern(pattern string)`

Removes a pattern from the global registry.

```go
json.UnregisterDangerousPattern("malicious_keyword")
```

#### ListDangerousPatterns

Signature: `func ListDangerousPatterns() []DangerousPattern`

Returns all custom patterns in the global registry.

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("Pattern: %s, Name: %s, Level: %s\n", p.Pattern, p.Name, p.Level)
}
```

### Global Registration vs Config Append

| Dimension | Global registration (`RegisterDangerousPattern`) | Config append (`AddDangerousPattern` / `AdditionalDangerousPatterns`) |
|-----------|---------------------------------------------------|------------------------------------------------------------------------|
| Scope | **All** Processors in the process, including already-created instances (the registry is read live at scan time) | Only Processors created with that Config (fixed into the security validator at construction) |
| Removal | `UnregisterDangerousPattern(pattern)` takes effect immediately | No runtime removal; rebuild the Processor with a new Config |
| Querying | `ListDangerousPatterns()` | Read the `cfg.AdditionalDangerousPatterns` field |
| Relation to `DisableDefaultPatterns` | Unaffected (explicitly added patterns always scan) | Unaffected (same as left) |
| Typical use | Application-wide security policy, compliance blacklists, registered at `main` startup | Per-instance business customization (e.g. only one tenant's Processor blocks specific keywords) |

Full comparison example:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// Global registration: applies to all Processors (including already-created ones)
	json.RegisterDangerousPattern(json.DangerousPattern{
		Pattern: "internal_only",
		Name:    "internal identifier",
		Level:   json.PatternLevelCritical,
	})
	defer json.UnregisterDangerousPattern("internal_only")

	// Config append: affects only Processors using this Config
	cfg := json.DefaultConfig()
	cfg.AddDangerousPattern(json.DangerousPattern{
		Pattern: "project_secret",
		Name:    "project secret",
		Level:   json.PatternLevelCritical,
	})

	withCfg, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer withCfg.Close()

	withoutCfg, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer withoutCfg.Close()

	_, err1 := withCfg.Get(`{"v": "project_secret"}`, "v")
	_, err2 := withoutCfg.Get(`{"v": "project_secret"}`, "v")
	_, err3 := withoutCfg.Get(`{"v": "internal_only"}`, "v")

	fmt.Println("Local pattern blocks config processor:", err1 != nil)
	fmt.Println("Local pattern blocks plain processor:", err2 != nil)
	fmt.Println("Global pattern blocks plain processor:", err3 != nil)
	// Output:
	// Local pattern blocks config processor: true
	// Local pattern blocks plain processor: false
	// Global pattern blocks plain processor: true
}
```

---

## Complete Examples

### Custom Security Policy

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// Option 1: set the configuration field directly
	cfg := json.DefaultConfig()
	cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
		{Pattern: "company_secret", Name: "company sensitive data", Level: json.PatternLevelCritical},
	}

	// Option 2: call the configuration method
	cfg.AddDangerousPattern(json.DangerousPattern{
		Pattern: "internal_api",
		Name:    "internal API reference",
		Level:   json.PatternLevelWarning,
	})

	p, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// Test dangerous-pattern detection (patterns match as whole words: no
	// letter/digit/underscore may sit directly adjacent on either side)
	_, err = p.Get(`{"data": "company_secret"}`, "data")
	fmt.Println("Dangerous pattern detected:", err != nil)
	// Output: Dangerous pattern detected: true

	// Inspect the registered patterns
	fmt.Printf("Custom pattern count: %d\n", len(cfg.AdditionalDangerousPatterns))
}
```

::: tip Matching is "whole-word"
After a pattern hit, a word-boundary context check runs: if letters, digits, or underscores sit directly adjacent on either side, the hit counts as part of an ordinary identifier and is not blocked. For example, the pattern `company_secret` triggers inside `"company_secret"` but not inside `"company_secret_info"` (the trailing `_` is a word character); patterns ending with separators like `(`, `[`, `:`, `.` (e.g. `eval(`) are unaffected by suffixes. This is also how the library's built-in patterns (like `eval(`, `__proto__`) match.
:::

### Disabling Default Patterns

```go
cfg := json.DefaultConfig()

// Disable the built-in defaults (except critical ones); use custom patterns only
// Note: the critical patterns (__proto__, constructor[, prototype.) are always enforced
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
    Name:    "suspicious but allowed",
    Level:   json.PatternLevelInfo, // Semantic label; the current implementation also blocks on a hit (see the PatternLevel behavior matrix)
})

// Inspect the registered custom patterns
for _, p := range cfg.AdditionalDangerousPatterns {
    fmt.Printf("Pattern: %s, Name: %s, Level: %s\n", p.Pattern, p.Name, p.Level)
}
```

---

## Scanning Switches

Three Config fields control "how to scan":

| Field | Default | Effect |
|-------|---------|--------|
| `FullSecurityScan` | `false` | When `true`, fully scans every input regardless of size; when `false`, small inputs (< 4KB) get full scans while large inputs take the tiered optimized scan (next section; the rolling window still covers every byte). Full mode adds roughly 10–30% overhead on >100KB inputs |
| `DisableDefaultPatterns` | `false` | When `true`, skips the built-in non-critical patterns (HTML tags, event handlers, etc.), keeping the 3 critical patterns + custom patterns |
| `AdditionalDangerousPatterns` | `nil` | Layers custom patterns on top of the built-ins (see above) |

```go
cfg := json.SecurityConfig() // Already enables FullSecurityScan and tightens every limit
// Equivalent to setting manually:
// cfg := json.DefaultConfig()
// cfg.FullSecurityScan = true
```

When to enable: turn on `FullSecurityScan` when handling **untrusted input** (public APIs, user submissions, external webhooks), touching sensitive data (authentication, financial, personal), or under compliance requirements for full auditing; trusted internal services moving large payloads can keep the default tiered scan for throughput.

---

## Security Scanning Strategy

### Small JSON (< 4KB)

Always fully security-scanned, checking every dangerous pattern one by one.

### Larger JSON (>= 4KB)

A multi-tier optimized scan whose rolling window covers every byte (no sampling blind spots):

- The critical patterns (`__proto__`, `constructor[`, `prototype.`) are always fully scanned
- An indicator-character check runs first: if no dangerous characters are present, scanning is skipped quickly
- Suspicious character density is measured: overly dense regions fall back to a full scan, preventing attackers from hiding malicious content in dense areas
- The remaining patterns use a 32KB **rolling window** scan (with overlap), so patterns straddling boundaries are never missed

---

## See Also

- [Config](../api-reference/config) - Configuration options
- [Schema Validation](../api-reference/schema) - Schema validation
- [Hook System](../extensions/hooks) - Operation interception
