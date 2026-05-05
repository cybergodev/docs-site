---
title: 상수 및 오류 - CyberGo env | 센티넬 오류 및 보안 상수
description: CyberGo env 환경 변수 관리 라이브러리의 상수 및 오류 완전 참조 문서입니다. 보안 제한 상수, 센티넬 오류 정의, 구조화된 오류 타입, 미리 정의된 변수 및 보안 도구 함수의 상세 설명을 제공하며, errors.Is 및 errors.As 표준 패턴과 함께 Go 개발자가 다양한 오류 시나리오와 예외 상황을 올바르게 식별하고 처리할 수 있도록 돕습니다.
---

# 상수 및 오류

라이브러리에 정의된 상수, 오류 타입, 센티넬 오류 및 미리 정의된 변수입니다.

## 보안 제한 상수

### 기본 제한

```go
const (
    // DefaultMaxFileSize - 단일 파일 최대 바이트 수
    DefaultMaxFileSize int64 = 2 * 1024 * 1024  // 2 MB

    // DefaultMaxLineLength - 단일 행 최대 길이
    DefaultMaxLineLength int = 1024  // 1 KB

    // DefaultMaxKeyLength - 키 이름 최대 길이
    DefaultMaxKeyLength int = 64

    // DefaultMaxValueLength - 값 최대 길이
    DefaultMaxValueLength int = 4096  // 4 KB

    // DefaultMaxVariables - 파일당 최대 변수 수
    DefaultMaxVariables int = 500

    // DefaultMaxExpansionDepth - 변수 확장 최대 깊이
    DefaultMaxExpansionDepth int = 5
)
```

### 하드 상한

::: warning 참고
다음은 라이브러리 내부의 하드 상한 (미내보내기)으로, `Config.Validate()` 내부 검사에 사용됩니다. 사용자는 이 상수를 직접 참조할 수 없지만, `cfg.Validate()`가 자동으로 제한 초과 여부를 검사합니다.
:::

| 상수 | 값 | 설명 |
|------|-----|------|
| HardMaxFileSize | 100 MB | 파일 크기 하드 상한 |
| HardMaxLineLength | 64 KB | 행 길이 하드 상한 |
| HardMaxKeyLength | 1024 | 키 길이 하드 상한 |
| HardMaxValueLength | 1 MB | 값 길이 하드 상한 |
| HardMaxVariables | 10000 | 변수 수 하드 상한 |
| HardMaxExpansionDepth | 20 | 확장 깊이 하드 상한 |

설정 검증은 하드 상한 초과 여부를 검사합니다:

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 200 * 1024 * 1024  // 100MB 상한 초과

if err := cfg.Validate(); err != nil {
    // 오류 반환: MaxFileSize exceeds hard limit
}
```

## 센티넬 오류

### 파일 오류

```go
var ErrFileNotFound = errors.New("file not found")
var ErrFileTooLarge = errors.New("file exceeds maximum size limit")
```

검사 방법:

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    // 파일 없음
}
if errors.Is(err, env.ErrFileTooLarge) {
    // 파일이 너무 큼
}
```

### 파싱 오류

```go
var ErrLineTooLong = errors.New("line exceeds maximum length limit")
var ErrInvalidKey = errors.New("invalid key format")
var ErrDuplicateKey = errors.New("duplicate key encountered")
```

### 보안 오류

```go
var ErrForbiddenKey = errors.New("key is forbidden for security reasons")
var ErrSecurityViolation = errors.New("security policy violation")
var ErrNullByte = errors.New("null byte detected in input")
var ErrControlChar = errors.New("control character detected in input")
var ErrInvalidValue = errors.New("invalid value content")
```

금지 키 검사:

```go
err := loader.Set("PATH", "value")
if errors.Is(err, env.ErrForbiddenKey) {
    // 금지 키 설정 시도
}
```

### 확장 오류

```go
var ErrExpansionDepth = errors.New("variable expansion depth exceeded")
```

### 제한 오류

```go
var ErrMaxVariables = errors.New("maximum number of variables exceeded")
```

### 상태 오류

```go
var ErrClosed = errors.New("loader has been closed")
var ErrInvalidConfig = errors.New("invalid configuration")
var ErrAlreadyInitialized = errors.New("default loader already initialized")
var ErrMissingRequired = errors.New("required key is missing")
```

**검사 방법:**

```go
// 로더 닫힘 여부 확인
if errors.Is(err, env.ErrClosed) {
    // 로더가 닫힘
}

// 기본 로더 초기화 여부 확인
if errors.Is(err, env.ErrAlreadyInitialized) {
    // 기본 로더가 이미 존재하여 Load()를 반복 호출할 수 없음
}

// 필수 키 누락 확인
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

**검사 방법:**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // 커스텀 검증기가 필수 키 검증을 지원하지 않음
    // 완전한 Validator 인터페이스를 구현해야 함
}
```

::: tip 해결 방법
`KeyValidator`만 구현하는 대신 `Validator` 인터페이스(`ValidateKey`, `ValidateValue`, `ValidateRequired` 세 메서드 포함)를 구현하세요.
:::

## 오류 타입

### ParseError

위치 정보를 포함한 파싱 오류:

```go
type ParseError struct {
    File    string  // 파일 이름
    Line    int     // 줄 번호
    Content string  // 오류 내용 (마스크됨)
    Err     error   // 원래 오류
}
```

사용 예제:

```go
err := loader.LoadFiles(".env")
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("파싱 오류 %s:%d: %v\n",
        parseErr.File, parseErr.Line, parseErr.Err)
}
```

### ValidationError

검증 오류:

```go
type ValidationError struct {
    Field   string  // 필드 이름
    Value   string  // 값 (마스크됨)
    Rule    string  // 규칙
    Message string  // 메시지
}
```

### SecurityError

보안 오류:

```go
type SecurityError struct {
    Action  string  // 작업
    Reason  string  // 원인
    Key     string  // 키 이름 (마스크됨)
    Details string  // 추가 상세 정보
}
```

사용 예제:

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("보안 오류: %s - %s\n", secErr.Action, secErr.Reason)
}
```

### FileError

파일 작업 오류:

```go
type FileError struct {
    Path  string  // 파일 경로
    Op    string  // 작업 (open, stat, size_check)
    Err   error   // 원래 오류
    Size  int64   // 파일 크기 (Size 검사 시)
    Limit int64   // 제한 (Size 검사 시)
}
```

사용 예제:

```go
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("파일 %s 크기 %d이 제한 %d을 초과\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
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

### JSONError

JSON 파싱 오류:

```go
type JSONError struct {
    Path    string  // 파일 경로
    Message string  // 오류 메시지
    Err     error   // 원래 오류
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
    Err     error   // 원래 오류
}
```

### MarshalError

직렬화 오류:

```go
type MarshalError struct {
    Field   string  // 필드 이름
    Message string  // 오류 메시지
}

func IsMarshalError(err error) bool  // 검사 함수
```

## 미리 정의된 변수

### DefaultForbiddenKeys

시스템 핵심 변수 수정을 방지하는 내장 금지 키 목록:

::: warning 참고
`defaultForbiddenKeys`는 라이브러리 내부 변수 (미내보내기)이므로 `env.DefaultForbiddenKeys`로 직접 접근할 수 없습니다. 다음은 참고용 내부 사용 전체 목록입니다.
:::

| 카테고리 | 금지 키 |
|------|--------|
| 시스템 경로 | `PATH` |
| 동적 링커 (Linux) | `LD_PRELOAD`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64`, `LD_AUDIT`, `LD_DEBUG` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| 언어 런타임 | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

**위험 설명:**

| 키 | 위험 유형 | 설명 |
|----|----------|------|
| `PATH` | 명령 가로챔 | 명령 검색 경로 수정 |
| `LD_PRELOAD` | 라이브러리 주입 | 악성 동적 라이브러리 사전 로드 |
| `LD_LIBRARY_PATH` | 라이브러리 가로챔 | 라이브러리 검색 경로 수정 |
| `DYLD_INSERT_LIBRARIES` | 라이브러리 주입 | macOS 라이브러리 주입 |
| `PYTHONPATH` | 모듈 가로챔 | Python 모듈검색경로 |
| `IFS` | 파싱 공격 | 필드 구분자 수정 |

**사용 예제:**

```go
// 금지 키 설정 시도하면 반환 ErrForbiddenKey
err := loader.Set("PATH", "/malicious/path")
if errors.Is(err, env.ErrForbiddenKey) {
    // 키가 금지됨
}

// 추가 금지 키
cfg := env.DefaultConfig()
cfg.ForbiddenKeys = []string{"MY_SENSITIVE_VAR"}
```

### SensitiveKeyPatterns

민감 키 패턴 목록으로, 민감 설정을 자동 감지하는 데 사용됩니다. 키 이름에 이러한 패턴이 포함되면 (대소문자 구분 없이) 민감한 것으로 식별됩니다:

::: warning 참고
`sensitiveKeyPatterns`는 라이브러리 내부 변수 (미내보내기)이며, `IsSensitiveKey()` 함수를 통해 간접적으로 접근합니다. 다음은 참고용 주요 민감 패턴 카테고리입니다.
:::

**주요 민감 패턴 카테고리:**

| 카테고리 | 패턴 예시 |
|------|----------|
| 인증과 인가 | `PASSWORD`, `SECRET`, `TOKEN`, `AUTH`, `CREDENTIAL`, `PASSPHRASE`, `SESSION`, `COOKIE` |
| API와 키 | `API_KEY`, `APIKEY`, `ACCESS_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `PUBLIC_KEY` |
| 암호화와 보안 | `PRIVATE`, `ENCRYPTION_KEY`, `ENCRYPT_KEY`, `DECRYPT_KEY`, `SIGNING_KEY`, `SIGN_KEY`, `VERIFY_KEY` |
| 금융 및 PII | `SSN`, `SOCIAL_SECURITY`, `CREDIT_CARD`, `CARD_NUMBER`, `CVV`, `CVC`, `CCV`, `PAN` |
| 암호화폐 | `MNEMONIC`, `SEED`, `RECOVERY`, `WALLET`, `PRIVATE_ADDRESS` |
| 데이터베이스 | `CONNECTION_STRING`, `CONN_STRING`, `DATABASE_URL`, `DB_PASSWORD` |
| 클라우드 서비스 | `AWS_SECRET`, `AZURE_KEY`, `GCP_KEY`, `SERVICE_ACCOUNT` |

**매치규칙：**
- 대소문자 구분 없음
- 키 이름에 패턴 중 하나가 포함되면 민감한 것으로 식별

**사용 예제:**

```go
// 키가 민감한지 확인
if env.IsSensitiveKey("DB_PASSWORD") {
    // 안전한 방식으로 처리
    secret := env.GetSecure("DB_PASSWORD")
    if secret != nil {
        defer secret.Release()
    }
}
```

### DefaultKeyPattern

기본 키 이름 검증 패턴:

```go
var DefaultKeyPattern *regexp.Regexp = nil
```

::: tip 성능 최적화
`nil` 값은 빠른 바이트 수준 검증을 활성화합니다 (약 10배 성능 향상).
기본검증규칙：문자로 시작，문자, 숫자, 밑줄만 포함。
:::

**커스텀패턴：**

```go
import "regexp"

cfg := env.DefaultConfig()
// 대문자로 시작하는 키만 허용
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,63}$`)
```

## 보안 도구 함수

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

키 이름이 민감 패턴과 일치하는지 확인합니다.

```go
if env.IsSensitiveKey("DB_PASSWORD") {
    // 민감 키, 보안 방식으로 처리
    secret := env.GetSecure("DB_PASSWORD")
    defer secret.Release()
}
```

### MaskValue

```go
func MaskValue(key, value string) string
```

키의 민감도에 따라 마스크된 값을 반환합니다.

```go
// 민감 키 - [MASKED:N chars] 형식 반환
masked := env.MaskValue("API_KEY", "secret123")
// 반환: [MASKED:9 chars]

// 비민감 키 - 원래 값 반환 (20자 초과 시 잘림)
masked := env.MaskValue("APP_NAME", "myapp")
// 반환: myapp
masked := env.MaskValue("DESCRIPTION", "this is a very long description text")
// 반환: this is a very lo...
```

### MaskKey

```go
func MaskKey(key string) string
```

로그용으로 키 이름을 마스크합니다.

```go
masked := env.MaskKey("DB_PASSWORD")
// 반환: DB***
```

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

문자열에서 잠재적으로 민감한 콘텐츠를 마스크합니다. 50자를 초과하는 문자열은 자릅니다.

**매개변수：**
- `s` - 원래문자열

**반환：**
- `string` - 마스크된 문자열

```go
// 긴 문자열은 잘림
log := "This is a very long log message that exceeds 50 characters and will be truncated"
clean := env.MaskSensitiveInString(log)
// 반환: "This is a very long log message that exceeds 50..."

// 짧은 문자열은 그대로 유지
short := "Short message"
clean := env.MaskSensitiveInString(short)
// 반환: "Short message"
```

::: warning 참고
이 함수는 주로 긴 문자열을 자르는 데 사용됩니다. 민감 키-값 쌍을 자동으로 마스크하려면 `SanitizeForLog`를 사용하세요.
:::

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

문자열에서 민감 키-값 쌍 정보를 정리합니다. `key=value` 형식의 민감 값을 자동으로 감지하고 마스크합니다.

**매개변수：**
- `s` - 원래문자열

**반환：**
- `string` - 정리된 문자열

**감지의민감키패턴：**
- `password=`, `secret=`, `token=`, `auth=`, `credential=`, `passphrase=`, `session=`, `cookie=`
- `api_key=`, `apikey=`, `access_key=`, `secret_key=`, `private_key=`, `public_key=`
- `encrypt_key=`, `decrypt_key=`, `signing_key=`
- `ssn=`, `credit_card=`, `card_number=`, `cvv=`, `cvc=`
- `mnemonic=`, `seed=`, `recovery=`, `wallet=`
- `connection_string=`, `database_url=`, `db_password=`

```go
// 민감 키-값 쌍 자동 마스크
msg := "Connected with password=secret123 api_key=abc123"
clean := env.SanitizeForLog(msg)
// 반환: "Connected with password=[MASKED] api_key=[MASKED]"

// 비민감 키-값 쌍은 그대로 유지
msg := "Config loaded: app_name=myapp port=8080"
clean := env.SanitizeForLog(msg)
// 반환: "Config loaded: app_name=myapp port=8080"
```

::: tip 사용 시나리오
로그 출력, 오류 메시지, 디버그 정보 등 민감 키-값 쌍을 자동 필터링해야 하는 시나리오에 적합합니다.
:::

### ClearBytes

```go
func ClearBytes(b []byte)
```

바이트 슬라이스를 안전하게 초기화합니다.

```go
sensitive := []byte("secret-data")
// 사용...
env.ClearBytes(sensitive)
// sensitive 이제 모두 0
```

## FileFormat 상수

파일 형식 타입:

```go
type FileFormat int

const (
    FormatAuto  FileFormat = iota  // 자동감지
    FormatEnv                      // .env 형식
    FormatJSON                     // JSON 형식
    FormatYAML                     // YAML 형식
)
```

사용 예제:

```go
// 형식 감지
format := env.DetectFormat("config.json")  // FormatJSON

// 지정 형식으로 직렬화
data, _ := env.Marshal(cfg, env.FormatJSON)

// 형식 문자열
fmt.Println(format.String())  // "json"
```

## 오류 확인 패턴

### errors.Is 패턴

센티넬 오류 확인:

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // 파일 없음
case errors.Is(err, env.ErrFileTooLarge):
    // 파일이 너무 큼
case errors.Is(err, env.ErrForbiddenKey):
    // 금지 키
case errors.Is(err, env.ErrClosed):
    // 로더가 닫힘
}
```

### errors.As 패턴

상세 오류 정보 추출:

```go
err := loader.LoadFiles(".env")

var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("파싱 오류 %s:%d\n", parseErr.File, parseErr.Line)
}

var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("파일 %s 크기 %d이 제한 %d을 초과\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}

var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("보안 오류: %s - %s\n", secErr.Action, secErr.Reason)
}
```

## 완전한 오류 처리 예제

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "os"

    "github.com/cybergodev/env"
)

func main() {
    cfg := env.ProductionConfig()
    cfg.FailOnMissingFile = true

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        switch {
        case errors.Is(err, env.ErrFileNotFound):
            log.Fatal("설정파일 없음")

        case errors.Is(err, env.ErrFileTooLarge):
            log.Fatal("설정파일이 너무 큼")

        case errors.Is(err, env.ErrClosed):
            log.Fatal("로더가 닫힘")

        default:
            var parseErr *env.ParseError
            if errors.As(err, &parseErr) {
                log.Fatalf("파싱 오류 %s:%d - %v",
                    parseErr.File, parseErr.Line, parseErr.Err)
            }

            var fileErr *env.FileError
            if errors.As(err, &fileErr) {
                log.Fatalf("파일 오류 %s - %v", fileErr.Path, fileErr.Err)
            }

            var secErr *env.SecurityError
            if errors.As(err, &secErr) {
                log.Fatalf("보안 오류: %s - %s", secErr.Action, secErr.Reason)
            }

            var jsonErr *env.JSONError
            if errors.As(err, &jsonErr) {
                log.Fatalf("JSON 잘못됨 %s: %s", jsonErr.Path, jsonErr.Message)
            }

            var yamlErr *env.YAMLError
            if errors.As(err, &yamlErr) {
                log.Fatalf("YAML 잘못됨 %s:%d:%d - %s",
                    yamlErr.Path, yamlErr.Line, yamlErr.Column, yamlErr.Message)
            }

            log.Fatal(err)
        }
    }

    // 필수 키 검증
    if err := loader.Validate(); err != nil {
        var valErr *env.ValidationError
        if errors.As(err, &valErr) {
            log.Fatalf("검증 실패: %s - %s", valErr.Field, valErr.Message)
        }
        log.Fatal(err)
    }
}
```

## 관련 문서

- [SecureValue API](/ko/env/api-reference/secure-value) - 안전도구함수완전한 API
- [Config API](/ko/env/api-reference/config) - 설정옵션과/와제한설정
- [보안 개요](/ko/env/security/) - 보안 아키텍처와 핵심 기능
- [프로덕션 체크리스트](/ko/env/security/production-checklist) - 출시 전 보안 점검
