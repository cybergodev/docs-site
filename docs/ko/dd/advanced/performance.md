---
sidebar_label: "성능"
title: "성능 최적화 - CyberGo DD | 고성능 로그"
description: "CyberGo DD 로그 라이브러리 성능 최적화의 완전한 가이드입니다. 저할당 최적화 팁, BufferedWriter 버퍼 쓰기 구성, 로그 샘플링 전략과 빈도 제어, 레벨 사전 검사로 불필요한 할당 회피, sync.Pool 객체 풀 재사용과 벤치마크 분석 방법을 상세히 설명하여 개발자가 고동시성 시나리오에서 극한의 로그 성능을 얻을 수 있도록 돕습니다."
sidebar_position: 1
---

# 성능 최적화

DD는 설계 단계부터 고성능을 추구하며, 다음은 로그 성능을 추가로 최적화하는 몇 가지 권장 사항입니다.

## 저할당 최적화

DD는 핫 패스에서 메모리 할당을 최소화합니다.

- `IsLevelEnabled()` 검사는 원자 연산을 사용하여 락 없음
- 구조화 필드는 사전 할당된 버퍼 사용
- 로그 레벨 불일치 시 메시지 포맷팅 회피

## 레벨 검사

고빈도 경로에서는 먼저 레벨을 검사하여 불필요한 필드 구성을 회피합니다.

```go
// 권장: 먼저 레벨 검사
if logger.IsDebugEnabled() {
    logger.DebugWith("상세 정보",
        dd.String("data", expensiveToString()),
        dd.Int("size", len(largeSlice)),
    )
}

// 비권장: 항상 필드 구성
logger.DebugWith("상세 정보",
    dd.String("data", expensiveToString()),
)
```

## 버퍼 쓰기

`BufferedWriter`로 I/O 시스템 콜을 줄입니다.

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
bwCfg := dd.DefaultBufferedWriterConfig()
bwCfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(fw, bwCfg)  // 8KB 버퍼

logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
defer logger.Close()  // Close가 자동으로 Flush
```

:::tip 팁 버퍼 크기
4KB-16KB를 권장합니다. 너무 작은 버퍼는 시스템 콜을 효과적으로 줄이지 못하고, 너무 큰 버퍼는 메모리 사용과 지연을 증가시킵니다.
:::

## 로그 샘플링

고처리량 시나리오에서 로그 샘플링을 활성화하여 반복 로그를 줄일 수 있습니다.

```go
logger.SetSampling(&dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,    // 처음 100개는 모두 기록
    Thereafter: 10,     // 이후 10개당 1개 기록
    Tick:       time.Minute, // 매분 카운터 리셋
})

// 런타임 동적 조정
cfg := logger.GetSampling()
```

## 파일 쓰기 최적화

### 합리적인 로테이션 구성

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
// 기본값: 100MB / 30일 / 10개 백업
```

- 파일이 너무 작으면 빈번한 로테이션으로 I/O 증가
- 백업이 너무 많으면 디스크 공간 점유
- 실제 로그량에 따라 매개변수 조정

### 다중 파일 분리

```go
// 레벨별 분리
infoWriter, _ := dd.NewFileWriter("logs/info.log", dd.DefaultFileWriterConfig())
errorWriter, _ := dd.NewFileWriter("logs/error.log", dd.DefaultFileWriterConfig())
```

## Writer 관리

### 동적 증감 Writer

```go
// 런타임 동적 추가
logger.AddWriter(newWriter)

// 더 이상 필요 없는 Writer 제거
logger.RemoveWriter(oldWriter)
```

### 너무 많은 Writer 회피

각 Writer는 쓰기 지연을 증가시킵니다. 3-4개 이하의 Writer를 권장합니다.

## 필드 최적화

### 타입화된 필드 사용

```go
// 권장: 타입화된 생성자
dd.Int("count", 42)
dd.String("name", "test")

// 회피: Any(추가 타입 단언 필요)
dd.Any("count", 42)
```

### 대형 객체 회피

```go
// 비권장: 대형 객체 기록
logger.InfoWith("데이터", dd.Any("payload", hugeStruct))

// 권장: 핵심 정보만 기록
logger.InfoWith("데이터",
    dd.Int("count", len(items)),
    dd.String("first", items[0].Name),
)
```

## 종료와 정리

```go
// 필터 goroutine 완료 대기
logger.WaitForFilterGoroutines(3 * time.Second)

// 우아한 종료, 모든 버퍼 flush 대기
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
logger.Shutdown(ctx)
```

## 다음 단계

- [출력 대상](../api-reference/output-integration/writers) -- FileWriter, BufferedWriter API
- [설정](../api-reference/core/config) -- 성능 관련 구성 항목
- [프로덕션 체크리스트](../security/production-checklist) -- 출시 전 검사
