---
sidebar_label: "Signing Algorithms"
title: "Signing Algorithms - CyberGo JWT | Selection"
description: "Compare HMAC, RSA, RSA-PSS, and ECDSA across 12 algorithms by key type, performance, and signature length, with selection and key rotation guidance."
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

An HMAC key must pass two checks performed by `validateSigningKey`:

- **Length check**: when `len(SecretKey) < 32`, returns `ErrInvalidSecretKey`; the error message includes the actual byte length, e.g. `"minimum 32 bytes required, got 16"`.
- **Entropy check**: low-entropy keys are detected via `internal.IsWeakKey`. The following patterns are rejected:
  - All identical characters (e.g. `"aaaaaaaa..."`)
  - Repeated short patterns (e.g. `"abcabcabc..."`)
  - Sequential ascending/descending sequences (e.g. `"abcdefgh..."`)
  - Common weak passwords and their variants (e.g. `"password"`, `"qwerty"`)

:::warning Weak Keys Are Rejected
Avoid guessable keys such as repeated characters, sequential runs, or dictionary words. Even at 32 bytes, a low-entropy key is rejected during `jwt.New` initialization with `ErrInvalidSecretKey`.
:::

Generate keys from a cryptographically secure random source in production:

```go
package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"

	"github.com/cybergodev/jwt"
)

func main() {
	// Generate a 32-byte random key using crypto/rand
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		log.Fatal(err)
	}
	// Store and pass it base64-encoded
	secret := base64.StdEncoding.EncodeToString(raw)

	cfg := jwt.DefaultConfig()
	cfg.SecretKey = secret
	processor, err := jwt.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer processor.Close()

	fmt.Println("HMAC key ready, length (bytes):", len(secret)) // Output: HMAC key ready, length (bytes): 44
}
```

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

RSA signs with a private key and verifies with a public key. It suits scenarios where the verifying side does not hold the private key.

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
// Generate 2048-bit RSA key pair (the library requires at least 2048 bits, otherwise returns ErrInvalidSecretKey)
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

:::tip Sharing Keys with RSA-PSS
RS256/RS384/RS512 and PS256/PS384/PS512 use the same key types (`*rsa.PrivateKey` / `*rsa.PublicKey`) and the same verification logic, so the keys are interchangeable. Migrating from RSA to RSA-PSS requires no key regeneration.
:::

## RSA-PSS (Asymmetric Key, Recommended over RSA)

RSA-PSS is an improved RSA signing scheme that uses Probabilistic Signature Scheme (PSS) padding and offers better security than PKCS#1 v1.5. It uses the same keys as RSA.

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

### Curve Matching

Algorithms and curves must correspond strictly; this is enforced at initialization (see `validateECDSACurve` in the source):

| Algorithm | Required Curve | How to Generate |
|-----------|----------------|-----------------|
| ES256 | P-256 | `elliptic.P256()` |
| ES384 | P-384 | `elliptic.P384()` |
| ES512 | P-521 | `elliptic.P521()` |

:::warning ES512 Uses P-521, Not P-512
The curve corresponding to `ES512` is **P-521** (note: 521, not 512). This is a common mistake — the number 512 misleadingly suggests the curve is also P-512, but the Go standard library has no `P512`; the highest curve is `elliptic.P521()`. A curve mismatch returns `ErrInvalidSecretKey`.
:::

## Key Separation Mode

In a microservice architecture, the **signing capability** (issuing tokens) is usually separated from the **verification capability** (validating tokens), following the principle of least privilege:

| Service Role | Held Key | Responsibility |
|--------------|----------|----------------|
| **Auth service** | Private key (`SigningKey`) | Issues access tokens after successful login |
| **API service** | Public key (`VerificationKey`) | Validates token signatures, does not issue tokens |

The auth service holds the private key and issues tokens; API services hold the public key and verify them. The current API requires the `SigningKey` field to be non-empty, so an API service still needs to supply a `*rsa.PrivateKey`. **A placeholder private key is sufficient**: once `VerificationKey` is set, verification uses only that public key, so the placeholder has no relation to the real signing key.

:::tip VerificationKey Takes Precedence
Once `VerificationKey` is set, the verification flow uses that public key rather than the one extracted from `SigningKey`. A verify-only service can therefore hold an unrelated 2048-bit placeholder private key, keeping signing capability fully isolated inside the auth service.
:::

Auth service (issuing tokens):

```go
authCfg := jwt.DefaultConfig()
authCfg.SigningMethod = jwt.SigningMethodRS256
authCfg.SigningKey = rsaPrivateKey           // *rsa.PrivateKey, used for signing
authCfg.VerificationKey = &rsaPrivateKey.PublicKey
```

API service (verification only):

```go
apiCfg := jwt.DefaultConfig()
apiCfg.SigningMethod = jwt.SigningMethodRS256
apiCfg.SigningKey = placeholderPrivateKey    // Any 2048-bit private key as a placeholder; not used for verification
apiCfg.VerificationKey = rsaPublicKey        // *rsa.PublicKey, actually used for verification
```

:::warning Do Not Issue Tokens from a Verification-Only Instance
A verification-only `Processor` should not call `Create` / `CreateRefresh`: that would sign with the placeholder key and produce tokens nobody can verify. For a complete cross-service example, see [Advanced Examples](../examples/advanced#key-separation-mode).
:::

## How to Choose

```text
Monolithic app ──────────→ HMAC
Microservices (same trust domain) ──→ HMAC
Microservices (cross-service verification) → RSA, RSA-PSS, or ECDSA
Security priority ────────→ RSA-PSS (replaces RSA)
High performance ─────────→ ECDSA
Short key length ─────────→ ECDSA
```

| Factor | HMAC | RSA | RSA-PSS | ECDSA |
|--------|------|-----|---------|-------|
| Sign speed | Fast | Slower | Slower | Fast |
| Verify speed | Fast | Fast | Fast | Fast |
| Key length | 32+ bytes | 2048+ bits | 2048+ bits | 256+ bits |
| Signature length | Fixed | Long (~256 bytes) | Long (~256 bytes) | Short (~64 bytes) |
| Architecture coupling | Tight | Loose | Loose | Loose |
| Security | High | High | Higher | High |

## Key Management Best Practices

### Environment Variable Injection

Pass keys via environment variables to avoid hardcoding them in source code:

```go
package main

import (
	"fmt"
	"os"

	"github.com/cybergodev/jwt"
)

func main() {
	secret := os.Getenv("JWT_SECRET_KEY")
	cfg := jwt.DefaultConfig()
	cfg.SecretKey = secret
	processor, err := jwt.New(cfg)
	if err != nil {
		fmt.Println("Invalid key:", err)
		return
	}
	defer processor.Close()
	fmt.Println("Processor ready") // Output: Processor ready
}
```

### Loading an RSA Key from a PEM File

In production, asymmetric keys are usually stored as PEM files and parsed at startup using `crypto/x509`:

```go
package main

import (
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"

	"github.com/cybergodev/jwt"
)

func main() {
	// Read the private key PEM file
	keyData, err := os.ReadFile("private_key.pem")
	if err != nil {
		fmt.Println("Failed to read private key:", err)
		return
	}

	block, _ := pem.Decode(keyData)
	if block == nil {
		fmt.Println("PEM decode failed")
		return
	}

	privateKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		fmt.Println("Failed to parse private key:", err)
		return
	}

	cfg := jwt.DefaultConfig()
	cfg.SigningMethod = jwt.SigningMethodRS256
	cfg.SigningKey = privateKey
	processor, err := jwt.New(cfg)
	if err != nil {
		fmt.Println("Initialization failed:", err)
		return
	}
	defer processor.Close()
	fmt.Println("RSA key loaded from PEM") // Output: RSA key loaded from PEM
}
```

:::tip Loading a Public Key from PEM
A public key PEM file is parsed with `x509.ParsePKIXPublicKey`, which returns `any` and must be type-asserted to `*rsa.PublicKey` or `*ecdsa.PublicKey`. For a complete example, see [Advanced Examples](../examples/advanced#loading-keys-from-pem-files).
:::

### Key Rotation

:::tip Rotation Recommendations
- Rotate signing keys regularly (every 3–6 months recommended)
- During the overlap period, the verifying side accepts both public keys
- The JWT header of this library is fixed to `{"typ":"JWT","alg":"<algorithm>"}` and **does not support `kid` (Key ID)**, so a token cannot record which key version signed it. During the overlap period, create one `Processor` per key. Decide the version from an external route or a claim, then hand verification to the matching instance. A single instance cannot select a key automatically
- After rotation completes, revoke the old key and check whether the blacklist needs updating
:::

## Security Notes

Key management checklist:

| Item | Requirement |
|------|-------------|
| Key source | Environment variables or a secrets manager; never in source code or version control |
| HMAC keys | Cryptographically secure random, ≥ 32 bytes; no pure digits, repeated characters, or dictionary words |
| Asymmetric keys | RSA ≥ 2048 bits; ECDSA curve strictly matched to the algorithm (ES256 → P-256, ES384 → P-384, ES512 → P-521) |
| Algorithm | Never `none` (the library rejects it automatically); prefer RSA-PSS or ECDSA for cross-service verification |
| Rotation | Rotate regularly; during the overlap period the verifying side accepts both public keys. The header is fixed and has no `kid`, see [Key Rotation](#key-rotation) |
| Wrap-up | Revoke the old key after rotation and check whether the blacklist needs updating |

## Next Steps

- [Custom Claims](./custom-claims) — Define business fields
- [API Reference → Package Functions](../api-reference/functions) — Complete API signatures
- [Basic Examples](../examples/basic) — HMAC complete example
