---
title: 자주 묻는 질문 - HTTPC
description: HTTPC 자주 묻는 질문 답변, 패키지 함수 선택, 구성 프리셋 비교, 프록시 설정, 오류 매칭, 객체 풀 관리 및 타임아웃 튜닝 등 빈번한 질문 포함.
---

# 자주 묻는 질문

## 언제 패키지 함수를 쓰고 언제 클라이언트를 생성해야 하나요?

**패키지 함수**는 간단한 시나리오에 적합합니다: 일회성 요청, 스크립트, 도구.

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**클라이언트 생성**은 사용자 정의 구성, 연결 풀 재사용, 미들웨어 사용이 필요한 시나리오에 적합합니다.

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## 구성 프리셋은 어떻게 선택하나요?

| 프리셋 | 적용 시나리오 |
|------|----------|
| `DefaultConfig()` | 범용 시나리오, 보안 기본값 |
| `SecureConfig()` | 사용자 제공 URL 처리, 금융/의료 시나리오 |
| `PerformanceConfig()` | 내부 마이크로서비스 통신, 높은 동시성 API |
| `TestingConfig()` | 단위 테스트, 로컬 개발 |
| `MinimalConfig()` | 일회성 스크립트, 간단한 HTTP 호출 |

## 내부 서비스에 어떻게 접근하나요?

기본 SSRF 방어가 사설 IP 연결을 차단합니다. 내부 서비스에 접근하려면:

```go
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true // 모든 사설 IP 허용

// 또는 정확한 면제
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}
```

## 프록시는 어떻게 설정하나요?

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy:8080"
client, _ := httpc.New(cfg)

// 시스템 프록시 사용
cfg.Connection.EnableSystemProxy = true
```

## HTTP 오류 코드는 어떻게 처리하나요?

HTTPC는 4xx/5xx를 error로 간주하지 않으며, 수동으로 확인해야 합니다:

```go
result, err := client.Get(url)
if err != nil {
    // 네트워크 계층 오류
    return err
}

switch {
case result.IsSuccess():
    // 2xx 성공
case result.IsClientError():
    // 4xx 클라이언트 오류
    log.Printf("요청 매개변수 오류: %d", result.StatusCode())
case result.IsServerError():
    // 5xx 서버 오류
    log.Printf("서버 장애: %d", result.StatusCode())
}
```

## 왜 ReleaseResult를 호출해야 하나요?

`ReleaseResult`는 Result를 객체 풀로 반환하여 GC 부하를 줄입니다. 반환 시 응답 본문의 민감한 데이터(앞 64KB)가 삭제되어 정보가 객체 풀에서 유출되는 것을 방지합니다. 높은 동시성 시나리오에서 성능 향상이 뚜렷합니다.

```go
result, _ := client.Get(url)
defer httpc.ReleaseResult(result)
// 이후에는 result에 접근하지 마십시오
```

## 재시도는 어떻게 비활성화하나요?

```go
// 전역 비활성화
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 0

// 또는 MinimalConfig 사용
client, _ := httpc.New(httpc.MinimalConfig())

// 단일 요청 비활성화
result, _ := client.Get(url, httpc.WithMaxRetries(0))
```

## 요청 타임아웃은 어떻게 설정하나요?

네 가지 방법이 있으며, 우선순위는 높은 것부터 낮은 것 순입니다:

```go
// 1. 컨텍스트 타임아웃 (권장)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, _ := client.Request(ctx, "GET", url)

// 2. 요청 옵션
result, _ := client.Get(url, httpc.WithTimeout(5*time.Second))

// 3. 미들웨어 강제 타임아웃
middleware := httpc.TimeoutMiddleware(5 * time.Second)

// 4. 클라이언트 기본 타임아웃
cfg.Timeouts.Request = 30 * time.Second
```

## 요청 로그는 어떻게 기록하나요?

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }),
}
client, _ := httpc.New(cfg)
```

## TestingConfig에서 경고가 출력되는 이유는?

`TestingConfig`는 보안 기능(TLS 검증, SSRF 방어)을 비활성화하므로 테스트 환경이 아닌 곳에서 사용하면 보안 위험이 있습니다. 테스트 환경이 아닌 것으로 감지되면 경고를 출력합니다.

`*_test.go` 파일이나 로컬 개발에만 사용하십시오.

## DNS-over-HTTPS를 어떻게 활성화하나요?

DoH는 DNS 해석 지연을 줄이고 DNS 하이재킹을 방지할 수 있습니다:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

기본적으로 Cloudflare, Google, AliDNS 세 가지 제공자를 사용합니다(우선순위에 따라 폴백). 모든 DoH 제공자를 사용할 수 없는 경우 시스템 DNS로 자동 폴백합니다.

:::tip 사용 팁
DoH는 DNS 해석 보안이 요구되는 시나리오에 적합합니다. 일반적인 API 호출에서는 활성화할 필요가 없으며, 기본 DNS로 충분합니다.
:::

## 더 많은 자료

- [빠른 시작](./getting-started) - 5분 빠른 시작
- [실전 튜토리얼](./guides/tutorial) - 단계별 완전한 예제
- [구성 API](./api-reference/config) - 완전한 구성 참조
- [오류 처리](./advanced/error-handling) - 오류 처리 가이드
