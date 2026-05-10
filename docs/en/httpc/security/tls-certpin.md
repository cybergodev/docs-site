---
title: TLS and Certificate Pinning - HTTPC
description: Guide to HTTPC TLS security and certificate pinning, covering TLS version control, custom CA loading, mTLS mutual authentication, SPKI public key pinning, and HTTP/2 negotiation.
---

# TLS and Certificate Pinning

## TLS Version Control

HTTPC requires TLS 1.2+ by default, recommending TLS 1.3:

```go
cfg := httpc.DefaultConfig()
cfg.Security.MinTLSVersion = tls.VersionTLS12  // default
cfg.Security.MaxTLSVersion = tls.VersionTLS13  // default
```

### Version Details

| Version | Status | HTTPC Default |
|---------|--------|---------------|
| TLS 1.0 | Insecure, deprecated | Rejected |
| TLS 1.1 | Insecure, deprecated | Rejected |
| TLS 1.2 | Secure | Minimum required |
| TLS 1.3 | Most secure, recommended | Supported |

## Cipher Suites

The default configuration only allows secure cipher suites:

| Cipher Suite | Description |
|-------------|-------------|
| `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256` | Recommended |
| `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384` | Recommended |
| `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305` | Recommended |
| `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` | Recommended |
| `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384` | Recommended |
| `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305` | Recommended |

## Custom TLS Configuration

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    MinVersion: tls.VersionTLS13,  // Enforce TLS 1.3
    // Other custom configuration
}
```

### Custom CA Certificate

```go
caCert, _ := os.ReadFile("custom-ca.pem")
caCertPool := x509.NewCertPool()
caCertPool.AppendCertsFromPEM(caCert)

cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    RootCAs:    caCertPool,
    MinVersion: tls.VersionTLS12,
}

client, _ := httpc.New(cfg)
```

### Mutual TLS (mTLS)

```go
cert, _ := tls.LoadX509KeyPair("client-cert.pem", "client-key.pem")

cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    Certificates: []tls.Certificate{cert},
    MinVersion:   tls.VersionTLS12,
}

client, _ := httpc.New(cfg)
```

## Certificate Pinning

Certificate pinning prevents man-in-the-middle attacks by verifying the public key hash of the server's certificate.

### SPKI Hash Pinning

The most common pinning method, verifying the SPKI hash of any certificate in the chain:

```go
// Generate SPKI hash:
// openssl x509 -in cert.pem -pubkey -noout | \
//   openssl pkey -pubin -outform der | \
//   openssl dgst -sha256 -binary | \
//   openssl enc -base64

// Pin Let's Encrypt intermediate certificate
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    InsecureSkipVerify: true, // Fully replaces standard verification, must complete all checks in VerifyPeerCertificate yourself
    VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
        // Implement certificate pinning logic here
        // Note: When InsecureSkipVerify=true, standard chain verification is skipped, full certificate verification must be done here
        return nil
    },
}
```

:::warning
Certificate pinning increases maintenance costs. If the server changes certificates (e.g., Let's Encrypt renewal), the client needs to update its pinned values accordingly.
It is recommended to pin multiple certificates (e.g., leaf + intermediate) and establish an update mechanism.
:::

### Pinning Strategies

| Strategy | Security | Maintenance Cost | Recommendation |
|----------|----------|-----------------|----------------|
| Pin root certificate | Low | Low | Tamper detection only |
| Pin intermediate certificate | Medium | Medium | Recommended |
| Pin leaf certificate | High | High | High-security scenarios |
| Pin multiple levels | High | Medium | Best |

## InsecureSkipVerify

```go
// For testing only!
cfg := httpc.TestingConfig()
// InsecureSkipVerify = true → skips TLS certificate verification
```

:::danger
`InsecureSkipVerify = true` disables all TLS security measures. Only use in testing environments. Never set to `true` in production.
:::

## HTTP/2

HTTP/2 is enabled by default and is only available with TLS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // Disable HTTP/2
```

## Best Practices

1. Use the default TLS configuration (TLS 1.2+)
2. When pinning certificates, pin intermediate certificates and prepare backup pins
3. Regularly update pinned values in sync with server certificate renewals
4. Use `SecureConfig()` as the security baseline
5. Never set `InsecureSkipVerify` in production environments

## Next Steps

- [SSRF Protection](./ssrf) - SSRF security configuration
- [Security Overview](./) - Security features overview
- [Config API](../api-reference/config) - SecurityConfig reference
