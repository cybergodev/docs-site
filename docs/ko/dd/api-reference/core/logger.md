---
sidebar_label: "Logger"
title: "Logger - CyberGo DD | 핵심 로거"
description: "CyberGo DD Logger 핵심 로거 API입니다. 로그 출력 메서드(Info/Warn/Error/Fatal), 레벨 동적 관리, Writer 추가/제거/교체, 라이프사이클 제어(Close/Flush), 체인 필드 설정을 다루며 로그 라이브러리 스레드 안전 고성능의 핵심 진입 타입입니다."
sidebar_position: 2
---

# Logger

`Logger`는 DD의 핵심 타입으로, 스레드 안전한 로깅 기능을 제공합니다.

## 생성

```go
// New로 생성
logger, _ := dd.New(dd.DefaultConfig())
```

```go
// 커스텀 구성으로 생성
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
```

## 로그 메서드

### 기본 로그

| 메서드 | 설명 |
|------|------|
| `Debug(args ...any)` | Debug 레벨 로그 |
| `Info(args ...any)` | Info 레벨 로그 |
| `Warn(args ...any)` | Warn 레벨 로그 |
| `Error(args ...any)` | Error 레벨 로그 |
| `Fatal(args ...any)` | Fatal 레벨 로그(기본적으로 os.Exit(1) 호출, **defer는 실행되지 않음**; FatalHandler로 사용자 정의 가능) |
| `Log(level LogLevel, args ...any)` | 지정 레벨 로그 |

### 포맷팅 로그

| 메서드 | 설명 |
|------|------|
| `Debugf(format string, args ...any)` | 포맷팅 Debug |
| `Infof(format string, args ...any)` | 포맷팅 Info |
| `Warnf(format string, args ...any)` | 포맷팅 Warn |
| `Errorf(format string, args ...any)` | 포맷팅 Error |
| `Fatalf(format string, args ...any)` | 포맷팅 Fatal(기본적으로 os.Exit(1) 호출, **defer는 실행되지 않음**; FatalHandler로 사용자 정의 가능) |
| `Logf(level LogLevel, format string, args ...any)` | 지정 레벨 포맷팅 |

### 구조화 로그

| 메서드 | 설명 |
|------|------|
| `DebugWith(msg string, fields ...Field)` | 구조화 Debug |
| `InfoWith(msg string, fields ...Field)` | 구조화 Info |
| `WarnWith(msg string, fields ...Field)` | 구조화 Warn |
| `ErrorWith(msg string, fields ...Field)` | 구조화 Error |
| `FatalWith(msg string, fields ...Field)` | 구조화 Fatal(기본적으로 os.Exit(1) 호출, **defer는 실행되지 않음**; FatalHandler로 사용자 정의 가능) |
| `LogWith(level LogLevel, msg string, fields ...Field)` | 구조화 지정 레벨 |

```go
logger.InfoWith("요청 완료",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 100*time.Millisecond),
)
```

## 레벨 관리

```go
level := logger.GetLevel()                    // 현재 레벨 가져오기
_ = logger.SetLevel(dd.LevelDebug)            // 레벨 설정
enabled := logger.IsLevelEnabled(dd.LevelInfo)// 레벨 확인

// 바로 가기 확인
logger.IsDebugEnabled()
logger.IsInfoEnabled()
logger.IsWarnEnabled()
logger.IsErrorEnabled()
logger.IsFatalEnabled()

// 동적 레벨 리졸버
logger.SetLevelResolver(func(ctx context.Context) dd.LogLevel {
    if isDebug {
        return dd.LevelDebug
    }
    return dd.LevelInfo
})
resolver := logger.GetLevelResolver()
```

## 필드 체인

```go
// 사전 설정 필드, LoggerEntry 반환
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("version", 2),
)

// 단일 필드
entry := logger.WithField("env", "prod")
```

## 출력 대상 관리

```go
// Writer 추가
_ = logger.AddWriter(os.Stderr)

// Writer 제거
_ = logger.RemoveWriter(os.Stderr)

// Writer 수 가져오기
count := logger.WriterCount()

// 쓰기 오류 핸들러 설정
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    fmt.Fprintf(os.Stderr, "쓰기 실패: %v\n", err)
})
```

## 컨텍스트 통합

```go
// 컨텍스트 추출기 추가
_ = logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
    }
})

// 모든 추출기 교체
_ = logger.SetContextExtractors(extractor1, extractor2)

// 현재 추출기 가져오기
extractors := logger.GetContextExtractors()
```

## 훅 관리

```go
// 훅 등록
_ = logger.AddHook(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    // 로그 전 처리
    return nil
})

// 훅 레지스트리 교체
_ = logger.SetHooks(registry)

// 훅 레지스트리 가져오기
hooks := logger.GetHooks()
```

## 샘플링 제어

```go
// 샘플링 구성 설정
logger.SetSampling(&dd.SamplingConfig{
    // 샘플링 매개변수
})

// 샘플링 구성 가져오기
cfg := logger.GetSampling()
```

## 보안 구성

```go
// 보안 구성 설정
logger.SetSecurityConfig(dd.DefaultSecurityConfig())

// 보안 구성 가져오기
sec := logger.GetSecurityConfig()
```

## 필드 검증

```go
// 필드 검증 설정
logger.SetFieldValidation(dd.StrictSnakeCaseConfig())

// 검증 구성 가져오기
validation := logger.GetFieldValidation()
```

## 라이프사이클

```go
// 버퍼 flush
_ = logger.Flush()

// 로거 종료
_ = logger.Close()

// 우아한 종료(타임아웃 포함)
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
_ = logger.Shutdown(ctx)

// 종료 여부 확인
closed := logger.IsClosed()

// 필터 goroutine 완료 대기
ok := logger.WaitForFilterGoroutines(3 * time.Second)
active := logger.ActiveFilterGoroutines()
```

## 디버그 출력

| 메서드 | 설명 |
|------|------|
| `Print(args ...any)` | 구성된 Writer로 출력(LevelInfo, 보안 필터 적용) |
| `Println(args ...any)` | Print와 동일 동작(내부 Log()가 자동 줄바꿈) |
| `Printf(format string, args ...any)` | 포맷팅 출력(LevelInfo, 보안 필터 적용) |
| `JSON(data ...any)` | stdout으로 컴팩트 JSON 출력(caller 정보 포함, 보안 필터 미적용) |
| `JSONF(format string, args ...any)` | stdout으로 포맷팅된 컴팩트 JSON 출력(caller 정보 포함, 보안 필터 미적용) |
| `Text(data ...any)` | stdout으로 보기 좋게 출력(caller 정보 미포함, 보안 필터 미적용) |
| `Textf(format string, args ...any)` | stdout으로 포맷팅된 텍스트 출력(caller 정보 미포함, 보안 필터 미적용) |

## 다음 단계

- [LoggerEntry](./entry) -- 사전 설정 필드 체인 호출
- [설정](./config) -- Config 상세
- [출력 대상](../output-integration/writers) -- FileWriter 상세
