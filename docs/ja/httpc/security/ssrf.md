---
title: "SSRF 防護 - CyberGo HTTPC | プライベートIPとメタ"
description: "HTTPC SSRF 防護の詳細: デフォルトで IPv4/IPv6 プライベート IP をブロック、SSRFExemptCIDRs 精密免除、DNS リバインディング防止、リダイレクトホワイトリスト、AWS/GCP/Azure クラウドメタデータ保護を解説します。"
---

# SSRF 防護

SSRF（Server-Side Request Forgery、サーバーサイドリクエストフォージェリ）は、攻撃者がサーバーを利用して内部ネットワークにリクエストを送信させる攻撃手法です。HTTPC はデフォルトで SSRF 防護が有効になっています。

## デフォルトの動作

```go
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → デフォルトですべてのプライベート IP をブロック
```

デフォルトでブロックされる IP 範囲：

| 範囲 | CIDR | 説明 |
|------|------|------|
| IPv4 ループバック | `127.0.0.0/8` | localhost |
| クラス A プライベート | `10.0.0.0/8` | 内部ネットワーク |
| クラス B プライベート | `172.16.0.0/12` | 内部ネットワーク |
| クラス C プライベート | `192.168.0.0/16` | 内部ネットワーク |
| リンクローカル | `169.254.0.0/16` | 自動設定 |
| IPv6 ループバック | `::1/128` | localhost |
| IPv6 ローカル | `fc00::/7` | ユニークローカルアドレス |
| IPv6 リンクローカル | `fe80::/10` | リンクローカル |

## CIDR 免除

マイクロサービス環境では、内部サービスにアクセスする必要がある場合があります：

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 内部
    "100.64.0.0/10",    // Tailscale VPN
    "172.20.0.0/16",    // Kubernetes Service CIDR
}
```

:::warning
免除 CIDR はできる限り精密に指定してください。大きすぎる範囲（例：`0.0.0.0/0`）は SSRF 防護を無効にするのと同じです。
:::

### リクエスト単位でのプライベート IP の免除

個別のリクエストに対してのみプライベート IP を許可したい場合（例：`localhost` のヘルスチェックエンドポイントの呼び出し）は、`AllowPrivateIPs` をグローバルに有効化する必要はありません。`WithAllowPrivateIPs` リクエストオプションを使えば、そのリクエストに対してのみ許可できます。

```go
// デフォルトクライアントはプライベート IP をブロック。この呼び出しではリクエスト単位で許可
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

:::warning
このオプションは**信頼でき、かつユーザー入力に由来しない** URL に対してのみ有効にしてください。SSRF 防護の目的は、攻撃者があなたのプロセスを誘導して内部ネットワークのエンドポイントにアクセスするのを防ぐことです。リクエスト単位で無効化すると、その呼び出しにおいてこのリスクが再び生じます。クライアント全体が内部サービスにアクセスする必要がある場合は、Config で `Security.AllowPrivateIPs = true` を設定してください。
:::

## DNS リバインディング防護

HTTPC は「解決-検証-直接接続」モードで DNS リバインディング攻撃を防止します：

1. ドメイン名を IP アドレスに解決
2. 解決されたすべての IP がプライベートアドレスでないか検証
3. 検証済みの IP に直接ダイヤル（ドメイン名を再解決しない）

```go
// 攻撃シナリオ：
// 1. 攻撃者が evil.com の DNS を制御
// 2. 最初の解決でパブリック IP を返す（検証を通過）
// 3. 実際の接続時に DNS が 127.0.0.1 を返す（検証をバイパス）
//
// HTTPC の防御：検証後に検証済みの IP を使用して直接ダイヤル、再解決なし
```

## リダイレクト SSRF チェック

リダイレクト先も SSRF 検証を通過します：

```go
// public-api.com にリクエストし、サーバーが 302 で http://169.254.169.254/ にリダイレクトした場合
// HTTPC はリダイレクト先の IP を検証し、メタデータサービスへのアクセスをブロック
```

### リダイレクトドメインホワイトリスト

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
    "*.cdn.example.com",  // ワイルドカード対応
}

// ホワイトリスト以外のドメインへのリダイレクトはブロックされる
```

## クラウド環境メタデータ防護

各クラウドプラットフォームのメタデータサービスアドレス：

| プラットフォーム | アドレス | 説明 |
|----------------|---------|------|
| AWS | `169.254.169.254` | インスタンスメタデータ |
| GCP | `metadata.google.internal` | メタデータサービス |
| Azure | `169.254.169.254` | インスタンスメタデータ |
| Alibaba Cloud | `100.100.100.200` | メタデータサービス |

HTTPC はデフォルトで AWS/Azure メタデータへのアクセスをブロックします（`169.254.169.254` は `169.254.0.0/16` ブロックリストに含まれています）。GCP メタデータ（`metadata.google.internal`）は DNS 解決検証でブロックされます。

:::warning
Alibaba Cloud メタデータ（`100.100.100.200`）は CGNAT 範囲（`100.64.0.0/10`）にあり、Tailscale/WireGuard などの VPN をサポートするため、この範囲はデフォルトのブロックリストに含まれて**いません**。Alibaba Cloud メタデータへのアクセスを防ぐ必要がある場合は、他のセキュリティポリシー（ファイアウォールルールなど）で制限してください。
:::

## SSRF 防護の完全な無効化

テスト環境でのみ使用してください：

```go
// TestingConfig は SSRF 防護を無効化
client, _ := httpc.New(httpc.TestingConfig())

// または手動設定
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true
```

:::danger
本番環境では絶対に `AllowPrivateIPs = true` に設定しないでください。
:::

## ベストプラクティス

1. `SecureConfig()` をセキュリティベースラインとして使用
2. 必要な CIDR 範囲のみを免除
3. `RedirectWhitelist` を設定してリダイレクト先を制限
4. `SSRFExemptCIDRs` 設定を定期的に監査
5. 監査ミドルウェアですべてのリクエストを記録

## 次のステップ

- [TLS と証明書ピンニング](./tls-certpin) - TLS セキュリティ設定
- [セキュリティ概要](./) - セキュリティ機能一覧
- [本番チェックリスト](./production-checklist) - リリース前の必須確認項目
