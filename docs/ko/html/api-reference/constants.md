---
title: "상수와 오류 - HTML"
description: "CyberGo HTML 라이브러리 상수와 오류 타입 API 레퍼런스, DefaultMaxInputSize(50MB) 등 기본값 상수, ErrInputTooLarge 등 센티넬 오류, 그리고 InputError, ConfigError, FileError 구조화된 오류 타입을 포함하며 모두 errors.Is/As 판별을 지원합니다."
---

# 상수와 오류

## 기본 설정 상수

| 상수 | 타입 | 값 | 설명 |
|------|------|----|------|
| `DefaultMaxInputSize` | `int` | `52428800` | 최대 입력 크기 (50MB) |
| `DefaultMaxCacheEntries` | `int` | `2000` | 캐시 최대 항목 수 |
| `DefaultWorkerPoolSize` | `int` | `4` | 워커 풀 크기 |
| `DefaultCacheTTL` | `time.Duration` | `1h` | 캐시 만료 시간 |
| `DefaultCacheCleanup` | `time.Duration` | `5m` | 캐시 정리 간격 |
| `DefaultMaxDepth` | `int` | `500` | 최대 DOM 깊이 |
| `DefaultProcessingTimeout` | `time.Duration` | `30s` | 처리 타임아웃 시간 |

## 감사 상수

### 감사 이벤트 유형

| 상수 | 값 | 설명 |
|------|------|------|
| `AuditEventBlockedTag` | `"blocked_tag"` | 차단된 태그 |
| `AuditEventBlockedAttr` | `"blocked_attr"` | 차단된 속성 |
| `AuditEventBlockedURL` | `"blocked_url"` | 차단된 URL |
| `AuditEventInputViolation` | `"input_violation"` | 입력 위반 |
| `AuditEventDepthViolation` | `"depth_violation"` | 깊이 위반 |
| `AuditEventTimeout` | `"timeout"` | 처리 타임아웃 |
| `AuditEventEncodingIssue` | `"encoding_issue"` | 인코딩 문제 |
| `AuditEventPathTraversal` | `"path_traversal"` | 경로 순회 시도 |

### 감사 레벨

| 상수 | 타입 | 값 | 설명 |
|------|------|------|------|
| `AuditLevelInfo` | `AuditLevel` | `"info"` | 정보 레벨 |
| `AuditLevelWarning` | `AuditLevel` | `"warning"` | 경고 레벨 |
| `AuditLevelCritical` | `AuditLevel` | `"critical"` | 심각 레벨 |

:::info
감사 시스템의 자세한 사용법과 Sink 타입은 [감사 시스템](./audit)을 참조하세요.
:::

## 센티넬 오류

| 오류 | 메시지 | 설명 |
|------|------|------|
| `ErrInputTooLarge` | `html: input size exceeds maximum` | 입력이 크기 제한을 초과함 |
| `ErrInvalidHTML` | `html: invalid HTML` | 유효하지 않은 HTML 콘텐츠 |
| `ErrProcessorClosed` | `html: processor closed` | 프로세서가 종료됨 |
| `ErrMaxDepthExceeded` | `html: max depth exceeded` | 최대 깊이를 초과함 |
| `ErrInvalidConfig` | `html: invalid config` | 유효하지 않은 설정 |
| `ErrProcessingTimeout` | `html: processing timeout exceeded` | 처리 타임아웃 초과 |
| `ErrFileNotFound` | `html: file not found` | 파일을 찾을 수 없음 |
| `ErrInvalidFilePath` | `html: invalid file path` | 유효하지 않은 파일 경로 |
| `ErrInternalPanic` | `html: internal panic recovered` | 내부 패닉이 복구됨 |
| `ErrMultipleConfigs` | `html: at most one Config may be provided` | 최대 1개의 Config만 허용됨 |

## 오류 타입

### InputError

입력 관련 오류로, 크기 정보를 포함합니다.

```go
type InputError struct {
    Op       string // 작업명
    Size     int    // 실제 크기
    MaxSize  int    // 최대 제한
    InputErr error  // 원래 오류
}

func (e *InputError) Error() string
func (e *InputError) Unwrap() error // → InputErr(nil이 아닌 경우) 또는 ErrInputTooLarge
```

### ConfigError

설정 검증 오류로, 필드 정보를 포함합니다.

```go
type ConfigError struct {
    Field   string // 필드명
    Value   any    // 유효하지 않은 값
    Message string // 오류 설명
}

func (e *ConfigError) Error() string
func (e *ConfigError) Unwrap() error // → ErrInvalidConfig
```

### FileError

파일 작업 오류로, 경로 노출을 방지하기 위해 자동으로 경로를 잘라냅니다.

```go
type FileError struct {
    Op      string // 작업명
    Path    string // 파일 경로
    FileErr error  // 원래 오류
}

func (e *FileError) Error() string        // 안전한 출력(경로 잘라냄)
func (e *FileError) SafePath() string     // 파일명만 반환
func (e *FileError) Unwrap() error        // → ErrFileNotFound | 원래 오류 | ErrInvalidFilePath
```

:::tip 안전한 경로
`FileError.Error()`와 `SafePath()`는 모두 잘라낸 안전한 경로(파일명만)를 반환하여 경로 노출을 방지합니다. 내부 디버깅으로 전체 경로가 필요한 경우 `Path` 필드에 직접 접근할 수 있습니다.
:::

## 오류 처리 패턴

```go
result, err := html.Extract(data)
if err != nil {
    var inputErr *html.InputError
    var configErr *html.ConfigError
    var fileErr *html.FileError

    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // 입력이 너무 큼
    case errors.Is(err, html.ErrInvalidHTML):
        // 유효하지 않은 HTML
    case errors.Is(err, html.ErrFileNotFound):
        // 파일이 존재하지 않음
    case errors.As(err, &inputErr):
        fmt.Printf("크기 %d가 제한 %d를 초과함\n", inputErr.Size, inputErr.MaxSize)
    case errors.As(err, &configErr):
        fmt.Printf("설정 필드 %s가 유효하지 않음: %s\n", configErr.Field, configErr.Message)
    case errors.As(err, &fileErr):
        fmt.Printf("파일: %s\n", fileErr.SafePath())
    }
}
```
