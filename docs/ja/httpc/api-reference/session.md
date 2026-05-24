---
title: "セッション管理 - HTTPC"
description: "HTTPC SessionManagerセッション管理APIリファレンス：NewSessionManager作成、SessionConfig設定、SetHeader/SetHeadersセッションヘッダーCRUD、SetCookie/SetCookies Cookieメソッド、SetCookieSecurityセキュリティ検証とUpdateFromResultレスポンス同期。"
---

# セッション管理

SessionManagerはスレッドセーフなCookieとヘッダーのストレージを提供し、DomainClientが内部で使用します。

## NewSessionManager

```go
func NewSessionManager(config ...*SessionConfig) (*SessionManager, error)
```

セッションマネージャーを作成します。

```go
sm, err := httpc.NewSessionManager()

// 設定付き
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

| フィールド | タイプ | 説明 |
|------------|--------|------|
| `CookieSecurity` | `*CookieSecurityConfig` | Cookieセキュリティ検証設定。nilは検証なしを意味します |

```go
func DefaultSessionConfig() *SessionConfig
```

デフォルト設定を返します（Cookieセキュリティ検証なし）。

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

## Cookie管理

### SetCookie

```go
func (s *SessionManager) SetCookie(cookie *http.Cookie) error
```

セッションCookieを設定します。Cookieの有効性を検証し、CookieSecurityが設定されている場合はセキュリティ属性も検証します。

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

Cookieを一括設定します。

### DeleteCookie

```go
func (s *SessionManager) DeleteCookie(name string)
```

名前でCookieを削除します。

### ClearCookies

```go
func (s *SessionManager) ClearCookies()
```

すべてのCookieをクリアします。

### GetCookies

```go
func (s *SessionManager) GetCookies() []*http.Cookie
```

すべてのCookieのコピーを返します。

### GetCookie

```go
func (s *SessionManager) GetCookie(name string) *http.Cookie
```

名前でCookieのコピーを取得します。存在しない場合はnilを返します。

## Cookieセキュリティ

### SetCookieSecurity

```go
func (s *SessionManager) SetCookieSecurity(config *CookieSecurityConfig)
```

Cookieセキュリティ検証設定を更新します。以降のすべてのSetCookie呼び出しに影響します。

```go
sm.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
```

### UpdateFromResult

```go
func (s *SessionManager) UpdateFromResult(result *Result)
```

リクエスト結果からセッションCookieを更新します。安全でないCookieは通知なくスキップされます。

### UpdateFromCookies

```go
func (s *SessionManager) UpdateFromCookies(cookies []*http.Cookie)
```

CookieスライスからセッションCookieを更新します。

## 関連項目

- [ドメインクライアント](./domain-client) - DomainClientリファレンス
- [ドメインクライアントとセッション](../guides/domain-session) - 使用ガイド
- [インターフェース定義](./interfaces) - DomainClienterインターフェースリファレンス
