---
title: "상수 및 오류 - CyberGo env | 센티넬 오류와 보안 상수"
description: "CyberGo env 상수·오류 참조로 DefaultMaxFileSize 제한, ErrFileNotFound 센티넬 오류, ParseError 유형, IsSensitiveKey와 MaskValue 유틸리티 함수를 제공합니다."
---

# 상수 및 오류

라이브러리에 정의된 상수, 오류 유형, 센티넬 오류 및 사전 정의된 변수입니다.

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

### 하드 상한선

:::warning 참고
다음은 라이브러리 내부의 하드 상한선(내보내지 않음)으로, `Config.Validate()` 내부 검사에 사용됩니다. 사용자가 이 상수들을 직접 참조할 수는 없지만, `cfg.Validate()`가 자동으로 이 제한을 초과하는지 검사합니다.
:::

| 상수 | 값 | 설명 |
|------|-----|------|
| HardMaxFileSize | 100 MB | 파일 크기 하드 상한선 |
| HardMaxLineLength | 64 KB | 행 길이 하드 상한선 |
| HardMaxKeyLength | 1024 | 키 길이 하드 상한선 |
| HardMaxValueLength | 1 MB | 값 길이 하드 상한선 |
| HardMaxVariables | 10000 | 변수 수 하드 상한선 |
| HardMaxExpansionDepth | 20 | 확장 깊이 하드 상한선 |

설정 검증은 하드 제한을 초과하는지 확인합니다:

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

확인 방법:

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    // 파일이 존재하지 않음
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
var ErrInvalidValue = errors.New("invalid value content")
```

금지 키 확인:

```go
err := loader.Set("PATH", "value")
if errors.Is(err, env.ErrForbiddenKey) {
    // 금지된 키 설정 시도
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
var ErrNotInitialized = errors.New("default loader not initialized; call Load() first")
var ErrMissingRequired = errors.New("required key is missing")
```

**확인 방법:**

```go
// 로더가 닫혔는지 확인
if errors.Is(err, env.ErrClosed) {
    // 로더가 닫힘
}

// 기본 로더가 이미 초기화되었는지 확인
if errors.Is(err, env.ErrAlreadyInitialized) {
    // 기본 로더가 이미 존재함, Load()를 반복 호출할 수 없음
}

// 기본 로더가 초기화되지 않았는지 확인
if errors.Is(err, env.ErrNotInitialized) {
    // 먼저 env.Load() 또는 env.LoadWithConfig()를 호출해야 함
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

사용자 정의 검증기가 `KeyValidator` 인터페이스만 구현하고 전체 `Validator` 인터페이스를 구현하지 않은 경우, `ValidateRequired`를 호출하면 이 오류가 반환됩니다.

**확인 방법:**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // 사용자 정의 검증기가 필수 키 검증을 지원하지 않음
    // 전체 Validator 인터페이스를 구현해야 함
}
```

:::tip 해결 방법
`KeyValidator`만 구현하는 대신 `Validator` 인터페이스(`ValidateKey`, `ValidateValue`, `ValidateRequired` 세 메서드 포함)를 구현하세요.
:::

## 오류 유형

### ParseError

파싱 오류, 위치 정보 포함:

```go
type ParseError struct {
    File    string  // 파일 이름
    Line    int     // 행 번호
    Content string  // 오류 내용 (마스킹됨)
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
    Value   string  // 값 (마스킹됨)
    Rule    string  // 규칙
    Message string  // 메시지
}
```

### SecurityError

보안 오류:

```go
type SecurityError struct {
    Action  string  // 작업
    Reason  string  // 사유
    Key     string  // 키 이름 (마스킹됨)
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
    fmt.Printf("파일 %s 크기 %d이(가) 제한 %d을(를) 초과함\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}
```

### ExpansionError

변수 확장 오류:

```go
type ExpansionError struct {
    Key   string             // 키 이름
    Depth int                // 현재 깊이
    Limit int                // 제한
    Chain string             // 확장 체인 (민감정보 제거됨)
    Kind  ExpansionErrorKind // 오류 원인 범주 (기본값 = 깊이/순환)
}
```

**오류 분류 (`Kind` 필드):**

```go
type ExpansionErrorKind int

const (
    // ExpansionDepthKind는 확장이 재귀 깊이 제한에 도달했거나 변수 순환을 감지했음을 나타냅니다.
    // 기본값이므로 일반적인 깊이/순환 오류는 명시적 분류가 필요 없습니다.
    // errors.Is(err, ErrExpansionDepth)로 일치 여부를 확인할 수 있습니다.
    ExpansionDepthKind ExpansionErrorKind = iota

    // ExpansionRequiredKind는 필수 변수(${VAR:?message})가 설정되지 않았거나 비어 있음을 나타냅니다.
    // 깊이 초과가 아니므로 ErrExpansionDepth와 일치하지 않습니다.
    ExpansionRequiredKind
)
```

**`errors.Is` 동작:** `*ExpansionError`는 `Kind != ExpansionRequiredKind`일 때만 `ErrExpansionDepth`와 일치합니다. 필수 변수 오류는 별도의 실패 모드이며 `ErrExpansionDepth`와 일치하지 않습니다.

사용 예:

```go
var expErr *env.ExpansionError
if errors.As(err, &expErr) {
    switch expErr.Kind {
    case env.ExpansionDepthKind:
        // 깊이 초과 또는 순환: errors.Is(err, env.ErrExpansionDepth) == true
        fmt.Printf("깊이 %d/%d, 체인: %s\n", expErr.Depth, expErr.Limit, expErr.Chain)
    case env.ExpansionRequiredKind:
        // 필수 변수 미설정: errors.Is(err, env.ErrExpansionDepth) == false
        fmt.Printf("필수 변수 %s가 설정되지 않음\n", expErr.Key)
    }
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
    Line    int     // 행 번호
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

func IsMarshalError(err error) bool  // 확인 함수
```

## 사전 정의된 변수

### DefaultForbiddenKeys

내장 금지 키 목록으로, 시스템 핵심 변수의 수정을 방지합니다:

:::warning 참고
`defaultForbiddenKeys`는 라이브러리 내부 변수(내보내지 않음)로, `env.DefaultForbiddenKeys`를 통해 직접 접근할 수 없습니다. 다음은 참고용 내부 사용 전체 목록입니다.
:::

| 범주 | 금지 키 |
|------|--------|
| 시스템 경로 | `PATH` |
| 동적 링커 (Linux) | `LD_PRELOAD`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64`, `LD_AUDIT`, `LD_DEBUG` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Windows | `COMSPEC`, `PATHEXT`, `SYSTEMROOT`, `WINDIR` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| 언어 런타임 | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

**위험 설명:**

| 키 | 위험 유형 | 설명 |
|----|----------|------|
| `PATH` | 명령 가로채기 | 명령 검색 경로 수정 |
| `LD_PRELOAD` | 라이브러리 주입 | 악성 동적 라이브러리 사전 로드 |
| `LD_LIBRARY_PATH` | 라이브러리 가로채기 | 라이브러리 검색 경로 수정 |
| `DYLD_INSERT_LIBRARIES` | 라이브러리 주입 | macOS 라이브러리 주입 |
| `COMSPEC` | 명령 가로채기 | Windows 명령 인터프리터 경로 덮어쓰기 |
| `PATHEXT` | 명령 가로채기 | Windows 실행 파일 확장자 변조 |
| `SYSTEMROOT` | 시스템 파괴 | Windows 시스템 루트 디렉토리 변조 |
| `WINDIR` | 시스템 파괴 | Windows 디렉토리 변조 |
| `PYTHONPATH` | 모듈 가로채기 | Python 모듈 검색 경로 |
| `IFS` | 파싱 공격 | 필드 구분자 수정 |

**사용 예제:**

```go
// 금지된 키 설정 시도 시 ErrForbiddenKey 반환
err := loader.Set("PATH", "/malicious/path")
if errors.Is(err, env.ErrForbiddenKey) {
    // 키가 금지됨
}

// 추가 금지 키 추가
cfg := env.DefaultConfig()
cfg.ForbiddenKeys = []string{"MY_SENSITIVE_VAR"}
```

### SensitiveKeyPatterns

민감 키 패턴 목록으로, 민감한 설정을 자동으로 감지하는 데 사용합니다. 키 이름에 이 패턴이 포함되면 (대소문자 구분 없음) 민감한 것으로 식별됩니다:

:::warning 참고
`sensitiveKeyPatterns`는 라이브러리 내부 변수(내보내지 않음)로, `IsSensitiveKey()` 함수를 통해 간접적으로 접근합니다. 다음은 참고용 주요 민감 패턴 범주입니다.
:::

**주요 민감 패턴 범주:**

| 범주 | 패턴 예시 |
|------|----------|
| 인증 및 권한 | `PASSWORD`, `SECRET`, `TOKEN`, `AUTH`, `CREDENTIAL`, `PASSPHRASE`, `SESSION`, `COOKIE` |
| API 및 키 | `API_KEY`, `APIKEY`, `ACCESS_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `PUBLIC_KEY` |
| 암호화 및 보안 | `PRIVATE`, `ENCRYPTION_KEY`, `ENCRYPT_KEY`, `DECRYPT_KEY`, `SIGNING_KEY`, `SIGN_KEY`, `VERIFY_KEY` |
| 금융 및 PII | `SSN`, `SOCIAL_SECURITY`, `CREDIT_CARD`, `CARD_NUMBER`, `CVV`, `CVC`, `CCV`, `PAN` |
| 암호화폐 | `MNEMONIC`, `SEED`, `RECOVERY`, `WALLET`, `PRIVATE_ADDRESS` |
| 데이터베이스 | `CONNECTION_STRING`, `CONN_STRING`, `DATABASE_URL`, `DB_PASSWORD` |
| 클라우드 서비스 | `AWS_SECRET`, `AZURE_KEY`, `GCP_KEY`, `SERVICE_ACCOUNT` |

**일치 규칙:**
- 대소문자 구분 없음
- 키 이름에 패턴 중 하나라도 포함되면 민감한 것으로 식별

**사용 예제:**

```go
// 키가 민감한지 확인
if env.IsSensitiveKey("DB_PASSWORD") {
    // 보안 방식으로 처리
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

:::tip 성능 최적화
`nil` 값은 빠른 바이트 수준 검증을 활성화합니다 (약 10배 성능 향상).
기본 검증 규칙: 문자로 시작, 문자, 숫자, 밑줄만 포함.
:::

**사용자 정의 패턴:**

```go
import "regexp"

cfg := env.DefaultConfig()
// 대문자로 시작하는 키만 허용
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,63}$`)
```

## 보안 유틸리티 함수

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

키 이름이 민감 패턴과 일치하는지 확인합니다.

```go
if env.IsSensitiveKey("DB_PASSWORD") {
    // 민감한 키, 보안 방식으로 처리
    secret := env.GetSecure("DB_PASSWORD")
    defer secret.Release()
}
```

### MaskValue

```go
func MaskValue(key, value string) string
```

키의 민감도에 따라 마스킹된 값을 반환합니다.

```go
// 민감한 키 - [MASKED:N chars] 형식 반환
masked := env.MaskValue("API_KEY", "secret123")
// 반환: [MASKED:9 chars]

// 민감하지 않은 키 - 원래 값 반환 (20자 초과 시 잘림)
masked := env.MaskValue("APP_NAME", "myapp")
// 반환: myapp
masked := env.MaskValue("DESCRIPTION", "this is a very long description text")
// 반환: this is a very lo...
```

### MaskKey

```go
func MaskKey(key string) string
```

키 이름을 로깅용으로 마스킹합니다.

```go
masked := env.MaskKey("DB_PASSWORD")
// 반환: DB***
```

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

문자열에서 잠재적으로 민감한 내용을 마스킹합니다. 50자를 초과하는 문자열은 잘립니다.

**매개변수:**
- `s` - 원래 문자열

**반환값:**
- `string` - 마스킹된 문자열

```go
// 긴 문자열은 잘림
log := "This is a very long log message that exceeds 50 characters and will be truncated"
clean := env.MaskSensitiveInString(log)
// 반환: "This is a very long log message that exceeds 50..."

// 짧은 문자열은 유지
short := "Short message"
clean := env.MaskSensitiveInString(short)
// 반환: "Short message"
```

:::warning 참고
이 함수는 주로 긴 문자열을 자르는 데 사용됩니다. 민감한 키-값 쌍을 자동으로 마스킹하려면 `SanitizeForLog`를 사용하세요.
:::

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

문자열에서 민감한 키-값 쌍 정보를 정리합니다. `key=value` 형식의 민감한 값을 자동으로 감지하고 마스킹합니다.

**매개변수:**
- `s` - 원래 문자열

**반환값:**
- `string` - 정리된 문자열

**감지하는 민감 키 패턴:**
- `password=`, `secret=`, `token=`, `auth=`, `credential=`, `passphrase=`, `session=`, `cookie=`
- `api_key=`, `apikey=`, `access_key=`, `secret_key=`, `private_key=`, `public_key=`
- `encrypt_key=`, `decrypt_key=`, `signing_key=`
- `ssn=`, `credit_card=`, `card_number=`, `cvv=`, `cvc=`
- `mnemonic=`, `seed=`, `recovery=`, `wallet=`
- `connection_string=`, `database_url=`, `db_password=`

```go
// 민감한 키-값 쌍 자동 마스킹
msg := "Connected with password=secret123 api_key=abc123"
clean := env.SanitizeForLog(msg)
// 반환: "Connected with password=[MASKED] api_key=[MASKED]"

// 민감하지 않은 키-값 쌍은 유지
msg := "Config loaded: app_name=myapp port=8080"
clean := env.SanitizeForLog(msg)
// 반환: "Config loaded: app_name=myapp port=8080"
```

:::tip 사용 사례
로그 출력, 오류 메시지, 디버그 정보 등 민감한 키-값 쌍을 자동으로 필터링해야 하는 시나리오에 적합합니다.
:::

### ClearBytes

```go
func ClearBytes(b []byte)
```

바이트 슬라이스를 안전하게 제로화합니다.

```go
sensitive := []byte("secret-data")
// 사용...
env.ClearBytes(sensitive)
// sensitive는 이제 모두 0
```

## FileFormat 상수

파일 형식 유형:

```go
type FileFormat int

const (
    FormatAuto  FileFormat = iota  // 자동 감지
    FormatEnv                      // .env 형식
    FormatJSON                     // JSON 형식
    FormatYAML                     // YAML 형식
)
```

사용 예제:

```go
// 형식 감지
format := env.DetectFormat("config.json")  // FormatJSON

// 지정된 형식으로 직렬화
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
    // 파일이 존재하지 않음
case errors.Is(err, env.ErrFileTooLarge):
    // 파일이 너무 큼
case errors.Is(err, env.ErrForbiddenKey):
    // 금지된 키
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
    fmt.Printf("파싱 오류: %s %d행\n", parseErr.File, parseErr.Line)
}

var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("파일 %s 크기 %d이(가) 제한 %d을(를) 초과함\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}

var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("보안 오류: %s - %s\n", secErr.Action, secErr.Reason)
}
```

## 전체 오류 처리 예제

```go
package main

import (
    "errors"
    "log"

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
            log.Fatal("설정 파일이 존재하지 않음")

        case errors.Is(err, env.ErrFileTooLarge):
            log.Fatal("설정 파일이 너무 큼")

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
                log.Fatalf("JSON 오류 %s: %s", jsonErr.Path, jsonErr.Message)
            }

            var yamlErr *env.YAMLError
            if errors.As(err, &yamlErr) {
                log.Fatalf("YAML 오류 %s:%d:%d - %s",
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

- [SecureValue API](/ko/env/api-reference/secure-value) - 보안 유틸리티 함수 전체 API
- [Config API](/ko/env/api-reference/config) - 설정 옵션 및 제한 설정
- [보안 개요](/ko/env/security/) - 보안 아키텍처 및 핵심 기능
- [프로덕션 체크리스트](/ko/env/security/production-checklist) - 출시 전 보안 점검
