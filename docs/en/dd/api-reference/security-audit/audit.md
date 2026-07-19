---
sidebar_label: "AuditLogger"
title: "Audit Logging - CyberGo DD | AuditLogger"
description: "Complete API documentation for CyberGo DD's audit logging, including the AuditLogger asynchronous audit-event recorder, AuditConfig options (output target, format, signing), and structured formatting of audit entries. Supports tracking of security-related events to meet enterprise-grade compliance and data-security requirements."
sidebar_position: 3
---

# Audit Logging

DD provides asynchronous audit logging that records security-related events, with support for integrity signing and per-entry sequence-number tracking.

## AuditLogger

Asynchronous security audit-event recorder.

### Creation

```go
func NewAuditLogger(cfg AuditConfig) (*AuditLogger, error)
```

Creates an asynchronous audit recorder using the provided `AuditConfig`. You can use `DefaultAuditConfig()` to obtain a config with sensible defaults.

Errors are returned when: configuration validation fails (e.g. `BufferSize` is negative).

```go
// Default config
auditLogger, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())

// Custom config
cfg := dd.DefaultAuditConfig()
cfg.JSONFormat = true
cfg.MinimumSeverity = dd.AuditSeverityWarning
auditLogger, _ := dd.NewAuditLogger(cfg)
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Log` | `(event AuditEvent)` | Record an audit event (asynchronous) |
| `LogSensitiveDataRedaction` | `(pattern, field, message string)` | Sensitive-data redaction event |
| `LogRateLimitExceeded` | `(message string, metadata map[string]any)` | Rate-limit event |
| `LogSecurityViolation` | `(violationType, message string, metadata map[string]any)` | Security-violation event |
| `LogReDoSAttempt` | `(pattern, message string)` | ReDoS attack event |
| `LogIntegrityViolation` | `(message string, metadata map[string]any)` | Integrity-violation event |
| `LogPathTraversalAttempt` | `(path, message string)` | Path-traversal event |
| `Stats` | `() AuditStats` | Audit statistics |
| `Close` | `() error` | Close and flush remaining events |

### Usage Example

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

// Record a sensitive-data redaction
audit.LogSensitiveDataRedaction("password", "login_form", "detected plaintext password field")

// Record a rate-limit event
audit.LogRateLimitExceeded("API request limit exceeded", map[string]any{
    "client_ip": "192.168.1.100",
    "limit":     100,
    "current":   150,
})

// Record a security violation
audit.LogSecurityViolation("sql_injection", "SQL injection attempt", map[string]any{
    "input": "' OR 1=1 --",
})
```

## AuditConfig

Audit logging configuration.

```go
type AuditConfig struct {
    Enabled          bool             // Whether audit is enabled (default true)
    Output           *os.File         // Output file (default os.Stderr); when nil, no output is produced and events only count toward statistics
    BufferSize       int              // Async event buffer size (default 1000; a negative value fails validation)
    IncludeTimestamp bool             // Whether to include timestamp (default true)
    JSONFormat       bool             // JSON format output (default true)
    MinimumSeverity  AuditSeverity    // Minimum severity to record (default AuditSeverityInfo)
    IntegritySigner  *IntegritySigner // Integrity signer (optional; when configured each audit event is signed)
}
```

### Default Config

```go
func DefaultAuditConfig() AuditConfig
```

Returns the default audit config; audit logging is enabled by default.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Validate` | `() error` | Validate config legality (returns an error if `BufferSize` is negative) |
| `Clone` | `() AuditConfig` | Copy config (`IntegritySigner` is a shared reference, not deep-copied) |

## AuditEvent

Audit event struct.

```go
type AuditEvent struct {
    Type      AuditEventType `json:"type"`
    Timestamp time.Time      `json:"timestamp"`
    Message   string         `json:"message"`
    Pattern   string         `json:"pattern,omitempty"`
    Field     string         `json:"field,omitempty"`
    Metadata  map[string]any `json:"metadata,omitempty"`
    Severity  AuditSeverity  `json:"severity"`
}
```

### AuditStats

Audit statistics struct.

```go
type AuditStats struct {
    TotalEvents int64                    // Total event count
    Dropped     int64                    // Dropped event count (accumulated when the buffer is full)
    ByType      map[AuditEventType]int64 // Per-type statistics
    BufferSize  int                      // Buffer size
    BufferUsage int                      // Current buffer usage
}
```

### AuditVerificationResult

Audit verification result.

```go
type AuditVerificationResult struct {
    Valid    bool         // Whether verification passed
    Event    *AuditEvent  // Parsed event
    RawEvent string       // Raw event string
    Error    error        // Verification error
}
```

## Audit Event Types

| Constant | String() | Description |
|----------|----------|-------------|
| `AuditEventSensitiveDataRedacted` | `"SENSITIVE_DATA_REDACTED"` | Sensitive data redacted |
| `AuditEventRateLimitExceeded` | `"RATE_LIMIT_EXCEEDED"` | Rate limit exceeded |
| `AuditEventReDoSAttempt` | `"REDOS_ATTEMPT"` | ReDoS attack attempt |
| `AuditEventSecurityViolation` | `"SECURITY_VIOLATION"` | Security violation |
| `AuditEventIntegrityViolation` | `"INTEGRITY_VIOLATION"` | Integrity violation |
| `AuditEventInputSanitized` | `"INPUT_SANITIZED"` | Input sanitized |
| `AuditEventPathTraversalAttempt` | `"PATH_TRAVERSAL_ATTEMPT"` | Path-traversal attempt |
| `AuditEventLog4ShellAttempt` | `"LOG4SHELL_ATTEMPT"` | Log4Shell attack attempt |
| `AuditEventNullByteInjection` | `"NULL_BYTE_INJECTION"` | Null-byte injection |
| `AuditEventOverlongEncoding` | `"OVERLONG_ENCODING"` | Overlong-encoding attack |
| `AuditEventHomographAttack` | `"HOMOGRAPH_ATTACK"` | Homograph attack |

## Audit Severity Levels

| Constant | String() | Description |
|----------|----------|-------------|
| `AuditSeverityInfo` | `"INFO"` | Info |
| `AuditSeverityWarning` | `"WARNING"` | Warning |
| `AuditSeverityError` | `"ERROR"` | Error |
| `AuditSeverityCritical` | `"CRITICAL"` | Critical |

### MarshalJSON

```go
func (s AuditSeverity) MarshalJSON() ([]byte, error)
```

`AuditSeverity` implements the `json.Marshaler` interface, emitting a string rather than an integer during JSON serialization:

```go
event := dd.AuditEvent{
    Type:     dd.AuditEventSecurityViolation,
    Severity: dd.AuditSeverityCritical,
}
data, _ := json.Marshal(event)
// Severity is serialized as "CRITICAL", not 3
```

## Verifying Audit Entries

```go
func VerifyAuditEvent(entry string, signer *IntegritySigner) *AuditVerificationResult
```

Verifies the integrity of an audit-log entry.

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
result := dd.VerifyAuditEvent(logEntry, signer)
if result != nil && result.Valid {
    fmt.Println("audit entry verified")
}
```

## Next Steps

- [Integrity Signing](./integrity) -- IntegritySigner in depth
- [Security Filtering](./security) -- Sensitive-data filtering
- [Hook System](./hooks) -- OnError hook
