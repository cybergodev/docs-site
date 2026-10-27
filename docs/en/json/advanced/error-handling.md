---
sidebar_label: "Error Handling"
title: "Error Handling - CyberGo JSON | Error Types and Checks"
description: "CyberGo JSON error handling: errors.Is for ErrPathNotFound, errors.As for JsonsError Op/Path, plus fallback, retry, and log-redaction patterns."
sidebar_position: 10
---

# Error Handling

JSON errors come in two shapes: sentinel errors you test with `errors.Is`, and `JsonsError` values that carry context you read with `errors.As` (`Op`/`Path`). The sections below give the classification table, the check patterns, and fallback, retry, and redaction recipes.

## Error Types

### Standard Errors

```go
var (
    ErrPathNotFound       = errors.New("path not found")
    ErrInvalidPath        = errors.New("invalid path format")
    ErrTypeMismatch       = errors.New("type mismatch")
    ErrInvalidJSON        = errors.New("invalid JSON format")
    ErrDepthLimit         = errors.New("depth limit exceeded")
    ErrSizeLimit          = errors.New("size limit exceeded")
    ErrSecurityViolation  = errors.New("security violation detected")
    ErrProcessorClosed    = errors.New("processor is closed")
    ErrConcurrencyLimit   = errors.New("concurrency limit exceeded")
    ErrUnsupportedPath    = errors.New("unsupported path operation")
    ErrDuplicateKey       = errors.New("duplicate object key")
    ErrOperationTimeout   = errors.New("operation timeout")           // Deprecated
    ErrResourceExhausted  = errors.New("system resources exhausted")  // Deprecated
)
```

### Sentinel Error Classification

The 13 exported sentinel errors fall into four categories by **how to handle them**:

| Error | Meaning / typical trigger | Category | Handling advice |
|-------|---------------------------|----------|-----------------|
| `ErrInvalidJSON` | Input is not valid JSON (syntax error, invalid UTF-8) | User input | Return a friendly message and ask for corrected data |
| `ErrPathNotFound` | Path does not exist (missing nested key, array index out of range) | User input | Fall back to a default or apply business semantics |
| `ErrTypeMismatch` | Value type differs from what was expected (`AsString` conversion failure, type mismatch mid-path in `GetCompiled`, non-object passed to `EncodeFields`, non-array root in `ForeachFileChunked`) | User input | Report a field type error; `GetTyped[T]` builds this sentinel internally but returns only the value |
| `ErrInvalidPath` | Illegal index content (`a[b]`, `a[]`, `a[-]`, `a[0:2:x]`), or a path longer than 5000 bytes | User input | Report a path format error |
| `ErrUnsupportedPath` | — (kept for compatibility, deprecated) | Deprecated | No operation returns it today; do not branch on it |
| `ErrDuplicateKey` | Input object has a repeated key when `Config.DetectDuplicateKeys` is on | User input | Reject the input; with the default off, the last key wins, matching `encoding/json` |
| `ErrSizeLimit` | Input exceeds `Config.MaxJSONSize` | Security limit | Reject and apply rate-limit policy |
| `ErrDepthLimit` | Nesting depth exceeds `MaxNestingDepthSecurity` | Security limit | Reject (deep nesting often signals malicious input) |
| `ErrSecurityViolation` | Dangerous pattern detected (prototype pollution, etc.) | Security limit | Log and reject; do not echo details |
| `ErrConcurrencyLimit` | In-flight operations reached `MaxConcurrency` (soft cap — immediate rejection, no blocking) | Transient system | **Retryable** — retry shortly or raise the cap |
| `ErrProcessorClosed` | Methods called after the processor was Closed | System state | Rebuild the `Processor` or check the lifecycle |
| `ErrOperationTimeout` | — (kept for compatibility, deprecated) | Deprecated | No operation returns it today; do not branch on it |
| `ErrResourceExhausted` | — (kept for compatibility, deprecated) | Deprecated | No operation returns it today; do not branch on it |

### Error Checking

A failing `Get` only produces input-class errors such as `ErrPathNotFound` and `ErrInvalidJSON` — type problems never surface there, because `Get` returns `any` and the caller decides how to interpret it. To get a typed error, use `SafeGet(...).AsString()` (which wraps `ErrTypeMismatch`) or `GetCompiled`:

```go
// Missing path: Get returns (nil, ErrPathNotFound)
_, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        return defaultName
    }
    return "", err
}

// Type mismatch: SafeGet + AsString wraps ErrTypeMismatch
if _, err := json.SafeGet(data, "user.name").AsString(); err != nil {
    if errors.Is(err, json.ErrTypeMismatch) {
        return "", fmt.Errorf("field type error: %w", err)
    }
    return "", err
}
```

Two failure modes differ here: when the path does not exist, every `As*` method returns `ErrPathNotFound`; when the path exists but the type does not match, only `AsString` wraps `ErrTypeMismatch`, while `AsInt`/`AsFloat64`/`AsBool` return a plain error (`errors.Is(err, ErrTypeMismatch)` is false).

## JsonsError

### Structure

`JsonsError` is the library's primary error type, carrying operation context:

```go
type JsonsError struct {
    Op      string `json:"op"`      // Operation type: "get", "set", "delete", "marshal", etc.
    Path    string `json:"path"`    // JSON path, if any
    Message string `json:"message"` // Human-readable error message
    Err     error  `json:"err"`     // Underlying error
}

func (e *JsonsError) Error() string
func (e *JsonsError) Unwrap() error
func (e *JsonsError) Is(target error) bool
```

### Usage

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // errors.Is: classify by sentinel
    if errors.Is(err, json.ErrPathNotFound) {
        // Path does not exist
    }
    if errors.Is(err, json.ErrInvalidJSON) {
        // Input is not valid JSON
    }

    // errors.As: extract the contextual JsonsError
    var jsonErr *json.JsonsError
    if errors.As(err, &jsonErr) {
        fmt.Printf("Operation: %s\n", jsonErr.Op)
        fmt.Printf("Path: %s\n", jsonErr.Path)
        fmt.Printf("Message: %s\n", jsonErr.Message)
    }
}
```

### Locating Failures with Op / Path

The `Op` (failed operation) and `Path` (failed path) combination pinpoints the problem without parsing error strings:

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"name":"Alice"},"perms":["read"]}`

	// Two typical failures: path not found / invalid JSON
	for _, tc := range []struct {
		jsonStr, path string
	}{
		{data, "user.email"},  // path not found
		{`{"broken"`, "user"}, // invalid JSON
	} {
		_, err := json.Get(tc.jsonStr, tc.path)
		var jsonErr *json.JsonsError
		if errors.As(err, &jsonErr) {
			fmt.Printf("op=%s path=%q reason=%v\n", jsonErr.Op, jsonErr.Path, json.SafeError(err))
		}
	}
}

// Output:
// op=get path="user.email" reason=path not found
// op=parse path="" reason=invalid JSON format
```

:::tip The localization method
`Op` answers "which operation failed" (`get`/`set`/`delete`/`get_multiple`/`warmup_cache`; parse failures are uniformly recorded as `parse`), and `Path` answers "on which path". Logging these two fields (instead of the whole `Error()` string) both pinpoints the problem and avoids writing sensitive key names from paths into logs — pair with [`RedactedPath`](#redactedpath-log-redaction) masking whenever you do output a path.
:::

## Error-Handling Patterns

### Providing Default Values

```go
// Type-safe getters have built-in default-value support
name := json.GetString(data, "user.name", "anonymous")
age := json.GetInt(data, "user.age", 0)
active := json.GetBool(data, "user.active", false)
```

### Collecting Multiple Errors

```go
type MultiError struct {
    Errors []error
}

func (e *MultiError) Add(err error) {
    e.Errors = append(e.Errors, err)
}

func (e *MultiError) HasError() bool {
    return len(e.Errors) > 0
}

func (e *MultiError) Error() string {
    msgs := make([]string, len(e.Errors))
    for i, err := range e.Errors {
        msgs[i] = err.Error()
    }
    return strings.Join(msgs, "; ")
}

// Usage
var multiErr MultiError
for _, path := range requiredPaths {
    if _, err := json.Get(data, path); err != nil {
        multiErr.Add(fmt.Errorf("%s: %w", path, err))
    }
}
if multiErr.HasError() {
    return multiErr.Error()
}
```

### Error Wrapping

```go
val, err := json.Get(data, "config.api_key")
if err != nil {
    return fmt.Errorf("reading API key failed: %w", err)
}
```

## Custom Errors

### Business Errors

```go
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed %s: %s", e.Field, e.Message)
}

// Usage
func validateUser(data string) error {
    name := json.GetString(data, "name")
    if name == "" {
        return &ValidationError{Field: "name", Message: "required"}
    }
    if len(name) < 2 {
        return &ValidationError{Field: "name", Message: "must be at least 2 characters"}
    }
    return nil
}
```

## Logging

### Structured Logging

```go
val, err := json.Get(data, path)
if err != nil {
    log.Error("JSON operation failed",
        "path", path,
        "error", err,
        "error_type", fmt.Sprintf("%T", err),
    )
    return err
}
```

### Audit Logging

```go
func auditLog(op string, path string, err error) {
    if err != nil {
        log.Warn("operation failed",
            "operation", op,
            "path", path,
            "error", err,
        )
    } else {
        log.Info("operation succeeded",
            "operation", op,
            "path", path,
        )
    }
}
```

## Recovery Strategies

### SafeError for Safe Output

`SafeError` returns a client-safe error message with internal context removed (operation, path, structural details) — suitable for HTTP/API responses (CWE-209):

```go
// Signature: func SafeError(err error) string

val, err := json.Get(untrustedInput, "data")
if err != nil {
    // The full Error() contains "JSON get failed at path '...': ..." — never send it as-is
    // SafeError returns only the underlying sentinel message, e.g. "path not found"
    safeMsg := json.SafeError(err)
    _ = safeMsg // http.Error(w, safeMsg, http.StatusBadRequest)
    _ = val
    return
}
```

### RedactedPath Log Redaction

Paths can carry sensitive key names (`user.password`, `token`, etc.). Mask them with `RedactedPath` before logging — any non-empty path is replaced with `***`, leaking no fragment:

```go
// Signature: func RedactedPath(path string) string

var jsonErr *json.JsonsError
if errors.As(err, &jsonErr) {
    // Log only the masked path, keeping sensitive key names out of the log system
    log.Warn("JSON operation failed",
        "op", jsonErr.Op,
        "path", json.RedactedPath(jsonErr.Path), // ***
    )
}
```

### Retry

```go
func withRetry(fn func() error, maxRetries int) error {
    var err error
    for i := 0; i < maxRetries; i++ {
        if err = fn(); err == nil {
            return nil
        }
        time.Sleep(time.Second * time.Duration(i+1))
    }
    return err
}

// Usage
err := withRetry(func() error {
    return processData(data)
}, 3)
```

### Degradation

```go
func getConfig(data string) Config {
    cfg := json.DefaultConfig()

    // Use type-safe getters with built-in defaults
    cfg.EnableMetrics = json.GetBool(data, "config.metrics", true)

    return cfg
}
```

## Error Classification

### User Input Errors

Caused by user-supplied JSON data or paths:

```go
val, err := json.Get(data, "user.name")
if err != nil {
    switch {
    case errors.Is(err, json.ErrInvalidJSON):
        // Malformed JSON
        return fmt.Errorf("malformed data: %w", err)
    case errors.Is(err, json.ErrPathNotFound):
        // Path does not exist (including an out-of-range array index)
        return fmt.Errorf("field does not exist: %w", err)
    case errors.Is(err, json.ErrInvalidPath):
        // Path syntax error
        return fmt.Errorf("path syntax error: %w", err)
    }
}
```

`Get` can also return `ErrInvalidJSON`, `ErrPathNotFound`, `ErrInvalidPath`, `ErrSizeLimit`, `ErrDepthLimit`, `ErrSecurityViolation`, `ErrConcurrencyLimit`, and `ErrProcessorClosed`. `ErrTypeMismatch` never appears on `Get` — to branch on type semantics, use `SafeGet(...).AsString()` or `GetCompiled`, whose failures wrap that sentinel (see [Error Checking](#error-checking)). No operation returns `ErrUnsupportedPath`, so it needs no branch.

### Security-Related Errors

A potential security threat was detected:

```go
val, err := json.Get(untrustedInput, "data")
if err != nil {
    if errors.Is(err, json.ErrSecurityViolation) {
        // Security violation: log and reject
        log.Warn("security violation", "error", err)
        return errors.New("invalid input")
    }
    if errors.Is(err, json.ErrSizeLimit) {
        return fmt.Errorf("data exceeds the size limit: %w", err)
    }
    if errors.Is(err, json.ErrDepthLimit) {
        return fmt.Errorf("nesting depth exceeded: %w", err)
    }
    return err
}
```

### System Errors

Transient system-level errors:

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrOperationTimeout) {
        // Operation timed out, retryable <Badge type="danger" text="Deprecated" />
        return fmt.Errorf("transient error, please retry: %w", err)
    }
    if errors.Is(err, json.ErrConcurrencyLimit) {
        // Concurrency limit (returned at MaxConcurrency; retryable)
        return fmt.Errorf("system busy, please try later: %w", err)
    }
    if errors.Is(err, json.ErrResourceExhausted) {
        // Resources exhausted <Badge type="danger" text="Deprecated" />
        return fmt.Errorf("insufficient system resources: %w", err)
    }
    if errors.Is(err, json.ErrProcessorClosed) {
        // Processor closed
        return fmt.Errorf("processor unavailable: %w", err)
    }
    return err
}
```

## Error-Handling Best Practices

### 1. Distinguish error types

```go
func processJSON(data string) error {
    val, err := json.Get(data, "user.name")
    if err != nil {
        // Distinguish error types with errors.Is
        switch {
        case errors.Is(err, json.ErrInvalidJSON),
            errors.Is(err, json.ErrPathNotFound),
            errors.Is(err, json.ErrInvalidPath):
            // User input error: return a friendly message
            return fmt.Errorf("malformed data: %w", err)
        case errors.Is(err, json.ErrSecurityViolation), errors.Is(err, json.ErrSizeLimit):
            // Security limit: log and reject
            log.Warn("security violation", "error", err)
            return errors.New("invalid input")
        case errors.Is(err, json.ErrConcurrencyLimit):
            // Concurrency cap: retryable later
            return fmt.Errorf("system busy, please retry later: %w", err)
        default:
            // System error
            log.Error("system error", "error", err)
            return errors.New("internal error")
        }
    }
    return nil
}
```

### 2. Use errors.As for context

```go
func handleWithDetail(data string, path string) error {
    val, err := json.Get(data, path)
    if err != nil {
        var jsonErr *json.JsonsError
        if errors.As(err, &jsonErr) {
            return fmt.Errorf("operation %s failed (path: %s): %w",
                jsonErr.Op, jsonErr.Path, jsonErr.Err)
        }
        return fmt.Errorf("operation failed: %w", err)
    }
    return nil
}
```

### 3. Error chain tracing

```go
func deepProcess(data string) error {
    if err := processLevel1(data); err != nil {
        return fmt.Errorf("deep processing failed: %w", err)
    }
    return nil
}

func processLevel1(data string) error {
    if err := processLevel2(data); err != nil {
        return fmt.Errorf("level-1 processing failed (path data.field): %w", err)
    }
    return nil
}

func processLevel2(data string) error {
    _, err := json.Get(data, "data.field")
    return err
}

// Example error chain (JsonsError carries Op/Path; %w layers preserve the
// underlying cause):
// deep processing failed: level-1 processing failed (path data.field): JSON get failed at path 'data.field': ... (caused by: path not found)
```

## See Also

- [Constants and Errors](../api-reference/constants)
- [Security Overview](../security/)
- [Performance Optimization](./performance)
