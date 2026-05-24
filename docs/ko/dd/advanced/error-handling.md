---
title: "오류 처리 - CyberGo DD | 로그 오류 관리"
description: "CyberGo DD 로그 라이브러리 오류 처리 전체 가이드. 구조화된 오류 타입과 계층 체계, 오류 코드 설계, 센티넬 오류 정의와 판단 방법, errors.Is/As 오류 래핑과 언래핑, 커스텀 오류 처리 전략 구현, 오류 복구 메커니즘 및 오류 훅 콜백 설정을 상세히 설명하여 개발자가 다양한 로그 관련 오류를 정확하게 식별하고 처리할 수 있도록 돕습니다."
---

# 오류 처리

DD는 구조화된 오류 체계를 정의하여 다양한 오류를 정확하게 식별하고 처리할 수 있습니다.

## 오류 타입

### LoggerError

오류 코드, 메시지, 원인, 컨텍스트를 포함하는 구조화된 오류:

```go
type LoggerError struct { ... }

// 생성 (LoggerError 구조체 필드 직접 사용)
err := &dd.LoggerError{
    Code:    "CUSTOM_CODE",
    Message: "오류 설명",
}

// 래핑 (LoggerError 구조체 필드 사용)
err := &dd.LoggerError{
    Code:    "WRAP_CODE",
    Message: "래핑 설명",
    Cause:   originalErr,
}
```

메서드:

| 메서드 | 설명 |
|------|------|
| `Error() string` | 오류 메시지 |
| `Unwrap() error` | 내부 오류 가져오기 |
| `Is(target error) bool` | 오류 비교 |
| `WithContext(key, value)` | 컨텍스트 정보 추가 |
| `WithField(key, value)` | 필드 정보 추가 |

```go
err := &dd.LoggerError{
    Code:    "DB_ERROR",
    Message: "쿼리 실패",
    Cause:   dbErr,
}
err = err.WithContext("query", "SELECT * FROM users")
err = err.WithField("retry_count", 3)
```

### WriterError

Writer 오류로, Writer 인덱스와 원본 오류를 포함합니다.

```go
type WriterError struct {
    Index  int
    Writer io.Writer
    Err    error
}
```

### MultiWriterError

다중 Writer 집계 오류.

```go
type MultiWriterError struct { ... }
```

메서드: `HasErrors()`, `ErrorCount()`, `FirstError()`

## 오류 처리 패턴

### errors.Is 매칭

```go
logger, err := dd.New(config)
if err != nil {
    if errors.Is(err, dd.ErrNilConfig) {
        // 설정이 비어 있음 처리
    }
    if errors.Is(err, dd.ErrInvalidLevel) {
        // 유효하지 않은 레벨 처리
    }
}
```

### 쓰기 오류 처리

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // 커스텀 쓰기 오류 처리
    if errors.Is(err, dd.ErrWriterNotFound) {
        // Writer가 제거됨
        return
    }
    // 오류 메트릭 기록
    metrics.WriteErrors.Inc()
})
```

### 런타임 오류 처리

```go
// Writer 추가
if err := logger.AddWriter(w); err != nil {
    if errors.Is(err, dd.ErrLoggerClosed) {
        // 로거가 종료됨
        return
    }
    if errors.Is(err, dd.ErrNilWriter) {
        // Writer가 비어 있음
        return
    }
}

// 레벨 설정
if err := logger.SetLevel(dd.LevelDebug); err != nil {
    if errors.Is(err, dd.ErrInvalidLevel) {
        // 유효하지 않은 레벨
    }
}
```

### 보안 오류

```go
fw, err := dd.NewFileWriter(userPath, dd.DefaultFileWriterConfig())
if err != nil {
    if errors.Is(err, dd.ErrPathTraversal) {
        // 경로 순회 공격
        log.Fatal("경로 순회 공격 감지")
    }
    if errors.Is(err, dd.ErrNullByte) {
        // Null 바이트 주입
        log.Fatal("null 바이트 주입 감지")
    }
    if errors.Is(err, dd.ErrSymlinkNotAllowed) {
        // 심볼릭 링크가 허용되지 않음
    }
}
```

### 패턴 오류

```go
filter, err := dd.NewCustomSensitiveDataFilter(pattern)
if err != nil {
    if errors.Is(err, dd.ErrReDoSPattern) {
        // ReDoS 위험 패턴
        log.Fatal("정규식 패턴에 ReDoS 위험 존재")
    }
    if errors.Is(err, dd.ErrInvalidPattern) {
        // 유효하지 않은 정규식
    }
    if errors.Is(err, dd.ErrPatternTooLong) {
        // 패턴이 너무 긺
    }
}
```

## 훅 오류

훅을 사용할 때 훅 설정의 `OnError` 콜백을 통해 훅 실행 중 발생하는 오류를 캡처하고 처리할 수 있습니다:

```go
// HooksConfig로 훅 오류 처리 설정
registry := dd.NewHooksFromConfig(dd.HooksConfig{
    ErrorHandler: func(event dd.HookEvent, hc *dd.HookContext, err error) {
        // 커스텀 훅 오류 처리
        handleHookError(event.String(), err)
    },
})
logger, _ := dd.New(dd.Config{
    Hooks: registry,
})
```

## 전역 로거 오류

```go
// 초기화 시 확인
err := dd.InitDefault(cfg)
if err != nil {
    log.Fatal(err)
}

// 런타임 확인
if err := dd.DefaultInitError(); err != nil {
    fmt.Println("전역 로거 초기화 오류:", err)
}
```

## 다음 단계

- [상수와 오류](../api-reference/constants) -- 전체 오류 코드 목록
- [훅 시스템](../api-reference/hooks) -- HookRegistry
- [보안 필터](../api-reference/security) -- 보안 관련 오류
