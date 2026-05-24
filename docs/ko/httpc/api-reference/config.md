---
title: "구성 - HTTPC"
description: "HTTPC 구성 시스템 API 레퍼런스: Config 메인 구조체 및 Timeouts, Connection, Security, Retry, Middleware 다섯 개 하위 구성 그룹의 모든 필드 설명, DefaultConfig 등 다섯 가지 프리셋 함수, ValidateConfig 검증과 Cookie 보안 구성."
---

# 구성

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

메인 구성 구조체입니다. `DefaultConfig()`를 통해 안전한 기본값을 얻을 수 있습니다.

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

## TimeoutConfig

```go
type TimeoutConfig struct {
    Request        time.Duration // 총 요청 타임아웃 (재시도 포함), 기본 180s
    Dial           time.Duration // TCP 연결 타임아웃, 기본 10s
    TLSHandshake   time.Duration // TLS 핸드셰이크 타임아웃, 기본 10s
    ResponseHeader time.Duration // 응답 헤더 대기 타임아웃, 기본 0 (비활성화, 컨텍스트 타임아웃에 의존)
    IdleConn       time.Duration // 유휴 연결 유지 시간, 기본 90s
}
```

| 필드 | 기본값 | 최대값 |
|------|--------|--------|
| Request | 180s | 30min |
| Dial | 10s | 30min |
| TLSHandshake | 10s | 30min |
| ResponseHeader | 0 | 30min |
| IdleConn | 90s | 30min |

0으로 설정하면 타임아웃이 없습니다 (프로덕션 환경에서는 권장하지 않음).

:::tip ResponseHeader 설계
`ResponseHeader`는 기본값이 0(비활성화)이며, 이때는 `Timeouts.Request` 또는 `WithTimeout()`이 유일한 타임아웃 메커니즘으로 작동하여, `WithTimeout()`이 요청 지속 시간을 완전히 제어할 수 있습니다. 이 설계는 AI API 및 롱 폴링 등 응답 시간 연장이 필요한 시나리오에 적합합니다. 전송 계층의 하드 상한이 필요한 경우에만(예: Slowloris 공격 방어) 양수로 설정하세요. 단, 이 경우 `WithTimeout`이 재정의됩니다.
:::

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // 전역 최대 유휴 연결, 기본 50
    MaxConnsPerHost        int           // 호스트당 최대 연결 수, 기본 10
    ProxyURL               string        // 프록시 주소, 예: "http://proxy:8080"
    EnableSystemProxy      bool          // 시스템 프록시 자동 감지, 기본 false
    EnableHTTP2            bool          // HTTP/2 활성화, 기본 true
    EnableCookies          bool          // Cookie 관리 활성화, 기본 false
    EnableDoH              bool          // DNS-over-HTTPS 활성화, 기본 false
    DoHCacheTTL            time.Duration // DoH 캐시 TTL, 기본 5min
    BrowserFingerprint     string        // TLS 핑거프린트 위장, 기본 "" (표준 Go TLS 사용)
    MaxResponseHeaderBytes int64         // 응답 헤더 최대 바이트 수, 기본 0 (Go 표준 라이브러리 기본값 10MB 사용)
}
```

### DNS-over-HTTPS

DoH를 활성화하면 DNS 해석 지연을 줄이고 DNS 하이재킹을 방지할 수 있습니다:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

기본 DoH 제공자 (우선순위 순): Cloudflare -> Google -> AliDNS. 자세한 내용은 [연결 풀과 프록시](../advanced/connection-pool)를 참조하세요.

### TLS 핑거프린트 위장

`BrowserFingerprint`를 활성화하면 실제 브라우저의 TLS ClientHello 핸드셰이크를 시뮬레이션하여 TLS 핑거프린트 기반 안티봇 탐지를 우회합니다. 설정하면 Go 표준 `crypto/tls` 대신 utls를 사용합니다:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.BrowserFingerprint = "chrome" // 선택: "chrome", "firefox", "safari", "ios"
```

| 값 | 시뮬레이션 브라우저 |
|------|----------|
| `"chrome"` | Google Chrome |
| `"firefox"` | Mozilla Firefox |
| `"safari"` | Apple Safari |
| `"ios"` | iOS Safari |
| `""` (기본) | 표준 Go TLS 사용 |

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config    // 커스텀 TLS 설정
    MinTLSVersion           uint16         // 최소 TLS 버전, 기본 TLS 1.2
    MaxTLSVersion           uint16         // 최대 TLS 버전, 기본 TLS 1.3
    InsecureSkipVerify      bool           // 인증서 검증 건너뛰기 (테스트 전용)
    MaxResponseBodySize     int64          // 응답 본문 크기 제한, 기본 10MB
    MaxRequestBodySize      int64          // 요청 본문 크기 제한, 기본 0 (MaxResponseBodySize 값 사용)
    MaxDecompressedBodySize int64          // 압축 해제 후 크기 제한, 기본 100MB
    AllowPrivateIPs         bool           // 사설 IP 허용, 기본 false
    SSRFExemptCIDRs         []string       // SSRF 면제 CIDR
    ValidateURL             bool           // URL 검증, 기본 true
    ValidateHeaders         bool           // 요청 헤더 검증, 기본 true
    StrictContentLength     bool           // 엄격한 Content-Length, 기본 true
    CookieSecurity          *CookieSecurityConfig // Cookie 보안 검증
    RedirectWhitelist       []string       // 리다이렉트 허용 도메인 화이트리스트
}
```

:::warning SSRF 방어
`AllowPrivateIPs`는 기본값이 `false`이며, 사설/예약 IP(127.0.0.1, 10.x, 192.168.x 등)로의 연결을 차단합니다. 내부 서비스에 연결해야 하는 경우에만 `true`로 설정하세요.
:::

### SSRF 면제 예시

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 내부
    "100.64.0.0/10",    // Tailscale
}
```

## RetryConfig

```go
type RetryConfig struct {
    MaxRetries    int           // 최대 재시도 횟수, 기본 3
    Delay         time.Duration // 초기 재시도 지연, 기본 1s
    BackoffFactor float64       // 백오프 배수, 기본 2.0
    EnableJitter  bool          // 지터 활성화, 기본 true
    MaxRetryDelay time.Duration // 최대 재시도 지연 상한, 기본 30s
    CustomPolicy  RetryPolicy   // 커스텀 재시도 정책
}
```

| 필드 | 기본값 | 범위 |
|------|--------|------|
| MaxRetries | 3 | 0-10 |
| Delay | 1s | 0-30min |
| BackoffFactor | 2.0 | 1.0-10.0 |
| MaxRetryDelay | 30s | 0-30min |

재시도 지연 공식: `min(Delay * BackoffFactor^attempt + jitter, MaxRetryDelay)`

## MiddlewareConfig

```go
type MiddlewareConfig struct {
    Middlewares     []MiddlewareFunc // 미들웨어 목록
    UserAgent       string           // User-Agent, 기본 "httpc/1.0"
    Headers         map[string]string // 기본 요청 헤더
    FollowRedirects bool             // 리다이렉트 따르기, 기본 true
    MaxRedirects    int              // 최대 리다이렉트 횟수, 기본 10
}
```

## 구성 프리셋

### DefaultConfig

```go
func DefaultConfig() *Config
```

안전한 기본 구성입니다. SSRF 방어가 기본적으로 활성화되어 있습니다.

### SecureConfig

```go
func SecureConfig() *Config
```

보안 우선 구성입니다. 더 짧은 타임아웃, 자동 리다이렉트 비활성화, 엄격한 SSRF 방어를 적용합니다.

| 구성 항목 | 값 |
|-----------|-----|
| Request 타임아웃 | 15s |
| Dial 타임아웃 | 5s |
| TLSHandshake 타임아웃 | 5s |
| ResponseHeader 타임아웃 | 10s (Slowloris 방어) |
| IdleConn 타임아웃 | 30s |
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

고처리량 구성입니다. 더 큰 연결 풀과 긴 타임아웃을 적용하며, 보안 검증은 유지합니다.

:::tip
PerformanceConfig은 `ValidateURL`과 `ValidateHeaders`를 활성화 상태로 유지하여 보안을 보장합니다. 신뢰할 수 있는 환경에서 최대 성능이 필요한 경우 `cfg.Security.ValidateURL = false`로 수동 비활성화할 수 있으나, 보안 위험(인젝션 공격, SSRF)에 주의하세요.
:::

| 구성 항목 | 값 |
|-----------|-----|
| Request 타임아웃 | 60s |
| Dial 타임아웃 | 15s |
| TLSHandshake 타임아웃 | 15s |
| ResponseHeader 타임아웃 | 0 (비활성화, Request 타임아웃 사용) |
| IdleConn 타임아웃 | 120s |
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

테스트 환경 구성입니다. 보안 검사를 비활성화하고 짧은 타임아웃을 적용합니다.

| 구성 항목 | 값 |
|-----------|-----|
| Dial 타임아웃 | 5s |
| TLSHandshake 타임아웃 | 5s |
| ResponseHeader 타임아웃 | 0 (비활성화, Request 타임아웃 사용) |
| IdleConn 타임아웃 | 30s |
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
이 구성은 TLS 검증과 SSRF 방어를 비활성화하므로 **테스트 전용**입니다. 비테스트 환경에서 사용하면 보안 경고가 출력됩니다.
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

경량 구성입니다. 재시도와 리다이렉트를 비활성화하고 최소 연결 풀을 적용합니다.

| 구성 항목 | 값 |
|-----------|-----|
| Dial 타임아웃 | 5s |
| TLSHandshake 타임아웃 | 5s |
| ResponseHeader 타임아웃 | 0 (비활성화, Request 타임아웃 사용) |
| IdleConn 타임아웃 | 30s |
| MaxIdleConns | 10 |
| MaxConnsPerHost | 2 |
| MaxResponseBodySize | 1MB |
| MaxRetries | 0 |
| Delay | 0 |
| BackoffFactor | 1.0 |
| EnableJitter | false |
| FollowRedirects | false |

## 검증

### ValidateConfig

```go
func ValidateConfig(cfg *Config) error
```

구성의 유효성을 검증합니다. `New()` 내부에서 자동으로 호출되며, 명시적으로 호출할 수도 있습니다.

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 100 // 범위 초과

if err := httpc.ValidateConfig(cfg); err != nil {
    log.Fatal(err) // invalid retry configuration: Retry.MaxRetries must be 0-10, got 100
}
```

### Config.String

```go
func (c *Config) String() string
```

안전한 문자열 표현을 반환합니다. ProxyURL 자격 증명은 마스킹되며, TLSConfig는 `<configured>` 또는 `<default>`로 표시되고, Headers는 출력되지 않습니다.

```go
cfg := httpc.DefaultConfig()
fmt.Println(cfg.String())
// Config{Timeouts:{Request: 3m0s, ...}, Security:{TLSConfig: <default>, ...}}
```

## Cookie 보안

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

Cookie 보안 속성 검증 구성입니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `RequireSecure` | `bool` | Cookie에 Secure 속성 설정 요구 |
| `RequireHttpOnly` | `bool` | Cookie에 HttpOnly 속성 설정 요구 |
| `RequireSameSite` | `string` | 요구되는 SameSite 값, 예: `"Strict"`, `"Lax"`, 빈 문자열은 검사하지 않음 |
| `AllowSameSiteNone` | `bool` | SameSite=None 허용 여부 |
| `RequireSecureForSameSiteNone` | `bool` | SameSite=None인 경우 Secure 속성 요구 (기본 `true`) |

### DefaultCookieSecurityConfig

```go
func DefaultCookieSecurityConfig() *CookieSecurityConfig
```

기본 Cookie 보안 구성입니다. Secure/HttpOnly/SameSite 속성을 요구하지 않지만, SameSite=None인 Cookie는 반드시 Secure 속성을 설정하도록 강제합니다.

### StrictCookieSecurityConfig

```go
func StrictCookieSecurityConfig() *CookieSecurityConfig
```

엄격한 Cookie 보안 구성입니다. Secure, HttpOnly 및 SameSite=Strict을 요구합니다.

```go
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
```
