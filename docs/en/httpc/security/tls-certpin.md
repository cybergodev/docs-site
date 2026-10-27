---
sidebar_label: "TLS & Certificate Pinning"
title: "TLS & Certificate Pinning - CyberGo HTTPC | Crypto & Pinning"
description: "HTTPC TLS and certificate pinning: TLS 1.2-1.3 control, SPKI hash generation and rotation, Pinner constructors, mTLS, and custom CA certificates."
sidebar_position: 30
---

# TLS and Certificate Pinning

TLS configuration sets the protocol versions and cipher suites used during the handshake, and certificate pinning adds an extra check on peer identity on top of it. This page covers version control, suite injection rules, the three pinner constructors, and key rotation.

## TLS Version Control

HTTPC requires TLS 1.2+ by default and rejects the insecure TLS 1.0/1.1. TLS 1.3 is recommended for stronger forward secrecy and a simpler handshake:

```go
cfg := httpc.DefaultConfig()
cfg.Security.MinTLSVersion = tls.VersionTLS12  // Default
cfg.Security.MaxTLSVersion = tls.VersionTLS13  // Default
```

### Version Details

| Version | Status | HTTPC Default |
|------|------|-----------|
| TLS 1.0 | Insecure, deprecated (POODLE/BEAST) | Rejected |
| TLS 1.1 | Insecure, deprecated | Rejected |
| TLS 1.2 | Secure | Minimum requirement |
| TLS 1.3 | Most secure, recommended (forward secrecy mandated) | Supported |

:::tip
To force TLS 1.3 only (higher security, simpler handshake), set `MinTLSVersion = tls.VersionTLS13`. Some legacy clients and proxies do not support TLS 1.3; confirm the target service is compatible before enabling.
:::

:::warning
Once `Security.TLSConfig` is set, `MinTLSVersion` and `MaxTLSVersion` **are ignored** and the settings inside `TLSConfig` take precedence. To control versions inside a custom `TLSConfig`, set its `MinVersion` / `MaxVersion` fields.
:::

## Cipher Suites

The default configuration allows only secure cipher suites (ECDHE family enforcing forward secrecy, AEAD encryption):

| Cipher Suite | Description |
|----------|------|
| `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256` | Recommended |
| `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384` | Recommended |
| `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305` | Recommended |
| `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` | Recommended |
| `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384` | Recommended |
| `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305` | Recommended |

TLS 1.3 cipher suites are negotiated automatically by the protocol and are not controlled by the `CipherSuites` field.

The suites above apply only when no custom `TLSConfig` is set; HTTPC injects them when building the transport (see `createTLSConfig` in `internal/connection/pool.go`).

The same injection adds curve preferences (X25519 / P-256 / P-384), `RenegotiateNever`, and an LRU session-ticket cache (256 entries, reducing repeated handshake cost). With a custom `TLSConfig`, the custom configuration takes precedence.

## Custom TLS Configuration

For fine-grained control (custom CA, mTLS, pinned cipher suites), set `Security.TLSConfig`:

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    MinVersion: tls.VersionTLS13,  // Force TLS 1.3
    // Other custom settings
}
```

### Custom CA Certificate

To connect to services signed by an internal CA (enterprise internal PKI, self-signed certificates), load a custom root certificate:

```go
package main

import (
	"crypto/tls"
	"crypto/x509"
	"log"
	"os"

	"github.com/cybergodev/httpc"
)

func main() {
	caCert, err := os.ReadFile("custom-ca.pem")
	if err != nil {
		log.Fatal(err)
	}
	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		log.Fatal("failed to parse CA certificate")
	}

	cfg := httpc.DefaultConfig()
	cfg.Security.TLSConfig = &tls.Config{
		RootCAs:    caCertPool,
		MinVersion: tls.VersionTLS12,
	}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = client.Close() }()
	log.Println("custom-CA client ready")
}
```

### Mutual TLS (mTLS)

When the server requires a client certificate (mTLS), configure the `Certificates` field:

```go
package main

import (
	"crypto/tls"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cert, err := tls.LoadX509KeyPair("client-cert.pem", "client-key.pem")
	if err != nil {
		log.Fatal(err)
	}

	cfg := httpc.DefaultConfig()
	cfg.Security.TLSConfig = &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = client.Close() }()
	log.Println("mTLS client ready")
}
```

:::tip
mTLS is common in zero-trust networks, service-mesh internal authentication, and financial APIs. The server identifies the caller via the client certificate, with no extra token needed. During certificate rotation, `client-cert.pem` / `client-key.pem` must be updated in sync.
:::

## Certificate Pinning

Certificate pinning layers an additional check **on top of** standard certificate-chain validation: it requires a known pinned public key or certificate to be present in the server's certificate chain. If a trusted CA is compromised or coerced into issuing a forged certificate, the attacker still cannot perform a MITM, because the public key of their certificate does not match the pinned value.

### How It Works

Standard TLS validation: the client trusts any certificate signed by a trusted CA. Certificate pinning: the client additionally requires the certificate's public-key hash to match a pre-stored value.

```text
Standard validation:  trust CA -> trust any certificate signed by that CA
Certificate pinning:  trust CA + certificate's public key must match the pre-stored hash
```

Pinning layers on top of standard validation, with no need to set `InsecureSkipVerify`. HTTPC validates **any layer** of the certificates in the verified chains (leaf and intermediates), so pinning the intermediate certificate stays valid after the leaf certificate is renewed.

### SPKI Hash Generation Steps

The SPKI (SubjectPublicKeyInfo) hash is the most common pinning format (HPKP standard). Generation steps:

**Step 1**: obtain the server certificate (export from a browser, or use openssl)

```bash
# Fetch the certificate chain from the server
openssl s_client -connect example.com:443 -showcerts < /dev/null 2>/dev/null \
  | openssl x509 -outform pem > cert.pem
```

**Step 2**: extract the public key from the certificate -> DER-encode -> SHA-256 -> base64

```bash
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
# Output: YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=
```

Three-step breakdown:

| Step | Command fragment | Purpose |
|------|---------|------|
| Extract public key | `openssl x509 -pubkey -noout` | Extract the PEM-format public key from the X.509 certificate |
| DER-encode | `openssl pkey -pubin -outform der` | Convert the PEM public key to DER (PKIX) format |
| Hash-encode | `openssl dgst -sha256 -binary \| openssl enc -base64` | SHA-256 then base64-encode |

:::tip
Pinning the **intermediate certificate**'s SPKI is recommended over the leaf certificate. Intermediate certificates are long-lived (5-10 years); when the leaf certificate is renewed (e.g. Let's Encrypt's 90 days), the intermediate stays the same, so the pinned value does not need frequent updates.
:::

### SPKI Hash Pinning (Recommended)

`NewSPKIHashPinner` accepts one or more base64-encoded SHA-256 SPKI hashes. Supplying multiple hashes supports key rotation: any match passes.

```go
package main

import (
	"crypto/tls"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	pinner, err := httpc.NewSPKIHashPinner(
		"YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // current intermediate
		"C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // backup (key rotation)
	)
	if err != nil {
		log.Fatal(err)
	}

	cfg := httpc.DefaultConfig()
	cfg.Security.MinTLSVersion = tls.VersionTLS12
	cfg.Security.CertificatePinner = pinner
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = client.Close() }()
	log.Println("certificate-pinning client ready")
}
```

`NewSPKIHashPinner` returns an error when the hashes are empty or not valid base64, so configuration problems surface at startup. Validation logic: iterate every layer of the server's certificate chain, compute each SPKI's SHA-256, and pass if any matches a pinned hash.

:::tip
`CertificatePinner` layers pinning validation **on top of** standard TLS chain validation — no need to set `InsecureSkipVerify`. Validation applies to any layer of the certificates in the verified chains, so pinning the intermediate remains valid after the leaf certificate is renewed.
:::

### Three Pinner Constructors Compared

HTTPC provides three Pinner constructors for different scenarios:

| Constructor | Input | Applicable scenario | Recommendation |
|--------|------|---------|--------|
| `NewSPKIHashPinner` | base64 SHA-256 SPKI hash | Most common (HPKP format) | Recommended |
| `NewPublicKeyPinner` | DER-encoded PKIX public key | When you already hold raw public-key bytes | Convenience |
| `NewCertificatePinnerChain` | Multiple pinners | Combining strategies / mixed rotating keys | Advanced |

```go
// 1. SPKI hash (recommended, most common)
spkiPinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=",
)

// 2. DER public key (when you already have raw public-key bytes; SHA-256 computed internally)
pubPinner, err := httpc.NewPublicKeyPinner(pubKeyDER1, pubKeyDER2)

// 3. Combine multiple pinners; any match accepts (mixed strategies or rotating keys across constructors)
chainPinner := httpc.NewCertificatePinnerChain(spkiPinner, pubPinner)
cfg.Security.CertificatePinner = chainPinner
```

:::warning
`NewCertificatePinnerChain` with no arguments does **not** return an error, but the resulting empty chain fails closed: `VerifyPeerCertificate` returns `certificate pinning failed: no pinners configured`, which **rejects every connection**.

All-nil elements are rejected as well, with `no pinner matched`. The public API documentation describes it as a pinner that "accepts nothing". Pass at least one Pinner at construction.
:::

### Pinner Verification Details and Failure Behavior

Pinning semantics follow the source (`internal/security/certpin.go`):

| Aspect | Behavior |
|------|------|
| Match scope | Standard-verification path: iterates only the certificates in the **verified chains** (`verifiedChains`); passes when the SPKI hash of any layer matches any pinned value — unverified certificates appended by the server do not participate in matching (prevents pin-stuffing: a MITM stuffing the victim's real certificate into its own chain still fails). `InsecureSkipVerify` path: matches the **leaf certificate only**; pinning an intermediate has no effect in that mode |
| Failure behavior | No match anywhere in the chain -> the handshake is rejected with an error such as `certificate pinning failed: no matching SPKI hash found` |
| Empty certificate chain | The server provided no certificate -> `no peer certificates provided` |
| Parse tolerance | Certificates in the chain that cannot be parsed or use an unsupported key type are skipped; matching on the remaining certificates is unaffected |
| Construction validation | Hashes are `TrimSpace`d first; a non-base64 value reports `invalid base64 hash`; no valid hash reports `at least one valid SPKI hash is required` |
| Performance | Certificate-fingerprint-to-SPKI-hash cache (1024 entries, FIFO eviction: a hit does not refresh position, and when full the oldest 256 entries are evicted), so repeated connections do not re-parse certificates |
| Concurrency safety | The Pinner holds an internal read/write lock and can be shared by multiple Clients; when `Config` is deep-copied, the Pinner is shared by reference (not copied) |
| Debug description | `Pin()` returns values such as `spki-pins:2`, `public-key-pins:2`, `chain:[spki-pins:1,spki-pins:1]`, which can be written to logs |

`NewPublicKeyPinner` computes SHA-256 for each DER PKIX public key internally and delegates to the SPKI hash pinner, so both share the same matching semantics; with no valid public key it reports `no valid public keys provided`.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/httpc"
)

func main() {
	// A non-base64 hash fails at construction time instead of surfacing at the first live handshake
	_, err := httpc.NewSPKIHashPinner("!!not-base64!!")
	fmt.Println("invalid hash rejected:", err != nil)

	// A whitespace-only string counts as unset after TrimSpace and is rejected as well
	_, err = httpc.NewSPKIHashPinner("   ")
	fmt.Println("empty hash rejected:", err != nil)
	// Output:
	// invalid hash rejected: true
	// empty hash rejected: true
}
```

### Interaction with a Custom TLSConfig

When `Security.TLSConfig` is set, HTTPC `Clone()`s the custom configuration and **injects** the `VerifyPeerCertificate` pinning callback on top of it. RootCAs, mTLS certificates, cipher suites, and other settings are all preserved, and pinning validation still applies (see `createTLSConfig` in `internal/connection/pool.go`).

:::warning
After a custom `TLSConfig` is set, `MinTLSVersion`/`MaxTLSVersion` are ignored, but `Security.InsecureSkipVerify = true` **still takes effect**: HTTPC clones the custom configuration and injects this switch one-way (it only forces skipping; an `InsecureSkipVerify` set inside `TLSConfig` itself is unaffected by the top-level switch).
:::

### Custom CertificatePinner

For advanced scenarios needing a custom pinning strategy (e.g. pinning the full certificate rather than the public key, or dynamically fetching pinned values from a config center), implement the `CertificatePinner` interface directly:

```go
package main

import (
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"log"

	"github.com/cybergodev/httpc"
)

// fullCertPinner pins the SHA-256 of the full certificate (rather than the public-key SPKI).
type fullCertPinner struct {
	pinnedHashes map[string]bool
}

func newFullCertPinner(hashes ...string) *fullCertPinner {
	m := make(map[string]bool, len(hashes))
	for _, h := range hashes {
		m[h] = true
	}
	return &fullCertPinner{pinnedHashes: m}
}

// Pin implements the CertificatePinner interface, returning a description of the pinned value (for logging/debugging).
func (p *fullCertPinner) Pin() string {
	return "full-cert-pinner"
}

// VerifyPeerCertificate implements the CertificatePinner interface.
// Returns nil to accept, non-nil to reject the handshake.
func (p *fullCertPinner) VerifyPeerCertificate(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
	if len(verifiedChains) == 0 || len(verifiedChains[0]) == 0 {
		return errors.New("certificate pinning failed: empty chain")
	}
	for _, cert := range verifiedChains[0] {
		sum := sha256.Sum256(cert.Raw)
		hash := base64.StdEncoding.EncodeToString(sum[:])
		if p.pinnedHashes[hash] {
			return nil // Match, accept
		}
	}
	return errors.New("certificate pinning failed: no matching certificate")
}

func main() {
	// Pin the SHA-256 of the full leaf certificate (must be updated after certificate renewal)
	pinner := newFullCertPinner(
		"wert6uY/PCq3yAAbZA/wtqfzfQsTwmxnfv6I3vRz1XQ=", // SHA-256 of the certificate Raw
	)

	cfg := httpc.DefaultConfig()
	cfg.Security.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	cfg.Security.CertificatePinner = pinner
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = client.Close() }()
	log.Println("custom certificate-pinning client ready")
}
```

:::warning
When implementing a custom `CertificatePinner`, layer pinning validation on top of standard certificate-chain validation (`verifiedChains`). Do not use it to replace standard validation; keep `InsecureSkipVerify = false` at all times.
:::

## Multiple Hashes and Key Rotation

Both `NewSPKIHashPinner` and `NewPublicKeyPinner` accept multiple values; any match passes. Key rotation depends on this: pin both the old and new public keys at the same time, so both old and new certificates pass during the rotation window without downtime.

Rotation workflow:

1. The server generates a new key pair and issues a new certificate
2. The client updates the pinned values, **keeping both old and new hashes**:
   ```go
   pinner, _ := httpc.NewSPKIHashPinner(
       "OLD_HASH...", // Old key (kept during rotation)
       "NEW_HASH...", // New key (about to activate)
   )
   ```
3. Deploy the client; confirm both old and new certificates pass
4. The server switches to the new certificate
5. After observing a trouble-free period, remove the old hash from the pinned values

:::danger
A pinning failure (pinned value not matching) makes the connection fail completely and does not recover automatically. Requirements:
- **Keep at least one backup pinned value** in case the primary key is unexpectedly corrupted
- Use an "add new first, remove old later" dual-window rotation strategy
- Set up monitoring so a pinning failure triggers a fast rollback of the client configuration
:::

## Certificate Pinning and Let's Encrypt

Let's Encrypt certificates are valid for only 90 days and renew frequently. Pinning the leaf certificate directly requires updating the pinned value every 90 days, which carries a high maintenance cost. Recommended strategies:

| Pinned target | Validity | Renewal impact | Recommendation |
|---------|--------|---------|--------|
| Leaf certificate | 90 days | Pinned value must be updated on every renewal | Low |
| Let's Encrypt intermediate | ~5 years | Update only when the intermediate rotates (every few years) | Recommended |
| Own domain's public key (if self-hosted) | Controlled by the site operator | Update only on a deliberate key rotation | Case by case |

Let's Encrypt intermediates (such as R3, R10, R11) are valid for years; pinning the intermediate's SPKI balances security with low maintenance. When Let's Encrypt rotates its intermediate, it announces this in advance, leaving plenty of time to update the pinned value.

```go
// Pin the Let's Encrypt intermediate certificate (recommended)
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // current intermediate
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // backup / next-round intermediate
)
```

## Security Considerations for Certificate Pinning

| Risk | Consequence | Mitigation |
|------|------|---------|
| Pinned value expired / not matching | Connection fails completely | Multiple hashes + backup keys + monitoring |
| Backup key lost | Cannot rotate, lockout | Offline-backup multiple key pairs |
| Pinned values hardcoded | Update requires a release | Dynamic loading from a config center (custom Pinner) |
| Pinning only one layer | Single point of failure | Pin multiple layers (leaf + intermediate) |

:::warning
Certificate pinning has two consequences: it improves defense against MITM and CA compromise, and a pinning failure causes a hard outage. Before adopting it, confirm:
1. A reliable mechanism exists for updating and distributing pinned values
2. Pinning-failure rates are monitored and alerted on
3. An emergency "disable pinning" switch is retained (at the cost of reduced security)
:::

### Pinning Strategy Comparison

| Strategy | Security | Maintenance cost | Recommended scenario |
|------|--------|----------|---------|
| Pin root certificate | Low | Low | Tamper protection only; CA scope too broad |
| Pin intermediate certificate | Medium | Medium | **Recommended**; balances security and maintenance |
| Pin leaf certificate | High | High | High security; certificate under your control |
| Pin multiple levels | High | Medium | Multi-layer redundancy; recommended |

## InsecureSkipVerify

`InsecureSkipVerify` skips all TLS certificate-chain validation and is for testing only:

```go
// Testing only!
cfg := httpc.TestingConfig()
// InsecureSkipVerify = true -> skips TLS certificate verification
```

When HTTPC detects `InsecureSkipVerify = true` in `httpc.New()` and the environment is not a test environment, it prints a warning to `stderr` (once per process). A test environment is identified by an executable ending in `.test`, or the `GO_TEST` / `GOTEST=1` environment variable being set.

:::danger
`InsecureSkipVerify = true` skips certificate-chain and hostname validation and is for test environments only. When certificate pinning is also configured, the SPKI hash check **still runs**: Go passes the peer certificate to the pinning callback even when chain validation is skipped, making pinning the only verification gate — and in that mode only the **leaf certificate** is matched, so combining `InsecureSkipVerify` with a pinned intermediate certificate always fails the handshake. Certificate-chain validity (expiry, revocation, CA issuance) and hostname validation are all absent in that case.

Never set it to `true` in production. For custom verification logic (e.g. pinning the full certificate), implement the `CertificatePinner` interface instead of skipping verification.
:::

## HTTP/2

HTTP/2 is enabled by default and is only available when using TLS (h2 via ALPN):

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // Disable HTTP/2 (HTTP/1.1 only)
```

:::tip
When certificate pinning or a custom `TLSConfig` is enabled, HTTP/2's ALPN negotiation still works normally. To disable HTTP/2 (e.g. for debugging or legacy-proxy compatibility), set `EnableHTTP2 = false`.
:::

## Best Practices

1. Use the default TLS configuration (TLS 1.2+); no manual setup is needed
2. When pinning, pin the **intermediate certificate** SPKI and prepare backup pins
3. Use multiple hashes to support key rotation with an "add new first, remove old later" strategy
4. Update pinned values in sync with server-certificate renewals
5. Use `SecureConfig()` as a security baseline
6. Do not set `InsecureSkipVerify` in production
7. For high-security scenarios, pin multiple certificate layers (leaf + intermediate) for redundancy

## Next Steps

- [SSRF Protection](./ssrf) - SSRF security configuration
- [Security Overview](./) - Security features overview
- [Configuration API](../api-reference/client-config/config) - SecurityConfig reference
