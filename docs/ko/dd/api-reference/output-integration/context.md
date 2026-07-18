---
sidebar_label: "컨텍스트 통합"
title: "컨텍스트 통합 - CyberGo DD | Context 통합"
description: "CyberGo DD 컨텍스트 통합 API: WithTraceID/WithSpanID/WithRequestID로 추적 식별자를 주입하고, ContextKey 타입 안전 키와 ContextExtractor 함수 타입으로 필드를 자동 추출하여 OpenTelemetry 등 분산 추적 프레임워크와의 통합을 지원합니다."
sidebar_position: 2
---

# 컨텍스트 통합

DD는 Go 표준 라이브러리 `context.Context` 통합을 지원하여 추적 정보를 자동으로 전파하고 컨텍스트 필드를 추출할 수 있습니다.

## ContextKey 타입

`ContextKey`는 `string` 기반의 커스텀 키 타입으로, 다른 패키지의 context 키와 충돌을 피합니다.

```go
type ContextKey string
```

TraceID / SpanID / RequestID에 각각 대응하는 세 개의 키 상수가 미리 정의되어 있습니다:

| 상수 | 타입 | 값 |
|------|------|----|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## 주입과 읽기

| 함수 | 서명 | 설명 |
|------|------|------|
| `WithTraceID` | `(ctx context.Context, traceID string) context.Context` | TraceID 주입 |
| `WithSpanID` | `(ctx context.Context, spanID string) context.Context` | SpanID 주입 |
| `WithRequestID` | `(ctx context.Context, requestID string) context.Context` | RequestID 주입 |
| `GetTraceID` | `(ctx context.Context) string` | TraceID 읽기 (없으면 `""` 반환) |
| `GetSpanID` | `(ctx context.Context) string` | SpanID 읽기 (없으면 `""` 반환) |
| `GetRequestID` | `(ctx context.Context) string` | RequestID 읽기 (없으면 `""` 반환) |

`With*` 함수는 `context.WithValue`를 기반으로 새 ctx를 파생시키고(키는 해당 `ContextKey` 상수), `Get*` 함수는 ctx에서 string 값을 가져옵니다; 키가 존재하지 않거나 값이 string이 아닌 경우 통일되게 빈 문자열을 반환합니다.

### 사용 예시

<!-- check-code: skip -->
```go
func handleRequest(ctx context.Context) {
    // 추적 정보 주입
    ctx = dd.WithTraceID(ctx, "trace-abc123")
    ctx = dd.WithSpanID(ctx, "span-def456")
    ctx = dd.WithRequestID(ctx, "req-789")

    // 수동으로 컨텍스트 필드를 추출하여 로그에 전달
    logger.InfoWith("요청 처리",
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("span_id", dd.GetSpanID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    )
}
```

:::tip 일괄 추출
수동 `Get*`는 일회성 시나리오에 적합합니다. 매 로그에 추적 필드를 자동으로 포함하려면 아래 `ContextExtractor`를 Logger에 등록하세요. 추출기는 매 `*With` 호출 시 실행됩니다.
:::

## ContextExtractor

`ContextExtractor`는 `context.Context`에서 필드를 자동으로 추출하는 함수 타입으로, OpenTelemetry, Jaeger 등 추적 프레임워크와의 연동에 편리합니다.

```go
type ContextExtractor func(ctx context.Context) []Field
```

추출기는 Logger 내부에서 스레드 안전한 레지스트리(`contextExtractorRegistry`, **비공개로 외부에 노출되지 않음**)를 통해 관리됩니다: 추가 순서대로 실행되며, 읽기는 `atomic.Pointer`의 락프리 빠른 경로를 사용합니다; 어느 추출기에서 panic이 발생해도 recover되어 stderr에 기록되며 애플리케이션을 중단시키지 않습니다.

### 추출기 등록

추출기 타입 자체는 이 파일에만 정의되어 있습니다; 등록/관리 API는 Logger에 있습니다 (core 도메인):

<!-- check-code: skip -->
```go
// 추출기 추가 (error 반환, nil 추출기는 거부됨)
err := logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    }
})

// 전체 추출기 일괄 교체
_ = logger.SetContextExtractors(extractor1, extractor2)

// 현재 등록된 추출기 스냅샷 읽기
extractors := logger.GetContextExtractors()
```

### OpenTelemetry 예시

<!-- check-code: skip -->
```go
// OTel span의 trace_id / span_id를 매 로그에 주입
otelExtractor := dd.ContextExtractor(func(ctx context.Context) []dd.Field {
    span := trace.SpanFromContext(ctx)
    if !span.SpanContext().IsValid() {
        return nil
    }
    return []dd.Field{
        dd.String("trace_id", span.SpanContext().TraceID().String()),
        dd.String("span_id", span.SpanContext().SpanID().String()),
    }
})
_ = logger.AddContextExtractor(otelExtractor)
```

## 전체 예시

### HTTP 미들웨어

<!-- check-code: skip -->
```go
func tracingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        traceID := r.Header.Get("X-Trace-ID")
        if traceID == "" {
            traceID = generateTraceID()
        }
        ctx := dd.WithTraceID(r.Context(), traceID)
        ctx = dd.WithRequestID(ctx, generateRequestID())
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### gRPC 인터셉터

<!-- check-code: skip -->
```go
func loggingInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    md, _ := metadata.FromIncomingContext(ctx)
    ctx = dd.WithTraceID(ctx, md.Get("trace-id")[0])
    ctx = dd.WithRequestID(ctx, md.Get("request-id")[0])

    dd.InfoWith("gRPC 요청",
        dd.String("method", info.FullMethod),
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    )
    return handler(ctx, req)
}
```

## 다음 단계

- [Logger](../core/logger) -- `AddContextExtractor` / `SetContextExtractors` / `GetContextExtractors`
- [구조화된 필드](./fields) -- `Field` 생성자와 필드 검증
- [설정](../core/config) -- `Config.ContextExtractors`
