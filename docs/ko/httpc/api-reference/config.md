---
title: 구성 - HTTPC
description: HTTPC 구성 시스템 API 참조, Config 기본 구조체와 다섯 가지 하위 구성 그룹의 모든 필드 설명, 5가지 프리셋 구성 함수와 Validate 검증 메서드 포함.
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

기본 구성 구조체로, `DefaultConfig()`로 보안 기본값을 가져옵니다.

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

## TimeoutConfig

```go
type TimeoutConfig struct {
    Request        time.Duration // 총 요청 타임아웃 (재시도 포함), 기본 30s
    Dial           time.Duration // TCP 연결 타임아웃, 기본 10s
    TLSHandshake   time.Duration // TLS 핸드셰이크 타임아웃, 기본 10s
    ResponseHeader time.Duration // 응답 헤더 대기 타임아웃, 기본 30s
    IdleConn       time.Duration // 유휴 연결 유지 시간, 기본 90s
}
```

| 필드 | 기본값 | 최대값 |
|------|--------|--------|
| Request | 30s | 30min |
| Dial | 10s | 30min |
| TLSHandshake | 10s | 30min |
| ResponseHeader | 30s | 30min |
| IdleConn | 90s | 30min |

0으로 설정하면 타임아웃 없음 (프로덕션 환경에서는 권장하지 않음).

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
    MaxResponseHeaderBytes int64         // 응답 헤더 최대 바이트 수, 기본 0 (Go 표준 라이브러리 기본값 10MB 사용)
}
```

### DNS-over-HTTPS

DoH를 활성화하여 DNS 해석 지연을 줄이고 DNS 하이재킹을 방지합니다:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

기본 DoH 제공자 (우선순위 순): Cloudflare → Google → AliDNS. 자세한 내용은 [연결 풀과 프록시](../advanced/connection-pool)를 참조하십시오.

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config    // 사용자 정의 TLS 구성
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
    RedirectWhitelist       []string       // 리다이렉트 허용 목록 도메인
}
```

:::warning 주의 SSRF 방어
`AllowPrivateIPs`는 기본적으로 `false`이며, 사설/예약 IP(127.0.0.1, 10.x, 192.168.x 등)로의 연결을 차단합니다. 내부 서비스에 연결할 때만 `true`로 설정하십시오.
:::

### SSRF 면제 예제

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
    CustomPolicy  RetryPolicy   // 사용자 정의 재시도 전략
}
```

| 필드 | 기본값 | 범위 |
|------|--------|------|
| MaxRetries | 3 | 0-10 |
| Delay | 1s | 0-30min |
| BackoffFactor | 2.0 | 1.0-10.0 |

재시도 지연 공식: `Delay * BackoffFactor^attempt + jitter`

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

보안 기본 구성. SSRF 방어가 기본적으로 활성화.

### SecureConfig

```go
func SecureConfig() *Config
```

보안 우선 구성. 더 짧은 타임아웃, 자동 리다이렉트 비활성화, 엄격한 SSRF 방어.

| 구성 항목 | 값 |
|--------|-----|
| Request 타임아웃 | 15s |
| Dial 타임아웃 | 5s |
| TLSHandshake 타임아웃 | 5s |
| ResponseHeader 타임아웃 | 10s |
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

높은 처리량 구성. 더 큰 연결 풀, 더 긴 타임아웃, 보안 검증 유지.

:::tip 사용 팁
PerformanceConfig는 `ValidateURL`과 `ValidateHeaders`를 활성화하여 보안을 유지합니다. 신뢰할 수 있는 환경에서 최대 성능을 원하는 경우 수동으로 비활성화할 수 있습니다: `cfg.Security.ValidateURL = false`, 단 보안 위험(주입 공격, SSRF)에 주의하십시오.
:::

| 구성 항목 | 값 |
|--------|-----|
| Request 타임아웃 | 60s |
| Dial 타임아웃 | 15s |
| TLSHandshake 타임아웃 | 15s |
| ResponseHeader 타임아웃 | 60s |
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

테스트 환경 구성. 보안 검사 비활성화, 짧은 타임아웃.

| 구성 항목 | 값 |
|--------|-----|
| Dial 타임아웃 | 5s |
| TLSHandshake 타임아웃 | 5s |
| ResponseHeader 타임아웃 | 10s |
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

:::danger 위험
이 구성은 TLS 검증과 SSRF 방어를 비활성화하므로 **테스트에만 사용**하십시오. 테스트 환경이 아닌 곳에서 사용하면 보안 경고가 출력됩니다.
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

경량급 구성. 재시도와 리다이렉트 비활성화, 최소 연결 풀.

| 구성 항목 | 값 |
|--------|-----|
| Dial 타임아웃 | 5s |
| TLSHandshake 타임아웃 | 5s |
| ResponseHeader 타임아웃 | 10s |
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

구성 유효성을 검증합니다. `New()` 내부에서 자동으로 호출되지만, 명시적으로 호출할 수도 있습니다.

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

안전한 문자열 표현을 반환합니다. ProxyURL 자격 증명은 마스킹되고, TLSConfig는 `<configured>` 또는 `<default>`로 표시되며, Headers는 출력되지 않습니다.

```go
cfg := httpc.DefaultConfig()
fmt.Println(cfg.String())
// Config{Timeouts:{Request: 30s, ...}, Security:{TLSConfig: <default>, ...}}
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

Cookie 보안 속성 검증 구성.

| 필드 | 유형 | 설명 |
|------|------|------|
| `RequireSecure` | `bool` | Cookie에 Secure 속성 설정 요구 |
| `RequireHttpOnly` | `bool` | Cookie에 HttpOnly 속성 설정 요구 |
| `RequireSameSite` | `string` | 요구되는 SameSite 값, 예: `"Strict"`, `"Lax"`; 빈 문자열은 검사하지 않음 |
| `AllowSameSiteNone` | `bool` | SameSite=None 허용 여부 |
| `RequireSecureForSameSiteNone` | `bool` | SameSite=None일 때 Secure 속성 요구 (기본 `true`) |

### DefaultCookieSecurityConfig

```go
func DefaultCookieSecurityConfig() *CookieSecurityConfig
```

기본 Cookie 보안 구성. Secure/HttpOnly/SameSite 속성을 요구하지 않지만, SameSite=None인 Cookie는 반드시 Secure를 설정해야 함.

### StrictCookieSecurityConfig

```go
func StrictCookieSecurityConfig() *CookieSecurityConfig
```

엄격한 Cookie 보안 구성. Secure, HttpOnly 및 SameSite=Strict 요구.

```go
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
```
