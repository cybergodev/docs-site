---
title: 本番チェックリスト - HTTPC
description: HTTPC 本番環境セキュリティチェックリスト。TLS 設定確認、SSRF 防護確認、タイムアウトとサイズ制限、リトライ戦略、リソース解放と監査監視。
---

# 本番チェックリスト

## 必須確認項目

### TLS 設定

- [ ] `InsecureSkipVerify` を `false` に設定（デフォルト値）
- [ ] `MinTLSVersion` を最低でも `tls.VersionTLS12` に設定
- [ ] `TestingConfig()` を使用していない

### SSRF 防護

- [ ] `AllowPrivateIPs` が `false`（デフォルト値）
- [ ] 内部サービスへのアクセスが必要な場合、`SSRFExemptCIDRs` で精密に指定
- [ ] ユーザー提供の URL を処理する場合は `SecureConfig()` を使用

### タイムアウト設定

- [ ] すべてのタイムアウト値が適切に設定されている
- [ ] `Timeouts.Request` が 0 ではない（無限待機を防止）
- [ ] `WithContext` を使用して各リクエストにタイムアウトを設定することを検討

### レスポンス制限

- [ ] `MaxResponseBodySize` に適切な上限を設定
- [ ] `MaxDecompressedBodySize` に適切な上限を設定
- [ ] 大きなレスポンスを処理する場合はストリーミングダウンロードを使用

### リトライ設定

- [ ] `MaxRetries` を 5 以下に設定
- [ ] 非冪等リクエスト（POST/PUT/PATCH）でのリトライは慎重に使用
- [ ] `EnableJitter` を有効にしてサンダリングハードを防止

### リソース管理

- [ ] クライアント使用後に `Close()` を呼び出す
- [ ] Result 使用後に `ReleaseResult()` を呼び出す
- [ ] `defer` を使用してリソース解放を確実に実行

## 推奨項目

### ミドルウェア

- [ ] `RecoveryMiddleware()` を使用して panic クラッシュを防止
- [ ] `LoggingMiddleware()` を使用してリクエストログを記録
- [ ] `MetricsMiddleware()` を使用してメトリクスを収集
- [ ] セキュリティ機密シナリオでは `AuditMiddleware()` を使用

### リクエストヘッダー

- [ ] 意味のある `User-Agent` を設定
- [ ] デフォルトリクエストヘッダーに機密情報を保存しない
- [ ] 手動で Authorization を設定するのではなく `WithBearerToken` を使用

### Cookie

- [ ] セキュリティ機密シナリオでは `CookieSecurity` 検証を有効化
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

    // 接続プール
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

### セキュアレベルのクライアント

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
