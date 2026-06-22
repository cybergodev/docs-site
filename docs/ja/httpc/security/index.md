---
title: "セキュリティ概要 - CyberGo HTTPC | セキュリティ機能"
description: "HTTPC セキュリティ機能概要: TLS 1.2+ バージョン制御、SSRF プライベート IP ブロックと CIDR 免除、CRLF インジェクション防止、Cookie セキュリティ、リダイレクトホワイトリストを解説します。"
---

# セキュリティ概要

HTTPC はデフォルトで安全（Secure by Default）に設計されており、すべてのセキュリティ機能がすぐに使用できます。

## セキュリティ機能一覧

| 機能 | デフォルト | 説明 |
|------|-----------|------|
| TLS 最低バージョン | TLS 1.2 | TLS 1.0/1.1 を拒否 |
| SSRF 防護 | 有効 | プライベート IP 接続をブロック |
| URL 検証 | 有効 | URL 形式とプロトコルを検証 |
| リクエストヘッダー検証 | 有効 | CRLF インジェクションを防止 |
| Content-Length 厳格チェック | 有効 | レスポンススマグリングを防止 |
| Cookie セキュリティ検証 | オプション | Cookie セキュリティ属性を検証 |
| レスポンスボディサイズ制限 | 10MB | メモリ枯渇を防止 |
| 解凍ボディサイズ制限 | 100MB | 解凍爆弾を防止 |
| リダイレクト制限 | 10 回 | 無限リダイレクトを防止 |

## TLS セキュリティ

```go
cfg := httpc.DefaultConfig()
// デフォルト TLS 1.2-1.3
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
```

:::danger
`InsecureSkipVerify` はテストのみに使用してください。本番環境では絶対に `true` に設定しないでください。
:::

## SSRF 防護

SSRF（Server-Side Request Forgery）は攻撃者がサーバーを利用して内部ネットワークにリクエストを送信させる攻撃手法です。

```go
// デフォルト：プライベート IP をブロック
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → 127.0.0.1, 10.x, 192.168.x などをブロック

// 特定の CIDR を免除（VPN、VPC など）
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 内部
    "100.64.0.0/10",    // Tailscale
}

// セキュアプリセット：最強の SSRF 防護
client, _ := httpc.New(httpc.SecureConfig())
```

### ブロックされる IP 範囲

| 範囲 | 説明 |
|------|------|
| 127.0.0.0/8 | ループバックアドレス |
| 10.0.0.0/8 | クラス A プライベート |
| 172.16.0.0/12 | クラス B プライベート |
| 192.168.0.0/16 | クラス C プライベート |
| 169.254.0.0/16 | リンクローカル |
| ::1/128 | IPv6 ループバック |
| fc00::/7 | IPv6 ユニークローカル |
| fe80::/10 | IPv6 リンクローカル |

## リクエストヘッダー検証

CRLF インジェクションとリクエストヘッダースマグリングを自動的に防止：

```go
// 以下のヘッダーは拒否されます
httpc.WithHeader("X-Custom", "value\r\nInjected: header") // CRLF インジェクション
httpc.WithHeader("X-Bad", "value\x00null")                // 制御文字
```

## Cookie セキュリティ

```go
// 厳格な Cookie セキュリティ
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
// 要求: Secure, HttpOnly, SameSite=Strict
```

## リダイレクトセキュリティ

```go
// リダイレクトを禁止（セキュリティ重視シナリオ）
cfg := httpc.SecureConfig() // FollowRedirects = false

// リダイレクトドメインを制限
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
}
```

## 監査ミドルウェア

```go
auditMiddleware := httpc.AuditMiddleware(func(event httpc.AuditEvent) {
    // URL はマスク済み（認証情報は削除）
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
})

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{auditMiddleware}
```

### 設定付きの監査

```go
auditCfg := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}
auditMiddleware := httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
    data, _ := json.Marshal(event)
    log.Println(string(data))
}, auditCfg)
```

## 次のステップ

- [SSRF 防護](./ssrf) - SSRF 防護の詳細と設定
- [TLS と証明書ピンニング](./tls-certpin) - TLS 設定と証明書ピンニング
- [本番チェックリスト](./production-checklist) - リリース前の必須確認項目
