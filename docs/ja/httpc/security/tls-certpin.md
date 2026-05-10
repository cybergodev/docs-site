---
title: TLS と証明書ピンニング - HTTPC
description: HTTPC TLS と証明書ピンニングガイド。TLS バージョン管理、カスタム CA 読み込み、mTLS 双方向認証、SPKI 公開鍵ピンニングと HTTP/2 ネゴシエーション。
---

# TLS と証明書ピンニング

## TLS バージョン管理

HTTPC はデフォルトで TLS 1.2+ を要求し、TLS 1.3 を推奨します：

```go
cfg := httpc.DefaultConfig()
cfg.Security.MinTLSVersion = tls.VersionTLS12  // デフォルト
cfg.Security.MaxTLSVersion = tls.VersionTLS13  // デフォルト
```

### バージョンの説明

| バージョン | ステータス | HTTPC デフォルト |
|------|------|------|
| TLS 1.0 | 安全でない、非推奨 | 拒否 |
| TLS 1.1 | 安全でない、非推奨 | 拒否 |
| TLS 1.2 | 安全 | 最低要件 |
| TLS 1.3 | 最も安全、推奨 | サポート |

## 暗号スイート

デフォルト設定では安全な暗号スイートのみを許可します：

| 暗号スイート | 説明 |
|----------|------|
| `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256` | 推奨 |
| `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384` | 推奨 |
| `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305` | 推奨 |
| `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` | 推奨 |
| `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384` | 推奨 |
| `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305` | 推奨 |

## カスタム TLS 設定

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    MinVersion: tls.VersionTLS13,  // TLS 1.3 を強制
    // その他のカスタム設定
}
```

### カスタム CA 証明書

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

### 双方向 TLS (mTLS)

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

証明書ピンニング（Certificate Pinning）は、サーバー証明書の公開鍵ハッシュを検証することで中間者攻撃を防止します。

### SPKI ハッシュピンニング

最も一般的なピンニング方式で、証明書チェーン内の任意の証明書の SPKI ハッシュを検証します：

```go
// SPKI ハッシュの生成：
// openssl x509 -in cert.pem -pubkey -noout | \
//   openssl pkey -pubin -outform der | \
//   openssl dgst -sha256 -binary | \
//   openssl enc -base64

// Let's Encrypt 中間証明書をピンニング
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    InsecureSkipVerify: true, // 標準検証を完全に置き換え、VerifyPeerCertificate で全ての検証を自行完了する必要がある
    VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
        // ここに証明書ピンニングロジックを実装
        // 注意: InsecureSkipVerify=true の場合、標準チェーン検証はスキップされるため、
        // ここで完全な証明書検証を完了する必要がある
        return nil
    },
}
```

:::warning 警告
証明書ピンニングはメンテナンスコストを増加させます。サーバーが証明書を変更した場合（Let's Encrypt の更新など）、クライアントもピンニング値を更新する必要があります。
複数の証明書（リーフ証明書 + 中間証明書など）を同時にピンニングし、更新メカニズムを設定することを推奨します。
:::

### ピンニング戦略

| 戦略 | セキュリティ | メンテナンスコスト | 推奨 |
|------|--------|----------|------|
| ルート証明書のピンニング | 低 | 低 | 改ざん防止のみ |
| 中間証明書のピンニング | 中 | 中 | 推奨 |
| リーフ証明書のピンニング | 高 | 高 | 高セキュリティシナリオ |
| 複数レベルのピンニング | 高 | 中 | ベスト |

## InsecureSkipVerify

```go
// テスト用途のみ！
cfg := httpc.TestingConfig()
// InsecureSkipVerify = true → TLS 証明書検証をスキップ
```

:::danger 危険
`InsecureSkipVerify = true` はすべての TLS セキュリティ対策を無効にします。テスト環境でのみ使用してください。本番環境では絶対に `true` に設定しないでください。
:::

## HTTP/2

HTTP/2 はデフォルトで有効で、TLS 使用時のみ利用可能です：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // HTTP/2 を無効化
```

## ベストプラクティス

1. デフォルトの TLS 設定（TLS 1.2+）を使用する
2. 証明書ピンニングでは中間証明書をピンニングし、バックアップピンニング値を用意する
3. ピンニング値を定期的に更新し、サーバー証明書の更新と同期する
4. `SecureConfig()` をセキュリティベースラインとして使用する
5. 本番環境では絶対に `InsecureSkipVerify` を設定しない

## 次のステップ

- [SSRF 防護](./ssrf) - SSRF セキュリティ設定
- [セキュリティ概要](./) - セキュリティ機能一覧
- [設定 API](../api-reference/config) - SecurityConfig リファレンス
