---
title: "미들웨어 - CyberGo HTTPC | 내장 미들웨어"
description: "HTTPC 미들웨어 API 레퍼런스: Chain 양파 모델 조합과 Recovery, Logging, RequestID, Timeout, Metrics, Audit 등 여덟 개 내장 미들웨어 및 감사 설정의 완전한 설명을 제공합니다."
---

# 미들웨어

HTTPC은 양파 모델 미들웨어 아키텍처를 채택하여, `MiddlewareFunc`로 요청 처리 로직을 래핑합니다.

```go
type MiddlewareFunc func(Handler) Handler
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

미들웨어는 `Config.Middleware.Middlewares`에서 설정하며, 순서대로 실행됩니다:

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.RecoveryMiddleware(),
            httpc.LoggingMiddleware(log.Printf),
            httpc.RequestIDMiddleware("X-Request-ID", nil),
        },
    },
})
```

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

여러 미들웨어를 단일 미들웨어로 조합합니다. 전달된 순서대로 실행되며, 마지막 미들웨어가 처리를 완료한 후 최종 Handler를 호출합니다.

```go
combined := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
)
```

## 내장 미들웨어

### RecoveryMiddleware

```go
func RecoveryMiddleware() MiddlewareFunc
```

panic 복구 미들웨어. 처리 체인의 panic을 포착하여 스택 정보가 포함된 error로 변환합니다.

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.RecoveryMiddleware(),
        },
    },
})
```

### LoggingMiddleware

```go
func LoggingMiddleware(log func(format string, args ...any)) MiddlewareFunc
```

요청 로그 미들웨어. 메서드, URL, 상태 코드와 소요 시간을 기록합니다. URL은 자동 마스킹됩니다(자격 증명 제거).

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.LoggingMiddleware(log.Printf),
        },
    },
})
// 출력 예: GET https://api.example.com/data -> 200 (125ms)
```

### RequestIDMiddleware

```go
func RequestIDMiddleware(headerName string, generator func() string) MiddlewareFunc
```

각 요청에 고유 ID를 추가합니다. 기본적으로 `crypto/rand`로 32자 16진수 ID를 생성합니다.

| 매개변수 | 설명 |
|-----------|------|
| `headerName` | 요청 헤더 이름, 예: `"X-Request-ID"` |
| `generator` | 커스텀 ID 생성 함수, `nil`이면 기본 암호학적 안전 생성기 사용 |

```go
// 기본 생성기 사용
middleware := httpc.RequestIDMiddleware("X-Request-ID", nil)

// 커스텀 생성기 사용
middleware := httpc.RequestIDMiddleware("X-Request-ID", func() string {
    return uuid.New().String()
})
```

:::tip
기본 생성기는 `crypto/rand`를 사용하여 예측 불가능한 ID를 생성하므로 보안 민감 시나리오에 적합합니다.
:::

### TimeoutMiddleware

```go
func TimeoutMiddleware(timeout time.Duration) MiddlewareFunc
```

미들웨어 레벨의 타임아웃 제어. 클라이언트 내장 타임아웃 전에 적용되며, 타임아웃 시 컨텍스트를 취소하고 오류를 반환합니다.

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.TimeoutMiddleware(10 * time.Second),
        },
    },
})
```

### HeaderMiddleware

```go
func HeaderMiddleware(headers map[string]string) MiddlewareFunc
```

모든 요청에 정적 요청 헤더를 추가합니다. 생성 시 헤더 보안 검증을 수행합니다(CRLF 주입 방지).

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.HeaderMiddleware(map[string]string{
                "X-API-Version": "v2",
                "X-Client":      "myapp/1.0",
            }),
        },
    },
})
```

### MetricsMiddleware

```go
func MetricsMiddleware(onMetrics func(method, url string, statusCode int, duration time.Duration, err error)) MiddlewareFunc
```

메트릭 수집 미들웨어. 매 요청 완료 후 콜백을 호출하여 메서드, URL, 상태 코드, 소요 시간과 오류 정보를 전달합니다.

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.MetricsMiddleware(func(method, url string, status int, d time.Duration, err error) {
                metrics.Record(method, status, d, err)
            }),
        },
    },
})
```

### AuditMiddleware

```go
func AuditMiddleware(onAudit func(event AuditEvent)) MiddlewareFunc
```

보안 감사 미들웨어로, 금융, 의료, 정부 등 컴플라이언스 시나리오에 적합합니다. 완전한 요청/응답 정보를 기록하며, URL은 자동 마스킹됩니다.

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.AuditMiddleware(func(event httpc.AuditEvent) {
                log.Printf("[AUDIT] %s %s -> %d (%v) user=%s ip=%s",
                    event.Method, event.URL, event.StatusCode,
                    event.Duration, event.UserID, event.SourceIP)
            }),
        },
    },
})
```

### AuditMiddlewareWithConfig

```go
func AuditMiddlewareWithConfig(onAudit func(event AuditEvent), config *AuditMiddlewareConfig) MiddlewareFunc
```

설정이 포함된 보안 감사 미들웨어입니다.

```go
config := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}

client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
                data, _ := json.Marshal(event)
                auditLog.Write(data)
            }, config),
        },
    },
})
```

## 감사 타입

### AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`              // 마스킹됨 (자격 증명 제거)
    StatusCode    int                 `json:"statusCode"`
    Duration      time.Duration       `json:"duration"`
    Attempts      int                 `json:"attempts"`
    Error         error               `json:"error,omitempty"`
    SourceIP      string              `json:"sourceIP,omitempty"`
    UserID        string              `json:"userID,omitempty"`
    RedirectChain []string            `json:"redirectChain,omitempty"`
    ReqHeaders    map[string][]string `json:"reqHeaders,omitempty"`
    RespHeaders   map[string][]string `json:"respHeaders,omitempty"`
}
```

보안 감사 이벤트입니다.

#### MarshalJSON

```go
func (e AuditEvent) MarshalJSON() ([]byte, error)
```

커스텀 JSON 직렬화로, 두 특수 필드를 처리합니다:

| 필드 | 변환 규칙 |
|------|-----------|
| `Duration` | `durationMs`(밀리초 정수) 추가, 원본 `duration` 필드(나노초) 유지 |
| `Error` | `error`(오류 메시지 문자열)로 변환, nil이면 생략 |

```go
event := httpc.AuditEvent{
    Method:    "GET",
    URL:       "https://api.example.com/data",
    Duration:  150 * time.Millisecond,
    StatusCode: 200,
}
data, _ := json.Marshal(event)
// {"timestamp":"...","method":"GET","url":"...","statusCode":200,"duration":150000000,"durationMs":150,"attempts":0}
```

### AuditMiddlewareConfig

```go
type AuditMiddlewareConfig struct {
    Format         string   // "text"(기본값) 또는 "json"
    IncludeHeaders bool     // 요청/응답 헤더 포함 여부
    MaskHeaders    []string // 마스킹할 헤더 이름
    SanitizeError  bool     // 오류 정보 마스킹 여부
}
```

| 필드 | 기본값 | 설명 |
|------|--------|------|
| Format | `"text"` | 출력 형식 |
| IncludeHeaders | `false` | 헤더 기록 여부 |
| MaskHeaders | `["Authorization", "Cookie", ...]` | 표준 민감 헤더 목록 |
| SanitizeError | `true` | 오류 정보를 `[sanitized]`로 대체 |

### DefaultAuditMiddlewareConfig

```go
func DefaultAuditMiddlewareConfig() *AuditMiddlewareConfig
```

기본 감사 설정을 반환합니다.

### 감사 컨텍스트 키

요청 컨텍스트로 감사 정보를 전달합니다:

```go
// 출처 IP 설정
ctx = context.WithValue(ctx, httpc.SourceIPKey, "192.168.1.1")

// 사용자 ID 설정
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")

result, err := client.Request(ctx, "GET", url)
```

| 상수 | 타입 | 설명 |
|------|------|------|
| `SourceIPKey` | `auditContextKey` | 출처 IP 컨텍스트 키 |
| `UserIDKey` | `auditContextKey` | 사용자 식별 컨텍스트 키 |

## 관련 항목

- [인터페이스 정의](./interfaces) - MiddlewareFunc, Handler 타입 정의
- [미들웨어 체인](../guides/middleware-chain) - 미들웨어 사용 가이드
- [상수와 타입](./constants) - AuditEvent, AuditMiddlewareConfig 타입
