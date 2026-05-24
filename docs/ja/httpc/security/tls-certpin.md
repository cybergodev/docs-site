---
title: "TLSと証明書ピンニング - HTTPC"
description: "HTTPC TLSと証明書ピンニングガイド：TLS 1.2-1.3バージョン制御と暗号スイート、カスタムCA証明書の読み込み、mTLS双方向認証、VerifyPeerCertificate SPKI公開鍵ピンニング戦略、InsecureSkipVerify警告とHTTP/2ネゴシエーション。"
---

# TLSと証明書ピンニング

## TLSバージョン制御

HTTPCはデフォルトでTLS 1.2以上を要求します。TLS 1.3を推奨：

```go
cfg := httpc.DefaultConfig()
cfg.Security.MinTLSVersion = tls.VersionTLS12  // デフォルト
cfg.Security.MaxTLSVersion = tls.VersionTLS13  // デフォルト
```

### バージョンの説明

| バージョン | ステータス | HTTPCデフォルト |
|------------|------------|-----------------|
| TLS 1.0 | 安全でない、非推奨 | 拒否 |
| TLS 1.1 | 安全でない、非推奨 | 拒否 |
| TLS 1.2 | 安全 | 最低要件 |
| TLS 1.3 | 最も安全、推奨 | サポート |

## 暗号スイート

デフォルト設定では安全な暗号スイートのみを許可：

| 暗号スイート | 説明 |
|--------------|------|
| `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256` | 推奨 |
| `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384` | 推奨 |
| `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305` | 推奨 |
| `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` | 推奨 |
| `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384` | 推奨 |
| `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305` | 推奨 |

## カスタムTLS設定

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    MinVersion: tls.VersionTLS13,  // TLS 1.3を強制
    // その他のカスタム設定
}
```

### カスタムCA証明書

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

### 相互TLS (mTLS)

```go
cert, _ := tls.LoadX509KeyPair("client-cert.pem", "client-key.pem")

cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    Certificates: []tls.Certificate{cert},
    MinVersion:   tls.VersionTLS12,
}

client, _ := httpc.New(cfg)
```

## 証明書ピンニング

証明書ピンニング（Certificate Pinning）は、サーバー証明書の公開鍵ハッシュを検証して中間者攻撃を防止します。

### SPKIハッシュピンニング

最も一般的なピンニング方式。証明書チェーン内の任意の証明書のSPKIハッシュを検証します：

```go
// SPKIハッシュの生成：
// openssl x509 -in cert.pem -pubkey -noout | \
//   openssl pkey -pubin -outform der | \
//   openssl dgst -sha256 -binary | \
//   openssl enc -base64

// Let's Encrypt中間証明書をピンニング
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    InsecureSkipVerify: true, // 標準検証を完全に置き換える。VerifyPeerCertificateで全検証を自行実施する必要がある
    VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
        // ここで証明書ピンニングロジックを実装
        // 注意: InsecureSkipVerify=trueの場合、標準のチェーン検証はスキップされるため、
        // ここで完全な証明書検証を行う必要がある
        return nil
    },
}
```

:::warning 警告
証明書ピンニングはメンテナンスコストを増加させます。サーバーが証明書を変更した場合（Let's Encryptの更新など）、クライアントもピンニング値を更新する必要があります。複数の証明書（リーフ証明書 + 中間証明書など）を同時にピンニングし、更新メカニズムを設定することをお勧めします。
:::

### ピンニング戦略

| 戦略 | セキュリティ | メンテナンスコスト | 推奨 |
|------|-------------|-------------------|------|
| ルート証明書のピンニング | 低 | 低 | 改ざん防止のみ |
| 中間証明書のピンニング | 中 | 中 | 推奨 |
| リーフ証明書のピンニング | 高 | 高 | 高セキュリティシナリオ |
| 複数レベルのピンニング | 高 | 中 | ベスト |

## InsecureSkipVerify

```go
// テストのみに使用！
cfg := httpc.TestingConfig()
// InsecureSkipVerify = true → TLS証明書検証をスキップ
```

:::danger 危険
`InsecureSkipVerify = true`はすべてのTLSセキュリティ対策を無効にします。テスト環境でのみ使用してください。本番環境では絶対に`true`にしないでください。
:::

## HTTP/2

HTTP/2はデフォルトで有効で、TLS使用時のみ利用可能：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // HTTP/2を無効化
```

## ベストプラクティス

1. デフォルトTLS設定（TLS 1.2+）を使用
2. 証明書ピンニング時は中間証明書をピンニングし、バックアップピンニング値を用意
3. ピンニング値を定期的に更新し、サーバー証明書の更新と同期
4. `SecureConfig()`をセキュリティベースラインとして使用
5. 本番環境では絶対に`InsecureSkipVerify`を設定しない

## 次のステップ

- [SSRF防御](./ssrf) - SSRFセキュリティ設定
- [セキュリティ概要](./) - セキュリティ機能一覧
- [設定API](../api-reference/config) - SecurityConfigリファレンス
