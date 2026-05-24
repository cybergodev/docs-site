---
title: "성능 최적화 - HTML"
description: "CyberGo HTML 라이브러리 성능 최적화 가이드, Processor 인스턴스 재사용(sync.Pool 오버헤드 방지), 캐시 전략 설정(MaxCacheEntries, CacheTTL, CacheCleanup), 배치 처리 동시성 제어(WorkerPoolSize), 입력 크기 제어와 타임아웃 설정 등 실용적인 팁을 포함합니다."
---

# 성능 최적화

## Processor 재사용

고빈도 호출 시나리오에서는 패키지 함수 대신 Processor 인스턴스를 사용해야 합니다:

```go
// 추천: Processor 재사용
p, _ := html.New(html.DefaultConfig())
defer p.Close()

for _, page := range pages {
    result, _ := p.Extract(page)
    // 캐시, 인코딩 감지기 등 리소스가 재사용됨
}

// 비추천: 매번 새 Processor 생성
for _, page := range pages {
    result, _ := html.Extract(page) // 매번 Pool에서 가져옴
}
```

## 캐시 전략

Processor는 내장 캐시를 제공하여, 동일한 입력은 반복해서 처리되지 않습니다:

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 5000     // 캐시 증설
cfg.CacheTTL = 10 * time.Minute // 시나리오에 맞게 조정
cfg.CacheCleanup = time.Minute   // 더 자주 정리
```

캐시 적중률 모니터링:

```go
stats := p.GetStatistics()
hitRate := float64(stats.CacheHits) / float64(stats.CacheHits+stats.CacheMisses)
fmt.Printf("캐시 적중률: %.2f%%\n", hitRate*100)
```

## 배치 처리

배치 처리는 자동으로 동시에 실행되므로 개별 처리보다 효율적입니다:

```go
// 추천: 배치 처리
batch := p.ExtractBatch(pages)

// 비추천: 루프에서 개별 처리
for _, page := range pages {
    p.Extract(page) // 순차 처리
}
```

CPU 코어 수에 맞게 워커 풀 크기 설정:

```go
cfg.WorkerPoolSize = runtime.NumCPU()
```

## 입력 제어

- `MaxInputSize`를 줄여 너무 큰 문서 처리 방지
- `TextOnlyConfig()`를 사용하여 불필요한 미디어 추출 건너뛰기
- 필요 없는 `Preserve*` 옵션 비활성화

```go
// TextOnlyConfig는 모든 미디어 보존을 비활성화하므로 추가 설정 불필요
cfg := html.TextOnlyConfig()

// 성능 향상을 위해 문서 인식 비활성화 가능
cfg.ExtractArticle = false
```

## 타임아웃 설정

적절한 타임아웃을 설정하여 느린 요청의 차단을 방지합니다:

```go
cfg.ProcessingTimeout = 10 * time.Second
```
