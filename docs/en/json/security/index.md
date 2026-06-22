---
title: "Security Overview - CyberGo JSON | Security Best Practices"
description: "CyberGo JSON security best practices: input validation, MaxNestingDepthSecurity/MaxMemory limits, injection defense, data filtering, and audit logging."
---

# Security Overview

Security considerations and best practices when processing JSON data.

## Common Security Risks

### 1. Resource Exhaustion Attacks

Maliciously crafted JSON can cause memory exhaustion or CPU overload.

**Protection Measures:**

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50                       // Limit nesting depth
cfg.MaxJSONSize = 10 * 1024 * 1024             // Limit JSON size (10MB)
cfg.MaxSecurityValidationSize = 100 * 1024 * 1024 // Increase security validation limit to 100MB (default 10MB)
```

### 2. Path Traversal Attacks

Malicious paths may access unintended data.

**Protection Measures:**

```go
// Validate user-provided paths
func safePath(path string) bool {
    // Disallow special characters
    if strings.ContainsAny(path, `<>:"|\`) {
        return false
    }
    return true
}
```

### 3. JSON Injection

Malicious data may break JSON structure.

**Protection Measures:**

```go
// Always use library functions for serialization, never concatenate strings
data := map[string]any{
    "user": userInput, // The library handles escaping automatically
}
bytes, _ := json.Marshal(data)
```

### 4. Sensitive Data Leakage

Logs or error messages may expose sensitive data.

**Protection Measures:**

```go
// Use a custom Hook to filter sensitive fields
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


## Security Configuration Recommendations

### Dangerous Pattern Management

The library includes built-in default dangerous pattern detection and supports custom pattern registration, unregistration, and querying.

#### RegisterDangerousPattern

Signature: `func RegisterDangerousPattern(pattern DangerousPattern)`

Registers a global dangerous pattern. Registered patterns take effect in all operations using the default security configuration.

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "eval-call",
    Level:   json.PatternLevelCritical,
})
```

#### UnregisterDangerousPattern

Signature: `func UnregisterDangerousPattern(pattern string)`

Unregisters a global dangerous pattern by pattern string. The `pattern` parameter is the dangerous pattern substring to unregister (corresponding to the `DangerousPattern.Pattern` field).

```go
json.UnregisterDangerousPattern("eval(")
```

#### ListDangerousPatterns

Signature: `func ListDangerousPatterns() []DangerousPattern`

Lists all registered dangerous patterns (including default and custom patterns).

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("Pattern: %s, Name: %s, Level: %s\n", p.Pattern, p.Name, p.Level)
}
```

#### Dangerous Pattern Levels

| Constant | Type | Value | Description |
|------|------|-----|------|
| `PatternLevelCritical` | `int` | `0` | Critical level, rejects operation on match |
| `PatternLevelWarning` | `int` | `1` | Warning level, rejects operation in strict mode |
| `PatternLevelInfo` | `int` | `2` | Info level, only logs |

::: tip
The `String()` method of `PatternLevel` returns the corresponding string representation (`"critical"`, `"warning"`, `"info"`) for convenient log output.
:::

#### Disabling Default Patterns

Use `Config.DisableDefaultPatterns` to disable built-in default warning-level patterns:

```go
cfg := json.DefaultConfig()
cfg.DisableDefaultPatterns = true // Disable default warning-level patterns
```

::: warning Note
`DisableDefaultPatterns` only disables default warning-level (`PatternLevelWarning`) patterns. Default critical-level (`PatternLevelCritical`) patterns are not affected.
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
    // Validate JSON string content
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

// Use custom validator
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&EmailValidator{}}
```

### Schema Validation

Schema is a struct type that can be used to validate JSON structure:

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

### Log Critical Operations

Use the `Hook` interface (`Before` returns `error`, `After` receives `(HookContext, any, error)` and returns `(any, error)`) to record audit logs:

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
- [Config Configuration](../api-reference/config)
- [Validator](../api-reference/validator)
