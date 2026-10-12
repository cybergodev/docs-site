---
sidebar_label: "AuditLogger"
title: "Audit Logging - CyberGo DD | AuditLogger"
description: "CyberGo DD AuditLogger API: async audit-event recorder with AuditConfig output, format, and signing options, for tracking security events and compliance."
sidebar_position: 3
---

# Audit Logging

> 🔧 **API Reference** · For a hands-on tutorial see [Audit Logging](../../guides/security/audit-logging)

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
| `Log` | `(event AuditEvent)` | Record an audit event (asynchronous; events below `MinimumSeverity` are not recorded, a full buffer drops the event and counts it in `Dropped`, a zero `Timestamp` is filled in automatically) |
| `LogSensitiveDataRedaction` | `(pattern, field, message string)` | Sensitive-data redaction event |
| `LogRateLimitExceeded` | `(message string, metadata map[string]any)` | Rate-limit event |
| `LogSecurityViolation` | `(violationType, message string, metadata map[string]any)` | Security-violation event |
| `LogReDoSAttempt` | `(pattern, message string)` | ReDoS attack event |
| `LogIntegrityViolation` | `(message string, metadata map[string]any)` | Integrity-violation event |
| `LogPathTraversalAttempt` | `(path, message string)` | Path-traversal event |
| `Stats` | `() AuditStats` | Audit statistics |
| `Close` | `() error` | Close and flush remaining events (safe to call repeatedly; idempotent) |

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
    Enabled          bool             // Whether audit is enabled (default true; when false, Log is a silent no-op and events are not counted toward statistics)
    Output           *os.File         // Output file (default os.Stderr); when nil, no output is produced and events only count toward statistics
    BufferSize       int              // Async event buffer size (default 1000; clamped to 1000 when enabled and left at 0; a negative value fails validation)
    IncludeTimestamp bool             // Whether text output includes timestamps (default true; JSON output always includes the timestamp field)
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

## AuditStats

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

## AuditVerificationResult

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

### UnmarshalJSON

```go
func (s *AuditSeverity) UnmarshalJSON(data []byte) error
```

`*AuditSeverity` implements the `json.Unmarshaler` interface, accepting the string form emitted by `MarshalJSON` (`"INFO"`, `"WARNING"`, `"ERROR"`, `"CRITICAL"`) and decoding it into the corresponding constant. Any other string returns an `unknown audit severity` error, and non-string JSON values fail as well. Without this method, `json.Unmarshal` cannot decode a JSON string into the int underlying type of `AuditSeverity`, so `VerifyAuditEvent`'s parsed `Event` field would always be `nil`.

```go
var sev dd.AuditSeverity
err := json.Unmarshal([]byte(`"CRITICAL"`), &sev)
// err == nil, sev == dd.AuditSeverityCritical

err = json.Unmarshal([]byte(`"FATAL"`), &sev)
// err != nil: unknown audit severity "FATAL"
```

:::warning Asymmetric serialization format
`AuditEvent.Type` serializes as a **bare integer**, while `AuditSeverity` serializes as a **string** (only Severity has custom string Marshal/Unmarshal). This is intentional and pinned by tests; take care to distinguish the two when parsing audit JSON, and use `AuditEventType.String()` for human-readable event names.
:::

## Verifying Audit Entries

```go
func VerifyAuditEvent(entry string, signer *IntegritySigner) *AuditVerificationResult
```

Verifies the integrity of an audit-log entry. The return value is never `nil`: when `signer` is `nil` or internal verification fails, `Valid` is `false` and `Error` is non-nil; on a signature mismatch `Valid` is `false` with a `nil` `Error`, and `RawEvent` holds the message with the signature stripped; when verification succeeds and the message parses as JSON, `Event` is non-nil.

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
- [Hook System](../core/hooks) -- OnError hook
