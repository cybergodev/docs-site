---
title: "本番チェックリスト - CyberGo HTTPC | デプロイ前チェック"
description: "HTTPC 本番環境セキュリティチェックリスト: TLS 確認、SSRF と CIDR 監査、タイムアウト設定、レスポンスサイズ制限、リトライ戦略、リソース解放と AuditMiddleware 監査監視のベストプラクティスを解説します。本番運用に役立つ実践的な内容です。"
---

# 本番チェックリスト

## 必須確認項目

### TLS 設定

- [ ] `InsecureSkipVerify` を `false` に設定（デフォルト値）
- [ ] `MinTLSVersion` を少なくとも `tls.VersionTLS12` に設定
- [ ] `TestingConfig()` を使用していないことを確認

### SSRF 防護

- [ ] `AllowPrivateIPs` を `false` に設定（デフォルト値）
- [ ] 内部サービスへのアクセスが必要な場合は `SSRFExemptCIDRs` で精密に指定
- [ ] ユーザー提供の URL を処理する場合は `SecureConfig()` を使用

### タイムアウト設定

- [ ] すべてのタイムアウト値が適切に設定されている
- [ ] `Timeouts.Request` が 0 ではないことを確認（無限待機を防止）
- [ ] 各リクエストに `WithContext` でタイムアウトを設定することを検討

### レスポンス制限

- [ ] `MaxResponseBodySize` に適切な上限を設定
- [ ] `MaxDecompressedBodySize` に適切な上限を設定
- [ ] 大きなレスポンスを処理する場合はストリーミングダウンロードを使用

### リトライ設定

- [ ] `MaxRetries` を 5 以下に設定
- [ ] 非冪等なリクエスト（POST/PUT/PATCH）ではリトライを慎重に使用
- [ ] Thundering Herd を防止するため `EnableJitter` を有効化

### リソース管理

- [ ] クライアント使用後に `Close()` を呼び出す
- [ ] `defer` を使用してリソース解放を保証

## 推奨項目

### ミドルウェア

- [ ] `RecoveryMiddleware()` を使用して panic クラッシュを防止
- [ ] `LoggingMiddleware()` を使用してリクエストログを記録
- [ ] `MetricsMiddleware()` を使用してメトリクスを収集
- [ ] セキュリティ重視シナリオでは `AuditMiddleware()` を使用

### リクエストヘッダー

- [ ] 意味のある `User-Agent` を設定
- [ ] デフォルトヘッダーに機密情報を保存しない
- [ ] 手動で Authorization を設定するのではなく `WithBearerToken` を使用

### Cookie

- [ ] セキュリティ重視シナリオでは `CookieSecurity` 検証を有効化
- [ ] `StrictCookieSecurityConfig()` を使用してセキュリティ属性を強制

### リダイレクト

- [ ] ユーザー入力 URL のシナリオではリダイレクトを無効化
- [ ] `RedirectWhitelist` を使用してリダイレクト先を制限

## コード例

### 本番レベルのクライアント作成

```go
func createProductionClient() (httpc.Client, error) {
    cfg := httpc.DefaultConfig()

    // タイムアウト
    cfg.Timeouts.Request = 30 * time.Second
    cfg.Timeouts.Dial = 10 * time.Second
    cfg.Timeouts.TLSHandshake = 10 * time.Second
    cfg.Timeouts.ResponseHeader = 30 * time.Second

    // コネクションプール
    cfg.Connection.MaxIdleConns = 50
    cfg.Connection.MaxConnsPerHost = 10

    // セキュリティ
    cfg.Security.AllowPrivateIPs = false
    cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024

    // リトライ
    cfg.Retry.MaxRetries = 3
    cfg.Retry.Delay = 1 * time.Second
    cfg.Retry.EnableJitter = true

    // ミドルウェア
    cfg.Middleware.UserAgent = "my-service/1.0"
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        httpc.LoggingMiddleware(log.Printf),
        httpc.RequestIDMiddleware("X-Request-ID", nil),
    }

    return httpc.New(cfg)
}
```

### セキュアクライアント

```go
func createSecureClient() (httpc.Client, error) {
    cfg := httpc.SecureConfig()
    cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
    cfg.Security.RedirectWhitelist = []string{"api.example.com"}
    return httpc.New(cfg)
}
```

## 確認コマンド

```bash
# TestingConfig の誤用を確認
grep -r "TestingConfig" --include="*.go" | grep -v "_test.go"

# InsecureSkipVerify を確認
grep -r "InsecureSkipVerify.*true" --include="*.go" | grep -v "_test.go"

# AllowPrivateIPs を確認
grep -r "AllowPrivateIPs.*true" --include="*.go" | grep -v "_test.go"
```

## 次のステップ

- [セキュリティ概要](./) - セキュリティ機能一覧
- [SSRF 防護](./ssrf) - SSRF 防護の詳細
- [設定 API](../api-reference/config) - 完全な設定リファレンス
