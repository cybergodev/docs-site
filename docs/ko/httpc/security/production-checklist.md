---
title: 프로덕션 체크리스트 - HTTPC
description: HTTPC 프로덕션 환경 배포 보안 체크리스트로, TLS 버전 및 인증서 구성 확인, SSRF 방어 전략 점검, 타임아웃 및 응답 본문 크기 제한 설정, 재시도 전략 선택 및 구성 최적화, defer Close 리소스 해제 관리 및 연결 풀 메트릭 모니터링 등 핵심 보안 구성 항목의 항목별 점검 및 보안 감사 가이드를 다룹니다.
---

# 프로덕션 체크리스트

## 필수 확인 사항

### TLS 구성

- [ ] `InsecureSkipVerify`가 `false`로 설정됨 (기본값)
- [ ] `MinTLSVersion`이 최소 `tls.VersionTLS12` 이상
- [ ] `TestingConfig()`를 사용하지 않음

### SSRF 방어

- [ ] `AllowPrivateIPs`가 `false`임 (기본값)
- [ ] 내부 서비스 접근이 필요한 경우 `SSRFExemptCIDRs`로 정확하게 지정
- [ ] 사용자 제공 URL을 처리할 때 `SecureConfig()` 사용

### 타임아웃 구성

- [ ] 모든 타임아웃 값이 적절하게 설정됨
- [ ] `Timeouts.Request`가 0이 아님 (무한 대기 방지)
- [ ] 각 요청에 `WithContext`를 사용한 타임아웃 설정 고려

### 응답 제한

- [ ] `MaxResponseBodySize`가 적절한 상한으로 설정됨
- [ ] `MaxDecompressedBodySize`가 적절한 상한으로 설정됨
- [ ] 대용량 응답 처리 시 스트리밍 다운로드 사용

### 재시도 구성

- [ ] `MaxRetries`가 5를 초과하지 않음
- [ ] 비멱등 요청(POST/PUT/PATCH)은 재시도를 신중하게 사용
- [ ] `EnableJitter`를 활성화하여 썬더링 허드 방지

### 리소스 관리

- [ ] 클라이언트 사용 후 `Close()` 호출
- [ ] Result 사용 후 `ReleaseResult()` 호출
- [ ] `defer`를 사용하여 리소스 해제 보장

## 권장 사항

### 미들웨어

- [ ] `RecoveryMiddleware()`를 사용하여 panic 충돌 방지
- [ ] `LoggingMiddleware()`를 사용하여 요청 로그 기록
- [ ] `MetricsMiddleware()`를 사용하여 메트릭 수집
- [ ] 보안 민감 시나리오에서 `AuditMiddleware()` 사용

### 요청 헤더

- [ ] 의미 있는 `User-Agent` 설정
- [ ] 기본 요청 헤더에 민감 정보를 저장하지 않음
- [ ] 수동으로 Authorization을 설정하는 대신 `WithBearerToken` 사용

### 쿠키

- [ ] 보안 민감 시나리오에서 `CookieSecurity` 검증 활성화
- [ ] `StrictCookieSecurityConfig()`를 사용하여 보안 속성 강제

### 리다이렉트

- [ ] 사용자 입력 URL 시나리오에서 리다이렉트 비활성화
- [ ] `RedirectWhitelist`를 사용하여 리다이렉트 대상 제한

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

## 검사 명령

```bash
# TestingConfig 오용 여부 확인
grep -r "TestingConfig" --include="*.go" | grep -v "_test.go"

# InsecureSkipVerify 확인
grep -r "InsecureSkipVerify.*true" --include="*.go" | grep -v "_test.go"

# AllowPrivateIPs 확인
grep -r "AllowPrivateIPs.*true" --include="*.go" | grep -v "_test.go"
```

## 다음 단계

- [보안 개요](./) - 보안 기능 개요
- [SSRF 방어](./ssrf) - SSRF 방어 상세
- [구성 API](../api-reference/config) - 전체 구성 참조
