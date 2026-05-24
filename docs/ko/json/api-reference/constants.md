---
title: "상수와 오류 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 상수와 오류 정의 완전 참조: DefaultMaxJSONSize/DefaultMaxNestingDepth 기본 제한 상수, ErrPathNotFound/ErrTypeMismatch 등 오류 변수 및 MergeMode 병합 모드 열거형을 포함하며, 설정 프리셋과 오류 처리를 지원합니다."
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

## 설정 프리셋

### 기본값 상수

```go
const (
    // 크기 제한
    DefaultMaxJSONSize     = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth = 200
    DefaultMaxPathDepth    = 50
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

### PathSegment 구조

```go
type PathSegment struct {
    Type  PathSegmentType  // 세그먼트 타입

    // 타입에 따라 다른 필드 사용
    Key   string // 속성명 (Property/Extract 타입)
    Index int    // 배열 인덱스 (ArrayIndex 타입) 또는 슬라이스 시작
    End   int    // 슬라이스 끝 (ArraySlice 타입)
    Step  int    // 슬라이스 간격 (ArraySlice 타입)
    Flags PathSegmentFlags // 세그먼트 플래그
}
```

### PathSegment 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `HasStart` | `func (s *PathSegment) HasStart() bool` | 슬라이스에 시작값이 있는지 |
| `HasEnd` | `func (s *PathSegment) HasEnd() bool` | 슬라이스에 끝값이 있는지 |
| `HasStep` | `func (s *PathSegment) HasStep() bool` | 슬라이스에 간격값이 있는지 |
| `IsNegativeIndex` | `func (s *PathSegment) IsNegativeIndex() bool` | 음수 인덱스인지 |
| `IsWildcardSegment` | `func (s *PathSegment) IsWildcardSegment() bool` | 와일드카드인지 |
| `IsFlatExtract` | `func (s *PathSegment) IsFlatExtract() bool` | 플랫 패턴인지 |

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
