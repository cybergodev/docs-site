---
title: "연결 풀과 프록시 - CyberGo HTTPC | 풀과 프록시"
description: "HTTPC 연결 풀과 프록시 가이드: MaxIdleConns 튜닝과 시나리오 추천, ProxyURL 수동과 시스템 프록시, SOCKS5와 HTTP 프록시, DoH 폴백, HTTP/2 설정과 연결 재사용 실무 요점을 다룹니다."
---

# 연결 풀과 프록시

## 연결 풀 설정

연결 풀은 HTTP 클라이언트 성능의 핵심 요소입니다. HTTPC은 `ConnectionConfig`로 연결 풀을 관리합니다.

```go
cfg := httpc.DefaultConfig()

// 연결 풀 매개변수
cfg.Connection.MaxIdleConns = 100         // 전역 최대 유휴 연결
cfg.Connection.MaxConnsPerHost = 20       // 호스트당 최대 연결 수
cfg.Timeouts.IdleConn = 120 * time.Second // 유휴 연결 유지 시간
```

### 매개변수 설명

| 매개변수 | 기본값 | 설명 |
|-----------|--------|------|
| `MaxIdleConns` | 50 | 전역 최대 유휴 연결 수 |
| `MaxConnsPerHost` | 10 | 호스트당 최대 연결 수 (활성+유휴 포함) |
| `IdleConn` | 90s | 유휴 연결 타임아웃, 초과 시 연결 닫기 |
| `Dial` | 10s | 연결 수립 타임아웃 |
| `TLSHandshake` | 10s | TLS 핸드셰이크 타임아웃 |
| `ResponseHeader` | 0 | 비활성화 (Request 타임아웃 사용) |

### 시나리오별 추천

| 시나리오 | MaxIdleConns | MaxConnsPerHost | IdleConn |
|----------|-------------|-----------------|----------|
| 고동시성 API | 100 | 20 | 120s |
| 일반 서비스 | 50 | 10 | 90s |
| 저빈도 요청 | 10 | 2 | 30s |
| 마이크로서비스 내부 | 50 | 10 | 60s |

:::tip
`MaxConnsPerHost`는 활성 연결과 유휴 연결을 모두 포함합니다. 이 제한을 초과하는 새 요청은 연결 해제를 대기합니다.
:::

## 프록시 설정

### 수동 프록시

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy.example.com:8080"

client, _ := httpc.New(cfg)
```

### 인증이 포함된 프록시

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://user:password@proxy.example.com:8080"
```

:::tip
`Config.String()` 메서드는 프록시 URL의 사용자 이름과 비밀번호를 자동으로 마스킹합니다.
:::

### SOCKS5 프록시

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "socks5://proxy.example.com:1080"
```

### 시스템 프록시 자동 감지

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableSystemProxy = true

// 자동 감지:
// - Windows: 레지스트리 Internet Settings
// - macOS: 시스템 환경설정 네트워크 프록시
// - Linux: 환경 변수 HTTP_PROXY / HTTPS_PROXY
```

프록시 우선순위:

1. `ProxyURL` (수동 지정, 최우선)
2. `EnableSystemProxy` (시스템 프록시 감지)
3. 직접 연결 (프록시 없음)

## DNS-over-HTTPS

DoH를 활성화하여 DNS 해석 지연을 줄이고 DNS 하이재킹을 방지합니다:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

기본 DoH 제공자 (우선순위 순):

| 제공자 | 주소 | 설명 |
|--------|------|------|
| Cloudflare | `1.1.1.1/dns-query` | 가장 빠름, 프라이버시 우선 |
| Google | `dns.google/resolve` | 글로벌 커버리지 |
| AliDNS | `dns.alidns.com/resolve` | 중국 지역 최적화 |

:::tip
DoH 활성화 시 DNS 해석 결과가 `DoHCacheTTL` 시간 동안 캐시됩니다. 모든 DoH 제공자를 사용할 수 없는 경우 시스템 DNS로 폴백합니다.
:::

## HTTP/2

기본적으로 HTTP/2가 활성화되어 있습니다 (TLS 필요):

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // HTTP/2 비활성화
```

HTTP/2 특징:
- 멀티플렉싱: 단일 연결로 여러 동시 요청 처리
- 헤더 압축: 반복 헤더 전송 감소
- 서버 푸시

## 객체 풀 재사용

HTTPC는 내부적으로 엔진 응답 객체와 문자열 빌더를 sync.Pool로 재사용하여 GC 부하를 줄이며, Result는 매 요청마다 새로 생성되어 GC가 자동 회수합니다.

```go
result, err := client.Get(url)
if err != nil {
    return err
}
// Result는 매 요청마다 새로 생성, GC가 자동 회수, 수동 해제 불필요
```

고동시성 시나리오에서 내부 객체 풀 재사용은 GC 부하를 크게 줄일 수 있습니다.

## 동시성 요청 패턴

```go
func fetchAll(ctx context.Context, urls []string) ([]*httpc.Result, error) {
    results := make([]*httpc.Result, len(urls))
    errs := make([]error, len(urls))

    var wg sync.WaitGroup
    for i, url := range urls {
        wg.Add(1)
        go func(idx int, u string) {
            defer wg.Done()
            result, err := client.Request(ctx, "GET", u)
            results[idx] = result
            errs[idx] = err
        }(i, url)
    }
    wg.Wait()

    for _, err := range errs {
        if err != nil {
            return nil, err
        }
    }
    return results, nil
}
```

## 연결 풀 자주 묻는 질문

| 문제 | 원인 | 해결 방법 |
|------|------|-----------|
| 대량의 TIME_WAIT | 유휴 연결 타임아웃이 너무 짧음 | `IdleConn` 타임아웃 증가 |
| 연결 거부 | 호스트당 연결 수 부족 | `MaxConnsPerHost` 증가 |
| 요청 대기 | 연결 풀이 너무 작음 | `MaxIdleConns` 증가 |

성능 안티패턴과 최적화 제안의 전체 내용은 [성능 최적화](./performance)를 참조하세요.

## 다음 단계

- [성능 최적화](./performance) - 성능 튜닝 가이드
- [설정 API](../api-reference/config) - 연결 설정 참조
- [보안 개요](../security/) - SSRF와 TLS 보안
