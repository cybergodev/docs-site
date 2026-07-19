---
sidebar_label: "컨텍스트 통합"
title: "컨텍스트 통합 - CyberGo DD | Context 통합"
description: "CyberGo DD 컨텍스트 통합 API입니다. WithTraceID/WithSpanID/WithRequestID으로 추적 식별자를 주입하고, ContextKey 타입 안전 키와 ContextExtractor 함수 타입으로 필드를 자동 추출하여 OpenTelemetry 등 분산 추적 프레임워크와의 통합을 지원합니다."
sidebar_position: 2
---

# 컨텍스트 통합

DD는 Go 표준 라이브러리 `context.Context` 통합을 지원하여 추적 정보 전파와 컨텍스트 필드 추출을 자동화할 수 있습니다.

## ContextKey 타입

`ContextKey`는 `string` 기반의 사용자 정의 키 타입으로, 다른 패키지의 context 키 충돌을 피합니다.

```go
type ContextKey string
```

세 개의 미리 정의된 키 상수가 있으며, 각각 TraceID / SpanID / RequestID에 대응합니다.

| 상수 | 타입 | 값 |
|------|------|----|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## 주입과 읽기

| 함수 | 시그니처 | 설명 |
|------|------|------|
| `WithTraceID` | `(ctx context.Context, traceID string) context.Context` | TraceID 주입 |
| `WithSpanID` | `(ctx context.Context, spanID string) context.Context` | SpanID 주입 |
| `WithRequestID` | `(ctx context.Context, requestID string) context.Context` | RequestID 주입 |
| `GetTraceID` | `(ctx context.Context) string` | TraceID 읽기(누락 시 `""` 반환) |
| `GetSpanID` | `(ctx context.Context) string` | SpanID 읽기(누락 시 `""` 반환) |
| `GetRequestID` | `(ctx context.Context) string` | RequestID 읽기(누락 시 `""` 반환) |

`With*` 함수는 `context.WithValue`를 기반으로 새 ctx를 파생(키는 해당 `ContextKey` 상수)하며, `Get*` 함수는 ctx에서 string 값을 가져옵니다. 키가 없거나 값이 string이 아닌 경우 통일되게 빈 문자열을 반환합니다.

### 사용 예

<!-- check-code: skip -->
```go
func handleRequest(ctx context.Context) {
    // 추적 정보 주입
    ctx = dd.WithTraceID(ctx, "trace-abc123")
    ctx = dd.WithSpanID(ctx, "span-def456")
    ctx = dd.WithRequestID(ctx, "req-789")

    // 수동으로 컨텍스트 필드를 추출해 로그에 전달
    logger.InfoWith("요청 처리",
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("span_id", dd.GetSpanID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    )
}
```

:::tip 팁 일괄 추출
수동 `Get*`는 일회성 시나리오에 적합합니다. 매 로그에 **전역/정적** 필드(예: 서비스명, 호스트명)를 자동으로 포함하려면 아래 `ContextExtractor`를 Logger에 등록하면 되며, 추출기는 매 `*With` 호출 시 실행됩니다. 주의: 추출기가 받는 것은 `context.Background()`로, **요청 스코프의 TraceID를 자동으로 가져올 수 없습니다**(아래 제한 참조).
:::

## ContextExtractor

`ContextExtractor`는 `context.Context`에서 필드를 자동 추출하는 함수 타입으로, OpenTelemetry, Jaeger 등 추적 프레임워크와의 연동에 편리합니다.

```go
type ContextExtractor func(ctx context.Context) []Field
```

추출기는 Logger 내부가 스레드 안전한 레지스트리(`contextExtractorRegistry`, **비공개, 외부 노출 안 함**)로 유지합니다: 추가 순서대로 실행, 읽기는 `atomic.Pointer` 락프리 빠른 경로; 추출기 중 하나가 panic을 일으키면 recover되어 stderr에 기록되며 애플리케이션을 다운시키지 않습니다.

### 추출기 등록

추출기 자체는 이 파일에서 타입만 정의하며, 등록/관리 API는 Logger에 있습니다(core 도메인):

<!-- check-code: skip -->
```go
// 추출기 하나 추가(오류 반환, nil 추출기는 거부됨)
err := logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    }
})

// 모든 추출기 일괄 교체
_ = logger.SetContextExtractors(extractor1, extractor2)

// 현재 등록된 추출기 스냅샷 읽기
extractors := logger.GetContextExtractors()
```

:::warning 경고 컨텍스트 제한(중요)
로그 메서드(`Info`/`InfoWith` 등)는 `context.Context` 매개변수를 받지 않으며, `ContextExtractor` 내부적으로 `context.Background()`로 호출되므로 **요청 스코프에서 TraceID/SpanID를 자동으로 추출할 수 없습니다**. 아래 OTel 예제는 글로벌 span이 존재할 때만 필드를 생성하며, 매 요청마다 추적 ID를 추가하려면 `WithFields()`로 수동 전달하세요([분산 추적 통합](../../guides/context-tracing) 참조).
:::

### OpenTelemetry 예제

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

## 전체 예

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
- [구조화 필드](./fields) -- `Field` 생성자와 필드 검증
- [설정](../core/config) -- `Config.ContextExtractors`
