---
title: 設定 - HTTPC
description: HTTPC 設定システム API リファレンス。Config 構造体と 5 つのサブ設定グループの全フィールド説明、5 種類のプリセット設定関数と Validate 検証メソッド。
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

メイン設定構造体。`DefaultConfig()` でセキュアなデフォルト値を取得。

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

## TimeoutConfig

```go
type TimeoutConfig struct {
    Request        time.Duration // 総リクエストタイムアウト（リトライ含む）、デフォルト 30s
    Dial           time.Duration // TCP 接続タイムアウト、デフォルト 10s
    TLSHandshake   time.Duration // TLS ハンドシェイクタイムアウト、デフォルト 10s
    ResponseHeader time.Duration // レスポンスヘッダー待機タイムアウト、デフォルト 30s
    IdleConn       time.Duration // アイドル接続保持時間、デフォルト 90s
}
```

| フィールド | デフォルト | 最大値 |
|------------|-----------|--------|
| Request | 30s | 30min |
| Dial | 10s | 30min |
| TLSHandshake | 10s | 30min |
| ResponseHeader | 30s | 30min |
| IdleConn | 90s | 30min |

0 に設定するとタイムアウトなしになります（本番環境では非推奨）。

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // グローバル最大アイドル接続数、デフォルト 50
    MaxConnsPerHost        int           // ホストあたり最大接続数、デフォルト 10
    ProxyURL               string        // プロキシアドレス、例："http://proxy:8080"
    EnableSystemProxy      bool          // システムプロキシの自動検出、デフォルト false
    EnableHTTP2            bool          // HTTP/2 を有効化、デフォルト true
    EnableCookies          bool          // Cookie 管理を有効化、デフォルト false
    EnableDoH              bool          // DNS-over-HTTPS を有効化、デフォルト false
    DoHCacheTTL            time.Duration // DoH キャッシュ TTL、デフォルト 5min
    MaxResponseHeaderBytes int64         // レスポンスヘッダーの最大バイト数、デフォルト 0（Go 標準ライブラリのデフォルト 10MB を使用）
}
```

### DNS-over-HTTPS

DoH を有効にすると DNS 解決遅延を削減し、DNS ハイジャックを防止できます：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

デフォルトの DoH プロバイダー（優先度順）：Cloudflare → Google → AliDNS。詳しくは[コネクションプールとプロキシ](../advanced/connection-pool)を参照してください。

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config    // カスタム TLS 設定
    MinTLSVersion           uint16         // 最低 TLS バージョン、デフォルト TLS 1.2
    MaxTLSVersion           uint16         // 最高 TLS バージョン、デフォルト TLS 1.3
    InsecureSkipVerify      bool           // 証明書検証をスキップ（テストのみ）
    MaxResponseBodySize     int64          // レスポンスボディサイズ制限、デフォルト 10MB
    MaxRequestBodySize      int64          // リクエストボディサイズ制限、デフォルト 0（MaxResponseBodySize の値を使用）
    MaxDecompressedBodySize int64          // 展開後サイズ制限、デフォルト 100MB
    AllowPrivateIPs         bool           // プライベート IP を許可、デフォルト false
    SSRFExemptCIDRs         []string       // SSRF 豁免 CIDR
    ValidateURL             bool           // URL 検証、デフォルト true
    ValidateHeaders         bool           // ヘッダー検証、デフォルト true
    StrictContentLength     bool           // 厳格な Content-Length、デフォルト true
    CookieSecurity          *CookieSecurityConfig // Cookie セキュリティ検証
    RedirectWhitelist       []string       // リダイレクトホワイトリストドメイン
}
```

:::warning SSRF 防護
`AllowPrivateIPs` はデフォルトで `false` であり、プライベート/予約 IP（127.0.0.1、10.x、192.168.x など）への接続をブロックします。内部サービスに接続する場合のみ `true` に設定してください。
:::

### SSRF 豁免の例

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
    BackoffFactor float64       // バックオフ倍数、デフォルト 2.0
    EnableJitter  bool          // ジッターを有効化、デフォルト true
    CustomPolicy  RetryPolicy   // カスタムリトライポリシー
}
```

| フィールド | デフォルト | 範囲 |
|------------|-----------|------|
| MaxRetries | 3 | 0-10 |
| Delay | 1s | 0-30min |
| BackoffFactor | 2.0 | 1.0-10.0 |

リトライ遅延の公式：`Delay * BackoffFactor^attempt + jitter`

## MiddlewareConfig

```go
type MiddlewareConfig struct {
    Middlewares     []MiddlewareFunc // ミドルウェアリスト
    UserAgent       string           // User-Agent、デフォルト "httpc/1.0"
    Headers         map[string]string // デフォルトリクエストヘッダー
    FollowRedirects bool             // リダイレクト追従、デフォルト true
    MaxRedirects    int              // 最大リダイレクト回数、デフォルト 10
}
```

## 設定プリセット

### DefaultConfig

```go
func DefaultConfig() *Config
```

セキュアなデフォルト設定。SSRF 防護はデフォルトで有効。

### SecureConfig

```go
func SecureConfig() *Config
```

セキュリティ優先設定。より短いタイムアウト、自動リダイレクト無効、厳格な SSRF 防護。

| 設定項目 | 値 |
|----------|-----|
| Request タイムアウト | 15s |
| Dial タイムアウト | 5s |
| TLSHandshake タイムアウト | 5s |
| ResponseHeader タイムアウト | 10s |
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

高スループット設定。大規模コネクションプール、長いタイムアウト、セキュリティ検証は維持。

:::tip ヒント
PerformanceConfig はセキュリティを確保するため `ValidateURL` と `ValidateHeaders` を有効に維持しています。信頼できる環境で最大パフォーマンスが必要な場合は `cfg.Security.ValidateURL = false` で手動で無効化できますが、セキュリティリスク（インジェクション攻撃、SSRF）に注意してください。
:::

| 設定項目 | 値 |
|----------|-----|
| Request タイムアウト | 60s |
| Dial タイムアウト | 15s |
| TLSHandshake タイムアウト | 15s |
| ResponseHeader タイムアウト | 60s |
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
|----------|-----|
| Dial タイムアウト | 5s |
| TLSHandshake タイムアウト | 5s |
| ResponseHeader タイムアウト | 10s |
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

:::danger 危険
この設定は TLS 検証と SSRF 防護を無効にします。**テスト専用**です。非テスト環境で使用するとセキュリティ警告が表示されます。
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

軽量設定。リトライとリダイレクトを無効化、最小コネクションプール。

| 設定項目 | 値 |
|----------|-----|
| Dial タイムアウト | 5s |
| TLSHandshake タイムアウト | 5s |
| ResponseHeader タイムアウト | 10s |
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

設定の有効性を検証。`New()` 内部で自動的に呼び出されますが、明示的に呼び出すことも可能。

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

安全な文字列表現を返します。ProxyURL の認証情報はマスクされ、TLSConfig は `<configured>` または `<default>` と表示され、Headers は出力されません。

```go
cfg := httpc.DefaultConfig()
fmt.Println(cfg.String())
// Config{Timeouts:{Request: 30s, ...}, Security:{TLSConfig: <default>, ...}}
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

Cookie セキュリティ属性検証の設定。

| フィールド | タイプ | 説明 |
|------------|--------|------|
| `RequireSecure` | `bool` | Cookie に Secure 属性の設定を要求 |
| `RequireHttpOnly` | `bool` | Cookie に HttpOnly 属性の設定を要求 |
| `RequireSameSite` | `string` | 要求する SameSite 値（例：`"Strict"`、`"Lax"`）。空文字列でチェックなし |
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

厳格な Cookie セキュリティ設定。Secure、HttpOnly、SameSite=Strict を要求。

```go
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
```
