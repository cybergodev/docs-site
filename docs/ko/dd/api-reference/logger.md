---
title: "Logger - CyberGo DD | 핵심 로거"
description: "CyberGo DD Logger 핵심 로거 전체 API 문서. 로그 출력 메서드 (Info/Warn/Error/Fatal), 레벨 동적 관리, Writer 동적 추가 및 교체, 라이프사이클 제어 (Close/Flush), 전역 로그 함수 및 체인 필드 설정을 다루며 DD 로그 라이브러리 사용의 핵심 진입 타입입니다."
---

# Logger

`Logger`는 DD의 핵심 타입으로, 스레드 안전한 로그 기록 기능을 제공합니다.

## 생성

```go
// New로 생성
logger, _ := dd.New(dd.DefaultConfig())

// 커스텀 설정으로 생성
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
| `Fatal(args ...any)` | Fatal 레벨 로그 (기본적으로 os.Exit(1) 호출, FatalHandler로 커스터마이즈 가능) |
| `Log(level LogLevel, args ...any)` | 레벨 지정 로그 |

### 포맷팅 로그

| 메서드 | 설명 |
|------|------|
| `Debugf(format string, args ...any)` | 포맷팅 Debug |
| `Infof(format string, args ...any)` | 포맷팅 Info |
| `Warnf(format string, args ...any)` | 포맷팅 Warn |
| `Errorf(format string, args ...any)` | 포맷팅 Error |
| `Fatalf(format string, args ...any)` | 포맷팅 Fatal |
| `Logf(level LogLevel, format string, args ...any)` | 포맷팅 레벨 지정 |

### 구조화된 로그

| 메서드 | 설명 |
|------|------|
| `DebugWith(msg string, fields ...Field)` | 구조화된 Debug |
| `InfoWith(msg string, fields ...Field)` | 구조화된 Info |
| `WarnWith(msg string, fields ...Field)` | 구조화된 Warn |
| `ErrorWith(msg string, fields ...Field)` | 구조화된 Error |
| `FatalWith(msg string, fields ...Field)` | 구조화된 Fatal |
| `LogWith(level LogLevel, msg string, fields ...Field)` | 구조화된 레벨 지정 |

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

// 빠른 확인
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
// 샘플링 설정
logger.SetSampling(&dd.SamplingConfig{
    // 샘플링 매개변수
})

// 샘플링 설정 가져오기
cfg := logger.GetSampling()
```

## 보안 설정

```go
// 보안 설정
logger.SetSecurityConfig(dd.DefaultSecurityConfig())

// 보안 설정 가져오기
sec := logger.GetSecurityConfig()
```

## 필드 검증

```go
// 필드 검증 설정
logger.SetFieldValidation(dd.StrictSnakeCaseConfig())

// 검증 설정 가져오기
validation := logger.GetFieldValidation()
```

## 라이프사이클

```go
// 버퍼 새로고침
_ = logger.Flush()

// 로거 종료
_ = logger.Close()

// 정상 종료 (타임아웃 포함)
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
_ = logger.Shutdown(ctx)

// 종료 여부 확인
closed := logger.IsClosed()

// 필터링 고루틴 완료 대기
ok := logger.WaitForFilterGoroutines(3 * time.Second)
active := logger.ActiveFilterGoroutines()
```

## 디버그 출력

| 메서드 | 설명 |
|------|------|
| `Print(args ...any)` | 설정된 Writer에 출력 (LevelInfo, 보안 필터링 적용) |
| `Println(args ...any)` | Print와 동일한 동작 (내부 Log()가 자동 줄바꿈) |
| `Printf(format string, args ...any)` | 포맷팅 출력 (LevelInfo, 보안 필터링 적용) |
| `JSON(data ...any)` | JSON 형식 디버그 출력을 stdout으로 (보안 필터링 미적용) |
| `JSONF(format string, args ...any)` | 포맷팅 JSON 디버그 출력을 stdout으로 (보안 필터링 미적용) |
| `Text(data ...any)` | 텍스트 형식 디버그 출력을 stdout으로 (보안 필터링 미적용) |
| `Textf(format string, args ...any)` | 포맷팅 텍스트 디버그 출력을 stdout으로 (보안 필터링 미적용) |

## 다음 단계

- [LoggerEntry](./entry) -- 사전 설정 필드 체인 호출
- [설정](./config) -- Config 상세 가이드
- [출력 대상](./writers) -- FileWriter 상세 가이드
