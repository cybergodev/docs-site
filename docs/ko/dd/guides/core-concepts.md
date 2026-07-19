---
sidebar_label: "핵심 개념"
title: "핵심 개념 - CyberGo DD | 아키텍처와 설계 철학"
description: "CyberGo DD 로그 라이브러리의 핵심 아키텍처와 설계 철학을 깊이 이해합니다. Logger와 LoggerEntry의 관계와 라이프사이클, 구조화 필드 Field의 타입 안전 사용 패턴, 로그 처리 파이프라인의 완전한 처리 흐름, 4계층 점진적 인터페이스 설계, 스레드 안전 동시성 모델을 다루어 개발자가 DD 라이브러리에 대한 체계적인 이해를 구축하도록 돕습니다."
sidebar_position: 1
---

# 핵심 개념

DD의 핵심 개념을 이해하는 것은 이 라이브러리를 효율적으로 사용하는 기초입니다. 이 장에서는 Logger 체계, 필드 시스템, 처리 파이프라인, 인터페이스 계층을 소개합니다.

## Logger 체계

DD의 로깅은 세 가지 핵심 타입을 중심으로 전개됩니다.

```text
Logger(로거)
  │
  ├── 직접 사용 → logger.Info("message")
  │
  └── WithFields() → LoggerEntry(사전 설정 필드를 가진 Entry)
                        │
                        └── entry.Info("message")  // 자동으로 사전 설정 필드 포함
```

### Logger

`Logger`는 핵심 로거로, `dd.New()`로 생성합니다.

```go
logger, err := dd.New(dd.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

logger.Info("서비스 시작")
logger.InfoWith("요청 처리",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)
```

각 Logger는 독립적인 구성, 출력 대상, 보안 필터, 라이프사이클을 가지며, 서로 다른 모듈 간에 안전하게 공유할 수 있습니다.

### LoggerEntry

`LoggerEntry`는 `WithFields()`로 생성되는 불변의 사전 설정 필드 컨테이너입니다.

```go
// 사전 설정 필드를 가진 Entry 생성
requestLog := logger.WithFields(
    dd.String("service", "user-api"),
    dd.String("version", "2.1.0"),
)

// 매 호출마다 사전 설정 필드 자동 포함
requestLog.Info("서비스 시작")
// 출력: ... 서비스 시작 service=user-api version=2.1.0

requestLog.InfoWith("사용자 로그인",
    dd.String("user", "alice"),
)
// 출력: ... 사용자 로그인 service=user-api version=2.1.0 user=alice
```

:::tip 팁 불변 설계
`WithFields()` 호출마다 새로운 `LoggerEntry`를 생성하며, 기존 Entry는 영향을 받지 않습니다. 즉, 서로 다른 goroutine에서 동일한 Entry를 안전하게 재사용할 수 있습니다.
:::

### 전역 로거

DD는 전역 로거를 제공하여 단순한 시나리오나 빠른 프로토타입에 적합합니다.

```go
// 패키지 수준 함수 직접 사용(전역 Logger 경유)
dd.Info("전역 로그")

// 동등한 표현
dd.Default().Info("전역 로그")
```

## 필드 시스템

### Field 타입

`Field`는 구조화 로그의 기본 단위로, 키-값 쌍으로 구성됩니다.

```go
// 필드 생성자는 모든 일반 타입을 다룸
dd.String("method", "GET")           // 문자열
dd.Int("status", 200)                // 정수
dd.Float64("latency", 0.123)         // 부동소수점
dd.Bool("success", true)             // 불리언
dd.Duration("elapsed", 150*time.Millisecond) // 기간
dd.Time("timestamp", time.Now())     // 타임스탬프
dd.Err(err)                          // 오류(key는 "error"로 고정)
dd.ErrWithKey("db_error", err)       // 오류(커스텀 key)
dd.Any("data", payload)              // 임의 타입
```

### 필드 체인 전달

필드는 Logger와 Entry 사이에서 계층적으로 전달될 수 있습니다.

```go
// 1계층: 서비스 수준 필드
serviceLog := logger.WithFields(
    dd.String("service", "api-gateway"),
)

// 2계층: 요청 수준 필드(서비스 수준에 추가)
requestLog := serviceLog.WithFields(
    dd.String("request_id", "req-001"),
    dd.String("path", "/api/users"),
)

// 3계층: 실제 로그(필드를 또 추가)
requestLog.InfoWith("처리 완료",
    dd.Int("status", 200),
    dd.Duration("elapsed", 50*time.Millisecond),
)
// 출력 포함: service=api-gateway request_id=req-001 path=/api/users status=200 elapsed=50ms
```

## 로그 처리 파이프라인

매 로그는 다음 처리 흐름을 거칩니다.

```text
사용자 호출 logger.InfoWith("msg", fields...)
       │
       ▼
  ① 레벨 검사 ─── 레벨 미활성화 → 직접 반환(제로 오버헤드)
       │
       ▼
  ② 보안 필터 ─── 메시지와 필드의 민감 데이터 → [REDACTED]
       │
       ▼
  ③ 컨텍스트 추출 ── 등록된 추출기 호출로 정적/글로벌 필드 추가(context.Background()로 호출되어 요청 스코프의 TraceID는 읽을 수 없음)
       │
       ▼
  ④ BeforeLog 훅
       │
       ▼
  ⑤ 포맷팅 ──── 텍스트 형식 또는 JSON 형식
       │
       ▼
  ⑥ 보안 크기 제한 ─── Security.MaxMessageSize 초과 시 절단(0은 제한 없음)
       │
       ▼
  ⑦ 쓰기 ────── 하나 이상의 Writer로 출력
       │
       ▼
  ⑧ AfterLog 훅
       │
       ▼
  ⑨ Fatal 처리 ── LevelFatal 전용: 먼저 Logger를 비동기로 Close(최대 5s 대기, OnClose 훅 트리거 및 writer flush), 이어서 os.Exit(1) 또는 커스텀 FatalHandler 호출
```

:::info 정보 성능 설계
레벨 검사(단계 ①)는 원자 연산을 사용하여 락 없이 거의 제로 오버헤드입니다. 보안 필터(단계 ②)는 타임아웃 보호를 통해 메인 흐름의 장기 차단을 방지합니다(대용량 입력은 goroutine + 타임아웃으로 최악의 경우 약 50ms 내에 반환 보장). Fatal 처리(단계 ⑨)는 Logger의 Close(flush 및 OnClose 훅 포함)를 비동기로 트리거하며 최대 5s 대기합니다. 사용자 main의 defer는 여전히 실행되지 않지만, Logger 자체의 Close는 호출됩니다.
:::

## 인터페이스 계층

DD는 정밀한 의존성 주입을 지원하기 위해 4개의 인터페이스를 정의합니다.

```text
CoreLogger                    ← 기본 로그: Debug/Info/Warn/Error/Fatal + WithFields
    │
    ├── LevelLogger           ← 레벨 관리: GetLevel/SetLevel/IsLevelEnabled(CoreLogger 임베드)
    │
    └── ConfigurableLogger    ← 구성 관리: Writer/보안/컨텍스트/훅(CoreLogger 임베드)

LogProvider                   ← 전체 기능: 독립된 평면 인터페이스, 모든 메서드 포함
```

```go
// 기본 로그만 필요? CoreLogger 주입
type Service struct {
    log dd.CoreLogger
}

// 동적으로 레벨을 조정해야 하나요? LevelLogger 주입
type Handler struct {
    log dd.LevelLogger
}
```

:::tip 팁 모범 사례
생성자에서 구체 타입이 아닌 최소한의 필수 인터페이스를 수용하세요. 이렇게 하면 코드가 더 테스트하기 쉽고 유연해집니다.
:::

## 스레드 안전 모델

DD의 핵심 설계 원칙: **여러 goroutine에서 안전하게 사용 가능, 추가 동기화 불필요**.

| 컴포넌트 | 안전 메커니즘 |
|------|----------|
| Logger | 모든 메서드를 동시에 안전하게 호출 가능 |
| LoggerEntry | 불변, 생성 후 읽기 전용 |
| Config | Clone() 메서드로 안전한 복사 |
| Writers | 원자 포인터, 락프리 읽기 |
| SensitiveDataFilter | 읽기/쓰기 분리, 독립 goroutine |
| HookRegistry | RWMutex로 등록과 읽기 보호(Logger는 `atomic.Value`로 해당 포인터를 보유) |

```go
// 안전: 여러 goroutine이 동일한 Logger 공유
var logger *dd.Logger  // 한 번만 초기화

func handleRequest(w http.ResponseWriter, r *http.Request) {
    // 안전: 동시 호출
    logger.InfoWith("요청 도착",
        dd.String("path", r.URL.Path),
        dd.String("method", r.Method),
    )
}
```

## 출력 대상 체계

DD는 세 가지 출력 대상을 지원하며, 임의로 조합할 수 있습니다.

```go
logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),                    // 콘솔
        dd.FileOutput("logs/app.log"),         // 파일(자동 로테이션)
        dd.CustomOutput(customWriter),         // 커스텀 io.Writer
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

내장 Writer 컴포넌트:

| 컴포넌트 | 용도 |
|------|------|
| `FileWriter` | 파일 쓰기 + 크기/시간 로테이션 + 압축 |
| `BufferedWriter` | 버퍼 쓰기, I/O 횟수 감소 |
| `MultiWriter` | 다중 대상 분산, 여러 Writer에 쓰기 |

## 다음 단계

- [구조화 로그](./structured-logging) -- 필드 사용 상세
- [파일 출력과 로테이션](./file-output) -- 파일 로그 구성
- [민감 데이터 필터링](./sensitive-filtering) -- 보안 필터 실전
- [API 레퍼런스](../api-reference/) -- 완전한 API 문서
