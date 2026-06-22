---
title: "TLS 与证书固定 - CyberGo HTTPC | 加密与证书固定"
description: "HTTPC TLS 与证书固定指南：TLS 1.2-1.3 版本控制与密码套件、自定义 CA 加载、mTLS 双向认证、CertificatePinner 固定 API 与 HTTP/2 协商。"
---

# TLS 与证书固定

## TLS 版本控制

HTTPC 默认要求 TLS 1.2+，推荐 TLS 1.3：

```go
cfg := httpc.DefaultConfig()
cfg.Security.MinTLSVersion = tls.VersionTLS12  // 默认
cfg.Security.MaxTLSVersion = tls.VersionTLS13  // 默认
```

### 版本说明

| 版本 | 状态 | HTTPC 默认 |
|------|------|-----------|
| TLS 1.0 | 不安全，已弃用 | 拒绝 |
| TLS 1.1 | 不安全，已弃用 | 拒绝 |
| TLS 1.2 | 安全 | 最低要求 |
| TLS 1.3 | 最安全，推荐 | 支持 |

## 密码套件

默认配置仅允许安全的密码套件：

| 密码套件 | 说明 |
|----------|------|
| `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256` | 推荐 |
| `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384` | 推荐 |
| `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305` | 推荐 |
| `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` | 推荐 |
| `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384` | 推荐 |
| `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305` | 推荐 |

## 自定义 TLS 配置

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    MinVersion: tls.VersionTLS13,  // 强制 TLS 1.3
    // 其他自定义配置
}
```

### 自定义 CA 证书

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

### 双向 TLS (mTLS)

```go
cert, _ := tls.LoadX509KeyPair("client-cert.pem", "client-key.pem")

cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    Certificates: []tls.Certificate{cert},
    MinVersion:   tls.VersionTLS12,
}

client, _ := httpc.New(cfg)
```

## 证书固定

证书固定（Certificate Pinning）通过验证服务端证书的公钥哈希来防止中间人攻击。

### SPKI 哈希固定（推荐）

最常见的固定方式。通过 `NewSPKIHashPinner` 校验服务端证书链中任一证书的 SPKI（SubjectPublicKeyInfo）SHA-256 哈希。提供多个哈希可支持密钥轮换——任一匹配即通过。

生成 SPKI 哈希：

```bash
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
```

固定 Let's Encrypt 中间证书（推荐固定中间证书，兼顾安全与维护成本）：

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // 当前中间证书
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // 备用（密钥轮换）
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, err := httpc.New(cfg)
```

:::tip
`CertificatePinner` 在标准 TLS 链验证**之上**叠加固定校验，无需设置 `InsecureSkipVerify`。校验对证书链中任意一层证书生效，因此固定中间证书可在叶子证书续期后继续生效。
:::

:::warning
证书固定会增加维护成本。如果服务端更换证书（如 Let's Encrypt 续期），客户端需要同步更新固定值。
建议同时固定多个证书（如叶子证书 + 中间证书），并设置更新机制。
:::

### 其他固定构造函数

除 SPKI 哈希外，HTTPC 还提供：

```go
// 由 DER 编码的 PKIX 公钥直接创建（内部计算 SHA-256）
pubPinner, err := httpc.NewPublicKeyPinner(pubKeyDER1, pubKeyDER2)

// 组合多个 pinner，任一通过即接受（混合固定策略或轮换密钥）
chainPinner := httpc.NewCertificatePinnerChain(spkiPinner, pubPinner)
cfg.Security.CertificatePinner = chainPinner
```

### 高级：自定义 TLS 验证回调

如需完全控制 TLS 验证逻辑（例如固定完整证书而非公钥），可通过 `TLSConfig` 自行实现。此时标准链验证由 `InsecureSkipVerify` 跳过，**必须**在 `VerifyPeerCertificate` 中完成全部校验：

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    InsecureSkipVerify: true, // 跳过标准链验证，需在回调中自行完成全部校验
    VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
        // 在这里实现完整的证书验证 + 固定逻辑
        return nil
    },
}
```

:::warning
`InsecureSkipVerify = true` 会完全跳过标准证书链验证。仅在确实需要自定义验证逻辑时使用，并确保回调中完成全部必要校验。绝大多数固定场景应优先使用 `CertificatePinner`。
:::

### 固定策略

| 策略 | 安全性 | 维护成本 | 推荐 |
|------|--------|----------|------|
| 固定根证书 | 低 | 低 | 仅防篡改 |
| 固定中间证书 | 中 | 中 | 推荐 |
| 固定叶子证书 | 高 | 高 | 高安全场景 |
| 固定多个层级 | 高 | 中 | 最佳 |

## InsecureSkipVerify

```go
// 仅用于测试！
cfg := httpc.TestingConfig()
// InsecureSkipVerify = true → 跳过 TLS 证书验证
```

:::danger
`InsecureSkipVerify = true` 会使所有 TLS 安全措施失效，仅在测试环境使用。生产环境永远不要设为 `true`。
:::

## HTTP/2

HTTP/2 默认启用，仅在使用 TLS 时可用：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // 禁用 HTTP/2
```

## 最佳实践

1. 使用默认 TLS 配置（TLS 1.2+）
2. 证书固定时固定中间证书，并准备备用固定值
3. 定期更新固定值，与服务端证书续期同步
4. 使用 `SecureConfig()` 作为安全基线
5. 永远不要在生产环境设置 `InsecureSkipVerify`

## 下一步

- [SSRF 防护](./ssrf) - SSRF 安全配置
- [安全概述](./) - 安全特性总览
- [配置 API](../api-reference/config) - SecurityConfig 参考
