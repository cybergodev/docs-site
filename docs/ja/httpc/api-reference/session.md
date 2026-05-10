---
title: セッション管理 - HTTPC
description: HTTPC SessionManager セッション管理 API リファレンス。作成関数、SessionConfig 設定、セッションヘッダー管理メソッド、Cookie セキュリティ検証とレスポンス同期。
---

# セッション管理

SessionManager はスレッドセーフな Cookie とリクエストヘッダーのストレージを提供し、DomainClient の内部で使用されます。

## NewSessionManager

```go
func NewSessionManager(config ...*SessionConfig) (*SessionManager, error)
```

セッションマネージャーを作成します。

```go
sm, err := httpc.NewSessionManager()

// 設定付きで作成
cfg := httpc.DefaultSessionConfig()
cfg.CookieSecurity = httpc.StrictCookieSecurityConfig()
sm, err := httpc.NewSessionManager(cfg)
```

## SessionConfig

```go
type SessionConfig struct {
    CookieSecurity *CookieSecurityConfig
}
```

| フィールド | 型 | 説明 |
|------|------|------|
| `CookieSecurity` | `*CookieSecurityConfig` | Cookie セキュリティ検証設定。nil の場合は検証なし |

```go
func DefaultSessionConfig() *SessionConfig
```

デフォルト設定を返します（Cookie セキュリティ検証なし）。

## ヘッダー管理

### SetHeader

```go
func (s *SessionManager) SetHeader(key, value string) error
```

セッションヘッダーを設定します。以降のすべてのリクエストに自動的に付与されます。ヘッダーのキーと値の有効性を検証します。

```go
err := sm.SetHeader("Authorization", "Bearer "+token)
```

### SetHeaders

```go
func (s *SessionManager) SetHeaders(headers map[string]string) error
```

セッションヘッダーを一括設定します。

```go
err := sm.SetHeaders(map[string]string{
    "Authorization": "Bearer " + token,
    "Accept":        "application/json",
})
```

### DeleteHeader

```go
func (s *SessionManager) DeleteHeader(key string)
```

指定したセッションヘッダーを削除します。

### ClearHeaders

```go
func (s *SessionManager) ClearHeaders()
```

すべてのセッションヘッダーをクリアします。

### GetHeaders

```go
func (s *SessionManager) GetHeaders() map[string]string
```

すべてのセッションヘッダーのコピーを返します。

## Cookie 管理

### SetCookie

```go
func (s *SessionManager) SetCookie(cookie *http.Cookie) error
```

セッション Cookie を設定します。Cookie の有効性を検証し、CookieSecurity が設定されている場合はセキュリティ属性も検証します。

```go
err := sm.SetCookie(&http.Cookie{
    Name:     "session",
    Value:    "abc123",
    Secure:   true,
    HttpOnly: true,
})
```

### SetCookies

```go
func (s *SessionManager) SetCookies(cookies []*http.Cookie) error
```

Cookie を一括設定します。

### DeleteCookie

```go
func (s *SessionManager) DeleteCookie(name string)
```

名前を指定して Cookie を削除します。

### ClearCookies

```go
func (s *SessionManager) ClearCookies()
```

すべての Cookie をクリアします。

### GetCookies

```go
func (s *SessionManager) GetCookies() []*http.Cookie
```

すべての Cookie のコピーを返します。

### GetCookie

```go
func (s *SessionManager) GetCookie(name string) *http.Cookie
```

名前を指定して Cookie のコピーを取得します。存在しない場合は nil を返します。

## Cookie セキュリティ

### SetCookieSecurity

```go
func (s *SessionManager) SetCookieSecurity(config *CookieSecurityConfig)
```

Cookie セキュリティ検証設定を更新します。以降のすべての SetCookie 呼び出しに影響します。

```go
sm.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
```

### UpdateFromResult

```go
func (s *SessionManager) UpdateFromResult(result *Result)
```

リクエスト結果からセッション Cookie を更新します。安全でない Cookie は通知なくスキップされます。

### UpdateFromCookies

```go
func (s *SessionManager) UpdateFromCookies(cookies []*http.Cookie)
```

Cookie スライスからセッション Cookie を更新します。

## 関連項目

- [ドメインクライアント](./domain-client) - DomainClient リファレンス
- [ドメインクライアントとセッション](../guides/domain-session) - 使用ガイド
- [インターフェース定義](./interfaces) - DomainClienter インターフェースリファレンス
