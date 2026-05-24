---
title: "本番チェックリスト - HTTPC"
description: "HTTPC本番環境セキュリティチェックリスト：TLS設定確認、SSRF AllowPrivateIPs確認とCIDR監査、Timeoutsタイムアウト設定、MaxResponseBodySizeサイズ制限、MaxRetriesリトライ戦略、リソース解放とAuditMiddleware監視監査。"
---

# 本番チェックリスト

## 必須確認項目

### TLS設定

- [ ] `InsecureSkipVerify`を`false`に設定（デフォルト値）
- [ ] `MinTLSVersion`を少なくとも`tls.VersionTLS12`に設定
- [ ] `TestingConfig()`を使用していない

### SSRF防御

- [ ] `AllowPrivateIPs`が`false`（デフォルト値）
- [ ] 内部サービスへのアクセスが必要な場合は`SSRFExemptCIDRs`で精密に指定
- [ ] ユーザー提供のURLを処理する場合は`SecureConfig()`を使用

### タイムアウト設定

- [ ] すべてのタイムアウト値が適切に設定されている
- [ ] `Timeouts.Request`が0ではない（無限待機を防止）
- [ ] 各リクエストに`WithContext`でタイムアウトを設定することを検討

### レスポンス制限

- [ ] `MaxResponseBodySize`に合理的な上限を設定
- [ ] `MaxDecompressedBodySize`に合理的な上限を設定
- [ ] 大きなレスポンスを処理する場合はストリーミングダウンロードを使用

### リトライ設定

- [ ] `MaxRetries`を5以下に設定
- [ ] 非べき等リクエスト（POST/PUT/PATCH）ではリトライを慎重に使用
- [ ] `EnableJitter`を有効にしてサンダースタンプを防止

### リソース管理

- [ ] クライアント使用後に`Close()`を呼び出す
- [ ] Result使用後に`ReleaseResult()`を呼び出す
- [ ] `defer`を使用してリソース解放を確実に実行

## 推奨項目

### ミドルウェア

- [ ] `RecoveryMiddleware()`を使用してpanicクラッシュを防止
- [ ] `LoggingMiddleware()`を使用してリクエストログを記録
- [ ] `MetricsMiddleware()`を使用してメトリクスを収集
- [ ] セキュリティ重視のシナリオでは`AuditMiddleware()`を使用

### リクエストヘッダー

- [ ] 意味のある`User-Agent`を設定
- [ ] デフォルトヘッダーに機密情報を保存しない
- [ ] 手動でAuthorizationを設定するのではなく`WithBearerToken`を使用

### Cookie

- [ ] セキュリティ重視のシナリオでは`CookieSecurity`検証を有効化
- [ ] `StrictCookieSecurityConfig()`でセキュリティ属性を強制

### リダイレクト

- [ ] ユーザー入力URLのシナリオではリダイレクトを無効化
- [ ] `RedirectWhitelist`でリダイレクト先を制限

## コード例

### 本番グレードのクライアント作成

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
# TestingConfigの誤用を確認
grep -r "TestingConfig" --include="*.go" | grep -v "_test.go"

# InsecureSkipVerifyを確認
grep -r "InsecureSkipVerify.*true" --include="*.go" | grep -v "_test.go"

# AllowPrivateIPsを確認
grep -r "AllowPrivateIPs.*true" --include="*.go" | grep -v "_test.go"
```

## 次のステップ

- [セキュリティ概要](./) - セキュリティ機能一覧
- [SSRF防御](./ssrf) - SSRF防御の詳細
- [設定API](../api-reference/config) - 完全な設定リファレンス
