---
title: "훅 시스템 - CyberGo DD | 라이프사이클 훅 실전 가이드"
description: "CyberGo DD 훅 시스템 실전 가이드. 6가지 라이프사이클 훅 이벤트 (BeforeLog, AfterLog, OnFilter, OnRotate, OnClose, OnError), HookRegistry 등록과 관리, HookContext 컨텍스트 데이터, 오류 처리 전략 및 일반적인 훅 사용 시나리오를 상세히 소개하여 개발자가 로그 라이브러리의 동작을 확장할 수 있도록 돕습니다."
---

# 훅 시스템

훅(Hooks)을 사용하면 로그 라이프사이클의 핵심 시점에 커스텀 로직을 주입할 수 있습니다. 예를 들어 로그 기록 전후, 파일 순환, 오류 발생 등의 시점에 추가 작업을 수행할 수 있습니다.

## 훅 이벤트

DD는 6가지 라이프사이클 훅 이벤트를 제공합니다:

| 이벤트 | 트리거 시점 | 일반적인 용도 |
|------|----------|----------|
| `HookBeforeLog` | 로그 포맷팅 전 (필드 이미 필터링됨) | 조건부 건너뛰기, 샘플링 제어 |
| `HookAfterLog` | 로그 기록 완료 | 메트릭 업데이트, 알림 발송 |
| `HookOnFilter` | 보안 필터링 트리거 | 마스킹 이벤트 기록, 감사 |
| `HookOnRotate` | 파일 순환 완료 | 운영팀 알림, 이전 파일 업로드 |
| `HookOnClose` | Logger 종료 | 리소스 정리, 최종 보고서 발송 |
| `HookOnError` | 쓰기 오류 발생 | 알림, 성능 저하 대응 |

## 빠른 시작

### HooksConfig 사용

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        fmt.Printf("기록 예정: %s\n", hCtx.Message)
        return nil
    }},
    AfterLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        metrics.LogCount.Inc()
        return nil
    }},
})

logger, _ := dd.New(dd.Config{
    Hooks: hooks,
})
```

### HookRegistry 사용

```go
registry := dd.NewHookRegistry()

// BeforeLog 훅 등록
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // 디버그 레벨 로그의 특정 처리 건너뛰기
    if hCtx.Level == dd.LevelDebug {
        return nil
    }
    return nil
})

// OnRotate 훅 등록
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    fmt.Printf("파일 순환: %s\n", hCtx.Metadata)
    return nil
})

logger, _ := dd.New(dd.Config{
    Hooks: registry,
})
```

## HookContext 컨텍스트

각 훅은 `HookContext`를 수신하며, 현재 로그의 전체 정보를 포함합니다:

```go
type HookContext struct {
    Event          HookEvent    // 트리거된 이벤트 타입
    Level          LogLevel     // 로그 레벨
    Message        string       // 로그 메시지
    Fields         []Field      // 처리된 필드
    OriginalFields []Field      // 원본 필드 (필터링 전)
    Error          error        // 관련 오류 (OnError 시)
    Timestamp      time.Time    // 타임스탬프
    Writer         io.Writer    // 대상 Writer
    Metadata       map[string]any // 추가 메타데이터
}
```

## 일반적인 시나리오

### 메트릭 수집

```go
var (
    logCounter   atomic.Int64
    errorCounter atomic.Int64
)

registry := dd.NewHookRegistry()

registry.Add(dd.HookAfterLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    logCounter.Add(1)
    if hCtx.Level >= dd.LevelError {
        errorCounter.Add(1)
    }
    return nil
})

logger, _ := dd.New(dd.Config{Hooks: registry})
```

### 로그 샘플링

```go
var requestCount atomic.Int64

registry := dd.NewHookRegistry()
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    if hCtx.Level == dd.LevelInfo {
        count := requestCount.Add(1)
        // 100개 중 1개만 기록
        if count%100 != 0 {
            return fmt.Errorf("sampled out") // 오류를 반환하여 로그 기록 차단
        }
    }
    return nil
})
```

### 파일 순환 알림

```go
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    // 모니터링 시스템에 알림
    monitoring.Alert("log_rotated", map[string]any{
        "file":     hCtx.Metadata["file"],
        "new_file": hCtx.Metadata["new_file"],
    })
    return nil
})
```

### 오류 알림

```go
registry.Add(dd.HookOnError, func(ctx context.Context, hCtx *dd.HookContext) error {
    // 알림 발송
    alerting.Send(fmt.Sprintf("로그 쓰기 실패: %v", hCtx.Error))
    return nil
})
```

## 오류 처리

### 전역 오류 핸들러

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        // 오류를 반환할 수 있음
        return someOperation()
    }},
    ErrorHandler: func(event dd.HookEvent, hCtx *dd.HookContext, err error) {
        log.Printf("훅 %s 실행 실패: %v", event, err)
    },
})
```

### BeforeLog에서 로그 중단

`BeforeLog` 훅이 오류를 반환하면 해당 로그는 기록되지 않습니다:

```go
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // 조건 확인, 불만족 시 건너뛰기
    if shouldSkip(hCtx.Message) {
        return fmt.Errorf("skipped") // 기록 차단
    }
    return nil // 기록 허용
})
```

:::warning 훅 내의 Panic
훅 함수에서 panic이 발생하면 DD가 자동으로 복구하며 메인 흐름에 영향을 주지 않습니다. panic 정보는 ErrorHandler에 전달됩니다.
:::

## 동적 등록

```go
// 런타임에 새 훅 등록
registry.Add(dd.HookAfterLog, newHookFunc)

// 런타임에 제거 (HookRegistry 메서드를 통해)
```

## 다음 단계

- [감사 로그](./audit-logging) -- 보안 감사 통합
- [분산 추적](./context-tracing) -- 컨텍스트 통합
- [API 레퍼런스 - Hooks](../api-reference/hooks) -- 훅 전체 API
