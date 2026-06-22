---
title: "상수와 오류 - CyberGo DD | LogLevel, Format, SentinelErrors"
description: "CyberGo DD 상수 정의와 오류 타입 전체 문서. LogLevel 로그 레벨 상수 (Debug/Info/Warn/Error/Fatal), Format 출력 형식 상수 및 SentinelErrors 센티넬 오류 정의를 포함하여, 로그 동작과 오류 처리를 정밀하게 제어하는 데 사용되며, DD 로그 라이브러리 설정 체계를 이해하는 핵심 기초입니다."
---

# 상수와 오류

DD는 풍부한 상수와 오류 타입을 정의하여 로그 레벨 제어, 포맷팅 및 오류 처리에 사용합니다.

## 로그 레벨

```go
type LogLevel int8 // 로그 레벨 타입
```

| 상수 | 값 | 설명 |
|------|----|------|
| `LevelDebug` | 0 | 디버그 레벨 |
| `LevelInfo` | 1 | 정보 레벨 (기본값) |
| `LevelWarn` | 2 | 경고 레벨 |
| `LevelError` | 3 | 오류 레벨 |
| `LevelFatal` | 4 | 치명적 레벨 |

`LogLevel`은 `String() string` 메서드(`"DEBUG"`/`"INFO"`/`"WARN"`/`"ERROR"`/`"FATAL"`을 반환하며, 알 수 없는 값은 `"UNKNOWN"` 반환)와 `IsValid() bool` 메서드(레벨이 `LevelDebug`~`LevelFatal` 유효 범위 내에 있는지 판단)를 구현합니다.

## 로그 형식

```go
type LogFormat int8 // 출력 형식 타입
```

| 상수 | 설명 |
|------|------|
| `FormatText` | 텍스트 형식 |
| `FormatJSON` | JSON 형식 |

`LogFormat`은 `String() string` 메서드(`"text"`/`"json"`을 반환하며, 알 수 없는 값은 `"unknown"` 반환)를 구현합니다.

## 필드 검증 모드

```go
type FieldValidationMode int // 필드 키 검증 모드
```

| 상수 | 값 | 설명 |
|------|----|------|
| `FieldValidationNone` | 0 | 검증 비활성화 (기본값) |
| `FieldValidationWarn` | 1 | 검증 실패 시 경고하지만 여전히 허용 |
| `FieldValidationStrict` | 2 | 엄격 모드, 검증 실패 시 오류 기록 |

## 필드 명명 규칙

```go
type FieldNamingConvention int // 필드 키 명명 규칙
```

| 상수 | 값 | 설명 |
|------|----|------|
| `NamingConventionAny` | 0 | 모든 형식 허용 (기본값) |
| `NamingConventionSnakeCase` | 1 | snake_case (예: user_id) |
| `NamingConventionCamelCase` | 2 | camelCase (예: userId) |
| `NamingConventionPascalCase` | 3 | PascalCase (예: UserId) |
| `NamingConventionKebabCase` | 4 | kebab-case (예: user-id) |

## 해시 알고리즘

```go
type HashAlgorithm int // 무결성 서명 해시 알고리즘
```

| 상수 | 설명 |
|------|------|
| `HashAlgorithmSHA256` | SHA-256 알고리즘 |

## 기본값

| 상수 | 값 | 설명 |
|------|----|------|
| `DefaultTimeFormat` | `"2006-01-02T15:04:05Z07:00"` | ISO 8601 시간 형식 |
| `DefaultLogPath` | `"logs/app.log"` | 기본 로그 파일 경로 |
| `DefaultMaxSizeMB` | `100` | 기본 파일 크기 제한 (MB) |
| `DefaultMaxBackups` | `10` | 기본 백업 수량 |
| `DefaultMaxAge` | `30 * 24 * time.Hour` | 기본 보존 일수 (30일) |

## 컨텍스트 키

| 상수 | 타입 | 값 |
|------|------|----|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## 오류 코드

`LoggerError.Code` 필드는 기계가 읽을 수 있는 오류 코드 문자열을 포함하며, 오류 타입을 정밀하게 매칭하는 데 사용됩니다. 오류 코드는 내부 구현 세부사항이므로 센티넬 오류로 매칭하는 것을 권장합니다.

## 센티넬 오류

각 오류 코드에 해당하는 센티넬 오류 변수:

```go
var (
    ErrNilConfig          = errors.New("config cannot be nil")
    ErrNilWriter          = errors.New("writer cannot be nil")
    ErrNilFilter          = errors.New("filter cannot be nil")
    ErrNilHook            = errors.New("hook cannot be nil")
    ErrNilExtractor       = errors.New("context extractor cannot be nil")
    ErrLoggerClosed       = errors.New("logger is closed")
    ErrWriterNotFound     = errors.New("writer not found")
    ErrInvalidLevel       = errors.New("invalid log level")
    ErrInvalidFormat      = errors.New("invalid log format")
    ErrMaxWritersExceeded = errors.New("maximum writer count exceeded")
    ErrEmptyFilePath      = errors.New("file path cannot be empty")
    ErrPathTooLong        = errors.New("file path too long")
    ErrPathTraversal      = errors.New("path traversal detected")
    ErrNullByte           = errors.New("null byte in input")
    ErrInvalidPath        = errors.New("invalid file path")
    ErrSymlinkNotAllowed  = errors.New("symlinks not allowed")
    ErrHardlinkNotAllowed = errors.New("hardlinks not allowed")
    ErrOverlongEncoding   = errors.New("UTF-8 overlong encoding detected")
    ErrMaxSizeExceeded    = errors.New("maximum size exceeded")
    ErrMaxBackupsExceeded = errors.New("maximum backup count exceeded")
    ErrBufferSizeTooLarge = errors.New("buffer size too large")
    ErrInvalidPattern     = errors.New("invalid regex pattern")
    ErrEmptyPattern       = errors.New("pattern cannot be empty")
    ErrPatternTooLong     = errors.New("pattern length exceeds maximum")
    ErrReDoSPattern       = errors.New("pattern contains dangerous nested quantifiers that may cause ReDoS")
    ErrPatternFailed      = errors.New("failed to add pattern")
    ErrConfigValidation   = errors.New("configuration validation failed")
    ErrWriterAdd          = errors.New("failed to add writer")
    ErrMultipleConfigs    = errors.New("multiple configs provided, expected 0 or 1")
    ErrNilMultiWriter     = errors.New("multiwriter is nil")
)
```

### 오류 확인

```go
if errors.Is(err, dd.ErrLoggerClosed) {
    // 로거가 종료됨
}

if errors.Is(err, dd.ErrPathTraversal) {
    // 경로 순회 공격 감지
}
```

## 오류 타입

### LoggerError

```go
type LoggerError struct {
    Code    string
    Message string
    Cause   error
    Context map[string]any
}
```

메서드: `Error()`, `Unwrap()`, `Is(target)`, `WithContext(key, value)`, `WithField(key, value)`

```go
// LoggerError는 오류 코드, 메시지, 원인 및 컨텍스트를 포함
// errors.Is로 센티넬 오류 확인
if errors.Is(err, dd.ErrLoggerClosed) {
    // 로거가 종료됨
}
```

### WriterError

```go
type WriterError struct {
    Index  int
    Writer io.Writer
    Err    error
}
```

메서드: `Error()`, `Unwrap()`

### MultiWriterError

```go
type MultiWriterError struct {
    Errors []WriterError
}
```

메서드: `Error()`, `Unwrap()`, `HasErrors()`, `ErrorCount()`, `FirstError()`

## 다음 단계

- [패키지 함수](./functions) -- 오류 처리 함수
- [보안 필터](./security) -- 경로 보안 검증
- [훅 시스템](./hooks) -- OnError 훅
