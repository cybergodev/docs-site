---
sidebar_label: "HookRegistry"
title: "훅 시스템 - CyberGo DD | HookRegistry"
description: "CyberGo DD 라이프사이클 훅 시스템의 완전한 API 문서입니다. 로그 쓰기 전후(BeforeLog/AfterLog), 파일 로테이션(OnRotate), 오류 발생(OnError) 등 핵심 이벤트에 커스텀 콜백 함수를 등록할 수 있으며, HookRegistry 레지스트리와 유연한 로그 처리 확장 메커니즘을 제공합니다."
sidebar_position: 1
---

# 훅 시스템

DD는 이벤트 기반의 훅 시스템을 제공하여 로그 라이프사이클의 핵심 시점에 커스텀 로직을 삽입할 수 있습니다.

## 훅 이벤트

| 상수 | String() | 트리거 시점 |
|------|----------|----------|
| `HookBeforeLog` | `"BeforeLog"` | 로그 쓰기 전 |
| `HookAfterLog` | `"AfterLog"` | 로그 쓰기 후 |
| `HookOnFilter` | `"OnFilter"` | 민감 데이터 필터링 시 |
| `HookOnRotate` | `"OnRotate"` | 파일 로테이션 시 |
| `HookOnClose` | `"OnClose"` | 로거 종료 시 |
| `HookOnError` | `"OnError"` | 오류 발생 시 |

## 훅 함수 타입

### Hook

```go
type Hook func(ctx context.Context, hookCtx *HookContext) error
```

훅 함수 시그니처. 로그 라이프사이클 이벤트 트리거 시 호출됩니다.

- `BeforeLog` 훅이 오류를 반환하면 **로그 항목이 기록되지 않습니다**.
- 다른 이벤트에서 반환된 오류는 기본적으로 이후 훅 실행을 중단시킵니다. 오류 핸들러(아래 `HookErrorHandler` 참조)를 설정한 경우에는 오류를 핸들러로 넘기고, 모든 훅이 여전히 실행됩니다.
- 훅 내부에서 발생한 panic은 `HookRegistry`가 잡아서 오류로 변환하여 애플리케이션 전체가 다운되는 것을 방지합니다.

### HookErrorHandler

```go
type HookErrorHandler func(event HookEvent, hookCtx *HookContext, err error)
```

훅 오류 핸들러 시그니처.

매개변수:

- `event`: 오류를 트리거한 훅 이벤트 타입
- `hookCtx`: 훅에 전달된 컨텍스트
- `err`: 훅이 반환한(또는 panic에서 변환된) 오류

오류 핸들러를 설정(`HookRegistry.SetErrorHandler` 또는 `HooksConfig.ErrorHandler` 경유)하면, `Trigger`는 모든 훅을 실행하고 오류가 발생해도 곧바로 중단하지 않습니다. 각 오류는 핸들러에 전달됩니다. **예외**: `BeforeLog` 이벤트는 핸들러를 설정해도 반환된 오류가 여전히 로그 쓰기를 차단합니다. 핸들러 내부에서 panic을 일으키면 안 되며, 발생할 경우 복구되어 stderr로 출력됩니다.

## HookRegistry

훅 레지스트리로, 모든 훅의 등록과 트리거를 관리합니다. 스레드 안전.

### 생성

```go
// 빈 레지스트리
reg := dd.NewHookRegistry()

// 구성에서 생성
reg := dd.NewHooksFromConfig(hooksConfig)
```

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Add` | `(event HookEvent, hook Hook)` | 훅 등록 |
| `Remove` | `(event HookEvent)` | 이벤트의 모든 훅 제거 |
| `Trigger` | `(ctx, event, hookCtx) error` | 이벤트의 모든 훅 트리거 |
| `Clear` | `()` | 모든 훅 제거 |
| `ClearFor` | `(event HookEvent)` | 지정 이벤트의 훅 제거 |
| `SetErrorHandler` | `(handler HookErrorHandler)` | 오류 핸들러 설정 |

### 훅 등록

```go
reg := dd.NewHookRegistry()

// BeforeLog 훅
reg.Add(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    fmt.Println("로그 쓰기 직전:", hc.Message)
    return nil
})

// AfterLog 훅
reg.Add(dd.HookAfterLog, func(ctx context.Context, hc *dd.HookContext) error {
    metrics.LogCount.Inc()
    return nil
})

// OnRotate 훅
reg.Add(dd.HookOnRotate, func(ctx context.Context, hc *dd.HookContext) error {
    dd.InfoWith("파일 로테이션 완료",
        dd.String("path", hc.Metadata["path"].(string)),
    )
    return nil
})
```

### Logger로 관리

```go
// 단일 훅 추가
_ = logger.AddHook(dd.HookBeforeLog, myHook)

// 전체 레지스트리 교체
_ = logger.SetHooks(reg)

// 현재 레지스트리 가져오기
hooks := logger.GetHooks()
```

## HookContext

훅 컨텍스트로, 이벤트 발생 시의 상세 정보를 제공합니다.

```go
type HookContext struct {
    Event          HookEvent      // 이벤트 타입
    Level          LogLevel       // 로그 레벨
    Message        string         // 로그 메시지
    Fields         []Field        // 구조화 필드(필터 후)
    OriginalFields []Field        // 원본 필드(필터 전)
    Error          error          // 오류 정보(OnError 이벤트)
    Timestamp      time.Time      // 이벤트 시간
    Writer         io.Writer      // 대상 Writer(쓰기 관련 이벤트)
    Metadata       map[string]any // 추가 메타데이터
}
```

## HooksConfig

구조화 훅 구성으로, 일괄 훅 등록에 권장됩니다.

```go
type HooksConfig struct {
    BeforeLog    []Hook              // 로그 쓰기 전 훅
    AfterLog     []Hook              // 로그 쓰기 후 훅
    OnFilter     []Hook              // 민감 데이터 필터링 시 훅
    OnRotate     []Hook              // 파일 로테이션 시 훅
    OnClose      []Hook              // 로거 종료 시 훅
    OnError      []Hook              // 쓰기 오류 시 훅
    ErrorHandler HookErrorHandler    // 오류 핸들러
}
```

```go
cfg := dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        // 로그 전 처리
        return nil
    }},
    AfterLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        metrics.LogCount.Inc()
        return nil
    }},
    ErrorHandler: func(event dd.HookEvent, hc *dd.HookContext, err error) {
        log.Printf("훅 오류: %v\n", err)
    },
}
registry := dd.NewHooksFromConfig(cfg)
```

## 전체 예

### 메트릭 수집

```go
reg := dd.NewHookRegistry()
reg.Add(dd.HookAfterLog, func(ctx context.Context, hc *dd.HookContext) error {
    logCount.Inc()
    logLevelCounter.WithLabelValues(hc.Level.String()).Inc()
    return nil
})
reg.Add(dd.HookOnError, func(ctx context.Context, hc *dd.HookContext) error {
    errorCount.Inc()
    return nil
})
_ = logger.SetHooks(reg)
```

## 다음 단계

- [Logger](../core/logger) -- AddHook / SetHooks 메서드
- [설정](../core/config) -- HooksConfig 구성
- [인터페이스 정의](../core/interfaces) -- Hook 타입 정의
