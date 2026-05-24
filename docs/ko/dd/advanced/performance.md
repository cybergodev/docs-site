---
title: "성능 최적화 - CyberGo DD | 고성능 로그"
description: "CyberGo DD 로그 라이브러리 성능 최적화 전체 가이드. 제로 할당 최적화 기술, BufferedWriter 버퍼 쓰기 설정, 로그 샘플링 전략과 빈도 제어, 레벨 사전 확인으로 불필요한 할당 방지, sync.Pool 객체 풀 재사용 및 벤치마크 분석 방법을 상세히 설명하여 개발자가 고동시성 시나리오에서 극한의 로그 성능을 달성할 수 있도록 돕습니다."
---

# 성능 최적화

DD는 설계 단계에서부터 고성능을 추구하며, 다음은 로그 성능을 더욱 최적화하기 위한 조언입니다.

## 제로 할당 최적화

DD는 핫 패스에서 메모리 할당을 최소화합니다:

- `IsLevelEnabled()` 확인은 원자적 연산을 사용하여 락 없이 수행
- 구조화된 필드는 사전 할당된 버퍼 사용
- 로그 레벨이 불일치할 때 메시지 포맷팅 방지

## 레벨 확인

고빈도 경로에서 레벨을 먼저 확인하여 불필요한 필드 생성을 방지합니다:

```go
// 권장: 레벨 먼저 확인
if logger.IsDebugEnabled() {
    logger.DebugWith("상세 정보",
        dd.String("data", expensiveToString()),
        dd.Int("size", len(largeSlice)),
    )
}

// 비권장: 항상 필드 생성
logger.DebugWith("상세 정보",
    dd.String("data", expensiveToString()),
)
```

## 버퍼 쓰기

`BufferedWriter`를 사용하여 I/O 시스템 콜을 줄입니다:

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
bwCfg := dd.DefaultBufferedWriterConfig()
bwCfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(fw, bwCfg)  // 8KB 버퍼

logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
defer logger.Close()  // Close가 자동 Flush
```

:::tip 버퍼 크기
4KB-16KB를 권장합니다. 너무 작은 버퍼는 시스템 콜을 효과적으로 줄이지 못하고, 너무 큰 버퍼는 메모리 사용량과 지연을 증가시킵니다.
:::

## 로그 샘플링

고처리량 시나리오에서 로그 샘플링을 활성화하여 중복 로그를 줄입니다:

```go
logger.SetSampling(&dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,    // 처음 100개는 모두 기록
    Thereafter: 10,     // 이후 10개 중 1개만 기록
    Tick:       time.Minute, // 매분 카운터 초기화
})

// 런타임 동적 조정
cfg := logger.GetSampling()
```

## 파일 쓰기 최적화

### 합리적인 순환 설정

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
// 기본: 100MB / 30일 / 10개 백업
```

- 파일이 너무 작으면 잦은 순환으로 I/O 증가
- 백업이 너무 많으면 디스크 공간 차지
- 실제 로그량에 따라 매개변수 조정

### 다중 파일 분리

```go
// 레벨별 분리
infoWriter, _ := dd.NewFileWriter("logs/info.log", dd.DefaultFileWriterConfig())
errorWriter, _ := dd.NewFileWriter("logs/error.log", dd.DefaultFileWriterConfig())
```

## Writer 관리

### 동적 Writer 증감

```go
// 런타임 동적 추가
logger.AddWriter(newWriter)

// 더 이상 필요하지 않은 Writer 제거
logger.RemoveWriter(oldWriter)
```

### 과도한 Writer 피하기

각 Writer는 쓰기 지연을 증가시킵니다. 3-4개 이하의 Writer를 권장합니다.

## 필드 최적화

### 타입화된 필드 사용

```go
// 권장: 타입화된 생성자
dd.Int("count", 42)
dd.String("name", "test")

// 피하기: Any (추가 타입 단언 필요)
dd.Any("count", 42)
```

### 큰 객체 피하기

```go
// 비권장: 큰 객체 기록
logger.InfoWith("데이터", dd.Any("payload", hugeStruct))

// 권장: 핵심 정보만 기록
logger.InfoWith("데이터",
    dd.Int("count", len(items)),
    dd.String("first", items[0].Name),
)
```

## 종료와 정리

```go
// 필터링 고루틴 완료 대기
logger.WaitForFilterGoroutines(3 * time.Second)

// 정상 종료, 모든 버퍼 새로고침 대기
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
logger.Shutdown(ctx)
```

## 다음 단계

- [출력 대상](../api-reference/writers) -- FileWriter, BufferedWriter API
- [설정](../api-reference/config) -- 성능 관련 설정 항목
- [프로덕션 체크리스트](../security/production-checklist) -- 출시 전 체크리스트
