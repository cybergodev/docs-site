---
title: "분산 추적 통합 - CyberGo DD | Context와 추적 가이드"
description: "CyberGo DD 분산 추적 통합 가이드. TraceID, SpanID, RequestID 컨텍스트 전파, ContextExtractor 커스텀 추출기, HTTP 미들웨어 통합 패턴, 요청 범위 로그 및 OpenTelemetry 등 추적 시스템과의 통합 방식을 다루어 개발자가 마이크로서비스 아키텍처에서 엔드투엔드 로그 추적을 구현할 수 있도록 돕습니다."
---

# 분산 추적 통합

DD는 `context.Context`를 통해 추적 식별자(TraceID, SpanID, RequestID)를 자동으로 전파하여 마이크로서비스 아키텍처에서 엔드투엔드 로그 연관을 구현합니다.

## 컨텍스트 키

DD는 3가지 컨텍스트 키를 사전 정의합니다:

| 키 | 설명 | 용도 |
|-----|------|------|
| `ContextKeyTraceID` | 추적 ID | 서비스 간 추적, 전체 요청 체인 연관 |
| `ContextKeySpanID` | Span ID | 서비스 내 작업 추적 |
| `ContextKeyRequestID` | 요청 ID | 단일 요청의 고유 식별자 |

## 기본 사용법

### 설정 및 가져오기

```go
ctx := context.Background()

// 추적 식별자 설정
ctx = dd.WithTraceID(ctx, "trace-abc123")
ctx = dd.WithSpanID(ctx, "span-def456")
ctx = dd.WithRequestID(ctx, "req-789")

// 추적 식별자 가져오기
traceID := dd.GetTraceID(ctx)    // "trace-abc123"
spanID := dd.GetSpanID(ctx)      // "span-def456"
requestID := dd.GetRequestID(ctx) // "req-789"
```

### 로그에 자동 추출

:::warning 현재 제한 사항
DD의 로그 메서드(`Info`, `InfoWith` 등)는 `context.Context` 매개변수를 직접 받지 않습니다. 컨텍스트 추출기는 내부적으로 `context.Background()`를 사용하여 호출되므로 요청 범위의 context에서 TraceID 등의 값을 직접 가져올 수 없습니다. 수동으로 필드를 전달하는 방식을 권장합니다 (아래 HTTP 미들웨어 통합 참조).
:::

```go
// 컨텍스트 추출기는 설정에 사전 설정된 정적 컨텍스트 필드에 사용됩니다
// 참고: 로그 메서드가 context를 받지 않으므로 추출기의 GetTraceID 등 함수는
// 요청 범위의 context 값을 가져올 수 없습니다

// 권장 방식: WithFields를 사용하여 추적 필드를 수동으로 전달
reqLog := logger.WithFields(
    dd.String("trace_id", traceID),
    dd.String("request_id", requestID),
)
reqLog.Info("요청 처리")
```

## HTTP 미들웨어 통합

### 기본 추적 미들웨어

```go
func TracingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // 요청 헤더에서 추적 식별자 추출 또는 생성
            traceID := r.Header.Get("X-Trace-ID")
            if traceID == "" {
                traceID = uuid.New().String()
            }

            requestID := r.Header.Get("X-Request-ID")
            if requestID == "" {
                requestID = uuid.New().String()
            }

            // context에 주입
            ctx := r.Context()
            ctx = dd.WithTraceID(ctx, traceID)
            ctx = dd.WithRequestID(ctx, requestID)

            // 요청 범위의 로그 Entry 생성
            reqLog := logger.WithFields(
                dd.String("trace_id", traceID),
                dd.String("request_id", requestID),
            )

            // Logger를 핸들러에 전달 (커스텀 타입 키를 사용하여 충돌 방지)
            type ctxKey struct{}
            ctx = context.WithValue(ctx, ctxKey{}, reqLog)
            next.ServeHTTP(w, r.WithContext(ctx))

            reqLog.InfoWith("요청 완료",
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
            )
        })
    }
}
```

### 전체 요청 추적 예시

```go
package main

import (
    "context"
    "net/http"

    "github.com/cybergodev/dd"
)

type Handler struct {
    log *dd.LoggerEntry
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // context에서 추적 정보 가져오기
    traceID := dd.GetTraceID(ctx)
    reqID := dd.GetRequestID(ctx)

    h.log.InfoWith("사용자 조회",
        dd.String("trace_id", traceID),
        dd.String("request_id", reqID),
        dd.String("user_id", r.PathValue("id")),
    )

    // 비즈니스 로직...

    h.log.InfoWith("조회 완료",
        dd.String("trace_id", traceID),
        dd.Int("status", 200),
    )
}
```

## ContextExtractor 커스텀 추출기

`ContextExtractor`를 사용하여 context에서 필드를 추출할 수 있습니다. 참고: 로그 메서드는 context 매개변수를 받지 않으므로 추출기는 내부적으로 `context.Background()`로 호출되며, 다음 시나리오에 적합합니다:

- 글로벌 context 또는 goroutine-local 저장소에서 정적 필드 추출
- HTTP 미들웨어와 결합하여 추적 필드를 수동으로 `WithFields`에 전달

### 커스텀 추출기 예시

```go
// 커스텀 추출기: 모든 로그에 정적/글로벌 메타데이터 추가
func tenantExtractor(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("service", "order-service"),
        dd.String("env", os.Getenv("APP_ENV")),
    }
}

// 추출기 등록
logger.AddContextExtractor(tenantExtractor)
```

:::warning 컨텍스트 제한
`ContextExtractor` 함수는 요청 범위의 context가 아닌 `context.Background()`를 받습니다. 요청마다 추적 ID를 추가하려면 위의 `WithFields()` 패턴을 사용하여 요청 범위의 `LoggerEntry`를 생성하세요.
:::

### 여러 추출기 조합

```go
// 서로 다른 글로벌 메타데이터를 수집하기 위해 여러 추출기 등록
logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("hostname", getHostname()),
        dd.String("version", buildVersion),
    }
})

logger.AddContextExtractor(tenantExtractor)
```

## 마이크로서비스 간 전파

마이크로서비스 호출에서 추적 식별자는 HTTP 헤더를 통해 전파됩니다:

```go
// 발신 측: 추적 식별자를 요청 헤더에 주입
func callUpstream(ctx context.Context, url string) (*http.Response, error) {
    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)

    // 추적 식별자 전파
    if traceID := dd.GetTraceID(ctx); traceID != "" {
        req.Header.Set("X-Trace-ID", traceID)
    }
    if reqID := dd.GetRequestID(ctx); reqID != "" {
        req.Header.Set("X-Request-ID", reqID)
    }

    return http.DefaultClient.Do(req)
}
```

## 요청 범위 로그 패턴

```go
type RequestLogger struct {
    log    *dd.LoggerEntry
    ctx    context.Context
    start  time.Time
}

func NewRequestLogger(logger *dd.Logger, r *http.Request) *RequestLogger {
    ctx := r.Context()
    ctx = dd.WithTraceID(ctx, r.Header.Get("X-Trace-ID"))
    ctx = dd.WithRequestID(ctx, r.Header.Get("X-Request-ID"))

    return &RequestLogger{
        log: logger.WithFields(
            dd.String("trace_id", dd.GetTraceID(ctx)),
            dd.String("request_id", dd.GetRequestID(ctx)),
            dd.String("method", r.Method),
            dd.String("path", r.URL.Path),
        ),
        ctx:   ctx,
        start: time.Now(),
    }
}

func (rl *RequestLogger) Info(msg string, fields ...dd.Field) {
    rl.log.InfoWith(msg, fields...)
}

func (rl *RequestLogger) Finish(status int) {
    rl.log.InfoWith("요청 완료",
        dd.Int("status", status),
        dd.Duration("elapsed", time.Since(rl.start)),
    )
}
```

## 다음 단계

- [훅 시스템](./hooks) -- 라이프사이클 훅 확장
- [감사 로그](./audit-logging) -- 보안 감사
- [API 레퍼런스 - Context](../api-reference/context) -- Context 전체 API
- [웹 서비스 예제](../examples/web-service) -- 전체 웹 서비스 예제
