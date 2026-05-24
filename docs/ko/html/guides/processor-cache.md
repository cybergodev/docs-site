---
title: "Processor 재사용과 캐시 - HTML"
description: "CyberGo HTML Processor 재사용과 캐시 최적화 가이드, 패키지 함수와 Processor 인스턴스의 차이점, sync.Pool 내부 메커니즘, 캐시 전략 설정(TTL, 용량, 정리 간격), 적중률 모니터링 통계, 웹 서비스 싱글톤과 크롤러 배치 처리 모범 사례를 상세히 설명합니다."
---

# Processor 재사용과 캐시

이 가이드는 패키지 함수와 Processor 인스턴스의 차이를 설명하여, 다양한 시나리오에서 올바른 선택과 최적의 성능을 얻는 데 도움을 줍니다.

## 두 가지 호출 모드

### 패키지 함수(일회성 호출)

```go
result, err := html.Extract(data)
```

내부적으로 `sync.Pool`로 임시 Processor를 관리하며, 매 호출 시 풀에서 가져오고 사용 후 반환합니다.

**적용 시나리오**: 저빈도 호출(예: CLI 도구, 일회성 스크립트)

**라이프사이클**:

```text
Extract() 호출
  → sync.Pool에서 Processor 획득(또는 새로 생성)
  → 추출 실행
  → sync.Pool로 반환
```

### Processor 인스턴스(재사용 모드)

```go
p, _ := html.New()
defer p.Close()

for _, page := range pages {
    result, _ := p.Extract(page)
}
```

독립적인 Processor 인스턴스를 생성하고, 라이프사이클을 수동으로 관리합니다.

**적용 시나리오**: 고빈도 호출(예: 웹 서비스, 크롤러)

**라이프사이클**:

```text
html.New()
  → Processor 생성(캐시, 감사, 통계)
  → 루프에서 p.Extract() 호출(캐시 재사용)
  → defer p.Close()
```

## 선택 방법

| 시나리오 | 추천 방식 | 이유 |
|------|----------|------|
| CLI 도구, 단일 처리 | 패키지 함수 | 간단하고 직관적, 관리 불필요 |
| 웹 서비스, API 백엔드 | Processor 인스턴스 | 캐시 가속, 통계 모니터링 |
| 배치 크롤러 | Processor 인스턴스 | 캐시 중복 제거, 리소스 제어 가능 |
| 테스트 코드 | 패키지 함수 | 상태 없음, 테스트 격리 |

## 캐시 메커니즘

Processor 인스턴스는 콘텐츠 기반 캐시를 내장합니다. 동일한 HTML 입력은 반복해서 처리되지 않습니다.

### 캐시 설정

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 2000     // 최대 캐시 항목 수(0=비활성화)
cfg.CacheTTL = time.Hour       // 캐시 유효 기간
cfg.CacheCleanup = 5 * time.Minute // 백그라운드 정리 간격
```

| 매개변수 | 기본값 | 설명 |
|------|--------|------|
| `MaxCacheEntries` | 2000 | 캐시 용량 상한, 0으로 설정하면 캐시 비활성화 |
| `CacheTTL` | 1시간 | 항목 만료 시간 |
| `CacheCleanup` | 5분 | 백그라운드에서 만료된 항목을 정리하는 간격 |

### 캐시 키 생성

캐시 키는 인코딩 변환 후 UTF-8 콘텐츠를 기반으로 생성됩니다:
- 64KB 미만의 콘텐츠: 전체 콘텐츠의 해시 계산
- 64KB 이상의 콘텐츠: 5점 샘플링 알고리즘 사용(헤더 + 푸터 + 균등 샘플링)

동일한 HTML 콘텐츠는 반복 호출 시 캐시에 직접 적중하여 파싱과 추출 단계를 건너뜁니다.

## 캐시 적중률 모니터링

```go
p, _ := html.New()
defer p.Close()

// 페이지 배치 처리
for _, page := range pages {
    p.Extract(page)
}

// 통계 가져오기
stats := p.GetStatistics()
fmt.Printf("총 처리: %d\n", stats.TotalProcessed)
fmt.Printf("캐시 적중: %d\n", stats.CacheHits)
fmt.Printf("캐시 미스: %d\n", stats.CacheMisses)

hitRate := float64(stats.CacheHits) / float64(stats.TotalProcessed) * 100
fmt.Printf("적중률: %.1f%%\n", hitRate)
```

## 추천 패턴

### 웹 서비스 싱글톤

웹 서비스에서는 싱글톤 Processor 사용을 권장합니다:

```go
var processor *html.Processor

func init() {
    cfg := html.DefaultConfig()
    cfg.MaxCacheEntries = 5000
    cfg.CacheTTL = 30 * time.Minute
    cfg.ProcessingTimeout = 10 * time.Second

    var err error
    processor, err = html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
}

func handleExtract(w http.ResponseWriter, r *http.Request) {
    data, _ := io.ReadAll(r.Body)
    result, err := processor.Extract(data)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    json.NewEncoder(w).Encode(result)
}
```

### 크롤러 배치 처리

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

urls := crawlURLs()
pages := fetchPages(urls) // [][]byte

batch := p.ExtractBatch(pages)
fmt.Printf("성공: %d, 실패: %d\n", batch.Success, batch.Failed)
```

### 정기 유지보수

장기 실행되는 Processor는 정기적인 유지보수가 필요합니다:

```go
// 정기 캐시 정리(메모리 증가 방지)
go func() {
    ticker := time.NewTicker(10 * time.Minute)
    for range ticker.C {
        p.ClearCache()
    }
}()

// 정기 통계 초기화(캐시는 유지)
go func() {
    ticker := time.NewTicker(time.Hour)
    for range ticker.C {
        stats := p.GetStatistics()
        log.Printf("처리 %d회, 오류 %d회",
            stats.TotalProcessed, stats.ErrorCount)
        p.ResetStatistics()
    }
}()
```

## 성능 비교

동일한 HTML을 1000회 반복 처리(참고용):

| 모드 | 첫 처리 | 캐시 적중 |
|------|----------|----------|
| 패키지 함수 | 기준 | 캐시 없음 |
| Processor(캐시 없음) | 약 기준 | 약 기준 |
| Processor(캐시 있음) | 약 기준 | 약 기준의 1/10 |

:::tip 캐시 적용 조건
캐시는 Processor 인스턴스에서만 적용됩니다. 패키지 함수는 매번 다른 Processor 인스턴스를 사용하므로 캐시를 활용할 수 없습니다.
:::

## 일반적인 오해

| 오해 | 올바른 방법 |
|------|----------|
| 매번 `html.New()`로 Processor 생성 | 동일한 인스턴스를 재사용 |
| `p.Close()` 호출 누락 | `defer p.Close()` 사용 |
| 패키지 함수에 캐시 기대 | 캐시는 Processor 인스턴스에서만 적용 |
| 종료 후 Processor 계속 사용 | `ErrProcessorClosed` 오류 확인 |

## 다음 단계

- [성능 최적화](../advanced/performance) - 더 많은 성능 튜닝 팁
- [API 레퍼런스: Processor](../api-reference/processor) - 전체 메서드 목록
- [API 레퍼런스: 설정](../api-reference/config) - 캐시 설정 상세
