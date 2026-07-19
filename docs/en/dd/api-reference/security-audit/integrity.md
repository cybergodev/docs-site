---
sidebar_label: "Integrity"
title: "Integrity Signing - CyberGo DD | IntegritySigner"
description: "Complete API documentation for CyberGo DD's integrity signing, supporting HMAC-SHA256 signing and a monotonically increasing sequence-number tracking mechanism, ensuring each log entry is tamper-evident. Provides the IntegritySigner signer and Verify verifier to meet security-audit and tamper-protection compliance requirements."
sidebar_position: 4
---

# Integrity Signing

DD provides an HMAC-based log-integrity signing mechanism that can verify log entries have not been tampered with.

## IntegritySigner

Log-entry signer supporting HMAC signing and monotonic sequence-number tracking (for after-the-fact detection of missing/replayed entries; the caller must compare sequence numbers themselves).

### Creation

```go
func NewIntegritySigner(cfg IntegrityConfig) (*IntegritySigner, error)
```

Creates a signer using the provided `IntegrityConfig`. You can use `DefaultIntegrityConfigSafe()` to generate a cryptographically secure random key.

Errors are returned when: `SecretKey` is fewer than 32 bytes, or `HashAlgorithm` is unsupported.

::: warning Key security
`NewIntegritySigner` **copies** the provided `SecretKey` and immediately zeroes the original `cfg.SecretKey` (to prevent key material from lingering in two memory locations). The caller should still avoid exposing the original key in logs or serialized output.
:::

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

// Custom config
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

Generates an HMAC signature for a log message. Thread-safe; safe to call concurrently.

```go
sig := signer.Sign("user login admin 192.168.1.1")
// -> "[SIG:1713456789000000000:1:base64signature...]"
```

#### SignFields

```go
func (s *IntegritySigner) SignFields(message string, fields []Field) string
```

Generates a signature for a message with fields; the signature covers the message and all field values. Thread-safe; safe to call concurrently.

```go
sig := signer.SignFields("user login", []dd.Field{
    dd.String("user", "admin"),
    dd.String("ip", "192.168.1.1"),
})
```

### Verification Methods

#### Verify

```go
func (s *IntegritySigner) Verify(entry string) (*LogIntegrity, error)
```

Verifies the integrity of a log entry. Thread-safe; safe to call concurrently.

```go
integrity, err := signer.Verify(signedEntry)
if err != nil {
    // Verification error (e.g. signer is nil)
}
if !integrity.Valid {
    // Invalid signature: signature mismatch or malformed
}
if integrity.Sequence != expectedSeq {
    // Sequence-number discontinuity: entries may have been removed
}
```

### Other Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `GetSequence` | `() uint64` | Current sequence number |
| `ResetSequence` | `()` | Reset the sequence number |
| `Stats` | `() IntegrityStats` | Signing statistics |

## IntegrityConfig

Signing configuration.

```go
type IntegrityConfig struct {
    SecretKey        []byte        // HMAC key (SHA-256 requires >= 32 bytes; store securely and rotate regularly)
    HashAlgorithm    HashAlgorithm // Hash algorithm (default SHA256)
    IncludeTimestamp bool          // Sign includes timestamp
    IncludeSequence  bool          // Sign includes a monotonically increasing sequence number (Verify result carries it; the caller must track it to detect replay/reorder)
    SignaturePrefix  string        // Signature prefix (default "[SIG:"; when empty NewIntegritySigner fills the default)
}
```

### Safe Creation

```go
func DefaultIntegrityConfigSafe() (IntegrityConfig, error)
```

Safely creates the default config (auto-generates a key). Recommended for production use.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Validate` | `() error` | Validate config legality (`SecretKey` must be >= 32 bytes; `HashAlgorithm` must be supported) |
| `Clone` | `() IntegrityConfig` | Deep-copy config (`SecretKey` is copied to a new slice) |
| `MarshalJSON` | `() ([]byte, error)` | JSON serialization (the key itself is **not** serialized; only `secretKeyLength` is output) |

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
    IncludeSequence  bool   // Whether sequence is included
}
```

## HashAlgorithm

| Constant | Description |
|----------|-------------|
| `HashAlgorithmSHA256` | SHA-256 algorithm |

Implements a `String()` method returning the algorithm name.

## Complete Examples

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

// Sign a log
message := "user login"
signature := signer.Sign(message)

// Store the signed log entry
logEntry := message + signature

// Verify the log
result, err := signer.Verify(logEntry)
if err != nil {
    fmt.Println("integrity verification failed:", err)
} else if result.Valid {
    fmt.Printf("verified - sequence: %d\n", result.Sequence)
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

// Audit logs are signed automatically
audit.Log(dd.AuditEvent{
    Type:     dd.AuditEventSecurityViolation,
    Message:  "SQL injection attempt",
    Severity: dd.AuditSeverityCritical,
    Metadata: map[string]any{"input": "' OR 1=1"},
})

// Verify the audit log
stats := signer.Stats()
fmt.Printf("algorithm: %s, sequence: %d\n", stats.Algorithm, stats.Sequence)
```

## Next Steps

- [Audit Logging](./audit) -- AuditLogger in depth
- [Security Filtering](./security) -- Sensitive-data filtering
- [Constants & Errors](../dev-tools/constants) -- Error codes
