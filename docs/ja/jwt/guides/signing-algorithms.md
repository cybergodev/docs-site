---
title: "署名アルゴリズム - CyberGo JWT | アルゴリズム比較と選定"
description: "署名アルゴリズムガイド：HMAC・RSA・RSA-PSS・ECDSA 4 種 12 アルゴリズムの鍵種・生成方式・署名検証性能・署名長・構成結合度を比較し、選定の決定と鍵管理の安全実務を示す。"
---

# 署名アルゴリズム

CyberGo JWT は 4 種類計 12 の署名アルゴリズムをサポートし、モノリスからマイクロサービスアーキテクチャまであらゆるシーンに対応します。

## アルゴリズム一覧

| 型 | アルゴリズム | 鍵の型 | 適用シーン |
|----|-----------|--------|-----------|
| HMAC | HS256 / HS384 / HS512 | 対称鍵 | モノリスアプリ、シンプルなサービス |
| RSA | RS256 / RS384 / RS512 | 公開鍵/秘密鍵 | マイクロサービス、マルチサービス検証 |
| RSA-PSS | PS256 / PS384 / PS512 | 公開鍵/秘密鍵 | マイクロサービス（RSA の代替として推奨） |
| ECDSA | ES256 / ES384 / ES512 | 公開鍵/秘密鍵 | 高パフォーマンスマイクロサービス |

## HMAC（対称鍵）

HMAC は同じ鍵で署名と検証を行う、最もシンプルな方式です。

### 鍵の要件

- 最低 32 バイト
- ライブラリは弱鍵を自動検出（純粋な繰り返し文字、単純な増分シーケンスなど）

### 使用方法

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.SigningMethod = jwt.SigningMethodHS256 // デフォルト値、省略可
```

### アルゴリズムの選択

| 定数 | アルゴリズム | 説明 |
|------|------------|------|
| `SigningMethodHS256` | HMAC-SHA256 | 推奨、パフォーマンスとセキュリティのバランス |
| `SigningMethodHS384` | HMAC-SHA384 | より高いセキュリティ |
| `SigningMethodHS512` | HMAC-SHA512 | 最高セキュリティ |

:::tip 推奨
ほとんどのシーンでは `HS256` で十分です。秘密鍵は暗号論的に安全な乱数で生成し、長さは最低 32 バイトにすることを推奨します。
:::

## RSA（非対称鍵）

RSA は秘密鍵で署名、公開鍵で検証します。検証側が秘密鍵を保持する必要がないシーンに適しています。

### 使用方法

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodRS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey（省略可）
```

:::tip 検証鍵
`VerificationKey` は省略可能です。未設定の場合、ライブラリは `SigningKey` から公開鍵を抽出して検証に使用します。
:::

### 鍵の生成

```go
// 2048 ビット RSA 鍵ペアの生成
privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
if err != nil {
    log.Fatal(err)
}
publicKey := &privateKey.PublicKey
```

### アルゴリズムの選択

| 定数 | アルゴリズム | 説明 |
|------|------------|------|
| `SigningMethodRS256` | RSA-SHA256 | 推奨 |
| `SigningMethodRS384` | RSA-SHA384 | より高いセキュリティ |
| `SigningMethodRS512` | RSA-SHA512 | 最高セキュリティ |

## RSA-PSS（非対称鍵、RSA の代替として推奨）

RSA-PSS は RSA の改良された署名方式で、確率的署名方式（PSS）パディングを使用し、PKCS#1 v1.5 より安全性が高いです。鍵は RSA と同じです。

### 使用方法

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodPS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey（RSA と鍵を共有）
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey（省略可）
```

:::tip 推奨される代替
RSA-PSS は RSA PKCS#1 v1.5 より安全です。新規プロジェクトでは RSA-PSS アルゴリズムを優先して使用することを推奨します。鍵は RSA と完全に同じため、追加の生成は不要です。
:::

### アルゴリズムの選択

| 定数 | アルゴリズム | 説明 |
|------|------------|------|
| `SigningMethodPS256` | RSA-PSS-SHA256 | 推奨 |
| `SigningMethodPS384` | RSA-PSS-SHA384 | より高いセキュリティ |
| `SigningMethodPS512` | RSA-PSS-SHA512 | 最高セキュリティ |

## ECDSA（楕円曲線）

ECDSA も非対称アルゴリズムですが、鍵が短く、パフォーマンスに優れています。

### 使用方法

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodES256
cfg.SigningKey = ecdsaPrivateKey      // *ecdsa.PrivateKey
cfg.VerificationKey = ecdsaPublicKey  // *ecdsa.PublicKey（省略可）
```

### 鍵の生成

```go
// P-256 曲線鍵ペアの生成
privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
if err != nil {
    log.Fatal(err)
}
publicKey := &privateKey.PublicKey
```

### アルゴリズムの選択

| 定数 | アルゴリズム | 曲線 | 説明 |
|------|------------|------|------|
| `SigningMethodES256` | ECDSA-SHA256 | P-256 | 推奨 |
| `SigningMethodES384` | ECDSA-SHA384 | P-384 | より高いセキュリティ |
| `SigningMethodES512` | ECDSA-SHA512 | P-521 | 最高セキュリティ |

## 選び方

```text
モノリスアプリ ────────→ HMAC
マイクロサービス（同一信頼ドメイン） → HMAC
マイクロサービス（クロスサービス検証）→ RSA、RSA-PSS または ECDSA
セキュリティ優先 ──────→ RSA-PSS（RSA の代替）
高性能要件 ───────────→ ECDSA
鍵長に敏感 ───────────→ ECDSA
```

| 考慮要素 | HMAC | RSA | RSA-PSS | ECDSA |
|---------|------|-----|---------|-------|
| 署名速度 | 速い | やや遅い | やや遅い | 速い |
| 検証速度 | 速い | 速い | 速い | 速い |
| 鍵長 | 32+ バイト | 2048+ ビット | 2048+ ビット | 256+ ビット |
| 署名長 | 固定 | 長い（~256 バイト） | 長い（~256 バイト） | 短い（~64 バイト） |
| アーキテクチャ結合 | 密結合 | 疎結合 | 疎結合 | 疎結合 |
| セキュリティ | 高い | 高い | より高い | 高い |

## セキュリティ上の注意

:::danger 禁止事項
- コードに秘密鍵をハードコードしない
- 弱鍵（純粋な数字、繰り返し文字など）を使用しない
- `none` アルゴリズムを使用しない（本ライブラリは自動的に拒否します）
- HMAC 秘密鍵を 32 バイト未満にしない
:::

:::tip ベストプラクティス
- 環境変数または鍵管理サービスで秘密鍵を保管
- 署名鍵を定期的にローテーション
- 本番環境では RSA または ECDSA の使用を推奨
- RSA 鍵は 2048 ビット以上を推奨
:::

## 次のステップ

- [カスタム Claims](./custom-claims) — ビジネスフィールドの定義
- [API リファレンス → パッケージ関数](../api-reference/functions) — 完全な API シグネチャ
- [基本サンプル](../examples/basic) — HMAC の完全な例
