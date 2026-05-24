---
title: "HMAC Signing - CyberGo DD | Integrity Protection"
description: "CyberGo DD HMAC-SHA256 integrity signing: IntegritySigner setup, signing and verification workflow, tamper detection, and production best practices."
---

# HMAC Signing in Practice

DD's `IntegritySigner` uses HMAC-SHA256 to sign log entries, ensuring logs are not tampered with during storage and transmission.

## Core Concepts

```text
Signing Flow:
  Raw Log → HMAC-SHA256(secret key + timestamp + sequence number) → Signed Log

Verification Flow:
  Signed Log → Extract Signature → Recalculate HMAC → Compare Signatures → Determine Integrity
```

## Creating a Signer

### Secure Key Configuration

```go
// Method 1: Auto-generate a secure key (recommended)
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
// cfg.SecretKey is populated with a 32-byte random key

signer, _ := dd.NewIntegritySigner(cfg)
```

### Custom Configuration

```go
cfg := dd.IntegrityConfig{
    SecretKey:       []byte("your-32-byte-minimum-secret-key!!"),  // At least 32 bytes
    HashAlgorithm:   dd.HashAlgorithmSHA256,
    IncludeTimestamp: true,    // Include timestamp in signature
    IncludeSequence:  true,    // Include sequence number in signature
    SignaturePrefix:  "[SIG:",  // Signature prefix
}
```

:::danger Key Management
- The key must be at least 32 bytes
- Do not hardcode keys in source code; use environment variables or key management services
- Rotate keys regularly
- Immediately rotate keys and re-verify all logs after a key leak
:::

## Signing Workflow

```go
// Create signer
signer, _ := dd.NewIntegritySigner(cfg)

// Sign a single log entry
logEntry := `{"level":"info","message":"user login","user":"admin"}`
signature := signer.Sign(logEntry)
signedEntry := logEntry + signature

fmt.Println(signedEntry)
// Output: {"level":"info","message":"user login","user":"admin"}[SIG:1713456789000000000:1:base64sig...]
```

### Signing Statistics

```go
stats := signer.Stats()
fmt.Printf("Current sequence: %d\n", stats.Sequence)
fmt.Printf("Algorithm: %s\n", stats.Algorithm)
fmt.Printf("Include timestamp: %v\n", stats.IncludeTimestamp)
fmt.Printf("Include sequence: %v\n", stats.IncludeSequence)
```

## Verification Workflow

### Verify a Single Log Entry

```go
result, err := signer.Verify(signedEntry)
if err != nil {
    fmt.Printf("Verification failed: %v\n", err)
    return
}

if result.Valid {
    fmt.Printf("Log intact - timestamp: %s, sequence: %d\n",
        result.Timestamp, result.Sequence)
    fmt.Printf("Message: %s\n", result.Message)
} else {
    fmt.Printf("Log may have been tampered with\n")
}
```

### Batch Verify Log File

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

### Verify Audit Events

```go
result := dd.VerifyAuditEvent(auditLogLine, signer)
if result.Valid && result.Event != nil {
    fmt.Printf("Audit event: %s\n", result.Event.Message)
} else {
    fmt.Printf("Verification failed: %s\n", result.Error)
}
```

## Integration with Audit Logging

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

    // Audit logger (with signing)
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

## Timestamps and Sequence Numbers

The signer supports embedding timestamps and sequence numbers in signatures:

```go
cfg := dd.IntegrityConfig{
    SecretKey:       secretKey,
    IncludeTimestamp: true,    // Include timestamp in signature
    IncludeSequence:  true,    // Include incremental sequence number in signature
}

// When enabled, Verify results include additional information
result, _ := signer.Verify(signedEntry)
result.Timestamp  // Timestamp at time of signing
result.Sequence   // Sequence number at time of signing
```

:::tip Sequence Number Detection
With sequence numbers enabled, you can detect whether logs have been deleted or reordered. If sequence numbers are not contiguous, the logs may have been tampered with.
:::

## Production Best Practices

### Key Management

```go
// Read key from environment variable
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
// Verify audit log integrity every hour
func startIntegrityChecker(signer *dd.IntegritySigner, logPath string) {
    ticker := time.NewTicker(time.Hour)
    go func() {
        for range ticker.C {
            valid, invalid, err := VerifyLogFile(logPath, signer)
            if err != nil {
                dd.Errorf("Integrity check failed: %v", err)
                continue
            }
            dd.InfoWith("Integrity check completed",
                dd.Int("valid", valid),
                dd.Int("invalid", invalid),
            )
            if invalid > 0 {
                dd.Error("Log tampering detected")
            }
        }
    }()
}
```

## Next Steps

- [Audit Logging](../guides/audit-logging) -- Security audit integration
- [Industry Compliance Configuration](../security/compliance) -- HIPAA/PCI-DSS signing requirements
- [API Reference - Integrity](../api-reference/integrity) -- IntegritySigner complete API
