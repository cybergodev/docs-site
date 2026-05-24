---
title: "컨텍스트 통합 - CyberGo DD | Context 통합"
description: "CyberGo DD 컨텍스트 통합 전체 API 문서. TraceID, SpanID, RequestID 자동 전파와 추출을 지원하며, 커스텀 ContextExtractor 인터페이스 구현, Context 전파 설정 옵션 및 WithContext 바인딩 메서드를 제공하여 OpenTelemetry 등 분산 추적 시스템과의 원활한 통합을 구현합니다."
---

# 컨텍스트 통합

DD는 Go 표준 라이브러리 `context.Context` 통합을 지원하여 추적 정보를 자동으로 전파하고 컨텍스트 필드를 추출할 수 있습니다.

## 내장 컨텍스트 키

| 함수 | 서명 | 설명 |
|------|------|------|
| `WithTraceID` | `(ctx context.Context, traceID string) context.Context` | TraceID 추가 |
| `WithSpanID` | `(ctx context.Context, spanID string) context.Context` | SpanID 추가 |
| `WithRequestID` | `(ctx context.Context, requestID string) context.Context` | RequestID 추가 |
| `GetTraceID` | `(ctx context.Context) string` | TraceID 가져오기 |
| `GetSpanID` | `(ctx context.Context) string` | SpanID 가져오기 |
| `GetRequestID` | `(ctx context.Context) string` | RequestID 가져오기 |

### 사용 예시

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
`ContextExtractor`와 `Config.ContextExtractors`를 결합하여 자동 추출을 구현할 수 있습니다. 추출기는 매 로그 호출 시 실행됩니다. 자세한 내용은 아래 [ContextExtractor](#contextextractor) 장을 참조하세요.
:::

## ContextExtractor

컨텍스트 추출기는 `context.Context`에서 필드를 자동으로 추출하는 데 사용됩니다.

```go
type ContextExtractor func(ctx context.Context) []Field
```

### 추출기 등록

```go
// Logger 메서드를 통해
logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    }
})

// 일괄 교체
logger.SetContextExtractors(extractor1, extractor2)

// 현재 추출기 가져오기
extractors := logger.GetContextExtractors()
```

## 컨텍스트 키 상수

| 상수 | 타입 | 값 |
|------|------|----|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## 전체 예시

### HTTP 미들웨어

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

- [Logger](./logger) -- AddContextExtractor 메서드
- [인터페이스 정의](./interfaces) -- ContextExtractor 타입 정의
- [구조화된 필드](./fields) -- Field 생성자
