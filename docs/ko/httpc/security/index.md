---
title: 보안 개요 - HTTPC
description: HTTPC 보안 기능 개요, TLS 강제 버전 관리, SSRF 방어, 요청 헤더 주입 검증, Cookie 보안 속성, 리다이렉트 허용 목록과 응답 본문 크기 제한 포함.
---

# 보안 개요

HTTPC는 기본 보안(Secure by Default)을 채택하며, 모든 보안 기능이 바로 사용 가능합니다.

## 보안 기능 총览

| 기능 | 기본값 | 설명 |
|------|------|------|
| TLS 최소 버전 | TLS 1.2 | TLS 1.0/1.1 거부 |
| SSRF 방어 | 활성화 | 사설 IP 연결 차단 |
| URL 검증 | 활성화 | URL 형식과 프로토콜 검증 |
| 요청 헤더 검증 | 활성화 | CRLF 주입 방지 |
| Content-Length 엄격 검사 | 활성화 | 응답 밀반입 방지 |
| Cookie 보안 검증 | 선택 사항 | Cookie 보안 속성 검증 |
| 응답 본문 크기 제한 | 10MB | 메모리 고갈 방지 |
| 압축 해제 본문 크기 제한 | 100MB | 압축 폭탄 방지 |
| 리다이렉트 제한 | 10회 | 무한 리다이렉트 방지 |

## TLS 보안

```go
cfg := httpc.DefaultConfig()
// 기본 TLS 1.2-1.3
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
```

:::danger 위험
`InsecureSkipVerify`는 테스트에만 사용하십시오. 프로덕션 환경에서는 절대 `true`로 설정하지 마십시오.
:::

## SSRF 방어

SSRF(서버 측 요청 위조)는 공격자가 서버를 이용하여 내부 네트워크 요청을 보내는 공격 방식입니다.

```go
// 기본: 사설 IP 차단
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → 127.0.0.1, 10.x, 192.168.x 등 차단

// 특정 CIDR 면제 (예: VPN, VPC)
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 내부
    "100.64.0.0/10",    // Tailscale
}

// 보안 프리셋: 가장 강력한 SSRF 방어
client, _ := httpc.New(httpc.SecureConfig())
```

### 차단되는 IP 범위

| 범위 | 설명 |
|------|------|
| 127.0.0.0/8 | 루프백 주소 |
| 10.0.0.0/8 | A 클래스 사설 |
| 172.16.0.0/12 | B 클래스 사설 |
| 192.168.0.0/16 | C 클래스 사설 |
| 169.254.0.0/16 | 링크 로컬 |
| ::1/128 | IPv6 루프백 |
| fc00::/7 | IPv6 고유 로컬 |
| fe80::/10 | IPv6 링크 로컬 |

## 요청 헤더 검증

CRLF 주입과 요청 헤더 밀반입을 자동으로 방지합니다:

```go
// 다음 요청 헤더는 거부됩니다
httpc.WithHeader("X-Custom", "value\r\nInjected: header") // CRLF 주입
httpc.WithHeader("X-Bad", "value\x00null")                // 제어 문자
```

## Cookie 보안

```go
// 엄격한 Cookie 보안
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
// 요구 사항: Secure, HttpOnly, SameSite=Strict
```

## 리다이렉트 보안

```go
// 리다이렉트 금지 (보안 민감 시나리오)
cfg := httpc.SecureConfig() // FollowRedirects = false

// 리다이렉트 도메인 제한
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
}
```

## 감사 미들웨어

```go
auditMiddleware := httpc.AuditMiddleware(func(event httpc.AuditEvent) {
    // URL이 마스킹됨 (자격 증명 제거됨)
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
})

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{auditMiddleware}
```

### 구성 포함 감사

```go
auditCfg := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}
auditMiddleware := httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
    data, _ := json.Marshal(event)
    log.Println(string(data))
}, auditCfg)
```

## 다음 단계

- [SSRF 방어](./ssrf) - SSRF 방어 상세 설명과 구성
- [TLS와 인증서 고정](./tls-certpin) - TLS 구성과 인증서 고정
- [프로덕션 체크리스트](./production-checklist) - 배포 전 필수 확인 사항
