---
title: "Integrity Signing - CyberGo DD | IntegritySigner"
description: "CyberGo DD integrity signing API: HMAC-SHA256 signing, sequence tracking, IntegritySigner, and Verify for tamper-proof audit log compliance."
---

# Integrity Signing

DD provides HMAC-based log integrity signing to verify that log entries have not been tampered with.

## IntegritySigner

Log entry signer, supporting HMAC signing and chain verification.

### Creation

```go
func NewIntegritySigner(cfg IntegrityConfig) (*IntegritySigner, error)
```

```go
// Safe creation (recommended for production)
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

// Custom configuration
cfg := dd.IntegrityConfig{
    SecretKey:      []byte("my-secret-key-that-is-at-least-32b!"),
    HashAlgorithm:  dd.HashAlgorithmSHA256,
    IncludeTimestamp: true,
    IncludeSequence:  true,
}
signer, err = dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}
```

### Signing Methods

#### Sign

```go
func (s *IntegritySigner) Sign(message string) string
```

Generates an HMAC signature for a log message. Thread-safe, can be called concurrently.

```go
sig := signer.Sign("User login admin 192.168.1.1")
// → "[SIG:1713456789000000000:1:base64signature...]"
```

#### SignFields

```go
func (s *IntegritySigner) SignFields(message string, fields []Field) string
```

Generates a signature for a message with fields. The signature includes the message and all field values. Thread-safe, can be called concurrently.

```go
sig := signer.SignFields("User login", []dd.Field{
    dd.String("user", "admin"),
    dd.String("ip", "192.168.1.1"),
})
```

### Verification Methods

#### Verify

```go
func (s *IntegritySigner) Verify(entry string) (*LogIntegrity, error)
```

Verifies the integrity of a log entry. Thread-safe, can be called concurrently.

```go
integrity, err := signer.Verify(signedEntry)
if err != nil {
    // Verification error (e.g., signer is nil)
}
if !integrity.Valid {
    // Signature invalid: signature mismatch or format error
}
if integrity.Sequence != expectedSeq {
    // Sequence number discontinuity: entries may have been deleted
}
```

### Other Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `GetSequence` | `() uint64` | Current sequence number |
| `ResetSequence` | `()` | Reset sequence number |
| `Stats` | `() IntegrityStats` | Signing statistics |

## IntegrityConfig

Signing configuration.

```go
type IntegrityConfig struct {
    SecretKey       []byte         // HMAC key
    HashAlgorithm   HashAlgorithm  // Hash algorithm
    IncludeTimestamp bool           // Include timestamp in signature
    IncludeSequence  bool           // Include sequence number in signature
    SignaturePrefix  string        // Signature prefix
}
```

### Safe Creation

```go
func DefaultIntegrityConfigSafe() (IntegrityConfig, error)
```

Safely creates default configuration (auto-generates key). Recommended for production use.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Validate` | `() error` | Validate configuration |
| `Clone` | `() IntegrityConfig` | Copy configuration |
| `MarshalJSON` | `() ([]byte, error)` | JSON serialization (key is excluded, only length is output) |

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}
```

## LogIntegrity

Log integrity verification result.

```go
type LogIntegrity struct {
    Valid     bool       // Whether the signature is valid
    Timestamp time.Time  // Signature timestamp
    Sequence  uint64     // Sequence number
    Message   string     // Original message
}
```

## IntegrityStats

Signing statistics.

```go
type IntegrityStats struct {
    Sequence         uint64 // Current sequence number
    Algorithm        string // Algorithm name
    IncludeTimestamp bool   // Whether timestamp is included
    IncludeSequence  bool   // Whether sequence number is included
}
```

## HashAlgorithm

| Constant | Description |
|----------|-------------|
| `HashAlgorithmSHA256` | SHA-256 algorithm |

Implements `String()` method, returns algorithm name.

## Complete Example

### Log Signing Flow

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

// Sign log
message := "User login"
signature := signer.Sign(message)

// Store signed log entry
logEntry := message + signature

// Verify log
result, err := signer.Verify(logEntry)
if err != nil {
    fmt.Println("Integrity verification failed:", err)
} else if result.Valid {
    fmt.Printf("Valid - sequence: %d\n", result.Sequence)
}
```

### Audit Integration

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

auditCfg := dd.DefaultAuditConfig()
auditCfg.IntegritySigner = signer
audit, _ := dd.NewAuditLogger(auditCfg)
defer audit.Close()

// Audit logs are automatically signed
audit.Log(dd.AuditEvent{
    Type:     dd.AuditEventSecurityViolation,
    Message:  "SQL injection attempt",
    Severity: dd.AuditSeverityCritical,
    Metadata: map[string]any{"input": "' OR 1=1"},
})

// Verify audit logs
stats := signer.Stats()
fmt.Printf("Algorithm: %s, Sequence: %d\n", stats.Algorithm, stats.Sequence)
```

## Next Steps

- [Audit Logging](./audit) -- AuditLogger in detail
- [Security Filtering](./security) -- Sensitive data filtering
- [Constants and Errors](./constants) -- Error codes
