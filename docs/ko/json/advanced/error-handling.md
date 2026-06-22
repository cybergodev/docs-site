---
title: "오류 처리 - CyberGo JSON | 모범 사례"
description: "CyberGo JSON 오류 처리 모범 사례: JsonsError 판단, errors.Is/As, 표준 오류 변수, 복구 전략, SafeError, RedactedPath 로깅으로 견고한 예외 처리를 구축합니다."
---

# 오류 처리

JSON 작업 중 발생하는 오류를 올바르게 처리합니다.

## 오류 타입

### 표준 오류

```go
var (
    ErrPathNotFound       = errors.New("path not found")
    ErrInvalidPath        = errors.New("invalid path format")
    ErrTypeMismatch       = errors.New("type mismatch")
    ErrInvalidJSON        = errors.New("invalid JSON format")
    ErrDepthLimit         = errors.New("depth limit exceeded")
    ErrSizeLimit          = errors.New("size limit exceeded")
    ErrSecurityViolation  = errors.New("security violation detected")
    ErrProcessorClosed    = errors.New("processor is closed")
    ErrConcurrencyLimit   = errors.New("concurrency limit exceeded") // Deprecated
    ErrUnsupportedPath    = errors.New("unsupported path operation")
    ErrOperationTimeout   = errors.New("operation timeout")           // Deprecated
    ErrResourceExhausted  = errors.New("system resources exhausted")  // Deprecated
)
```

### 오류 확인

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // 경로가 존재하지 않음
        return defaultName
    }
    if errors.Is(err, json.ErrTypeMismatch) {
        // 타입 불일치
        return "", fmt.Errorf("필드 타입 오류: %w", err)
    }
    return "", err
}
```

## JsonsError

### 구조체

`JsonsError`는 라이브러리의 주요 오류 타입으로, 작업 컨텍스트 정보를 포함합니다:

```go
type JsonsError struct {
    Op      string `json:"op"`      // 작업 타입: "get", "set", "delete", "marshal" 등
    Path    string `json:"path"`    // JSON 경로 (있는 경우)
    Message string `json:"message"` // 사람이 읽을 수 있는 오류 메시지
    Err     error  `json:"err"`     // 기저 오류
}

func (e *JsonsError) Error() string
func (e *JsonsError) Unwrap() error
func (e *JsonsError) Is(target error) bool
```

### 사용법

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // errors.Is로 오류 타입 확인
    if errors.Is(err, json.ErrPathNotFound) {
        // 경로가 존재하지 않음
    }
    if errors.Is(err, json.ErrTypeMismatch) {
        // 타입 불일치
    }

    // errors.As로 상세 컨텍스트 가져오기
    var jsonErr *json.JsonsError
    if errors.As(err, &jsonErr) {
        fmt.Printf("작업: %s\n", jsonErr.Op)
        fmt.Printf("경로: %s\n", jsonErr.Path)
        fmt.Printf("메시지: %s\n", jsonErr.Message)
    }
}
```

## 오류 처리 패턴

### 기본값 제공

```go
// 타입 안전 가져오기 함수에 기본값 지원 내장
name := json.GetString(data, "user.name", "익명")
age := json.GetInt(data, "user.age", 0)
active := json.GetBool(data, "user.active", false)
```

### 여러 오류 수집

```go
type MultiError struct {
    Errors []error
}

func (e *MultiError) Add(err error) {
    e.Errors = append(e.Errors, err)
}

func (e *MultiError) HasError() bool {
    return len(e.Errors) > 0
}

func (e *MultiError) Error() string {
    msgs := make([]string, len(e.Errors))
    for i, err := range e.Errors {
        msgs[i] = err.Error()
    }
    return strings.Join(msgs, "; ")
}

// 사용법
var multiErr MultiError
for _, path := range requiredPaths {
    if _, err := json.Get(data, path); err != nil {
        multiErr.Add(fmt.Errorf("%s: %w", path, err))
    }
}
if multiErr.HasError() {
    return multiErr.Error()
}
```

### 오류 래핑

```go
val, err := json.Get(data, "config.api_key")
if err != nil {
    return fmt.Errorf("API 키 읽기 실패: %w", err)
}
```

## 커스텀 오류

### 비즈니스 오류

```go
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("검증 실패 %s: %s", e.Field, e.Message)
}

// 사용법
func validateUser(data string) error {
    name := json.GetString(data, "name")
    if name == "" {
        return &ValidationError{Field: "name", Message: "필수 항목"}
    }
    if len(name) < 2 {
        return &ValidationError{Field: "name", Message: "최소 2자 이상"}
    }
    return nil
}
```

## 로그 기록

### 구조화된 로그

```go
val, err := json.Get(data, path)
if err != nil {
    log.Error("JSON 작업 실패",
        "path", path,
        "error", err,
        "error_type", fmt.Sprintf("%T", err),
    )
    return err
}
```

### 감사 로그

```go
func auditLog(op string, path string, err error) {
    if err != nil {
        log.Warn("작업 실패",
            "operation", op,
            "path", path,
            "error", err,
        )
    } else {
        log.Info("작업 성공",
            "operation", op,
            "path", path,
        )
    }
}
```

## 복구 전략

### SafeError 안전한 출력

`SafeError`는 내부 컨텍스트 정보를 제거한 클라이언트에 안전한 오류 메시지를 반환합니다:

```go
// 시그니처: func SafeError(err error) string

val, err := json.Get(untrustedInput, "data")
if err != nil {
    // SafeError는 경로와 작업 컨텍스트 등 내부 세부 정보를 제거합니다
    safeMsg := json.SafeError(err)
    http.Error(w, safeMsg, http.StatusBadRequest)
    return
}
```

### 재시도

```go
func withRetry(fn func() error, maxRetries int) error {
    var err error
    for i := 0; i < maxRetries; i++ {
        if err = fn(); err == nil {
            return nil
        }
        time.Sleep(time.Second * time.Duration(i+1))
    }
    return err
}

// 사용법
err := withRetry(func() error {
    return processData(data)
}, 3)
```

### 성능 저하

```go
func getConfig(data string) Config {
    cfg := json.DefaultConfig()

    // 타입 안전 가져오기 함수 사용, 기본값 내장
    cfg.StrictMode = json.GetBool(data, "config.strict", true)

    return cfg
}
```

## 오류 분류

### 사용자 입력 오류

사용자가 제공한 JSON 데이터나 경로로 인해 발생합니다:

```go
val, err := json.Get(data, "user.name")
if err != nil {
    switch {
    case errors.Is(err, json.ErrInvalidJSON):
        // JSON 형식 오류
        return fmt.Errorf("데이터 형식 오류: %w", err)
    case errors.Is(err, json.ErrPathNotFound):
        // 경로가 존재하지 않음
        return fmt.Errorf("필드가 존재하지 않음: %w", err)
    case errors.Is(err, json.ErrTypeMismatch):
        // 타입 불일치
        return fmt.Errorf("타입 오류: %w", err)
    case errors.Is(err, json.ErrInvalidPath):
        // 경로 문법 오류
        return fmt.Errorf("경로 문법 오류: %w", err)
    case errors.Is(err, json.ErrUnsupportedPath):
        // 지원하지 않는 경로 작업
        return fmt.Errorf("지원하지 않는 작업: %w", err)
    }
}
```

### 보안 관련 오류

잠재적인 보안 위협이 감지된 경우:

```go
val, err := json.Get(untrustedInput, "data")
if err != nil {
    if errors.Is(err, json.ErrSecurityViolation) {
        // 보안 위반, 기록 및 거부
        log.Warn("보안 위반", "error", err)
        return errors.New("입력이 올바르지 않습니다")
    }
    if errors.Is(err, json.ErrSizeLimit) {
        return fmt.Errorf("데이터가 크기 제한을 초과했습니다: %w", err)
    }
    if errors.Is(err, json.ErrDepthLimit) {
        return fmt.Errorf("중첩 깊이 제한 초과: %w", err)
    }
    return err
}
```

### 시스템 오류

시스템 수준의 일시적인 오류:

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrOperationTimeout) {
        // 작업 시간 초과, 재시도 가능 <Badge type="danger" text="사용 중단" />
        return fmt.Errorf("일시적 오류, 다시 시도해 주세요: %w", err)
    }
    if errors.Is(err, json.ErrConcurrencyLimit) {
        // 동시성 제한 <Badge type="danger" text="사용 중단" />
        return fmt.Errorf("시스템이 혼잡합니다, 잠시 후 다시 시도해 주세요: %w", err)
    }
    if errors.Is(err, json.ErrResourceExhausted) {
        // 리소스 고갈 <Badge type="danger" text="사용 중단" />
        return fmt.Errorf("시스템 리소스가 부족합니다: %w", err)
    }
    if errors.Is(err, json.ErrProcessorClosed) {
        // 프로세서가 닫힘
        return fmt.Errorf("프로세서를 사용할 수 없습니다: %w", err)
    }
    return err
}
```

## 오류 처리 모범 사례

### 1. 오류 유형 구분

```go
func processJSON(data string) error {
    val, err := json.Get(data, "user.name")
    if err != nil {
        // errors.Is로 오류 유형 구분
        switch {
        case errors.Is(err, json.ErrInvalidJSON),
            errors.Is(err, json.ErrPathNotFound),
            errors.Is(err, json.ErrTypeMismatch),
            errors.Is(err, json.ErrInvalidPath):
            // 사용자 입력 오류, 친절한 팁 반환
            return fmt.Errorf("데이터 형식 오류: %w", err)
        case errors.Is(err, json.ErrSecurityViolation):
            // 보안 오류, 기록 및 거부
            log.Warn("보안 위반", "error", err)
            return errors.New("입력이 올바르지 않습니다")
        case errors.Is(err, json.ErrOperationTimeout),          // Deprecated
            errors.Is(err, json.ErrConcurrencyLimit): // Deprecated
            // 재시도 가능한 오류 (이러한 오류는 현재 라이브러리에서 반환되지 않으며, 호환성을 위해 유지)
            return fmt.Errorf("일시적 오류, 다시 시도해 주세요: %w", err)
        default:
            // 시스템 오류
            log.Error("시스템 오류", "error", err)
            return errors.New("내부 오류")
        }
    }
    return nil
}
```

### 2. errors.As로 컨텍스트 가져오기

```go
func handleWithDetail(data string, path string) error {
    val, err := json.Get(data, path)
    if err != nil {
        var jsonErr *json.JsonsError
        if errors.As(err, &jsonErr) {
            return fmt.Errorf("작업 %s 실패 (경로: %s): %w",
                jsonErr.Op, jsonErr.Path, jsonErr.Err)
        }
        return fmt.Errorf("작업 실패: %w", err)
    }
    return nil
}
```

### 3. 오류 체인 추적

```go
func deepProcess(data string) error {
    if err := processLevel1(data); err != nil {
        return fmt.Errorf("깊이 처리 실패: %w", err)
    }
    return nil
}

func processLevel1(data string) error {
    if err := processLevel2(data); err != nil {
        return fmt.Errorf("1단계 처리 실패 (경로 data.field): %w", err)
    }
    return nil
}

func processLevel2(data string) error {
    _, err := json.Get(data, "data.field")
    return err
}

// 오류 체인 예제:
// 깊이 처리 실패: 1단계 처리 실패 (경로 data.field): path not found
```

## 관련 문서

- [상수와 오류](../api-reference/constants)
- [보안 개요](../security/)
- [성능 최적화](./performance)
