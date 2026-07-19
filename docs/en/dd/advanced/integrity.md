---
sidebar_label: "HMAC Signing"
title: "HMAC Signing In Practice - CyberGo DD | Log Integrity Protection"
description: "A practical guide to CyberGo DD's HMAC-SHA256 log-integrity signing, covering IntegritySigner creation and initialization, the complete signing and verification flow, the timestamp and monotonically increasing sequence-number mechanism, tamper-detection strategies, integration with audit logging, and production-deployment best practices to ensure the integrity and traceability of the log chain."
sidebar_position: 3
---

# HMAC Signing In Practice

DD's `IntegritySigner` signs log entries with HMAC-SHA256, ensuring logs are not tampered with during storage or transit.

## Core Concept

```text
Signing flow:
  Original log -> HMAC-SHA256(key + timestamp + sequence) -> Signed log

Verification flow:
  Signed log -> Extract signature -> Recompute HMAC -> Compare signatures -> Determine integrity
```

## Creating a Signer

### Safe Key Configuration

```go
// Option 1: auto-generate a secure key (recommended)
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
// cfg.SecretKey is filled with 32 random bytes

signer, _ := dd.NewIntegritySigner(cfg)
```

### Custom Configuration

```go
cfg := dd.IntegrityConfig{
    SecretKey:       []byte("your-32-byte-minimum-secret-key!!"),  // At least 32 bytes
    HashAlgorithm:   dd.HashAlgorithmSHA256,
    IncludeTimestamp: true,    // Sign includes timestamp
    IncludeSequence:  true,    // Sign includes sequence number
    SignaturePrefix:  "[SIG:",  // Signature prefix
}
```

:::danger Key Management
- Key must be at least 32 bytes
- Do not hardcode the key in source code; use environment variables or a key-management service
- Rotate keys periodically
- Rotate immediately and re-verify all logs upon key compromise
:::

## Signing Flow

```go
// Create the signer
signer, _ := dd.NewIntegritySigner(cfg)

// Sign a single log
logEntry := `{"level":"info","message":"user login","user":"admin"}`
signature := signer.Sign(logEntry)
signedEntry := logEntry + signature

fmt.Println(signedEntry)
// Output: {"level":"info","message":"user login","user":"admin"}[SIG:1713456789000000000:1:base64sig...]
```

### Signing Statistics

```go
stats := signer.Stats()
fmt.Printf("current sequence: %d\n", stats.Sequence)
fmt.Printf("algorithm: %s\n", stats.Algorithm)
fmt.Printf("includes timestamp: %v\n", stats.IncludeTimestamp)
fmt.Printf("includes sequence: %v\n", stats.IncludeSequence)
```

## Verification Flow

### Verify a Single Log

```go
result, err := signer.Verify(signedEntry)
if err != nil {
    fmt.Printf("verification failed: %v\n", err)
    return
}

if result.Valid {
    fmt.Printf("log intact - time: %s, sequence: %d\n",
        result.Timestamp, result.Sequence)
    fmt.Printf("message: %s\n", result.Message)
} else {
    fmt.Printf("log may have been tampered with\n")
}
```

### Batch-verifying a Log File

```go
func VerifyLogFile(path string, signer *dd.IntegritySigner) (valid, invalid int, err error) {
    file, err := os.Open(path)
    if err != nil {
        return 0, 0, err
    }
    defer file.Close()

    scanner := bufio.NewScanner(file)
    for scanner.Scan() {
        result, err := signer.Verify(scanner.Text())
        if err != nil || !result.Valid {
            invalid++
        } else {
            valid++
        }
    }

    return valid, invalid, scanner.Err()
}
```

### Verifying Audit Events

```go
result := dd.VerifyAuditEvent(auditLogLine, signer)
if result.Valid && result.Event != nil {
    fmt.Printf("audit event: %s\n", result.Event.Message)
} else {
    fmt.Printf("verification failed: %s\n", result.Error)
}
```

## Integrating with Audit Logging

```go
// Complete signing + audit solution
func NewSignedAuditSystem() (*dd.AuditLogger, *dd.IntegritySigner, error) {
    // Signer
    cfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(cfg)

    // Audit file
    auditFile, _ := os.OpenFile(
        "logs/audit-signed.json",
        os.O_CREATE|os.O_WRONLY|os.O_APPEND,
        0600,
    )

    // AuditLogger (signed)
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        IncludeTimestamp: true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityWarning,
        IntegritySigner:  signer,
    })

    return auditLogger, signer, nil
}
```

## Timestamp and Sequence Number

The signer supports embedding a timestamp and sequence number in the signature:

```go
cfg := dd.IntegrityConfig{
    SecretKey:       secretKey,
    IncludeTimestamp: true,    // Signature includes a timestamp
    IncludeSequence:  true,    // Signature includes an increasing sequence number
}

// Once enabled, Verify results include extra information
result, _ := signer.Verify(signedEntry)
result.Timestamp  // Timestamp at signing
result.Sequence   // Sequence number at signing
```

:::tip Sequence-number Detection
With sequence numbers enabled, you can detect whether logs have been deleted or reordered. If sequence numbers are discontinuous, logs may have been tampered with.

Note: the sequence number itself does not prevent replay attacks; the verifier must track observed sequence numbers itself to reject duplicates.
:::

## Production Best Practices

### Key Management

```go
// Read the key from an environment variable
func loadSecretKey() ([]byte, error) {
    key := os.Getenv("DD_INTEGRITY_SECRET")
    if len(key) < 32 {
        return nil, fmt.Errorf("secret key must be at least 32 bytes")
    }
    return []byte(key), nil
}
```

### Periodic Verification

```go
// Verify audit-log integrity once per hour
func startIntegrityChecker(signer *dd.IntegritySigner, logPath string) {
    ticker := time.NewTicker(time.Hour)
    go func() {
        for range ticker.C {
            valid, invalid, err := VerifyLogFile(logPath, signer)
            if err != nil {
                dd.Errorf("integrity check failed: %v", err)
                continue
            }
            dd.InfoWith("integrity check completed",
                dd.Int("valid", valid),
                dd.Int("invalid", invalid),
            )
            if invalid > 0 {
                dd.Error("log tampering detected")
            }
        }
    }()
}
```

## Next Steps

- [Audit Logging](../guides/audit-logging) -- Security audit integration
- [Industry Compliance Configuration](../security/compliance) -- HIPAA/PCI-DSS signing requirements
- [API Reference - Integrity](../api-reference/security-audit/integrity) -- Complete IntegritySigner API
