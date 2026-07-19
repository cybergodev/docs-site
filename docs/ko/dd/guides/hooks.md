---
sidebar_label: "훅 시스템"
title: "훅 시스템 - CyberGo DD | 라이프사이클 훅 실전 가이드"
description: "CyberGo DD 훅 시스템 가이드입니다. 6가지 라이프사이클 이벤트(BeforeLog, AfterLog, OnFilter, OnRotate, OnClose, OnError), HookRegistry 등록 관리, HookContext 컨텍스트와 일반 확장 시나리오를 다룹니다."
sidebar_position: 6
---

# 훅 시스템

훅(Hooks)을 사용하면 로그 라이프사이클의 핵심 시점에 커스텀 로직을 주입할 수 있습니다. 예: 로그 쓰기 전후, 파일 로테이션, 오류 발생 등의 순간에 추가 작업 수행.

## 훅 이벤트

DD는 6가지 라이프사이클 훅 이벤트를 제공합니다.

| 이벤트 | 트리거 시점 | 일반 용도 |
|------|----------|----------|
| `HookBeforeLog` | 로그 포맷팅 이전(필드 필터 완료 후) | 조건부 건너뛰기, 샘플링 제어 |
| `HookAfterLog` | 로그 쓰기 완료 | 메트릭 업데이트, 알림 발송 |
| `HookOnFilter` | 필드값이 마스킹될 때 트리거(메시지 텍스트 마스킹은 트리거 안 함; 훅은 필드 key만 받고 원래 값은 받지 않음) | 마스킹 이벤트 기록, 감사 |
| `HookOnRotate` | 파일 로테이션 완료 | 운영 알림, 이전 파일 업로드 |
| `HookOnClose` | Logger 종료 | 리소스 정리, 최종 보고서 발송 |
| `HookOnError` | 쓰기 오류 발생 | 알림, 성능 저하 처리 |

## 빠른 시작

### HooksConfig 사용

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        fmt.Printf("쓰기 직전: %s\n", hCtx.Message)
        return nil
    }},
    AfterLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        metrics.LogCount.Inc()
        return nil
    }},
})

logger, err := dd.New(dd.Config{
    Hooks: hooks,
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### HookRegistry 사용

```go
registry := dd.NewHookRegistry()

// BeforeLog 훅 등록
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // 디버그 레벨 로그의 일부 처리 건너뛰기
    if hCtx.Level == dd.LevelDebug {
        return nil
    }
    return nil
})

// OnRotate 훅 등록
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    fmt.Printf("파일 로테이션: %s\n", hCtx.Metadata)
    return nil
})

logger, err := dd.New(dd.Config{
    Hooks: registry,
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

## HookContext 컨텍스트

각 훅은 `HookContext`를 수신하며, 여기에는 현재 로그의 완전한 정보가 포함됩니다.

```go
type HookContext struct {
    Event          HookEvent    // 트리거된 이벤트 타입
    Level          LogLevel     // 로그 레벨
    Message        string       // 로그 메시지
    Fields         []Field      // 처리된 필드
    OriginalFields []Field      // 원본 필드(필터 전)
    Error          error        // 관련 오류(OnError 시)
    Timestamp      time.Time    // 타임스탬프
    Writer         io.Writer    // 대상 Writer
    Metadata       map[string]any // 추가 메타데이터
}
```

## 일반 시나리오

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

logger, err := dd.New(dd.Config{Hooks: registry})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### 로그 샘플링

```go
var requestCount atomic.Int64

registry := dd.NewHookRegistry()
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    if hCtx.Level == dd.LevelInfo {
        count := requestCount.Add(1)
        // 100개당 1개만 기록
        if count%100 != 0 {
            return fmt.Errorf("sampled out") // 오류 반환으로 로그 쓰기 차단
        }
    }
    return nil
})
```

### 파일 로테이션 알림

```go
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    // 모니터링 시스템에 알림
    monitoring.Alert("log_rotated", map[string]any{
        "path": hCtx.Metadata["path"],
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

### 글로벌 오류 핸들러

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        // 오류 반환 가능
        return someOperation()
    }},
    ErrorHandler: func(event dd.HookEvent, hCtx *dd.HookContext, err error) {
        log.Printf("훅 %s 실행 실패: %v", event, err)
    },
})
```

### BeforeLog로 로그 중단

`BeforeLog` 훅이 오류를 반환하면 해당 로그는 기록되지 않습니다.

```go
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // 조건 검사, 불일치 시 건너뛰기
    if shouldSkip(hCtx.Message) {
        return fmt.Errorf("skipped") // 쓰기 차단
    }
    return nil // 쓰기 허용
})
```

:::warning 경고 훅 내의 Panic
훅 함수에서 panic이 발생해도 DD가 자동으로 복구하여 메인 흐름에 영향을 주지 않습니다. panic 정보는 ErrorHandler에 전달됩니다.
:::

## 동적 등록

```go
// 런타임에 새 훅 등록
registry.Add(dd.HookAfterLog, newHookFunc)

// 런타임에 제거(HookRegistry 메서드 경유)
```

:::warning 경고 registry 복제
Logger 생성 시 전달된 `registry`를 복제합니다(`dd.New(dd.Config{Hooks: registry})` 후 내부에 저장되는 것은 복사본). 이후 원본 `registry`를 수정해도 이미 생성된 Logger에는 영향을 주지 않습니다. **이미 생성된 Logger**의 훅을 런타임에 변경하려면 `logger.AddHook(event, hook)`을 사용하세요(내부적으로 Clone-Modify-Store 수행).
:::

## 다음 단계

- [감사 로그](./audit-logging) -- 보안 감사 통합
- [분산 추적](./context-tracing) -- 컨텍스트 통합
- [API 레퍼런스 - Hooks](../api-reference/security-audit/hooks) -- 훅의 완전한 API
