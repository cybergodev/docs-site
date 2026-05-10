---
title: セキュリティ概要 - HTTPC
description: HTTPC セキュリティ機能概要。TLS 強制バージョン管理、SSRF 防護、リクエストヘッダーインジェクション検証、Cookie セキュリティ属性、リダイレクトホワイトリストとレスポンスボディ制限。
---

# セキュリティ概要

HTTPC はデフォルトで安全（Secure by Default）であり、すべてのセキュリティ機能がすぐに利用可能です。

## セキュリティ機能一覧

| 機能 | デフォルト | 説明 |
|------|------|------|
| TLS 最低バージョン | TLS 1.2 | TLS 1.0/1.1 を拒否 |
| SSRF 防護 | 有効 | プライベート IP 接続をブロック |
| URL 検証 | 有効 | URL 形式とプロトコルを検証 |
| リクエストヘッダー検証 | 有効 | CRLF インジェクションを防止 |
| Content-Length 厳密チェック | 有効 | レスポンススマグリングを防止 |
| Cookie セキュリティ検証 | オプション | Cookie セキュリティ属性を検証 |
| レスポンスボディサイズ制限 | 10MB | メモリ枯渇を防止 |
| 展開ボディサイズ制限 | 100MB | 展開爆弾を防止 |
| リダイレクト制限 | 10 回 | 無限リダイレクトを防止 |

## TLS セキュリティ

```go
cfg := httpc.DefaultConfig()
// デフォルト TLS 1.2-1.3
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
```

:::danger 危険
`InsecureSkipVerify` はテスト用途のみです。本番環境では絶対に `true` に設定しないでください。
:::

## SSRF 防護

SSRF（サーバーサイドリクエストフォージェリ）は、攻撃者がサーバーを利用して内部ネットワークにリクエストを送信させる攻撃手法です。

```go
// デフォルト：プライベート IP をブロック
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → 127.0.0.1, 10.x, 192.168.x などをブロック

// 特定の CIDR を除外（VPN、VPC など）
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 内部
    "100.64.0.0/10",    // Tailscale
}

// セキュリティプリセット：最強の SSRF 防護
client, _ := httpc.New(httpc.SecureConfig())
```

### ブロックされる IP 範囲

| 範囲 | 説明 |
|------|------|
| 127.0.0.0/8 | ループバックアドレス |
| 10.0.0.0/8 | A クラスプライベート |
| 172.16.0.0/12 | B クラスプライベート |
| 192.168.0.0/16 | C クラスプライベート |
| 169.254.0.0/16 | リンクローカル |
| ::1/128 | IPv6 ループバック |
| fc00::/7 | IPv6 ユニークローカル |
| fe80::/10 | IPv6 リンクローカル |

## リクエストヘッダー検証

CRLF インジェクションとリクエストヘッダースマグリングを自動的に防止します：

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
// リダイレクト禁止（セキュリティ機密シナリオ）
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
    // URL はサニタイズ済み（認証情報は削除済み）
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

- [SSRF 防護](./ssrf) - SSRF 防護の詳細と設定
- [TLS と証明書ピンニング](./tls-certpin) - TLS 設定と証明書ピンニング
- [本番チェックリスト](./production-checklist) - リリース前の必須確認項目
