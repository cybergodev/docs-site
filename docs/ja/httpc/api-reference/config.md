---
title: 設定 - HTTPC
description: HTTPC 設定システム API リファレンス。Config メイン構造体と 5 つのサブ設定グループの全フィールド説明、5 種類のプリセット設定関数、Validate 検証メソッドを網羅。
---

# 設定

## Config

```go
type Config struct {
    Timeouts   TimeoutConfig
    Connection ConnectionConfig
    Security   SecurityConfig
    Retry      RetryConfig
    Middleware MiddlewareConfig
}
```

メイン設定構造体。`DefaultConfig()` で安全なデフォルト値を取得します。

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

## TimeoutConfig

```go
type TimeoutConfig struct {
    Request        time.Duration // リクエスト総タイムアウト（リトライ含む）、デフォルト 180s
    Dial           time.Duration // TCP 接続タイムアウト、デフォルト 10s
    TLSHandshake   time.Duration // TLS ハンドシェイクタイムアウト、デフォルト 10s
    ResponseHeader time.Duration // レスポンスヘッダー待機タイムアウト、デフォルト 0（無効、コンテキストタイムアウトに依存）
    IdleConn       time.Duration // アイドル接続保持時間、デフォルト 90s
}
```

| フィールド | デフォルト | 最大値 |
|------|--------|--------|
| Request | 180s | 30min |
| Dial | 10s | 30min |
| TLSHandshake | 10s | 30min |
| ResponseHeader | 0 | 30min |
| IdleConn | 90s | 30min |

0 に設定するとタイムアウトなしになります（本番環境では非推奨）。

:::tip ResponseHeader の設計
`ResponseHeader` のデフォルトは 0（無効）です。この場合、`Timeouts.Request` または `WithTimeout()` が唯一のタイムアウトメカニズムとして機能し、`WithTimeout()` がリクエストの持続時間を完全に制御できます。この設計は、AI API やロングポーリングなど、レスポンス時間を延長する必要があるシナリオに適しています。トランスポート層のハードリミットが必要な場合（例：Slowloris 攻撃の防御）のみ正の値を設定してください。ただし、この設定は `WithTimeout` をオーバーライドすることに注意してください。
:::

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // グローバル最大アイドル接続数、デフォルト 50
    MaxConnsPerHost        int           // ホストごとの最大接続数、デフォルト 10
    ProxyURL               string        // プロキシアドレス（例："http://proxy:8080"）
    EnableSystemProxy      bool          // システムプロキシ自動検出、デフォルト false
    EnableHTTP2            bool          // HTTP/2 を有効化、デフォルト true
    EnableCookies          bool          // Cookie 管理を有効化、デフォルト false
    EnableDoH              bool          // DNS-over-HTTPS を有効化、デフォルト false
    DoHCacheTTL            time.Duration // DoH キャッシュ TTL、デフォルト 5min
    MaxResponseHeaderBytes int64         // レスポンスヘッダーの最大バイト数、デフォルト 0（Go 標準ライブラリのデフォルト 10MB を使用）
}
```

### DNS-over-HTTPS

DoH を有効にすると、DNS 解析遅延の削減と DNS ハイジャック防止に効果があります：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

デフォルト DoH プロバイダー（優先度順）：Cloudflare → Google → AliDNS。詳細は [コネクションプールとプロキシ](../advanced/connection-pool) をご覧ください。

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config    // カスタム TLS 設定
    MinTLSVersion           uint16         // 最低 TLS バージョン、デフォルト TLS 1.2
    MaxTLSVersion           uint16         // 最高 TLS バージョン、デフォルト TLS 1.3
    InsecureSkipVerify      bool           // 証明書検証をスキップ（テスト用のみ）
    MaxResponseBodySize     int64          // レスポンスボディサイズ制限、デフォルト 10MB
    MaxRequestBodySize      int64          // リクエストボディサイズ制限、デフォルト 0（MaxResponseBodySize の値を使用）
    MaxDecompressedBodySize int64          // 展開後サイズ制限、デフォルト 100MB
    AllowPrivateIPs         bool           // プライベート IP を許可、デフォルト false
    SSRFExemptCIDRs         []string       // SSRF 除外 CIDR
    ValidateURL             bool           // URL 検証、デフォルト true
    ValidateHeaders         bool           // リクエストヘッダー検証、デフォルト true
    StrictContentLength     bool           // 厳格な Content-Length、デフォルト true
    CookieSecurity          *CookieSecurityConfig // Cookie セキュリティ検証
    RedirectWhitelist       []string       // リダイレクトホワイトリストドメイン
}
```

:::warning SSRF 防護
`AllowPrivateIPs` のデフォルトは `false` で、プライベート/予約済み IP（127.0.0.1、10.x、192.168.x など）への接続をブロックします。内部サービスに接続する場合のみ `true` に設定してください。
:::

### SSRF 除外の例

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 内部
    "100.64.0.0/10",    // Tailscale
}
```

## RetryConfig

```go
type RetryConfig struct {
    MaxRetries    int           // 最大リトライ回数、デフォルト 3
    Delay         time.Duration // 初期リトライ遅延、デフォルト 1s
    BackoffFactor float64       // バックオフ倍率、デフォルト 2.0
    EnableJitter  bool          // ジッターを有効化、デフォルト true
    MaxRetryDelay time.Duration // 最大リトライ遅延上限、デフォルト 30s
    CustomPolicy  RetryPolicy   // カスタムリトライポリシー
}
```

| フィールド | デフォルト | 範囲 |
|------|--------|--------|
| MaxRetries | 3 | 0-10 |
| Delay | 1s | 0-30min |
| BackoffFactor | 2.0 | 1.0-10.0 |
| MaxRetryDelay | 30s | 0-30min |

リトライ遅延の公式：`min(Delay * BackoffFactor^attempt + jitter, MaxRetryDelay)`

## MiddlewareConfig

```go
type MiddlewareConfig struct {
    Middlewares     []MiddlewareFunc // ミドルウェアリスト
    UserAgent       string           // User-Agent、デフォルト "httpc/1.0"
    Headers         map[string]string // デフォルトリクエストヘッダー
    FollowRedirects bool             // リダイレクトに追従、デフォルト true
    MaxRedirects    int              // 最大リダイレクト回数、デフォルト 10
}
```

## プリセット設定

### DefaultConfig

```go
func DefaultConfig() *Config
```

安全なデフォルト設定。SSRF 防護がデフォルトで有効です。

### SecureConfig

```go
func SecureConfig() *Config
```

セキュリティ優先設定。より短いタイムアウト、自動リダイレクトの無効化、厳格な SSRF 防護。

| 設定項目 | 値 |
|--------|-----|
| Request タイムアウト | 15s |
| Dial タイムアウト | 5s |
| TLSHandshake タイムアウト | 5s |
| ResponseHeader タイムアウト | 10s（Slowloris 防御） |
| IdleConn タイムアウト | 30s |
| MaxIdleConns | 20 |
| MaxConnsPerHost | 5 |
| MaxResponseBodySize | 5MB |
| MaxRetries | 1 |
| Delay | 2s |
| EnableJitter | true |
| FollowRedirects | false |

### PerformanceConfig

```go
func PerformanceConfig() *Config
```

高スループット設定。大規模コネクションプール、長めのタイムアウト、セキュリティ検証は維持。

:::tip
PerformanceConfig は `ValidateURL` と `ValidateHeaders` を有効なまま維持し、セキュリティを確保しています。信頼できる環境で最大パフォーマンスが必要な場合は、手動で無効化できます：`cfg.Security.ValidateURL = false`。ただし、セキュリティリスク（インジェクション攻撃、SSRF）に注意してください。
:::

| 設定項目 | 値 |
|--------|-----|
| Request タイムアウト | 60s |
| Dial タイムアウト | 15s |
| TLSHandshake タイムアウト | 15s |
| ResponseHeader タイムアウト | 0（無効、Request タイムアウトを使用） |
| IdleConn タイムアウト | 120s |
| MaxIdleConns | 100 |
| MaxConnsPerHost | 20 |
| EnableCookies | true |
| MaxResponseBodySize | 50MB |
| StrictContentLength | false |
| ValidateURL | true |
| ValidateHeaders | true |
| Delay | 500ms |
| BackoffFactor | 1.5 |
| EnableJitter | true |

### TestingConfig

```go
func TestingConfig() *Config
```

テスト環境設定。セキュリティチェック無効、短いタイムアウト。

| 設定項目 | 値 |
|--------|-----|
| Dial タイムアウト | 5s |
| TLSHandshake タイムアウト | 5s |
| ResponseHeader タイムアウト | 0（無効、Request タイムアウトを使用） |
| IdleConn タイムアウト | 30s |
| MaxIdleConns | 10 |
| MaxConnsPerHost | 5 |
| EnableHTTP2 | false |
| EnableCookies | true |
| InsecureSkipVerify | true |
| AllowPrivateIPs | true |
| ValidateURL | false |
| ValidateHeaders | false |
| MaxRetries | 1 |
| Delay | 100ms |
| EnableJitter | false |
| UserAgent | httpc-test/1.0 |

:::danger
この設定は TLS 検証と SSRF 防護を無効にします。**テスト用のみ**に使用してください。テスト以外の環境で使用すると、セキュリティ警告が表示されます。
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

軽量設定。リトライとリダイレクトを無効化、最小コネクションプール。

| 設定項目 | 値 |
|--------|-----|
| Dial タイムアウト | 5s |
| TLSHandshake タイムアウト | 5s |
| ResponseHeader タイムアウト | 0（無効、Request タイムアウトを使用） |
| IdleConn タイムアウト | 30s |
| MaxIdleConns | 10 |
| MaxConnsPerHost | 2 |
| MaxResponseBodySize | 1MB |
| MaxRetries | 0 |
| Delay | 0 |
| BackoffFactor | 1.0 |
| EnableJitter | false |
| FollowRedirects | false |

## 検証

### ValidateConfig

```go
func ValidateConfig(cfg *Config) error
```

設定の有効性を検証します。`New()` 内部で自動的に呼び出されますが、明示的に呼び出すことも可能です。

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 100 // 範囲外

if err := httpc.ValidateConfig(cfg); err != nil {
    log.Fatal(err) // invalid retry configuration: Retry.MaxRetries must be 0-10, got 100
}
```

### Config.String

```go
func (c *Config) String() string
```

安全な文字列表現を返します。ProxyURL の認証情報はマスキングされ、TLSConfig は `<configured>` または `<default>` と表示され、Headers は出力されません。

```go
cfg := httpc.DefaultConfig()
fmt.Println(cfg.String())
// Config{Timeouts:{Request: 3m0s, ...}, Security:{TLSConfig: <default>, ...}}
```

## Cookie セキュリティ

### CookieSecurityConfig

```go
type CookieSecurityConfig struct {
    RequireSecure                bool
    RequireHttpOnly              bool
    RequireSameSite              string
    AllowSameSiteNone            bool
    RequireSecureForSameSiteNone bool
}
```

Cookie セキュリティ属性の検証設定。

| フィールド | 型 | 説明 |
|------|------|------|
| `RequireSecure` | `bool` | Cookie に Secure 属性の設定を要求 |
| `RequireHttpOnly` | `bool` | Cookie に HttpOnly 属性の設定を要求 |
| `RequireSameSite` | `string` | 要求する SameSite 値（例：`"Strict"`、`"Lax"`）。空文字列はチェックしない |
| `AllowSameSiteNone` | `bool` | SameSite=None を許可するかどうか |
| `RequireSecureForSameSiteNone` | `bool` | SameSite=None の場合に Secure 属性を要求（デフォルト `true`） |

### DefaultCookieSecurityConfig

```go
func DefaultCookieSecurityConfig() *CookieSecurityConfig
```

デフォルトの Cookie セキュリティ設定。Secure/HttpOnly/SameSite 属性は要求しませんが、SameSite=None の Cookie には Secure の設定を強制します。

### StrictCookieSecurityConfig

```go
func StrictCookieSecurityConfig() *CookieSecurityConfig
```

厳格な Cookie セキュリティ設定。Secure、HttpOnly、SameSite=Strict を要求します。

```go
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
```
