---
title: "TLS と証明書ピンニング - CyberGo HTTPC | 暗号とピンニング"
description: "HTTPC TLS と証明書ピンニングガイド: TLS 1.2-1.3 バージョン制御と暗号スイート、カスタム CA 証明書の読み込み、mTLS 双方向認証、CertificatePinner ピンニング API、HTTP/2 ネゴシエーションを解説します。"
---

# TLS と証明書ピンニング

## TLS バージョン制御

HTTPC はデフォルトで TLS 1.2+ を要求し、TLS 1.3 を推奨します：

```go
cfg := httpc.DefaultConfig()
cfg.Security.MinTLSVersion = tls.VersionTLS12  // デフォルト
cfg.Security.MaxTLSVersion = tls.VersionTLS13  // デフォルト
```

### バージョンの説明

| バージョン | ステータス | HTTPC デフォルト |
|-----------|-----------|----------------|
| TLS 1.0 | 安全ではない、非推奨 | 拒否 |
| TLS 1.1 | 安全ではない、非推奨 | 拒否 |
| TLS 1.2 | 安全 | 最低要件 |
| TLS 1.3 | 最も安全、推奨 | サポート |

## 暗号スイート

デフォルト設定では安全な暗号スイートのみを許可します：

| 暗号スイート | 説明 |
|-------------|------|
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

### 相互 TLS (mTLS)

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

### SPKI ハッシュピンニング（推奨）

最も一般的なピンニング方式です。`NewSPKIHashPinner` を使い、サーバー証明書チェーン内のいずれかの証明書の SPKI（SubjectPublicKeyInfo）SHA-256 ハッシュを検証します。複数のハッシュを指定すれば鍵のローテーションに対応でき、いずれかが一致すれば通過します。

SPKI ハッシュの生成：

```bash
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
```

Let's Encrypt 中間証明書をピンニング（中間証明書の固定が、セキュリティと運用コストのバランスが良く推奨されます）：

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // 現在の中間証明書
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // バックアップ（鍵のローテーション用）
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, err := httpc.New(cfg)
```

:::tip
`CertificatePinner` は標準の TLS チェーン検証**の上に**ピンニング検証を重ねるものであり、`InsecureSkipVerify` を設定する必要はありません。検証は証明書チェーンのどの階層の証明書にも有効なため、中間証明書を固定すればリーフ証明書の更新後も引き続き有効です。
:::

:::warning
証明書ピンニングは運用コストを増加させます。サーバーが証明書を更新した場合（例：Let's Encrypt の更新）、クライアントもピンニング値を更新する必要があります。
複数の証明書（リーフ証明書 + 中間証明書など）を同時にピンニングし、更新メカニズムを設けることをお勧めします。
:::

### その他のピンニングコンストラクタ

SPKI ハッシュに加え、HTTPC は以下も提供します：

```go
// DER エンコードされた PKIX 公開鍵から直接作成（内部で SHA-256 を計算）
pubPinner, err := httpc.NewPublicKeyPinner(pubKeyDER1, pubKeyDER2)

// 複数の pinner を組み合わせ、いずれかが通過すれば受け入れ（混在固定戦略やローテーション鍵向け）
chainPinner := httpc.NewCertificatePinnerChain(spkiPinner, pubPinner)
cfg.Security.CertificatePinner = chainPinner
```

### 高度：カスタム TLS 検証コールバック

TLS 検証ロジックを完全に制御したい場合（例：公開鍵ではなく完全な証明書を固定する場合）は、`TLSConfig` で独自に実装できます。この場合、標準のチェーン検証は `InsecureSkipVerify` でスキップされるため、`VerifyPeerCertificate` で**必ず**すべての検証を行う必要があります：

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    InsecureSkipVerify: true, // 標準のチェーン検証をスキップ。コールバック内で全検証を自行実施する必要がある
    VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
        // ここで完全な証明書検証 + ピンニングロジックを実装
        return nil
    },
}
```

:::warning
`InsecureSkipVerify = true` は標準の証明書チェーン検証を完全にスキップします。本当にカスタム検証ロジックが必要な場合にのみ使用し、コールバック内で必要な検証をすべて完了させてください。ほとんどのピンニングシナリオでは `CertificatePinner` を優先してください。
:::

### ピンニング戦略

| 戦略 | セキュリティ | 運用コスト | 推奨 |
|------|-------------|-----------|------|
| ルート証明書のピンニング | 低 | 低 | 改ざん防止のみ |
| 中間証明書のピンニング | 中 | 中 | 推奨 |
| リーフ証明書のピンニング | 高 | 高 | 高セキュリティシナリオ |
| 複数階層のピンニング | 高 | 中 | ベスト |

## InsecureSkipVerify

```go
// テストのみ！
cfg := httpc.TestingConfig()
// InsecureSkipVerify = true → TLS 証明書検証をスキップ
```

:::danger
`InsecureSkipVerify = true` はすべての TLS セキュリティ対策を無効にします。テスト環境でのみ使用してください。本番環境では絶対に `true` に設定しないでください。
:::

## HTTP/2

HTTP/2 はデフォルトで有効で、TLS 使用時のみ利用可能です：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // HTTP/2 を無効化
```

## ベストプラクティス

1. デフォルトの TLS 設定（TLS 1.2+）を使用
2. 証明書ピンニング時は中間証明書をピンニングし、バックアップピンニング値を準備
3. ピンニング値を定期的に更新し、サーバーの証明書更新と同期
4. `SecureConfig()` をセキュリティベースラインとして使用
5. 本番環境では絶対に `InsecureSkipVerify` を設定しない

## 次のステップ

- [SSRF 防護](./ssrf) - SSRF セキュリティ設定
- [セキュリティ概要](./) - セキュリティ機能一覧
- [設定 API](../api-reference/config) - SecurityConfig リファレンス
