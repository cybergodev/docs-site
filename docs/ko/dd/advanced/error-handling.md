---
sidebar_label: "오류 처리"
title: "오류 처리 - CyberGo DD | 로그 오류 관리"
description: "CyberGo DD 로그 라이브러리의 오류 처리 완전한 가이드입니다. 구조화된 오류 타입과 계층 체계, 오류 코드 설계, 센티넬 오류 정의와 판단 방법, errors.Is/As 오류 래핑과 언래핑, 커스텀 오류 처리 전략 구현, 오류 복구 메커니즘과 오류 훅 콜백 구성을 상세히 설명하여 개발자가 다양한 로그 관련 오류를 정확히 식별하고 처리할 수 있도록 돕습니다."
sidebar_position: 2
---

# 오류 처리

DD는 구조화된 오류 체계를 정의하여 다양한 오류를 정확히 식별하고 처리하기 용이합니다.

## 오류 타입

### LoggerError

구조화된 오류로, 오류 코드, 메시지, 원인, 컨텍스트를 포함합니다.

```go
type LoggerError struct { ... }

// 생성(LoggerError 구조체 필드 직접 사용)
err := &dd.LoggerError{
    Code:    "CUSTOM_CODE",
    Message: "오류 설명",
}

// 래핑(LoggerError 구조체 필드 사용)
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

writer 오류로, Writer 인덱스와 원본 오류를 포함합니다.

```go
type WriterError struct {
    Index  int
    Writer io.Writer
    Err    error
}
```

### MultiWriterError

다중 writer 집계 오류.

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
        // 구성이 비어 있을 때 처리
    }
    if errors.Is(err, dd.ErrInvalidLevel) {
        // 무효한 레벨 처리
    }
}
```

### 쓰기 오류 처리

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // 커스텀 쓰기 오류 처리
    // 주의: 이 콜백은 writer.Write() 실패 시에만 트리거되며, 전달되는 것은 writer 자신의 오류;
    // dd.ErrWriterNotFound는 RemoveWriter가 호출자에게 직접 반환되며 이 콜백으로 전달되지 않습니다.
    if errors.Is(err, io.ErrShortWrite) {
        // 쓰기 바이트 수 부족
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
        // 로거가 이미 종료됨
        return
    }
    if errors.Is(err, dd.ErrNilWriter) {
        // Writer가 nil
        return
    }
}

// 레벨 설정
if err := logger.SetLevel(dd.LevelDebug); err != nil {
    if errors.Is(err, dd.ErrInvalidLevel) {
        // 무효한 레벨
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
        // null 바이트 주입
        log.Fatal("null 바이트 주입 감지")
    }
    if errors.Is(err, dd.ErrSymlinkNotAllowed) {
        // 심볼릭 링크 허용 안 됨
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
        // 무효한 정규식
    }
    if errors.Is(err, dd.ErrPatternTooLong) {
        // 패턴이 너무 김
    }
}
```

## 훅 오류

훅 사용 시 훅 구성의 `ErrorHandler` 콜백으로 훅 실행 중 오류를 포착하고 처리할 수 있습니다.

```go
// HooksConfig로 훅 오류 처리 구성
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

## 글로벌 로거 오류

```go
// 초기화 시 검사
err := dd.InitDefault(cfg)
if err != nil {
    log.Fatal(err)
}

// 런타임 검사
if err := dd.DefaultInitError(); err != nil {
    fmt.Println("전역 로거 초기화 오류:", err)
}
```

## 다음 단계

- [상수와 오류](../api-reference/dev-tools/constants) -- 완전한 오류 코드 목록
- [훅 시스템](../api-reference/security-audit/hooks) -- HookRegistry
- [보안 필터](../api-reference/security-audit/security) -- 보안 관련 오류
