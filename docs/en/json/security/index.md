---
sidebar_label: "Security Overview"
title: "Security Overview - CyberGo JSON | Best Practices"
description: "CyberGo JSON security: MaxNestingDepthSecurity/MaxMemory limits, path traversal and JSON injection defense, sensitive-data filtering, SecurityConfig presets."
sidebar_position: 1
---

# Security Overview

Security considerations and best practices when handling JSON data.

## Common Security Risks

### 1. Resource Exhaustion Attacks

Maliciously crafted JSON can exhaust memory or overload the CPU: excessive nesting (stack overflow), oversized single values (memory), or flat ultra-wide objects/arrays (millions of keys).

**Minimal reproduction** (the library blocks deep nesting and oversized input by default):

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	// 5000 levels of nesting, above the default cap of 200 (DefaultMaxNestingDepth)
	deep := strings.Repeat(`{"a":`, 5000) + `1` + strings.Repeat(`}`, 5000)

	p, err := json.New(json.SecurityConfig()) // Nesting cap tightened to 30
	if err != nil {
		panic(err)
	}
	defer p.Close()

	_, err = p.Get(deep, "a")
	fmt.Println("Deep nesting blocked:", err != nil)
	// Output: Deep nesting blocked: true
}
```

**Protective measures:**

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50                       // Limit nesting depth
cfg.MaxJSONSize = 10 * 1024 * 1024             // Limit JSON size (10MB)
cfg.MaxObjectKeys = 5000                        // Limit keys per object (default 100000)
cfg.MaxArrayElements = 5000                     // Limit elements per array (default 100000)
cfg.MaxSecurityValidationSize = 100 * 1024 * 1024 // Raise the security validation cap to 100MB (default 10MB)
```

Or simply use the [`json.SecurityConfig()`](./production-checklist#checklist-template) preset — every limit already tightened for untrusted input.

### 2. Path Traversal Attacks

Malicious paths may reach unintended data. Both path kinds have built-in protection: **file paths** (`LoadFromFile`/`SaveToFile`, etc.) are **unconditionally** checked for traversal, symlinks, platform restrictions, and system directories at read/write time; **JSON paths** (`Get`/`Set`, etc.) reject `..`, URL-encoded bypasses, zero-width characters, and other injection patterns.

**Minimal reproduction** (both path kinds blocked by default):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// File path: NFC normalization + recursive URL decoding first, then
	// traversal-pattern detection
	_, err = p.LoadFromFile("../../../etc/passwd")
	fmt.Println("File path traversal blocked:", err != nil)

	// JSON path: reject "..", URL encoding, and zero-width character injection
	_, err = p.Get(`{"data": 1}`, "../../etc/passwd")
	fmt.Println("JSON path traversal blocked:", err != nil)
	// Output:
	// File path traversal blocked: true
	// JSON path traversal blocked: true
}
```

**Protective measures:**

```go
// Validate user-supplied paths
func safePath(path string) bool {
    // Disallow special characters
    if strings.ContainsAny(path, `<>:"|\`) {
        return false
    }
    return true
}
```

Keep a path allowlist at the application layer as well; the library's built-in validation covers encoded-confusion bypasses.

### 3. JSON Injection

Malicious data can break JSON structure, or carry payloads like `<script>` or `__proto__` into downstream systems. By default the library scans all input for dangerous patterns (case-insensitive + word-boundary context checks) and rejects on any hit.

**Minimal reproduction** (blocked by default, no configuration needed):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	payloads := []string{
		`{"name": "Alice", "bio": "<script>alert(1)</script>"}`, // XSS
		`{"__proto__": {"isAdmin": true}}`,                      // prototype pollution
	}
	for i, in := range payloads {
		_, err := p.Get(in, ".")
		fmt.Printf("Payload %d blocked: %v\n", i+1, err != nil)
	}
	// Output:
	// Payload 1 blocked: true
	// Payload 2 blocked: true
}
```

For the full built-in pattern list see [Security Mode](./security-mode#built-in-dangerous-patterns).

**Protective measures:**

```go
// Always serialize with the library functions; never concatenate strings
data := map[string]any{
    "user": userInput, // escaped automatically by the library
}
bytes, _ := json.Marshal(data)
```

### 4. Sensitive Data Leaks

Logs or error messages can expose sensitive data. The library has two layers of defense: results containing sensitive patterns (`password`, `token`, `api_key`, `ssn`, `aws_secret`, etc.) are **not written to the operation cache**, preventing sensitive data from lingering in the cache; and the doc comment on `HookContext.JSONStr` explicitly warns against logging raw input.

**Protective measures** (delete sensitive fields via a Hook before returning):

```go
// Filter sensitive fields with a custom Hook
type FilterFieldsHook struct {
    fields map[string]bool
}

func (h *FilterFieldsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *FilterFieldsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if m, ok := result.(map[string]any); ok {
        for field := range h.fields {
            delete(m, field)
        }
    }
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&FilterFieldsHook{fields: map[string]bool{
    "password": true,
    "token":    true,
    "secret":   true,
}})
```

For runnable, production-ready code see [Production Checklist - Sensitive Data Handling](./production-checklist#sensitive-data-handling).

## Security Configuration Advice

### Security-Related Config Fields Overview

These limits have no separate aggregate type — they are provided directly as `Config` fields. Field values under the two common configurations:

| Config field | `DefaultConfig()` default | `SecurityConfig()` preset | Error triggered |
|--------------|---------------------------|---------------------------|-----------------|
| `MaxJSONSize` | 100MB (`DefaultMaxJSONSize`) | 10MB | `ErrSizeLimit` |
| `MaxNestingDepthSecurity` | 200 (`DefaultMaxNestingDepth`) | 30 | `ErrDepthLimit` |
| `MaxPathDepth` | 50 (`DefaultMaxPathDepth`) | 30 | `ErrInvalidPath` |
| `MaxBatchSize` | 2000 (`DefaultMaxBatchSize`) | 2000 | `ErrSizeLimit` |
| `MaxObjectKeys` | 100000 (`DefaultMaxObjectKeys`) | 5000 | `ErrSizeLimit` |
| `MaxArrayElements` | 100000 (`DefaultMaxArrayElements`) | 5000 | `ErrSizeLimit` |
| `MaxSecurityValidationSize` | 10MB (`DefaultMaxSecuritySize`) | 10MB | — (threshold type) |
| `FullSecurityScan` | `false` (tiered optimized scanning) | `true` (full scan) | — |

`Config.Validate` clamps out-of-range values back into the legal ranges (e.g. `MaxNestingDepthSecurity` clamped to 10–200, `MaxObjectKeys` to 100–100000); use `ValidateWithWarnings` to see the adjustments.

### Dangerous Pattern Management

The library ships default dangerous-pattern detection and also supports registering, unregistering, and querying custom patterns.

Custom patterns are uniformly expressed with the `DangerousPattern` struct:

```go
type DangerousPattern struct {
    Pattern string       // Substring to detect in the input
    Name    string       // Descriptive name of the pattern
    Level   PatternLevel // Severity level
}
```

| Field | Type | Description |
|-------|------|-------------|
| `Pattern` | `string` | Substring to detect in the input (matched case-insensitively) |
| `Name` | `string` | Human-readable risk description (for logs and audits) |
| `Level` | `PatternLevel` | Severity level; see the table below (currently semantic labeling only) |

#### RegisterDangerousPattern

Signature: `func RegisterDangerousPattern(pattern DangerousPattern)`

Registers a global dangerous pattern. Patterns in the global registry apply to **all Processor instances** (including already-created ones — the registry is read live at scan time), checked in addition to the default patterns.

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "eval-call",
    Level:   json.PatternLevelCritical,
})
```

#### UnregisterDangerousPattern

Signature: `func UnregisterDangerousPattern(pattern string)`

Unregisters a global dangerous pattern by its pattern string. The `pattern` argument is the dangerous-pattern substring to remove (matching the `DangerousPattern.Pattern` field).

```go
json.UnregisterDangerousPattern("eval(")
```

#### ListDangerousPatterns

Signature: `func ListDangerousPatterns() []DangerousPattern`

Lists **globally registered custom patterns** (not the built-in defaults — those are always in effect and need no registration).

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("Pattern: %s, Name: %s, Level: %s\n", p.Pattern, p.Name, p.Level)
}
```

#### Dangerous Pattern Levels

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `PatternLevelCritical` | `PatternLevel` | `0` | Critical level; semantically always blocks |
| `PatternLevelWarning` | `PatternLevel` | `1` | Warning level; semantically blocks in strict mode |
| `PatternLevelInfo` | `PatternLevel` | `2` | Info level; semantically logs only |

::: warning Actual blocking behavior of levels
The current pattern-scanning implementation rejects the operation on **any hit** (that passes the word-boundary context check); the `Level` field does not yet change blocking behavior and serves as semantic labeling only (to distinguish severity in audits and logs). See [Security Mode - PatternLevel behavior matrix](./security-mode#patternlevel-behavior-matrix).
:::

::: tip
`PatternLevel`'s `String()` method returns the corresponding string form (`"critical"`, `"warning"`, `"info"`), convenient for logging.
:::

#### Disabling Default Patterns

Use `Config.DisableDefaultPatterns` to disable the built-in default patterns:

```go
cfg := json.DefaultConfig()
cfg.DisableDefaultPatterns = true // Disable the built-in default patterns
```

::: warning Note
With `DisableDefaultPatterns=true`, all built-in patterns except the 3 critical ones (`__proto__`, `constructor[`, `prototype.` — always enforced) are disabled. Note: all built-in patterns are Critical level.
:::

### Production Configuration

```go
func ProductionConfig() json.Config {
    cfg := json.SecurityConfig()
    cfg.AddHook(&AuditHook{logger: prodLogger})
    return cfg
}
```

### Development Configuration

```go
func DevelopmentConfig() json.Config {
    cfg := json.DefaultConfig()
    cfg.MaxNestingDepthSecurity = 100
    cfg.AddHook(json.LoggingHook(devLogger))
    return cfg
}
```

## Input Validation

### Custom Validators

Implement the `Validator` interface (`Validate(jsonStr string) error`) for input validation:

```go
// Implement a custom validator
type EmailValidator struct{}

func (v *EmailValidator) Validate(jsonStr string) error {
    // Validate the JSON string content
    var data map[string]any
    if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
        return err
    }
    email, ok := data["email"].(string)
    if !ok {
        return nil
    }
    if !strings.Contains(email, "@") {
        return errors.New("invalid email format")
    }
    return nil
}

// Use the custom validator
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&EmailValidator{}}
```

### Schema Validation

Schema is a struct type usable for validating JSON structure:

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"id", "name", "email"},
    Properties: map[string]*json.Schema{
        "id":    {Type: "string", Pattern: `^[a-zA-Z0-9]+$`},
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
        "age":   {Type: "number", Minimum: 0, Maximum: 150},
    },
}
```

## Error Handling

### Safe Error Messages

```go
val, err := json.Get(data, path)
if err != nil {
    // Do not expose internal error details
    return errors.New("invalid data format")
}
```

## Audit Logging

### Recording Key Operations

Use the `Hook` interface (`Before` returning `error`, `After` receiving `(HookContext, any, error)` and returning `(any, error)`) for audit logging:

```go
type AuditHook struct {
    logger *slog.Logger
}

func (h *AuditHook) Before(ctx json.HookContext) error {
    h.logger.Info("JSON operation started", "op", ctx.Operation, "path", ctx.Path)
    return nil
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("JSON operation completed", "op", ctx.Operation)
    return result, err
}
```

## See Also

- [Production Checklist](./production-checklist)
- [Config](../api-reference/config)
- [Schema Validation](../api-reference/schema)
