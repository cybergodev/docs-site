---
title: "상수와 오류 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 상수와 오류: DefaultMaxJSONSize, DefaultMaxNestingDepth, ErrPathNotFound 오류 변수, MergeMode 열거형으로 Go 설정과 오류 처리를 지원합니다."
---

# 상수와 오류

## 오류 변수

### 주요 오류

```go
var (
    // 기본 오류
    ErrInvalidJSON     = errors.New("invalid JSON format")
    ErrPathNotFound    = errors.New("path not found")
    ErrTypeMismatch    = errors.New("type mismatch")
    ErrInvalidPath     = errors.New("invalid path format")
    ErrProcessorClosed = errors.New("processor is closed")

    // 제한 오류
    ErrSizeLimit        = errors.New("size limit exceeded")
    ErrDepthLimit       = errors.New("depth limit exceeded")
    ErrConcurrencyLimit = errors.New("concurrency limit exceeded")

    // 보안 및 검증 오류
    ErrSecurityViolation = errors.New("security violation detected")
    ErrUnsupportedPath   = errors.New("unsupported path operation")

    // 리소스 및 성능 오류
    ErrOperationTimeout  = errors.New("operation timeout")
    ErrResourceExhausted = errors.New("system resources exhausted")
)
```

### 오류 확인

`errors.Is`를 사용하여 오류 타입을 확인합니다:

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // 경로가 존재하지 않음
        fmt.Println("경로를 찾을 수 없습니다")
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // 타입 불일치
        fmt.Println("타입이 일치하지 않습니다")
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // JSON 형식 오류
        fmt.Println("유효하지 않은 JSON")
    }
}
```

## JsonsError 타입

### 구조 정의

```go
type JsonsError struct {
    Op      string `json:"op"`      // 작업 이름
    Path    string `json:"path"`    // 오류가 발생한 경로
    Message string `json:"message"` // 사람이 읽을 수 있는 오류 메시지
    Err     error  `json:"err"`     // 기본 오류
}
```

### 메서드

```go
func (e *JsonsError) Error() string
func (e *JsonsError) Unwrap() error
func (e *JsonsError) Is(target error) bool
```

### 사용 예제

```go
val, err := json.Get(data, "complex.path[0]")
if err != nil {
    var jsonErr *json.JsonsError
    if errors.As(err, &jsonErr) {
        fmt.Printf("작업: %s\n", jsonErr.Op)
        fmt.Printf("경로: %s\n", jsonErr.Path)
        fmt.Printf("메시지: %s\n", jsonErr.Message)
        if jsonErr.Err != nil {
            fmt.Printf("원인: %v\n", jsonErr.Err)
        }
    }
}
```

## 오류 헬퍼 함수

위의 오류 유형 외에도 라이브러리는 두 가지 오류 처리 헬퍼 함수를 제공합니다 (자세한 내용은 [헬퍼 유틸리티](./helpers#safeerror) 참조):

| 함수 | 시그니처 | 설명 |
|------|---------|------|
| `SafeError` | `func SafeError(err error) string` | 클라이언트에 안전한 오류 메시지를 반환하며, 경로명 등 내부 세부 정보를 생략합니다 (CWE-209) |
| `RedactedPath` | `func RedactedPath(path string) string` | 마스킹된 경로를 반환합니다 (비어 있지 않은 경로는 `"***"`로 마스킹됨). 로그 및 오류 응답에 사용 |

## 설정 프리셋

### 기본값 상수

```go
const (
    // 크기 제한
    DefaultMaxJSONSize     = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth = 200
    DefaultMaxPathDepth    = 50
    DefaultMaxDepth        = 100                 // 인코딩/디코딩 기본 중첩 깊이 (Config.MaxDepth)
    DefaultMaxConcurrency  = 50

    // 보안 제한
    DefaultMaxSecuritySize   = 10 * 1024 * 1024  // 10MB
    DefaultMaxObjectKeys     = 100000
    DefaultMaxArrayElements  = 100000
    DefaultMaxBatchSize      = 2000
    DefaultParallelThreshold = 10

    // 캐시
    DefaultCacheTTL = 5 * time.Minute
)
```

## 설정 프리셋 함수

### DefaultConfig

시그니처: `func DefaultConfig() Config`

기본 설정을 반환합니다.

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### SecurityConfig

시그니처: `func SecurityConfig() Config`

신뢰할 수 없는 입력을 처리하는 데 적합한 보안 설정을 반환합니다.

```go
// 다음 시나리오에 권장:
// - 공개 API 및 웹 서비스
// - 사용자 제출 데이터
// - 외부 웹훅
// - 인증 엔드포인트
// - 금융 데이터 처리
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**보안 설정 특징**:

- 전체 보안 스캔
- 엄격 모드
- 보수적인 제한값
- 캐시 활성화

### PrettyConfig

시그니처: `func PrettyConfig() Config`

포맷 출력 설정을 반환합니다.

```go
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

## 병합 모드 상수

```go
// MergeMode는 병합 모드 타입입니다 (internal 패키지에서 내보냄)
type MergeMode = internal.MergeMode

const (
    // MergeUnion - 통합 병합 (기본값)
    // 객체: 모든 키를 병합하고, 충돌값은 덮어쓰기값 사용
    // 배열: 모든 요소를 병합하고 중복 제거
    MergeUnion = internal.MergeUnion

    // MergeIntersection - 교집합 병합
    // 객체: 공통 키만 보존
    // 배열: 공통 요소만 보존
    MergeIntersection = internal.MergeIntersection

    // MergeDifference - 차집합 병합
    // 객체: 기본에만 존재하고 덮어쓰기에 없는 키만 보존
    // 배열: 기본에만 존재하고 덮어쓰기에 없는 요소만 보존
    MergeDifference = internal.MergeDifference
)
```

## 경로 세그먼트 타입

`PathSegment`은 `internal` 패키지에서 내보낸 경로 세그먼트 타입으로, 파싱된 경로의 구성 요소를 나타냅니다.

```go
type PathSegment = internal.PathSegment
```

::: warning 내부 구현 별칭
`PathSegment`는 `internal.PathSegment`의 타입 별칭입니다. 구체적인 필드, 필드 타입(예: `PathSegmentType`, `PathSegmentFlags`) 및 메서드는 `internal` 패키지에 속하며 **공개 API로 내보내지지 않습니다**. 버전에 따라 변경될 수 있으므로 비즈니스 코드에서 내부 구조에 직접 의존하지 마세요.

- 커스텀 경로 문법을 구현할 때는 [`PathParser`](./interfaces#pathparser) 인터페이스의 `ParsePath` 메서드를 통해 `[]PathSegment`를 반환합니다.
- 사전 컴파일된 경로는 [`Processor.CompilePath`](./processor/query#compilepath)를 사용하며, `*CompiledPath`를 반환합니다.
:::

## 보안 패턴 수준

```go
type PatternLevel int

const (
    // PatternLevelCritical - 심각한 위험, 항상 작업 차단
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning - 경고 수준, 엄격 모드에서 차단
    PatternLevelWarning

    // PatternLevelInfo - 정보 수준, 로그만 기록
    PatternLevelInfo
)
```

### DangerousPattern 구조

```go
type DangerousPattern struct {
    Pattern string       // 감지할 부분 문자열
    Name    string       // 사람이 읽을 수 있는 보안 위험 설명
    Level   PatternLevel // 처리 수준
}
```

## 오류 처리 모범 사례

### errors.Is로 타입 확인

```go
result, err := json.Get(data, path)
if errors.Is(err, json.ErrPathNotFound) {
    return defaultValue
}
if errors.Is(err, json.ErrTypeMismatch) {
    return defaultValue
}
```

### errors.As로 상세 정보 가져오기

```go
var jsonErr *json.JsonsError
if errors.As(err, &jsonErr) {
    log.Printf("작업 %s이(가) 경로 %s에서 실패: %s",
        jsonErr.Op, jsonErr.Path, jsonErr.Message)
}
```

### 오류 래핑

```go
val := json.GetString(data, path)
if val == "" {
    return fmt.Errorf("설정 %s 가져오기가 빈 값을 반환", path)
}
```

## 관련 문서

- [오류 처리](../advanced/error-handling) - 고급 오류 처리 가이드
- [Config](./config) - 설정 옵션
- [보안 개요](../security/) - 보안 모범 사례
