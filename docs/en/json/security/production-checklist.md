---
title: "Production Checklist - CyberGo JSON | Security Deployment"
description: "CyberGo JSON production security checklist: SecurityConfig, resource limits, input validation, error handling, monitoring, and performance-security balance."
---

# Production Checklist

Before deploying to production, confirm the following security items.

## Configuration Check

### Resource Limits

- [ ] Set `MaxNestingDepthSecurity` to prevent deep nesting attacks
- [ ] Set `MaxJSONSize` to limit individual value size
- [ ] Set `MaxMemory` to limit total memory usage

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50
cfg.MaxJSONSize = 10 * 1024 * 1024
cfg.MaxMemory = 100 * 1024 * 1024
```

## Input Validation

### Required Fields

- [ ] Validate all required fields exist
- [ ] Validate field types are correct

```go
// Custom validator example
type RequiredFieldValidator struct{}

func (v *RequiredFieldValidator) Validate(jsonStr string) error {
    // Check if required fields exist
    return nil
}

cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&RequiredFieldValidator{}}
```

### Format Validation

- [ ] Validate email format
- [ ] Validate URL format
- [ ] Validate custom formats

```go
// Custom format validator
type EmailValidator struct{}

func (v *EmailValidator) Validate(jsonStr string) error {
    var data map[string]any
    if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
        return nil
    }
    email, _ := data["email"].(string)
    matched, _ := regexp.MatchString(`^\w+@\w+\.\w+$`, email)
    if !matched {
        return errors.New("invalid email format")
    }
    return nil
}

cfg := json.DefaultConfig()
cfg.CustomValidators = append(cfg.CustomValidators, &EmailValidator{})
```

### Range Validation

- [ ] Validate numeric ranges
- [ ] Validate string length
- [ ] Validate array length

```go
// Use Schema for range validation
schema := &json.Schema{
    Type: "object",
    Properties: map[string]*json.Schema{
        "age":  {Type: "number", Minimum: 0, Maximum: 100},
        "name": {Type: "string", MinLength: 1, MaxLength: 255},
    },
}
```

## Sensitive Data Handling

### Filter Sensitive Fields

- [ ] Filter password fields
- [ ] Filter token fields
- [ ] Filter other sensitive data

```go
// Use Hook to filter sensitive fields
type SensitiveFilterHook struct {
    fields map[string]bool
}

func (h *SensitiveFilterHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *SensitiveFilterHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if m, ok := result.(map[string]any); ok {
        for field := range h.fields {
            delete(m, field)
        }
    }
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&SensitiveFilterHook{fields: map[string]bool{
    "password": true,
    "token":    true,
    "api_key":  true,
    "secret":   true,
}})
```

### Log Sanitization

- [ ] Do not log sensitive data
- [ ] Error messages do not contain sensitive information

## Error Handling

### Safe Error Responses

- [ ] Do not expose internal error details
- [ ] Use generic error messages
- [ ] Log detailed errors

```go
if err != nil {
    log.Error("Detailed error", "error", err)
    return errors.New("Operation failed, please try again later")
}
```

## Monitoring and Auditing

### Performance Monitoring

- [ ] Monitor parsing time
- [ ] Monitor memory usage
- [ ] Set alert thresholds

```go
// Use Hook to monitor performance
type MetricsHook struct{}

func (h *MetricsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *MetricsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    log.Info("operation", "op", ctx.Operation)
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&MetricsHook{})
```

### Audit Logging

- [ ] Log critical operations
- [ ] Log anomalous inputs
- [ ] Periodically review logs

## Test Coverage

### Security Testing

- [ ] Deep nesting tests
- [ ] Large file processing tests
- [ ] Invalid input tests
- [ ] Boundary condition tests

### Performance Testing

- [ ] Concurrency tests
- [ ] Large data volume tests
- [ ] Memory leak tests

## Quick Check Commands

```bash
# Check for sensitive fields
grep -r "password\|token\|secret" --include="*.go"

# Check for hardcoded configuration
grep -r "MaxNestingDepthSecurity\|MaxMemory" --include="*.go"

# Run security tests
go test -run Security ./...
```

## Checklist Template

```go
// Production configuration template
func ProductionConfig() json.Config {
    cfg := json.SecurityConfig()

    // Resource limits (SecurityConfig has secure defaults)
    cfg.MaxMemory = 100 * 1024 * 1024

    // Custom validators
    cfg.CustomValidators = []json.Validator{&RequiredFieldValidator{}}

    // Audit Hook
    cfg.Hooks = []json.Hook{&AuditHook{logger: prodLogger}}

    return cfg
}
```

## See Also

- [Security Overview](./)
- [Config Configuration](../api-reference/config)
