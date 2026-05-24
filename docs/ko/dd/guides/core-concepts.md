---
title: "핵심 개념 - CyberGo DD | 아키텍처와 설계 철학"
description: "CyberGo DD 로그 라이브러리의 핵심 아키텍처와 설계 철학을 깊이 있게 이해하기. Logger와 LoggerEntry의 관계와 라이프사이클, 구조화된 필드 Field의 타입 안전 사용 패턴, 로그 처리 파이프라인의 전체 처리 흐름, 4계층 점진적 인터페이스 설계 및 스레드 안전 동시성 모델을 다루어 개발자가 DD 라이브러리에 대한 체계적인 이해를 구축할 수 있도록 돕습니다."
---

# 핵심 개념

DD의 핵심 개념을 이해하는 것은 이 라이브러리를 효율적으로 사용하는 기초입니다. 이 장에서는 Logger 체계, 필드 시스템, 처리 파이프라인, 인터페이스 계층을 소개합니다.

## Logger 체계

DD의 로그 기록은 세 가지 핵심 타입을 중심으로 전개됩니다:

```text
Logger (로거)
  │
  ├── 직접 사용 → logger.Info("message")
  │
  └── WithFields() → LoggerEntry (사전 설정 필드가 있는 Entry)
                        │
                        └── entry.Info("message")  // 사전 설정 필드 자동 포함
```

### Logger

`Logger`는 핵심 로거로, `dd.New()`로 생성합니다:

```go
logger, _ := dd.New(dd.DefaultConfig())
defer logger.Close()

logger.Info("서비스 시작")
logger.InfoWith("요청 처리",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)
```

각 Logger는 독립적인 설정, 출력 대상, 보안 필터, 라이프사이클을 가지며, 서로 다른 모듈 간에 안전하게 공유할 수 있습니다.

### LoggerEntry

`LoggerEntry`는 `WithFields()`로 생성되며, 변경 불가능한 사전 설정 필드 컨테이너입니다:

```go
// 사전 설정 필드가 있는 Entry 생성
requestLog := logger.WithFields(
    dd.String("service", "user-api"),
    dd.String("version", "2.1.0"),
)

// 매번 호출 시 사전 설정 필드 자동 포함
requestLog.Info("서비스 시작")
// 출력: ... 서비스 시작 service=user-api version=2.1.0

requestLog.InfoWith("사용자 로그인",
    dd.String("user", "alice"),
)
// 출력: ... 사용자 로그인 service=user-api version=2.1.0 user=alice
```

:::tip 불변 설계
`WithFields()`를 호출할 때마다 새로운 `LoggerEntry`가 생성되며, 기존 Entry는 영향을 받지 않습니다. 즉, 서로 다른 goroutine에서 동일한 Entry를 안전하게 재사용할 수 있습니다.
:::

### 전역 로거

DD는 간단한 시나리오나 빠른 프로토타이핑에 적합한 전역 로거를 제공합니다:

```go
// 패키지 수준 함수로 직접 사용 (전역 Logger를 통해)
dd.Info("전역 로그")

// 다음과 동일
dd.Default().Info("전역 로그")
```

## 필드 시스템

### Field 타입

`Field`는 구조화된 로그의 기본 단위로, 키-값 쌍으로 구성됩니다:

```go
// 필드 생성자는 모든 일반 타입을 지원
dd.String("method", "GET")           // 문자열
dd.Int("status", 200)                // 정수
dd.Float64("latency", 0.123)         // 실수
dd.Bool("success", true)             // 불리언
dd.Duration("elapsed", 150*time.Millisecond) // 기간
dd.Time("timestamp", time.Now())     // 타임스탬프
dd.Err(err)                          // 오류 (key는 "error"로 고정)
dd.ErrWithKey("db_error", err)       // 오류 (커스텀 key)
dd.Any("data", payload)              // 임의 타입
```

### 필드 체인 전달

필드는 Logger, Entry 간에 계층적으로 전달될 수 있습니다:

```go
// 1계층: 서비스 수준 필드
serviceLog := logger.WithFields(
    dd.String("service", "api-gateway"),
)

// 2계층: 요청 수준 필드 (서비스 수준에 추가)
requestLog := serviceLog.WithFields(
    dd.String("request_id", "req-001"),
    dd.String("path", "/api/users"),
)

// 3계층: 실제 로그 (필드 추가)
requestLog.InfoWith("처리 완료",
    dd.Int("status", 200),
    dd.Duration("elapsed", 50*time.Millisecond),
)
// 출력 포함: service=api-gateway request_id=req-001 path=/api/users status=200 elapsed=50ms
```

## 로그 처리 파이프라인

각 로그는 다음 처리 흐름을 거칩니다:

```text
사용자 호출 logger.InfoWith("msg", fields...)
       │
       ▼
  ① 레벨 확인 ─── 레벨 미활성화 → 바로 반환 (제로 오버헤드)
       │
       ▼
  ② 보안 필터링 ─── 메시지와 필드의 민감 데이터 → [REDACTED]
       │
       ▼
  ③ 컨텍스트 추출 ── 등록된 추출기에서 TraceID/SpanID 등 추출
       │
       ▼
  ④ BeforeLog 훅
       │
       ▼
  ⑤ 포맷팅 ──── 텍스트 형식 또는 JSON 형식
       │
       ▼
  ⑥ 보안 크기 제한 ─── Security.MaxMessageSize 초과 시 잘라냄 (0은 제한 없음)
       │
       ▼
  ⑦ 쓰기 ────── 하나 이상의 Writer에 출력
       │
       ▼
  ⑧ AfterLog 훅
       │
       ▼
  ⑨ Fatal 처리 ── LevelFatal만, os.Exit 또는 커스텀 FatalHandler 호출
```

:::info 성능 설계
레벨 확인 (단계 ①)은 원자적 연산을 사용하여 락이 필요 없으며 거의 제로 오버헤드입니다. 보안 필터링 (단계 ②)은 작은 입력은 동기적으로 처리하고, 큰 입력은 별도 goroutine에서 타임아웃 보호와 함께 실행되어 메인 흐름을 차단하지 않습니다.
:::

## 인터페이스 계층

DD는 정확한 의존성 주입을 지원하는 4개의 인터페이스를 정의합니다:

```text
CoreLogger                    ← 기본 로그: Debug/Info/Warn/Error/Fatal + WithFields
    │
    ├── LevelLogger           ← 레벨 관리: GetLevel/SetLevel/IsLevelEnabled (CoreLogger 포함)
    │
    └── ConfigurableLogger    ← 설정 관리: Writer/보안/컨텍스트/훅 (CoreLogger 포함)

LogProvider                   ← 전체 기능: 독립적 플랫 인터페이스, 모든 메서드 포함
```

```go
// 기본 로그만 필요? CoreLogger 주입
type Service struct {
    log dd.CoreLogger
}

// 동적으로 레벨 조정 필요? LevelLogger 주입
type Handler struct {
    log dd.LevelLogger
}
```

:::tip 모범 사례
생성자에서 구체 타입이 아닌 최소 필수 인터페이스를 받으세요. 이렇게 하면 코드가 테스트하기 쉽고 유연해집니다.
:::

## 스레드 안전 모델

DD의 핵심 설계 원칙: **여러 goroutine에서 추가 동기화 없이 안전하게 사용 가능**.

| 컴포넌트 | 안전 메커니즘 |
|------|----------|
| Logger | 모든 메서드는 동시 호출에 안전 |
| LoggerEntry | 불변, 생성 후 읽기 전용 |
| Config | Clone() 메서드로 안전한 복사 |
| Writers | 원자적 포인터, 락 없는 읽기 |
| SensitiveDataFilter | 읽기/쓰기 분리, 별도 goroutine |
| HookRegistry | 뮤텍스로 등록 보호, 원자적 읽기로 실행 |

```go
// 안전: 여러 goroutine이 동일한 Logger 공유
var logger *dd.Logger  // 한 번 초기화

func handleRequest(w http.ResponseWriter, r *http.Request) {
    // 안전: 동시 호출
    logger.InfoWith("요청 도착",
        dd.String("path", r.URL.Path),
        dd.String("method", r.Method),
    )
}
```

## 출력 대상 체계

DD는 3가지 출력 대상을 지원하며, 자유롭게 조합할 수 있습니다:

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),                    // 콘솔
        dd.FileOutput("logs/app.log"),         // 파일 (자동 순환)
        dd.CustomOutput(customWriter),         // 커스텀 io.Writer
    },
})
```

내장 Writer 컴포넌트:

| 컴포넌트 | 용도 |
|------|------|
| `FileWriter` | 파일 쓰기 + 크기/시간 순환 + 압축 |
| `BufferedWriter` | 버퍼 쓰기, I/O 횟수 감소 |
| `MultiWriter` | 다중 대상 분배, 여러 Writer에 기록 |

## 다음 단계

- [구조화된 로그](./structured-logging) -- 필드 사용 상세 가이드
- [파일 출력과 순환](./file-output) -- 파일 로그 설정
- [민감 데이터 필터링](./sensitive-filtering) -- 보안 필터링 실전
- [API 레퍼런스](../api-reference/) -- 전체 API 문서
