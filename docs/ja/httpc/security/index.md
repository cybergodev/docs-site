---
title: "セキュリティ概要 - HTTPC"
description: "HTTPCセキュリティ機能概要：TLS 1.2+バージョン制御、SSRFプライベートIPブロックとCIDR免除、CRLFインジェクション防止、StrictCookieSecurityConfig Cookieセキュリティ、RedirectWhitelistリダイレクトホワイトリストとレスポンスボディサイズ制限。"
---

# セキュリティ概要

HTTPCはデフォルトで安全（Secure by Default）に設計されており、すべてのセキュリティ機能がすぐに使用できます。

## セキュリティ機能一覧

| 機能 | デフォルト | 説明 |
|------|------------|------|
| TLS最低バージョン | TLS 1.2 | TLS 1.0/1.1を拒否 |
| SSRF防御 | 有効 | プライベートIP接続をブロック |
| URL検証 | 有効 | URL形式とプロトコルを検証 |
| リクエストヘッダー検証 | 有効 | CRLFインジェクションを防止 |
| Content-Length厳格チェック | 有効 | レスポンススマグリングを防止 |
| Cookieセキュリティ検証 | オプション | Cookieセキュリティ属性を検証 |
| レスポンスボディサイズ制限 | 10MB | メモリ枯渇を防止 |
| 解凍ボディサイズ制限 | 100MB | 解凍爆弾を防止 |
| リダイレクト制限 | 10回 | 無限リダイレクトを防止 |

## TLSセキュリティ

```go
cfg := httpc.DefaultConfig()
// デフォルトTLS 1.2-1.3
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
```

:::danger 危険
`InsecureSkipVerify`はテストのみに使用してください。本番環境では絶対に`true`にしないでください。
:::

## SSRF防御

SSRF（Server-Side Request Forgery）は、攻撃者がサーバーを利用して内部ネットワークにリクエストを送信させる攻撃手法です。

```go
// デフォルト：プライベートIPをブロック
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → 127.0.0.1, 10.x, 192.168.xなどをブロック

// 特定CIDRを免除（VPN、VPCなど）
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC内部
    "100.64.0.0/10",    // Tailscale
}

// セキュアプリセット：最強のSSRF防御
client, _ := httpc.New(httpc.SecureConfig())
```

### ブロックされるIP範囲

| 範囲 | 説明 |
|------|------|
| 127.0.0.0/8 | ループバックアドレス |
| 10.0.0.0/8 | クラスAプライベート |
| 172.16.0.0/12 | クラスBプライベート |
| 192.168.0.0/16 | クラスCプライベート |
| 169.254.0.0/16 | リンクローカル |
| ::1/128 | IPv6ループバック |
| fc00::/7 | IPv6ユニークローカル |
| fe80::/10 | IPv6リンクローカル |

## リクエストヘッダー検証

CRLFインジェクションとリクエストヘッダースマグリングを自動的に防止：

```go
// 以下のヘッダーは拒否されます
httpc.WithHeader("X-Custom", "value\r\nInjected: header") // CRLFインジェクション
httpc.WithHeader("X-Bad", "value\x00null")                // 制御文字
```

## Cookieセキュリティ

```go
// 厳格なCookieセキュリティ
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
// 要求: Secure, HttpOnly, SameSite=Strict
```

## リダイレクトセキュリティ

```go
// リダイレクト禁止（セキュリティ重視シナリオ）
cfg := httpc.SecureConfig() // FollowRedirects = false

// リダイレクトドメインの制限
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
}
```

## 監査ミドルウェア

```go
auditMiddleware := httpc.AuditMiddleware(func(event httpc.AuditEvent) {
    // URLはマスク済み（認証情報は削除済み）
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
})

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{auditMiddleware}
```

### 設定付き監査

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

- [SSRF防御](./ssrf) - SSRF防御の詳細と設定
- [TLSと証明書ピンニング](./tls-certpin) - TLS設定と証明書ピンニング
- [本番チェックリスト](./production-checklist) - リリース前の必須確認項目
