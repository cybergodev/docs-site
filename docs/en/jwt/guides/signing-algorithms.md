---
sidebar_label: "Signing Algorithms"
title: "Signing Algorithms - CyberGo JWT | Selection"
description: "Compare HMAC, RSA, RSA-PSS, and ECDSA across 12 algorithms by key type, signing performance, signature length, and coupling, with selection guidance."
sidebar_position: 10
---

# Signing Algorithms

CyberGo JWT supports 4 categories with 12 signing algorithms, covering scenarios from monolithic apps to microservice architectures.

## Algorithm Overview

| Type | Algorithms | Key Type | Use Case |
|------|-----------|----------|----------|
| HMAC | HS256 / HS384 / HS512 | Symmetric key | Single apps, simple services |
| RSA | RS256 / RS384 / RS512 | Public/Private key | Microservices, multi-service validation |
| RSA-PSS | PS256 / PS384 / PS512 | Public/Private key | Microservices (recommended over RSA) |
| ECDSA | ES256 / ES384 / ES512 | Public/Private key | High-performance microservices |

## HMAC (Symmetric Key)

HMAC uses the same key for signing and verification — the simplest approach.

### Key Requirements

- Minimum 32 bytes
- Library auto-detects weak keys (repeated characters, sequential patterns, etc.)

### Usage

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.SigningMethod = jwt.SigningMethodHS256 // default, can be omitted
```

### Algorithm Selection

| Constant | Algorithm | Description |
|----------|-----------|-------------|
| `SigningMethodHS256` | HMAC-SHA256 | Recommended, balanced performance and security |
| `SigningMethodHS384` | HMAC-SHA384 | Higher security |
| `SigningMethodHS512` | HMAC-SHA512 | Highest security |

:::tip Recommendation
`HS256` is sufficient for most scenarios. Keys should be generated using cryptographically secure random methods, at least 32 bytes.
:::

## RSA (Asymmetric Key)

RSA uses a private key for signing and a public key for verification. Suitable when the verifying party doesn't need the private key.

### Usage

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodRS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey (optional)
```

:::tip Verification Key
`VerificationKey` is optional. When not set, the library uses `SigningKey` for verification (internally extracts the public key from the private key).
:::

### Key Generation

```go
// Generate 2048-bit RSA key pair
privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
if err != nil {
    log.Fatal(err)
}
publicKey := &privateKey.PublicKey
```

### Algorithm Selection

| Constant | Algorithm | Description |
|----------|-----------|-------------|
| `SigningMethodRS256` | RSA-SHA256 | Recommended |
| `SigningMethodRS384` | RSA-SHA384 | Higher security |
| `SigningMethodRS512` | RSA-SHA512 | Highest security |

## RSA-PSS (Asymmetric Key, Recommended over RSA)

RSA-PSS is an improved RSA signing scheme using Probabilistic Signature Scheme (PSS) padding, offering better security than PKCS#1 v1.5. Uses the same keys as RSA.

### Usage

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodPS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey (same key as RSA)
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey (optional)
```

:::tip Recommended Replacement
RSA-PSS is more secure than RSA PKCS#1 v1.5. New projects should prefer RSA-PSS algorithms. Keys are identical to RSA — no additional key generation needed.
:::

### Algorithm Selection

| Constant | Algorithm | Description |
|----------|-----------|-------------|
| `SigningMethodPS256` | RSA-PSS-SHA256 | Recommended |
| `SigningMethodPS384` | RSA-PSS-SHA384 | Higher security |
| `SigningMethodPS512` | RSA-PSS-SHA512 | Highest security |

## ECDSA (Elliptic Curve)

ECDSA is also asymmetric but with shorter keys and better performance.

### Usage

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodES256
cfg.SigningKey = ecdsaPrivateKey      // *ecdsa.PrivateKey
cfg.VerificationKey = ecdsaPublicKey  // *ecdsa.PublicKey (optional)
```

### Key Generation

```go
// Generate P-256 curve key pair
privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
if err != nil {
    log.Fatal(err)
}
publicKey := &privateKey.PublicKey
```

### Algorithm Selection

| Constant | Algorithm | Curve | Description |
|----------|-----------|-------|-------------|
| `SigningMethodES256` | ECDSA-SHA256 | P-256 | Recommended |
| `SigningMethodES384` | ECDSA-SHA384 | P-384 | Higher security |
| `SigningMethodES512` | ECDSA-SHA512 | P-521 | Highest security |

## How to Choose

```text
Monolithic app ────────→ HMAC
Microservices (same trust domain) → HMAC
Microservices (cross-service verification) → RSA, RSA-PSS, or ECDSA
Security priority ─────→ RSA-PSS (replaces RSA)
High performance ──────→ ECDSA
Short key length ──────→ ECDSA
```

| Factor | HMAC | RSA | RSA-PSS | ECDSA |
|--------|------|-----|---------|-------|
| Sign speed | Fast | Slower | Slower | Fast |
| Verify speed | Fast | Fast | Fast | Fast |
| Key length | 32+ bytes | 2048+ bits | 2048+ bits | 256+ bits |
| Signature length | Fixed | Long (~256 bytes) | Long (~256 bytes) | Short (~64 bytes) |
| Architecture coupling | Tight | Loose | Loose | Loose |
| Security | High | High | Higher | High |

## Security Notes

:::danger Prohibited
- Never hardcode keys in source code
- Never use weak keys (pure digits, repeated characters, etc.)
- Never use the `none` algorithm (automatically rejected by this library)
- HMAC keys must not be shorter than 32 bytes
:::

:::tip Best Practices
- Use environment variables or key management services
- Rotate signing keys regularly
- Use RSA or ECDSA in production
- RSA keys should be 2048 bits or larger
:::

## Next Steps

- [Custom Claims](./custom-claims) — Define business fields
- [API Reference → Package Functions](../api-reference/functions) — Complete API signatures
- [Basic Examples](../examples/basic) — HMAC complete example
