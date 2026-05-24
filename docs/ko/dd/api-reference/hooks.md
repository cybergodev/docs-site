---
title: "훅 시스템 - CyberGo DD | HookRegistry"
description: "CyberGo DD 라이프사이클 훅 시스템 전체 API 문서. 로그 기록 전후 (BeforeLog/AfterLog), 파일 순환 (OnRotate), 오류 발생 (OnError) 등 핵심 이벤트에 커스텀 콜백 함수를 등록하는 것을 지원하며, HookRegistry 레지스트리와 유연한 로그 처리 확장 메커니즘을 제공합니다."
---

# 훅 시스템

DD는 이벤트 기반 훅 시스템을 제공하여 로그 라이프사이클의 핵심 시점에 커스텀 로직을 삽입할 수 있습니다.

## 훅 이벤트

| 상수 | String() | 트리거 시점 |
|------|----------|----------|
| `HookBeforeLog` | `"BeforeLog"` | 로그 기록 전 |
| `HookAfterLog` | `"AfterLog"` | 로그 기록 후 |
| `HookOnFilter` | `"OnFilter"` | 민감 데이터 필터링 시 |
| `HookOnRotate` | `"OnRotate"` | 파일 순환 시 |
| `HookOnClose` | `"OnClose"` | 로거 종료 시 |
| `HookOnError` | `"OnError"` | 오류 발생 시 |

## HookRegistry

훅 레지스트리로, 모든 훅의 등록과 트리거를 관리합니다. 스레드 안전.

### 생성

```go
// 빈 레지스트리
reg := dd.NewHookRegistry()

// 설정에서 생성
reg := dd.NewHooksFromConfig(hooksConfig)
```

### 메서드

| 메서드 | 서명 | 설명 |
|------|------|------|
| `Add` | `(event HookEvent, hook Hook)` | 훅 등록 |
| `Remove` | `(event HookEvent)` | 이벤트의 모든 훅 제거 |
| `Trigger` | `(ctx, event, hookCtx) error` | 이벤트의 모든 훅 트리거 |
| `Clear` | `()` | 모든 훅 제거 |
| `ClearFor` | `(event HookEvent)` | 지정된 이벤트의 훅 제거 |
| `SetErrorHandler` | `(handler HookErrorHandler)` | 오류 핸들러 설정 |

### 훅 등록

```go
reg := dd.NewHookRegistry()

// BeforeLog 훅
reg.Add(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    fmt.Println("로그 기록 예정:", hc.Message)
    return nil
})

// AfterLog 훅
reg.Add(dd.HookAfterLog, func(ctx context.Context, hc *dd.HookContext) error {
    metrics.LogCount.Inc()
    return nil
})

// OnRotate 훅
reg.Add(dd.HookOnRotate, func(ctx context.Context, hc *dd.HookContext) error {
    dd.InfoWith("파일 순환 완료",
        dd.String("new_file", hc.Message),
    )
    return nil
})
```

### Logger를 통해 관리

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
    Fields         []Field        // 구조화된 필드 (필터링 후)
    OriginalFields []Field        // 원본 필드 (필터링 전)
    Error          error          // 오류 정보 (OnError 이벤트)
    Timestamp      time.Time      // 이벤트 시간
    Writer         io.Writer      // 대상 Writer (쓰기 관련 이벤트)
    Metadata       map[string]any // 추가 메타데이터
}
```

## HooksConfig

구조화된 훅 설정으로, 일괄 훅 등록에 권장됩니다.

```go
type HooksConfig struct {
    BeforeLog    []Hook              // 로그 기록 전 훅
    AfterLog     []Hook              // 로그 기록 후 훅
    OnFilter     []Hook              // 민감 데이터 필터링 시 훅
    OnRotate     []Hook              // 파일 순환 시 훅
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

## 전체 예시

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

- [Logger](./logger) -- AddHook / SetHooks 메서드
- [설정](./config) -- HooksConfig 설정
- [인터페이스 정의](./interfaces) -- Hook 타입 정의
