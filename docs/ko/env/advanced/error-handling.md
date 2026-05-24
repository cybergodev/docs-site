---
title: "오류 처리 - CyberGo env | 센티넬 오류와 복구 전략"
description: "CyberGo env 라이브러리 오류 처리와 모범 사례 완전 가이드, 15개 센티넬 오류의 errors.Is 정확한 일치 검사, 8가지 구조화된 오류 타입의 errors.As 컨텍스트 추출, 오류 복구 및 성능 저하 전략, 커스텀 오류 래핑 패턴과 오류 체인 Unwrap 추적 메서드를 상세히 설명하여 견고한 프로덕션급 Go 코드 작성을 지원합니다."
---

# 오류 처리

env 라이브러리는 구조화된 오류 처리 메커니즘을 제공하며, `errors.Is`와 `errors.As` 패턴을 지원합니다.

## 센티넬 오류

### 파일 오류

```go
var (
    ErrFileNotFound  = errors.New("file not found")
    ErrFileTooLarge  = errors.New("file exceeds maximum size limit")
)
```

**사용 예시:**

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    log.Println("구성 파일이 존재하지 않음")
}
if errors.Is(err, env.ErrFileTooLarge) {
    log.Println("구성 파일이 너무 큼")
}
```

### 파싱 오류

```go
var (
    ErrLineTooLong  = errors.New("line exceeds maximum length limit")
    ErrInvalidKey   = errors.New("invalid key format")
    ErrDuplicateKey = errors.New("duplicate key encountered")
)
```

### 보안 오류

```go
var (
    ErrForbiddenKey      = errors.New("key is forbidden for security reasons")
    ErrSecurityViolation = errors.New("security policy violation")
    ErrInvalidValue      = errors.New("invalid value content")
)
```

**금지 키 확인:**

```go
err := loader.Set("PATH", "/malicious")
if errors.Is(err, env.ErrForbiddenKey) {
    log.Println("금지 키 설정 시도 감지")
}
```

### 확장 오류

```go
var ErrExpansionDepth = errors.New("variable expansion depth exceeded")
```

### 상태 오류

```go
var (
    ErrClosed             = errors.New("loader has been closed")
    ErrInvalidConfig      = errors.New("invalid configuration")
    ErrAlreadyInitialized = errors.New("default loader already initialized")
    ErrNotInitialized     = errors.New("default loader not initialized; call Load() first")
    ErrMissingRequired    = errors.New("required key is missing")
)
```

**확인 방법:**

```go
// 로더 닫힘 여부 확인
if errors.Is(err, env.ErrClosed) {
    // 로더가 닫힘
}

// 기본 로더 초기화 여부 확인
if errors.Is(err, env.ErrAlreadyInitialized) {
    // 기본 로더가 이미 존재함, Load()를 반복 호출할 수 없음
}

// 기본 로더 미초기화 여부 확인
if errors.Is(err, env.ErrNotInitialized) {
    // 먼저 env.Load() 또는 env.LoadWithConfig()를 호출해야 함
}

// 필수 키 누락 여부 확인
if errors.Is(err, env.ErrMissingRequired) {
    // 필수 키 누락
}
```

### 어댑터 오류

```go
var ErrValidateRequiredUnsupported = errors.New(
    "custom validator does not implement ValidateRequired; " +
    "implement Validator interface for required key validation",
)
```

커스텀 검증기가 `KeyValidator` 인터페이스만 구현하고 완전한 `Validator` 인터페이스를 구현하지 않은 경우, `ValidateRequired` 호출 시 이 오류가 반환됩니다.

**확인 방법:**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // 커스텀 검증기가 필수 키 검증을 지원하지 않음
    // 완전한 Validator 인터페이스를 구현해야 함
}
```

::: tip 해결 방법
`KeyValidator`만 구현하는 대신 `Validator` 인터페이스(`ValidateKey`, `ValidateValue`, `ValidateRequired` 세 가지 메서드 포함)를 구현하세요.
:::

## 구조화된 오류 타입

### ParseError

파싱 오류, 위치 정보 포함:

```go
type ParseError struct {
    File    string  // 파일 이름
    Line    int     // 줄 번호
    Content string  // 오류 내용
    Err     error   // 원본 오류
}
```

**사용 예시:**

```go
err := loader.LoadFiles(".env")

var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    log.Printf("파싱 오류 %s:%d - %s\n",
        parseErr.File, parseErr.Line, parseErr.Err)
    // 출력: 파싱 오류 .env:15 - invalid key format
}
```

### FileError

파일 작업 오류:

```go
type FileError struct {
    Path  string  // 파일 경로
    Op    string  // 작업
    Err   error   // 원본 오류
    Size  int64   // 파일 크기
    Limit int64   // 제한
}
```

**사용 예시:**

```go
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    if fileErr.Size > 0 {
        log.Printf("파일 %s 크기 %d이(가) 제한 %d을(를) 초과\n",
            fileErr.Path, fileErr.Size, fileErr.Limit)
    }
}
```

### SecurityError

보안 오류:

```go
type SecurityError struct {
    Action  string  // 작업
    Reason  string  // 사유
    Key     string  // 키 이름
    Details string  // 상세 정보
}
```

**사용 예시:**

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    log.Printf("보안 오류: %s - %s (키: %s)\n",
        secErr.Action, secErr.Reason, secErr.Key)
}
```

### ValidationError

검증 오류:

```go
type ValidationError struct {
    Field   string  // 필드 이름
    Value   string  // 값
    Rule    string  // 규칙
    Message string  // 메시지
}
```

**사용 예시:**

```go
var valErr *env.ValidationError
if errors.As(err, &valErr) {
    log.Printf("검증 실패: 필드 %s - %s\n", valErr.Field, valErr.Message)
}
```

### ExpansionError

변수 확장 오류:

```go
type ExpansionError struct {
    Key   string  // 키 이름
    Depth int     // 현재 깊이
    Limit int     // 제한
    Chain string  // 확장 체인
}
```

**사용 예시:**

```go
var expErr *env.ExpansionError
if errors.As(err, &expErr) {
    log.Printf("확장 깊이 초과: %s (체인: %s)\n", expErr.Key, expErr.Chain)
}
```

### JSONError

JSON 파싱 오류:

```go
type JSONError struct {
    Path    string  // 파일 경로
    Message string  // 오류 메시지
    Err     error   // 원본 오류
}
```

**사용 예시:**

```go
var jsonErr *env.JSONError
if errors.As(err, &jsonErr) {
    log.Printf("JSON 오류 %s: %s\n", jsonErr.Path, jsonErr.Message)
}
```

### YAMLError

YAML 파싱 오류:

```go
type YAMLError struct {
    Path    string  // 파일 경로
    Line    int     // 줄 번호
    Column  int     // 열 번호
    Message string  // 오류 메시지
    Err     error   // 원본 오류
}
```

**사용 예시:**

```go
var yamlErr *env.YAMLError
if errors.As(err, &yamlErr) {
    log.Printf("YAML 오류 %s:%d:%d - %s\n",
        yamlErr.Path, yamlErr.Line, yamlErr.Column, yamlErr.Message)
}
```

### MarshalError

직렬화/역직렬화 오류:

```go
type MarshalError struct {
    Field   string  // 필드 이름
    Message string  // 오류 메시지
}
```

**사용 예시:**

```go
_, err := env.MarshalStruct(invalidData)
if err != nil && env.IsMarshalError(err) {
    var marshalErr *env.MarshalError
    if errors.As(err, &marshalErr) {
        log.Printf("직렬화 오류: 필드 %s - %s\n", marshalErr.Field, marshalErr.Message)
    }
}
```

## 오류 처리 패턴

### errors.Is 패턴

센티넬 오류 확인:

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // 파일 없음
    log.Println("구성 파일이 존재하지 않음, 기본값 사용")

case errors.Is(err, env.ErrFileTooLarge):
    // 파일이 너무 큼
    log.Fatal("구성 파일이 너무 큼")

case errors.Is(err, env.ErrForbiddenKey):
    // 금지 키
    log.Fatal("금지 키 감지")

case errors.Is(err, env.ErrInvalidKey):
    // 잘못된 키 형식
    log.Fatal("잘못된 키 감지")

case err != nil:
    // 기타 오류
    log.Fatalf("로딩 실패: %v", err)
}
```

### errors.As 패턴

상세 오류 정보 추출:

```go
err := loader.LoadFiles(".env")
if err == nil {
    return
}

// 파싱 오류 추출 시도
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    log.Fatalf("파싱 오류 %s %d번째 줄: %v",
        parseErr.File, parseErr.Line, parseErr.Err)
}

// 파일 오류 추출 시도
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    log.Fatalf("파일 %s 오류: %v", fileErr.Path, fileErr.Err)
}

// 보안 오류 추출 시도
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    log.Fatalf("보안 오류: %s - %s", secErr.Action, secErr.Reason)
}

// 기타 오류
log.Fatalf("알 수 없는 오류: %v", err)
```

### 조합 처리

```go
func handleLoadError(err error) {
    if err == nil {
        return
    }

    // 먼저 센티넬 오류 확인
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        log.Println("경고: 구성 파일이 존재하지 않음")
        return

    case errors.Is(err, env.ErrFileTooLarge):
        var fileErr *env.FileError
        errors.As(err, &fileErr)
        log.Fatalf("파일 %s이(가) 너무 큼 (%d > %d)",
            fileErr.Path, fileErr.Size, fileErr.Limit)
    }

    // 그 다음 구조화된 오류 확인
    var parseErr *env.ParseError
    if errors.As(err, &parseErr) {
        log.Fatalf("파싱 오류 %s:%d - %v",
            parseErr.File, parseErr.Line, parseErr.Err)
    }

    var secErr *env.SecurityError
    if errors.As(err, &secErr) {
        log.Fatalf("보안 오류: %s", secErr.Reason)
    }

    // 알 수 없는 오류
    log.Fatalf("오류: %v", err)
}
```

## 복구 패턴

### 우아한 성능 저하

```go
func loadConfig() *Config {
    cfg := env.ProductionConfig()
    cfg.Filenames = nil
    loader, err := env.New(cfg)
    if err != nil {
        log.Printf("구성 오류: %v, 기본 구성 사용", err)
        return defaultConfig()
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        if errors.Is(err, env.ErrFileNotFound) {
            log.Println("구성 파일이 존재하지 않음, 기본값 사용")
            return defaultConfig()
        }
        log.Fatalf("로딩 실패: %v", err)
    }

    if err := loader.Validate(); err != nil {
        log.Fatalf("검증 실패: %v", err)
    }

    return parseConfig(loader)
}
```

### 재시도 패턴

```go
func loadWithRetry(filenames []string, maxRetries int) error {
    cfg := env.DefaultConfig()
    cfg.Filenames = nil
    loader, err := env.New(cfg)
    if err != nil {
        return err
    }
    defer loader.Close()

    for i := 0; i < maxRetries; i++ {
        err := loader.LoadFiles(filenames...)
        if err == nil {
            return nil
        }

        if errors.Is(err, env.ErrFileNotFound) {
            time.Sleep(time.Second * time.Duration(i+1))
            continue
        }

        return err
    }

    return errors.New("max retries exceeded")
}
```

## 전체 예시

```go
package main

import (
    "errors"
    "fmt"
    "log"

    "github.com/cybergodev/env"
)

func main() {
    cfg := env.ProductionConfig()
    cfg.Filenames = nil
    cfg.FailOnMissingFile = true
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        handleLoadError(err)
    }

    if err := loader.Validate(); err != nil {
        handleValidationError(err)
    }

    log.Println("구성 로딩 성공")
}

func handleLoadError(err error) {
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        log.Fatal("구성 파일이 존재하지 않음")

    case errors.Is(err, env.ErrFileTooLarge):
        var fileErr *env.FileError
        errors.As(err, &fileErr)
        log.Fatalf("파일이 너무 큼: %s (%d bytes)", fileErr.Path, fileErr.Size)

    case errors.Is(err, env.ErrForbiddenKey):
        log.Fatal("금지 키 감지")
    }

    // 구조화된 오류
    var parseErr *env.ParseError
    if errors.As(err, &parseErr) {
        log.Fatalf("파싱 오류 %s:%d - %v",
            parseErr.File, parseErr.Line, parseErr.Err)
    }

    var secErr *env.SecurityError
    if errors.As(err, &secErr) {
        log.Fatalf("보안 오류: %s - %s", secErr.Action, secErr.Reason)
    }

    log.Fatalf("로딩 실패: %v", err)
}

func handleValidationError(err error) {
    var valErr *env.ValidationError
    if errors.As(err, &valErr) {
        log.Fatalf("검증 실패: %s - %s", valErr.Field, valErr.Message)
    }

    if errors.Is(err, env.ErrMissingRequired) {
        log.Fatal("필수 키 누락")
    }

    log.Fatalf("검증 실패: %v", err)
}
```

## 관련 문서

- [상수 및 오류](/ko/env/api-reference/constants) - 전체 오류 목록
- [Config API](/ko/env/api-reference/config) - 구성 제한 설정
- [보안 개요](/ko/env/security/) - 보안 오류 처리
