---
title: "Audit Logging - CyberGo DD | AuditLogger"
description: "CyberGo DD audit logging API: AuditLogger async event recorder, AuditConfig options, structured entries, and enterprise compliance audit support."
---

# Audit Logging

DD provides asynchronous audit logging for recording security-related events, with support for integrity signing and chain verification.

## AuditLogger

Asynchronous security audit event recorder.

### Creation

```go
func NewAuditLogger(cfg AuditConfig) (*AuditLogger, error)
```

```go
// Using default configuration
auditLogger, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())

// Custom configuration
cfg := dd.DefaultAuditConfig()
cfg.JSONFormat = true
cfg.MinimumSeverity = dd.AuditSeverityWarning
auditLogger, _ := dd.NewAuditLogger(cfg)
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Log` | `(event AuditEvent)` | Record audit event (async) |
| `LogSensitiveDataRedaction` | `(pattern, field, message string)` | Sensitive data redaction event |
| `LogRateLimitExceeded` | `(message string, metadata map[string]any)` | Rate limit exceeded event |
| `LogSecurityViolation` | `(violationType, message string, metadata map[string]any)` | Security violation event |
| `LogReDoSAttempt` | `(pattern, message string)` | ReDoS attack event |
| `LogIntegrityViolation` | `(message string, metadata map[string]any)` | Integrity violation event |
| `LogPathTraversalAttempt` | `(path, message string)` | Path traversal event |
| `Stats` | `() AuditStats` | Audit statistics |
| `Close` | `() error` | Close and flush remaining events |

### Usage Example

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

// Record sensitive data redaction
audit.LogSensitiveDataRedaction("password", "login_form", "Plaintext password field detected")

// Record rate limit exceeded
audit.LogRateLimitExceeded("API request limit exceeded", map[string]any{
    "client_ip": "192.168.1.100",
    "limit":     100,
    "current":   150,
})

// Record security violation
audit.LogSecurityViolation("sql_injection", "SQL injection attempt", map[string]any{
    "input": "' OR 1=1 --",
})
```

## AuditConfig

Audit log configuration.

```go
type AuditConfig struct {
    Enabled          bool             // Whether to enable auditing
    Output           *os.File         // Output file
    BufferSize       int              // Buffer size
    IncludeTimestamp  bool            // Whether to include timestamp
    JSONFormat       bool             // JSON format output
    MinimumSeverity  AuditSeverity    // Minimum severity level to record
    IntegritySigner  *IntegritySigner // Integrity signer
}
```

### Default Configuration

```go
func DefaultAuditConfig() AuditConfig
```

Returns default audit configuration. Audit logging is enabled by default.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Validate` | `() error` | Validate configuration |
| `Clone` | `() AuditConfig` | Copy configuration |

## AuditEvent

Audit event struct.

```go
type AuditEvent struct {
    Type     AuditEventType    `json:"type"`
    Timestamp time.Time        `json:"timestamp"`
    Message  string            `json:"message"`
    Pattern  string            `json:"pattern,omitempty"`
    Field    string            `json:"field,omitempty"`
    Metadata map[string]any    `json:"metadata,omitempty"`
    Severity AuditSeverity     `json:"severity"`
}
```

### AuditStats

Audit statistics structure.

```go
type AuditStats struct {
    TotalEvents int64                      // Total event count
    Dropped     int64                      // Dropped event count
    ByType      map[AuditEventType]int64   // Statistics by type
    BufferSize  int                        // Buffer size
    BufferUsage int                        // Buffer usage
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
| `AuditEventPathTraversalAttempt` | `"PATH_TRAVERSAL_ATTEMPT"` | Path traversal attempt |
| `AuditEventLog4ShellAttempt` | `"LOG4SHELL_ATTEMPT"` | Log4Shell attack attempt |
| `AuditEventNullByteInjection` | `"NULL_BYTE_INJECTION"` | Null byte injection |
| `AuditEventOverlongEncoding` | `"OVERLONG_ENCODING"` | Overlong encoding attack |
| `AuditEventHomographAttack` | `"HOMOGRAPH_ATTACK"` | Homograph attack |

## Audit Severity Levels

| Constant | String() | Description |
|----------|----------|-------------|
| `AuditSeverityInfo` | `"INFO"` | Informational |
| `AuditSeverityWarning` | `"WARNING"` | Warning |
| `AuditSeverityError` | `"ERROR"` | Error |
| `AuditSeverityCritical` | `"CRITICAL"` | Critical |

### MarshalJSON

```go
func (s AuditSeverity) MarshalJSON() ([]byte, error)
```

`AuditSeverity` implements the `json.Marshaler` interface, outputting strings instead of integers during JSON serialization:

```go
event := dd.AuditEvent{
    Type:     dd.AuditEventSecurityViolation,
    Severity: dd.AuditSeverityCritical,
}
data, _ := json.Marshal(event)
// Severity serializes as "CRITICAL", not 3
```

## Verifying Audit Entries

```go
func VerifyAuditEvent(entry string, signer *IntegritySigner) *AuditVerificationResult
```

Verifies the integrity of an audit log entry.

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
result := dd.VerifyAuditEvent(logEntry, signer)
if result != nil && result.Valid {
    fmt.Println("Audit entry verification passed")
}
```

## Next Steps

- [Integrity Signing](./integrity) -- IntegritySigner in detail
- [Security Filtering](./security) -- Sensitive data filtering
- [Hook System](./hooks) -- OnError hook
