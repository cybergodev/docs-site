---
title: "프로덕션 체크리스트 - HTTPC"
description: "HTTPC 프로덕션 환경 보안 체크리스트: TLS 확인, SSRF AllowPrivateIPs 확인과 CIDR 감사, Timeouts 타임아웃 설정, MaxResponseBodySize 크기 제한, MaxRetries 재시도 전략, 리소스 해제와 AuditMiddleware 모니터링 감사."
---

# 프로덕션 체크리스트

## 필수 확인 사항

### TLS 구성

- [ ] `InsecureSkipVerify`를 `false`로 설정 (기본값)
- [ ] `MinTLSVersion`이 최소 `tls.VersionTLS12` 이상
- [ ] `TestingConfig()`를 사용하지 않음

### SSRF 방어

- [ ] `AllowPrivateIPs`가 `false` (기본값)
- [ ] 내부 서비스에 접근해야 하는 경우 `SSRFExemptCIDRs`로 정확히 지정
- [ ] 사용자 제공 URL을 처리할 때 `SecureConfig()` 사용

### 타임아웃 구성

- [ ] 모든 타임아웃 값이 설정되어 있고 합리적인지 확인
- [ ] `Timeouts.Request`가 0이 아닌지 확인 (무한 대기 방지)
- [ ] 각 요청에 `WithContext`로 타임아웃 설정 고려

### 응답 제한

- [ ] `MaxResponseBodySize`에 합리적인 상한 설정
- [ ] `MaxDecompressedBodySize`에 합리적인 상한 설정
- [ ] 대용량 응답 처리 시 스트리밍 다운로드 사용

### 재시도 구성

- [ ] `MaxRetries`가 5를 초과하지 않음
- [ ] 비멱등성 요청(POST/PUT/PATCH)은 재시도를 신중하게 사용
- [ ] `EnableJitter`를 활성화하여 천둥 무리 효과 방지

### 리소스 관리

- [ ] 클라이언트 사용 후 `Close()` 호출
- [ ] Result 사용 후 `ReleaseResult()` 호출
- [ ] `defer`를 사용하여 리소스 해제 보장

## 권장 사항

### 미들웨어

- [ ] `RecoveryMiddleware()` 사용으로 panic 충돌 방지
- [ ] `LoggingMiddleware()` 사용으로 요청 로그 기록
- [ ] `MetricsMiddleware()` 사용으로 메트릭 수집
- [ ] 보안 민감 시나리오에서 `AuditMiddleware()` 사용

### 요청 헤더

- [ ] 의미 있는 `User-Agent` 설정
- [ ] 기본 요청 헤더에 민감한 정보를 저장하지 않음
- [ ] 수동으로 Authorization 설정 대신 `WithBearerToken` 사용

### Cookie

- [ ] 보안 민감 시나리오에서 `CookieSecurity` 검증 활성화
- [ ] `StrictCookieSecurityConfig()`로 보안 속성 강제

### 리다이렉트

- [ ] 사용자 입력 URL 시나리오에서 리다이렉트 비활성화
- [ ] `RedirectWhitelist`로 리다이렉트 대상 제한

## 코드 예제

### 프로덕션급 클라이언트 생성

```go
func createProductionClient() (httpc.Client, error) {
    cfg := httpc.DefaultConfig()

    // 타임아웃
    cfg.Timeouts.Request = 30 * time.Second
    cfg.Timeouts.Dial = 10 * time.Second
    cfg.Timeouts.TLSHandshake = 10 * time.Second
    cfg.Timeouts.ResponseHeader = 30 * time.Second

    // 연결 풀
    cfg.Connection.MaxIdleConns = 50
    cfg.Connection.MaxConnsPerHost = 10

    // 보안
    cfg.Security.AllowPrivateIPs = false
    cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024

    // 재시도
    cfg.Retry.MaxRetries = 3
    cfg.Retry.Delay = 1 * time.Second
    cfg.Retry.EnableJitter = true

    // 미들웨어
    cfg.Middleware.UserAgent = "my-service/1.0"
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        httpc.LoggingMiddleware(log.Printf),
        httpc.RequestIDMiddleware("X-Request-ID", nil),
    }

    return httpc.New(cfg)
}
```

### 보안급 클라이언트

```go
func createSecureClient() (httpc.Client, error) {
    cfg := httpc.SecureConfig()
    cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
    cfg.Security.RedirectWhitelist = []string{"api.example.com"}
    return httpc.New(cfg)
}
```

## 확인 명령어

```bash
# TestingConfig 오용 확인
grep -r "TestingConfig" --include="*.go" | grep -v "_test.go"

# InsecureSkipVerify 확인
grep -r "InsecureSkipVerify.*true" --include="*.go" | grep -v "_test.go"

# AllowPrivateIPs 확인
grep -r "AllowPrivateIPs.*true" --include="*.go" | grep -v "_test.go"
```

## 다음 단계

- [보안 개요](./) - 보안 기능 총览
- [SSRF 방어](./ssrf) - SSRF 방어 상세 설명
- [구성 API](../api-reference/config) - 완전한 구성 참조
