---
title: "SSRF防御 - HTTPC"
description: "HTTPC SSRF防御の詳細：デフォルトでIPv4/IPv6プライベートIPをブロック、SSRFExemptCIDRs精密免除、DNSリバインディング防御、RedirectWhitelistリダイレクトホワイトリスト、AWS/GCP/Azureクラウドメタデータ保護とAllowPrivateIPsの注意事項。"
---

# SSRF防御

SSRF（Server-Side Request Forgery、サーバーサイドリクエストフォージェリ）は、攻撃者がサーバーを利用して内部ネットワークにリクエストを送信させる攻撃手法です。HTTPCはデフォルトでSSRF防御が有効になっています。

## デフォルトの動作

```go
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → デフォルトですべてのプライベートIPをブロック
```

デフォルトでブロックされるIP範囲：

| 範囲 | CIDR | 説明 |
|------|------|------|
| IPv4ループバック | `127.0.0.0/8` | localhost |
| クラスAプライベート | `10.0.0.0/8` | 内部ネットワーク |
| クラスBプライベート | `172.16.0.0/12` | 内部ネットワーク |
| クラスCプライベート | `192.168.0.0/16` | 内部ネットワーク |
| リンクローカル | `169.254.0.0/16` | 自動設定 |
| IPv6ループバック | `::1/128` | localhost |
| IPv6ローカル | `fc00::/7` | ユニークローカルアドレス |
| IPv6リンクローカル | `fe80::/10` | リンクローカル |

## CIDR免除

マイクロサービス環境では、内部サービスへのアクセスが必要な場合があります：

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC内部
    "100.64.0.0/10",    // Tailscale VPN
    "172.20.0.0/16",    // Kubernetes Service CIDR
}
```

:::warning 警告
免除CIDRはできるだけ精密に指定してください。大きすぎる範囲（例：`0.0.0.0/0`）の使用は避けてください。SSRF防御が無効化されてしまいます。
:::

## DNSリバインディング防御

HTTPCは「解決-検証-直結」モードでDNSリバインディング攻撃を防止します：

1. ドメイン名をIPアドレスに解決
2. 解決されたすべてのIPがプライベートアドレスでないか検証
3. 検証済みのIPに直接ダイヤル（ドメイン名を再解決しない）

```go
// 攻撃シナリオ：
// 1. 攻撃者がevil.comのDNSを制御
// 2. 最初の解決でパブリックIPを返す（検証を通過）
// 3. 実際の接続時にDNSが127.0.0.1を返す（検証を回避）
//
// HTTPCの防御：検証後に検証済みIPを使用して直接ダイヤルし、再解決しない
```

## リダイレクトSSRFチェック

リダイレクト先もSSRF検証の対象となります：

```go
// public-api.comにリクエストし、サーバーがhttp://169.254.169.254/に302リダイレクトを返したと仮定
// HTTPCはリダイレクト先のIPを検証し、メタデータサービスへのアクセスをブロック
```

### リダイレクトドメインホワイトリスト

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
    "*.cdn.example.com",  // ワイルドカード対応
}

// ホワイトリスト以外のドメインへのリダイレクトはブロック
```

## クラウド環境のメタデータ保護

各クラウドプラットフォームのメタデータサービスアドレス：

| プラットフォーム | アドレス | 説明 |
|------------------|----------|------|
| AWS | `169.254.169.254` | インスタンスメタデータ |
| GCP | `metadata.google.internal` | メタデータサービス |
| Azure | `169.254.169.254` | インスタンスメタデータ |
| Alibaba Cloud | `100.100.100.200` | メタデータサービス |

HTTPCはデフォルトでAWS/Azureメタデータアクセスをブロックします（`169.254.169.254`は`169.254.0.0/16`ブロックリストに含まれています）。GCPメタデータ（`metadata.google.internal`）はDNS解決検証でブロックされます。

:::warning 警告
Alibaba Cloudメタデータ（`100.100.100.200`）はCGNAT範囲（`100.64.0.0/10`）にあり、Tailscale/WireGuardなどのVPNをサポートするため、この範囲はデフォルトのブロックリストに含まれて**いません**。Alibaba Cloudメタデータアクセスを防御する必要がある場合は、他のセキュリティポリシー（ファイアウォールルールなど）で制限してください。
:::

## SSRF防御の完全な無効化

テスト環境でのみ使用：

```go
// TestingConfigはSSRF防御を無効化
client, _ := httpc.New(httpc.TestingConfig())

// または手動設定
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true
```

:::danger 危険
本番環境では絶対に`AllowPrivateIPs = true`にしないでください。
:::

## ベストプラクティス

1. `SecureConfig()`をセキュリティベースラインとして使用
2. 必要なCIDR範囲のみを免除
3. `RedirectWhitelist`でリダイレクト先を制限
4. `SSRFExemptCIDRs`設定を定期的に監査
5. 監査ミドルウェアですべてのリクエストを記録

## 次のステップ

- [TLSと証明書ピンニング](./tls-certpin) - TLSセキュリティ設定
- [セキュリティ概要](./) - セキュリティ機能一覧
- [本番チェックリスト](./production-checklist) - リリース前の必須確認項目
