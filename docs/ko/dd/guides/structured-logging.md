---
title: "구조화된 로그 - CyberGo DD | 필드와 체인 호출"
description: "CyberGo DD 구조화된 로그 사용 가이드. 20개 이상의 타입 안전한 필드 생성자, Field 체인 전달 패턴, LoggerEntry 불변 설계 원리, 필드 명명 규칙과 검증 규칙, 구조화된 로그의 모범 사례와 일반적인 사용 패턴을 상세히 소개하여 개발자가 프로젝트에서 고성능 구조화된 로그 기록 솔루션을 효과적으로 사용할 수 있도록 돕습니다."
---

# 구조화된 로그

구조화된 로그는 키-값 쌍 필드로 컨텍스트 정보를 기록하여 로그를 프로그램이 파싱, 검색, 분석할 수 있게 합니다. DD는 타입 안전한 필드 생성자와 유연한 체인 호출 메커니즘을 제공합니다.

## 필드 생성자

DD는 20개 이상의 타입 안전한 필드 생성자를 제공합니다:

### 기본 타입

```go
dd.InfoWith("사용자 등록",
    dd.String("username", "alice"),
    dd.Int("age", 25),
    dd.Float64("score", 98.5),
    dd.Bool("verified", true),
)
```

### 시간 관련

```go
dd.InfoWith("스케줄된 작업 실행",
    dd.Time("scheduled_at", time.Now()),
    dd.Duration("elapsed", 150*time.Millisecond),
)
```

### 정수 타입 계열

```go
dd.InfoWith("패킷 처리",
    dd.Int8("flags", 0x0F),
    dd.Int32("seq", 1001),
    dd.Int64("total_bytes", 1<<20),
    dd.Uint16("port", 8080),
    dd.Uint32("src_ip", 0xC0A80101),
)
```

### 오류 처리

```go
// 기본 key는 "error"
dd.ErrorWith("쿼리 실패", dd.Err(err))

// 커스텀 key
dd.ErrorWith("데이터베이스 오류", dd.ErrWithKey("db_error", dbErr))

// 스택 정보 포함
dd.ErrorWith("심각한 오류", dd.ErrWithStack(err))
```

### 임의 타입

```go
// 모든 타입, fmt.Sprintf로 포맷팅
dd.InfoWith("요청 페이로드", dd.Any("body", requestBody))
```

:::warning 성능 팁
`Any`는 리플렉션을 사용하여 타입이 명확한 생성자보다 성능이 낮습니다. 고빈도 경로에서는 구체적인 타입의 생성자를 우선 사용하세요.
:::

## 체인 호출

### Logger → Entry

```go
// 사전 설정 필드가 있는 Entry 생성
reqLog := logger.WithFields(
    dd.String("service", "api"),
    dd.String("version", "1.0"),
)

// Entry는 사전 설정 필드를 자동으로 포함
reqLog.Info("서비스 시작")
reqLog.Warn("메모리 사용량 높음")
reqLog.ErrorWith("요청 실패",
    dd.String("path", "/api/users"),
    dd.Err(err),
)
```

### Entry → Entry (다계층 중첩)

```go
// 서비스 수준
svcLog := logger.WithFields(dd.String("service", "order"))

// 모듈 수준 (서비스 수준 필드 상속)
dbLog := svcLog.WithFields(dd.String("module", "database"))

// 작업 수준 (모든 상위 필드 상속)
queryLog := dbLog.WithFields(dd.String("operation", "query"))

queryLog.InfoWith("쿼리 완료",
    dd.Int("rows", 42),
    dd.Duration("elapsed", 10*time.Millisecond),
)
// 필드: service=order module=database operation=query rows=42 elapsed=10ms
```

### 패키지 수준 함수 체인 호출

```go
dd.WithFields(
    dd.String("app", "myapp"),
    dd.String("env", "production"),
).Info("애플리케이션 시작")
```

## 필드 명명 규칙

DD는 필드 명명 규칙 설정을 지원하며, 개발 단계에서 자동 검사합니다:

### 내장 규칙

```go
// snake_case (권장, 가장 범용적)
cfg := dd.StrictSnakeCaseConfig()

// camelCase
cfg := dd.StrictCamelCaseConfig()

// 제한 없음 (기본값)
cfg := dd.DefaultFieldValidationConfig()
```

### 설정에서 활성화

```go
logger, _ := dd.New(dd.Config{
    FieldValidation: dd.StrictSnakeCaseConfig(),
})
```

활성화 후, 규칙에 맞지 않는 필드명은 로그에 경고가 표시됩니다:

```go
logger.InfoWith("테스트",
    dd.String("UserName", "alice"),   // PascalCase → 경고
    dd.String("user_name", "alice"),  // snake_case → 정상
)
```

## 일반적인 패턴

### HTTP 요청 로그

```go
func loggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()

            reqLog := logger.WithFields(
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
                dd.String("remote_addr", r.RemoteAddr),
                dd.String("user_agent", r.UserAgent()),
            )

            next.ServeHTTP(w, r)

            reqLog.InfoWith("요청 완료",
                dd.Duration("elapsed", time.Since(start)),
            )
        })
    }
}
```

### 서비스 계층화 로그

```go
type UserService struct {
    log *dd.LoggerEntry
}

func NewUserService(logger *dd.Logger) *UserService {
    return &UserService{
        log: logger.WithFields(dd.String("component", "user_service")),
    }
}

func (s *UserService) CreateUser(ctx context.Context, name string) error {
    s.log.InfoWith("사용자 생성",
        dd.String("name", name),
    )

    if err := s.validate(name); err != nil {
        s.log.ErrorWith("사용자 생성 실패",
            dd.String("name", name),
            dd.Err(err),
        )
        return err
    }

    return nil
}
```

### 조건부 로그 (불필요한 연산 방지)

```go
// 방법 1: 레벨 먼저 확인
if logger.IsDebugEnabled() {
    data := computeExpensiveDebugInfo()
    logger.DebugWith("디버그 데이터", dd.Any("data", data))
}

// 방법 2: WithFields의 지연 계산 특성 활용
reqLog := logger.WithFields(dd.String("request_id", reqID))
// WithFields는 필드만 생성하고, I/O 오버헤드를 발생시키지 않음
// 실제로 Info/Error 등의 메서드를 호출할 때만 로그가 기록됨
```

## 출력 형식

### 텍스트 형식 (기본값)

```text
[2026-04-16T21:16:48+08:00   INFO] main.go:13 요청 완료 method=GET status=200 elapsed=150ms
```

### JSON 형식

```go
logger, _ := dd.New(dd.JSONConfig())
logger.InfoWith("요청 완료",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)
```

```json
{"timestamp":"2026-04-16T21:16:48+08:00","level":"info","caller":"main.go:13","message":"요청 완료","fields":{"method":"GET","status":200}}
```

## 다음 단계

- [파일 출력과 순환](./file-output) -- 로그를 파일에 기록
- [민감 데이터 필터링](./sensitive-filtering) -- 민감 정보 자동 마스킹
- [API 레퍼런스 - 필드](../api-reference/fields) -- 모든 필드 생성자
- [API 레퍼런스 - LoggerEntry](../api-reference/entry) -- Entry 전체 메서드
