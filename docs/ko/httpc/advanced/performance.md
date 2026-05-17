---
title: 성능 최적화 - HTTPC
description: HTTPC 성능 최적화 가이드. 네 가지 사전 설정의 성능 차이를 비교하고, 연결 풀 튜닝, Result 객체 풀 재사용 전략과 일반적인 성능 안티패턴 해결 방법을 다룹니다.
---

# 성능 최적화

## 사전 설정 비교

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

| 시나리오 | 추천 사전 설정 | 조정 제안 |
|----------|---------------|-----------|
| 일반 웹 서비스 | Default | - |
| 사용자 제공 URL 처리 | Secure | - |
| 내부 마이크로서비스 고동시성 | Performance | MaxIdleConns 증가 |
| 일회성 스크립트 | Minimal | - |
| 파일 다운로드 서비스 | Performance | MaxResponseBodySize 증가 |
| 금융/의료 API | Secure + 커스텀 | 감사 미들웨어 추가 |

```go
// 고처리량 시나리오
client, _ := httpc.New(httpc.PerformanceConfig())

// 사전 설정을 기반으로 미세 조정
cfg := httpc.PerformanceConfig()
cfg.Timeouts.Request = 120 * time.Second
cfg.Connection.MaxIdleConns = 200
client, _ := httpc.New(cfg)
```

## 객체 풀 재사용

HTTPC는 내장 Result 객체 풀을 제공하며, `ReleaseResult`로 반환합니다:

```go
result, err := client.Get(url)
if err != nil {
    return err
}
defer httpc.ReleaseResult(result) // 객체 풀로 반환
```

:::tip 팁
고동시성 시나리오에서 `ReleaseResult`는 GC 부하를 크게 줄일 수 있습니다.
:::

## 성능 안티패턴

| 안티패턴 | 원인 | 올바른 방법 |
|----------|------|-------------|
| 요청마다 클라이언트 생성 | 연결 재사용 불가 | 전역 클라이언트 재사용 |
| ReleaseResult 무시 | GC 부하 증가 | defer로 반환 |
| 과도하게 큰 MaxResponseBodySize | 메모리 과다 사용 | 합리적인 제한 설정 |
| 핫 경로에서 result.String() 사용 | 문자열 생성 오버헤드 | Body() 직접 사용 |

## 다음 단계

- [연결 풀과 프록시](./connection-pool) — 연결 풀 매개변수 선택, 프록시 및 DoH 설정
- [오류 처리](./error-handling) — 타임아웃 계층화 전략
- [보안 개요](../security/) — 보안과 성능의 균형
