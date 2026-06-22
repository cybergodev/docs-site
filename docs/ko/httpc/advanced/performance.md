---
title: "성능 최적화 - CyberGo HTTPC | 프리셋과 동시성"
description: "HTTPC 성능 최적화 가이드: Default/Secure/Performance/Minimal 네 가지 프리셋 비교와 시나리오 선택, 연결 풀과 타임아웃 미세 조정, Result 수명 주기 관리와 고동시성 요청 패턴을 다룹니다."
---

# 성능 최적화

## 프리셋 설정 비교

| 지표 | Default | Secure | Performance | Minimal |
|------|---------|--------|-------------|---------|
| Request 타임아웃 | 180s | 15s | 60s | 180s |
| MaxIdleConns | 50 | 20 | 100 | 10 |
| MaxConnsPerHost | 10 | 5 | 20 | 2 |
| MaxRetries | 3 | 1 | 3 | 0 |
| MaxResponseBodySize | 10MB | 5MB | 50MB | 1MB |
| HTTP/2 | 활성화 | 활성화 | 활성화 | 활성화 |
| Cookies | 비활성화 | 비활성화 | 활성화 | 비활성화 |
| SSRF 방어 | 활성화 | 활성화 | 활성화 | 활성화 |
| FollowRedirects | 활성화 | 비활성화 | 활성화 | 비활성화 |

## 시나리오별 선택

| 시나리오 | 추천 프리셋 | 조정 제안 |
|----------|------------|-----------|
| 범용 웹 서비스 | Default | - |
| 사용자 제공 URL 처리 | Secure | - |
| 내부 마이크로서비스 고동시성 | Performance | MaxIdleConns 증가 |
| 일회성 스크립트 | Minimal | - |
| 파일 다운로드 서비스 | Performance | MaxResponseBodySize 증가 |
| 금융/의료 API | Secure + 커스텀 | 감사 미들웨어 추가 |

```go
// 고처리량 시나리오
client, _ := httpc.New(httpc.PerformanceConfig())

// 프리셋 기반 미세 조정
cfg := httpc.PerformanceConfig()
cfg.Timeouts.Request = 120 * time.Second
cfg.Connection.MaxIdleConns = 200
client, _ := httpc.New(cfg)
```

## 객체 풀 재사용

HTTPC는 내부적으로 엔진 응답 객체와 문자열 빌더를 sync.Pool로 재사용하여 GC 부하를 줄이며, Result는 매 요청마다 새로 생성되어 GC가 자동 회수합니다:

```go
result, err := client.Get(url)
if err != nil {
    return err
}
// Result는 매 요청마다 새로 생성, GC가 자동 회수, 수동 해제 불필요
```

:::tip
고동시성 시나리오에서 객체 풀 재사용은 GC 부하를 크게 줄일 수 있습니다.
:::

## 성능 안티패턴

| 안티패턴 | 원인 | 올바른 방법 |
|----------|------|------------|
| 매 요청마다 클라이언트 생성 | 연결 재사용 불가 | 전역 클라이언트 재사용 |
| 과도한 MaxResponseBodySize | 메모리 점유 | 합리적인 제한 설정 |
| 핫 경로에서 result.String() 사용 | 문자열 구성 오버헤드 | Body() 직접 사용 |

## 다음 단계

- [연결 풀과 프록시](./connection-pool) -- 연결 풀 매개변수 선택, 프록시와 DoH 설정
- [오류 처리](./error-handling) -- 타임아웃 계층화 전략
- [보안 개요](../security/) -- 보안과 성능의 균형
