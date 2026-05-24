---
title: "設定 - HTTPC"
description: "HTTPC設定システムAPIリファレンス：Configメイン構造体とTimeouts、Connection、Security、Retry、Middlewareの5つのサブ設定グループの全フィールド説明、DefaultConfigなど5種類のプリセット関数、ValidateConfig検証とCookieセキュリティ設定。"
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

メイン設定構造体。`DefaultConfig()`で安全なデフォルト値を取得します。

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

## TimeoutConfig

```go
type TimeoutConfig struct {
    Request        time.Duration // 総リクエストタイムアウト（リトライ含む）、デフォルト180s
    Dial           time.Duration // TCP接続タイムアウト、デフォルト10s
    TLSHandshake   time.Duration // TLSハンドシェイクタイムアウト、デフォルト10s
    ResponseHeader time.Duration // レスポンスヘッダー待機タイムアウト、デフォルト0（無効、コンテキストタイムアウトに依存）
    IdleConn       time.Duration // アイドル接続保持時間、デフォルト90s
}
```

| フィールド | デフォルト | 最大値 |
|------------|------------|--------|
| Request | 180s | 30min |
| Dial | 10s | 30min |
| TLSHandshake | 10s | 30min |
| ResponseHeader | 0 | 30min |
| IdleConn | 90s | 30min |

0に設定するとタイムアウトなしになります（本番環境では非推奨）。

:::tip ヒント ResponseHeaderの設計
`ResponseHeader`はデフォルトで0（無効）です。この場合、`Timeouts.Request`または`WithTimeout()`が唯一のタイムアウトメカニズムとして使用され、`WithTimeout()`がリクエストの所要時間を完全に制御できます。この設計はAI APIやロングポーリングなど、レスポンス時間を延長する必要があるシナリオに適しています。トランスポート層のハードリミット（Slowloris攻撃の防御など）が必要な場合のみ正の値に設定してください。ただし、これは`WithTimeout`を上書きすることに注意してください。
:::

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // グローバル最大アイドル接続数、デフォルト50
    MaxConnsPerHost        int           // ホストごとの最大接続数、デフォルト10
    ProxyURL               string        // プロキシアドレス、例 "http://proxy:8080"
    EnableSystemProxy      bool          // システムプロキシの自動検出、デフォルトfalse
    EnableHTTP2            bool          // HTTP/2の有効化、デフォルトtrue
    EnableCookies          bool          // Cookie管理の有効化、デフォルトfalse
    EnableDoH              bool          // DNS-over-HTTPSの有効化、デフォルトfalse
    DoHCacheTTL            time.Duration // DoHキャッシュTTL、デフォルト5min
    BrowserFingerprint     string        // TLSフィンガープリント偽装、デフォルト""（標準Go TLSを使用）
    MaxResponseHeaderBytes int64         // レスポンスヘッダーの最大バイト数、デフォルト0（Go標準ライブラリのデフォルト10MBを使用）
}
```

### DNS-over-HTTPS

DoHを有効にするとDNS解決の遅延を減らし、DNSハイジャックを防止できます：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

デフォルトDoHプロバイダー（優先度順）：Cloudflare → Google → AliDNS。詳しくは[接続プールとプロキシ](../advanced/connection-pool)をご覧ください。

### TLSフィンガープリント偽装

`BrowserFingerprint`を有効にすると、実際のブラウザのTLS ClientHelloハンドシェイクをシミュレートし、TLSフィンガープリントベースのアンチクロール検出を回避します。設定後、接続はGo標準の`crypto/tls`の代わりにutlsを使用します：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.BrowserFingerprint = "chrome" // 選択肢: "chrome", "firefox", "safari", "ios"
```

| 値 | シミュレートするブラウザ |
|----|--------------------------|
| `"chrome"` | Google Chrome |
| `"firefox"` | Mozilla Firefox |
| `"safari"` | Apple Safari |
| `"ios"` | iOS Safari |
| `""` (デフォルト) | 標準Go TLSを使用 |

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config    // カスタムTLS設定
    MinTLSVersion           uint16         // 最低TLSバージョン、デフォルトTLS 1.2
    MaxTLSVersion           uint16         // 最高TLSバージョン、デフォルトTLS 1.3
    InsecureSkipVerify      bool           // 証明書検証をスキップ（テストのみ）
    MaxResponseBodySize     int64          // レスポンスボディサイズ制限、デフォルト10MB
    MaxRequestBodySize      int64          // リクエストボディサイズ制限、デフォルト0（MaxResponseBodySizeの値を使用）
    MaxDecompressedBodySize int64          // 解凍後サイズ制限、デフォルト100MB
    AllowPrivateIPs         bool           // プライベートIPを許可、デフォルトfalse
    SSRFExemptCIDRs         []string       // SSRF免除CIDR
    ValidateURL             bool           // URL検証、デフォルトtrue
    ValidateHeaders         bool           // ヘッダー検証、デフォルトtrue
    StrictContentLength     bool           // 厳格なContent-Length、デフォルトtrue
    CookieSecurity          *CookieSecurityConfig // Cookieセキュリティ検証
    RedirectWhitelist       []string       // リダイレクトホワイトリストドメイン
}
```

:::warning 警告 SSRF防御
`AllowPrivateIPs`はデフォルトで`false`に設定されており、プライベート/予約済みIP（127.0.0.1、10.x、192.168.xなど）への接続をブロックします。内部サービスに接続する場合のみ`true`に設定してください。
:::

### SSRF免除の例

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC内部
    "100.64.0.0/10",    // Tailscale
}
```

## RetryConfig

```go
type RetryConfig struct {
    MaxRetries    int           // 最大リトライ回数、デフォルト3
    Delay         time.Duration // 初期リトライ遅延、デフォルト1s
    BackoffFactor float64       // バックオフ倍数、デフォルト2.0
    EnableJitter  bool          // ジッターの有効化、デフォルトtrue
    MaxRetryDelay time.Duration // 最大リトライ遅延上限、デフォルト30s
    CustomPolicy  RetryPolicy   // カスタムリトライポリシー
}
```

| フィールド | デフォルト | 範囲 |
|------------|------------|------|
| MaxRetries | 3 | 0-10 |
| Delay | 1s | 0-30min |
| BackoffFactor | 2.0 | 1.0-10.0 |
| MaxRetryDelay | 30s | 0-30min |

リトライ遅延の計算式：`min(Delay * BackoffFactor^attempt + jitter, MaxRetryDelay)`

## MiddlewareConfig

```go
type MiddlewareConfig struct {
    Middlewares     []MiddlewareFunc // ミドルウェアリスト
    UserAgent       string           // User-Agent、デフォルト "httpc/1.0"
    Headers         map[string]string // デフォルトリクエストヘッダー
    FollowRedirects bool             // リダイレクトに追従、デフォルトtrue
    MaxRedirects    int              // 最大リダイレクト回数、デフォルト10
}
```

## 設定プリセット

### DefaultConfig

```go
func DefaultConfig() *Config
```

安全なデフォルト設定。SSRF防御はデフォルトで有効。

### SecureConfig

```go
func SecureConfig() *Config
```

セキュリティ優先設定。短いタイムアウト、自動リダイレクト無効、厳格なSSRF防御。

| 設定項目 | 値 |
|----------|-----|
| Requestタイムアウト | 15s |
| Dialタイムアウト | 5s |
| TLSHandshakeタイムアウト | 5s |
| ResponseHeaderタイムアウト | 10s（Slowloris防御） |
| IdleConnタイムアウト | 30s |
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

高スループット設定。大規模接続プール、長いタイムアウト。セキュリティ検証は維持。

:::tip ヒント
PerformanceConfigは`ValidateURL`と`ValidateHeaders`を有効にしたままセキュリティを確保します。信頼できる環境で最大パフォーマンスが必要な場合は、`cfg.Security.ValidateURL = false`で手動で無効化できますが、セキュリティリスク（インジェクション攻撃、SSRF）に注意してください。
:::

| 設定項目 | 値 |
|----------|-----|
| Requestタイムアウト | 60s |
| Dialタイムアウト | 15s |
| TLSHandshakeタイムアウト | 15s |
| ResponseHeaderタイムアウト | 0（無効、Requestタイムアウトを使用） |
| IdleConnタイムアウト | 120s |
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
| Dialタイムアウト | 5s |
| TLSHandshakeタイムアウト | 5s |
| ResponseHeaderタイムアウト | 0（無効、Requestタイムアウトを使用） |
| IdleConnタイムアウト | 30s |
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
この設定はTLS検証とSSRF防御を無効にします。**テストのみに使用してください**。テスト以外の環境で使用するとセキュリティ警告が表示されます。
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

軽量設定。リトライとリダイレクト無効、最小接続プール。

| 設定項目 | 値 |
|----------|-----|
| Dialタイムアウト | 5s |
| TLSHandshakeタイムアウト | 5s |
| ResponseHeaderタイムアウト | 0（無効、Requestタイムアウトを使用） |
| IdleConnタイムアウト | 30s |
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

設定の有効性を検証します。`New()`内で自動的に呼び出されますが、明示的に呼び出すことも可能です。

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

安全な文字列表現を返します。ProxyURLの認証情報はマスクされ、TLSConfigは`<configured>`または`<default>`と表示され、Headersは出力されません。

```go
cfg := httpc.DefaultConfig()
fmt.Println(cfg.String())
// Config{Timeouts:{Request: 3m0s, ...}, Security:{TLSConfig: <default>, ...}}
```

## Cookieセキュリティ

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

Cookieセキュリティ属性の検証設定。

| フィールド | タイプ | 説明 |
|------------|--------|------|
| `RequireSecure` | `bool` | CookieにSecure属性の設定を要求 |
| `RequireHttpOnly` | `bool` | CookieにHttpOnly属性の設定を要求 |
| `RequireSameSite` | `string` | 要求するSameSite値（例：`"Strict"`、`"Lax"`）。空文字列はチェックなし |
| `AllowSameSiteNone` | `bool` | SameSite=Noneを許可するかどうか |
| `RequireSecureForSameSiteNone` | `bool` | SameSite=Noneの場合にSecure属性を要求（デフォルト`true`） |

### DefaultCookieSecurityConfig

```go
func DefaultCookieSecurityConfig() *CookieSecurityConfig
```

デフォルトCookieセキュリティ設定。Secure/HttpOnly/SameSite属性は要求しませんが、SameSite=NoneのCookieにはSecureの設定を強制します。

### StrictCookieSecurityConfig

```go
func StrictCookieSecurityConfig() *CookieSecurityConfig
```

厳格なCookieセキュリティ設定。Secure、HttpOnly、SameSite=Strictを要求します。

```go
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
```
