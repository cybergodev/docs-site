---
sidebar_label: "Production Checklist"
title: "Production Checklist - CyberGo JSON | Pre-Launch Security"
description: "CyberGo JSON production security checklist: SecurityConfig, MaxNestingDepthSecurity/MaxJSONSize resource limits, input validation, error handling, monitoring."
sidebar_position: 30
---

# Production Checklist

Before deploying to production, confirm the following security items.

## Configuration Checks

### Resource Limits

- [ ] Set `MaxNestingDepthSecurity` against deep-nesting attacks
- [ ] Set `MaxJSONSize` to bound single-value size
- [ ] Set `MaxMemory` to bound total memory usage

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50
cfg.MaxJSONSize = 10 * 1024 * 1024
cfg.MaxMemory = 100 * 1024 * 1024
```

Defaults versus recommended production values (the defaults are library constants you can reference directly, avoiding magic numbers):

| Limit | Config field | Library constant | Default | Recommended production (`SecurityConfig()` preset) |
|-------|--------------|------------------|---------|-----------------------------------------------------|
| JSON size cap | `MaxJSONSize` | `DefaultMaxJSONSize` | 100MB | 10MB |
| Nesting depth cap | `MaxNestingDepthSecurity` | `DefaultMaxNestingDepth` | 200 | 30 |
| Path depth cap | `MaxPathDepth` | `DefaultMaxPathDepth` | 50 | 30 |
| Object key count cap | `MaxObjectKeys` | `DefaultMaxObjectKeys` | 100000 | 5000 |
| Array element count cap | `MaxArrayElements` | `DefaultMaxArrayElements` | 100000 | 5000 |
| Security validation threshold | `MaxSecurityValidationSize` | `DefaultMaxSecuritySize` | 10MB | 10MB |
| Concurrency cap | `MaxConcurrency` | `DefaultMaxConcurrency` | 50 | 50 |

```go
// Reference the constants instead of hardcoding
cfg := json.DefaultConfig()
cfg.MaxJSONSize = int64(json.DefaultMaxJSONSize) / 10 // Tighten from the default 100MB
```

`json.SecurityConfig()` presets every field to the "recommended production values" above, and additionally enables `FullSecurityScan` and `StrictMode` — for untrusted input, start from it and fine-tune.

## Input Validation

### Required Fields

- [ ] Verify all required fields are present
- [ ] Verify field types are correct

```go
// Example custom validator
type RequiredFieldValidator struct{}

func (v *RequiredFieldValidator) Validate(jsonStr string) error {
    // Check that required fields exist
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
- [ ] Validate string lengths
- [ ] Validate array lengths

```go
// Range validation with a Schema
schema := &json.Schema{
    Type: "object",
    Properties: map[string]*json.Schema{
        "age":  {Type: "number", Minimum: 0, Maximum: 100},
        "name": {Type: "string", MinLength: 1, MaxLength: 255},
    },
}
```

## Sensitive Data Handling

### Filtering Sensitive Fields

- [ ] Filter password fields
- [ ] Filter token fields
- [ ] Filter other sensitive data

```go
// Filter sensitive fields with a Hook
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

Full runnable code (sensitive fields stripped automatically before `Get` returns):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

// SensitiveFilterHook deletes sensitive fields from get results before they
// reach the caller.
type SensitiveFilterHook struct {
	fields map[string]bool
}

func (h *SensitiveFilterHook) Before(ctx json.HookContext) error {
	return nil
}

func (h *SensitiveFilterHook) After(ctx json.HookContext, result any, err error) (any, error) {
	if err != nil {
		return result, err
	}
	if obj, ok := result.(map[string]any); ok {
		for field := range h.fields {
			delete(obj, field)
		}
	}
	return result, err
}

func main() {
	cfg := json.DefaultConfig()
	cfg.AddHook(&SensitiveFilterHook{fields: map[string]bool{
		"password": true,
		"token":    true,
		"api_key":  true,
		"secret":   true,
	}})

	p, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	user, err := p.Get(`{"name": "Alice", "role": "admin", "password": "hunter2", "token": "t-123"}`, ".")
	if err != nil {
		panic(err)
	}

	out, err := p.Marshal(user)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))
	// Output: {"name":"Alice","role":"admin"}
}
```

### Log Redaction

- [ ] No sensitive data in logs
- [ ] No sensitive information in error messages

## Error Handling

### Safe Error Responses

- [ ] Do not expose internal error details
- [ ] Use generic error messages
- [ ] Log detailed errors

```go
if err != nil {
    slog.Error("detailed error", "error", err) // Full reason goes to logs only
    return errors.New("operation failed, please retry later") // Generic message outward
}
```

## Monitoring and Auditing

### Performance Monitoring

- [ ] Monitor parse time
- [ ] Monitor memory usage
- [ ] Set alert thresholds

```go
// Monitor performance with a Hook
type MetricsHook struct{}

func (h *MetricsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *MetricsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    slog.Info("operation", "op", ctx.Operation, "duration", time.Since(ctx.StartTime))
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&MetricsHook{})
```

For pure timing, the factory hook is easier: `cfg.AddHook(json.TimingHook(myRecorder))` (`myRecorder` implements `Record(op string, duration time.Duration)`).

### Audit Logging

- [ ] Record key operations
- [ ] Record abnormal input
- [ ] Review logs periodically

Full runnable code (auditing write operations + operation timing, all via factory hooks and `HookFunc`, never logging raw `JSONStr`):

```go
package main

import (
	"fmt"
	"sync"
	"time"

	"github.com/cybergodev/json"
)

// opMetrics implements the Record interface required by TimingHook
type opMetrics struct {
	mu    sync.Mutex
	count map[string]int
}

func (m *opMetrics) Record(op string, duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.count[op]++
}

func main() {
	metrics := &opMetrics{count: make(map[string]int)}
	var auditLog []string

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// Audit: record only write operations' type/path/outcome, never JSONStr content
	p.AddHook(&json.HookFunc{
		AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
			if ctx.Operation == "set" || ctx.Operation == "delete" {
				auditLog = append(auditLog,
					fmt.Sprintf("op=%s path=%s ok=%v", ctx.Operation, ctx.Path, err == nil))
			}
			return result, err
		},
	})
	// Performance: count by operation type (replace with a histogram/time-series
	// store in production)
	p.AddHook(json.TimingHook(metrics))

	data := `{"env": "prod", "password": "hunter2"}`

	if data, err = p.Set(data, "password", nil); err != nil {
		panic(err)
	}
	if data, err = p.Delete(data, "password"); err != nil {
		panic(err)
	}
	if _, err = p.Get(data, "env"); err != nil {
		panic(err)
	}

	for _, e := range auditLog {
		fmt.Println(e)
	}
	fmt.Println("get timing records:", metrics.count["get"])
	// Output:
	// op=set path=password ok=true
	// op=delete path=password ok=true
	// get timing records: 1
}
```

## Test Coverage

### Security Tests

- [ ] Deep-nesting tests
- [ ] Large-file handling tests
- [ ] Invalid-input tests
- [ ] Boundary-condition tests

### Performance Tests

- [ ] Concurrency tests
- [ ] Large-volume tests
- [ ] Memory-leak tests

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

    // Resource limits (SecurityConfig already presets safe defaults)
    cfg.MaxMemory = 100 * 1024 * 1024

    // Custom validators
    cfg.CustomValidators = []json.Validator{&RequiredFieldValidator{}}

    // Audit hooks
    cfg.Hooks = []json.Hook{&AuditHook{logger: prodLogger}}

    return cfg
}
```

## See Also

- [Security Overview](./)
- [Config](../api-reference/config)
