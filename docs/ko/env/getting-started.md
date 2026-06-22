---
title: "빠른 시작 - CyberGo env | 5분 입문 가이드"
description: "CyberGo env 5분 빠른 시작 가이드로, go get 설치부터 .env 로딩·타입 안전 읽기·구조체 매핑·변수 확장까지 핵심 기능과 실행 가능한 코드 예제를 제공합니다."
---

# 빠른 시작

5분 안에 env 라이브러리를 시작하세요. 설치부터 실제 사용까지.

## 설치

```bash
go get github.com/cybergodev/env
```

:::tip 요구 사항
Go 1.25+
:::

## .env 파일 생성

프로젝트 루트 디렉토리에 `.env` 파일을 생성합니다:

```bash
# 데이터베이스 설정
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=secret

# 애플리케이션 설정
DEBUG=true
APP_NAME=myapp
LOG_LEVEL=info

# 다중 값 (쉼표 구분)
ALLOWED_HOSTS=localhost,example.com,api.example.com
```

## 가장 간단한 사용법

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // .env 파일을 로드하고 시스템 환경에 적용
    if err := env.Load(".env"); err != nil {
        panic(err)
    }

    // 환경 변수 가져오기
    host := env.GetString("DB_HOST", "localhost")
    port := env.GetInt("DB_PORT", 5432)

    fmt.Printf("Server: %s:%d\n", host, port)
}
```

## 값 읽기 - 모든 타입

### 기본 타입

```go
// === 기본값 포함 ===

// 문자열 - 찾지 못하면 기본값 "localhost" 반환
host := env.GetString("HOST", "localhost")

// 정수 (int64) - 찾지 못하면 기본값 8080 반환
port := env.GetInt("PORT", 8080)

// 불리언 - 찾지 못하면 기본값 false 반환
debug := env.GetBool("DEBUG", false)

// 시간 간격 - 찾지 못하면 기본값 30s 반환
timeout := env.GetDuration("TIMEOUT", 30*time.Second)


// === 기본값 없이 ===

// 문자열 - 찾지 못하면 빈 문자열 "" 반환
host := env.GetString("HOST")

// 정수 (int64) - 찾지 못하면 0 반환
port := env.GetInt("PORT")

// 불리언 - 찾지 못하면 false 반환
debug := env.GetBool("DEBUG")

// 시간 간격 - 찾지 못하면 0 반환
timeout := env.GetDuration("TIMEOUT")
```

:::tip 키 이름 해석
라이브러리는 다양한 키 이름 접근 방식을 지원합니다:

```go
// JSON: {"app": {"name": "myapp"}}
// 저장됨: APP_NAME=myapp

// 다음 방식 모두 값에 접근할 수 있습니다
name := env.GetString("APP_NAME")      // 평탄화 키 이름 (권장)
name := env.GetString("app.name")      // 점 경로 (자동 변환)
name := env.GetString("APP.NAME")      // 대문자 점 경로
```

**해석 규칙:**
1. **정확한 일치**: 키 이름 `KEY`를 우선적으로 검색
2. **대문자 변환**: 소문자 키 이름을 대문자 버전으로 시도 `key` → `KEY`
3. **경로 해석**: 점 경로를 밑줄로 변환 `app.name` → `APP_NAME`
:::

### 불리언 값 지원

`GetBool`은 다음 값을 지원합니다 (대소문자 구분 없음):

| 참 값 | 거짓 값 |
|------|------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

### 슬라이스 타입

```go
// 문자열 슬라이스
hosts := env.GetSlice[string]("HOSTS", []string{"localhost"})

// 정수 슬라이스 (int, int64, uint, uint64 지원)
ports := env.GetSlice[int64]("PORTS", []int64{80, 443})
portsInt := env.GetSlice[int]("PORTS")  // int 타입도 지원

// 부동소수점 슬라이스
rates := env.GetSlice[float64]("RATES", []float64{0.1, 0.2})

// 불리언 슬라이스
flags := env.GetSlice[bool]("FLAGS", []bool{true, false})

// Duration 슬라이스
timeouts := env.GetSlice[time.Duration]("TIMEOUTS")
```

**해석 순서:**
1. 인덱스 키 `KEY_0`, `KEY_1`, `KEY_2`...를 우선 검색
2. 인덱스 키가 없으면 `KEY`의 값을 쉼표로 구분하여 해석

```go
// 방법 1: 인덱스 키 (권장)
// HOSTS_0=localhost
// HOSTS_1=example.com
hosts := env.GetSlice[string]("HOSTS")  // ["localhost", "example.com"]

// 방법 2: 쉼표 구분
// PORTS=80,443,8080
ports := env.GetSlice[int64]("PORTS")  // [80, 443, 8080]
```

### 확인 및 조회

```go
// 키 존재 여부 확인
value, exists := env.Lookup("API_KEY")
if !exists {
    // 키가 존재하지 않음
}

// 모든 키 가져오기
keys := env.Keys()

// 모든 키-값 쌍 가져오기
all := env.All()

// 변수 수 가져오기
count := env.Len()
```

### 보안 값

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    // 원래 값 가져오기 (평문이 필요할 때만 호출, 예: 암호화, API 호출)
    value := secret.Reveal()

    // 로그에 마스크 사용 (유출 방지)
    log.Printf("API Key: %s", secret.Masked())  // 출력: [SECURE:32 bytes]
}
```

## 구조체 매핑

태그를 사용하여 환경 변수를 구조체에 매핑합니다:

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/env"
)

type Config struct {
    Host     string        `env:"DB_HOST" envDefault:"localhost"`
    Port     int64         `env:"DB_PORT" envDefault:"5432"`
    Password string        `env:"DB_PASSWORD"`
    Debug    bool          `env:"DEBUG" envDefault:"false"`
    Timeout  time.Duration `env:"TIMEOUT" envDefault:"30s"`
    Hosts    []string      `env:"ALLOWED_HOSTS" envSeparator:","`
}

func main() {
    env.Load(".env")

    var cfg Config
    if err := env.ParseInto(&cfg); err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", cfg)
}
```

:::details 자세히
[구조체 매핑](/ko/env/guides/struct-mapping) 가이드를 참조하세요.
:::

## 설정 프리셋

라이브러리는 다양한 시나리오에 적합한 네 가지 프리셋 설정을 제공합니다:

| 프리셋 | 용도 | 특징 |
|------|------|------|
| `DefaultConfig()` | 일반 시나리오 | 안전한 기본값, 대부분의 경우에 적합 |
| `DevelopmentConfig()` | 개발 환경 | 느슨한 제한, 덮어쓰기 허용 |
| `TestingConfig()` | 테스트 환경 | 타이트한 제한, 덮어쓰기 허용, 단위 테스트에 적합 |
| `ProductionConfig()` | 프로덕션 환경 | 엄격한 검증 + 감사 로그 |

```go
// 개발 환경 - 느슨한 제한
cfg := env.DevelopmentConfig()

// 테스트 환경 - 타이트한 제한
cfg := env.TestingConfig()

// 프로덕션 환경 - 엄격한 검증 + 감사 로그
cfg := env.ProductionConfig()
```

### 프리셋 상세 비교

| 기능 | Default | Development | Testing | Production |
|------|---------|-------------|---------|------------|
| 기존 변수 덮어쓰기 | ✗ | ✓ | ✓ | ✗ |
| 파일 없을 시 오류 | ✗ | ✗ | ✗ | ✓ |
| 감사 로그 | ✗ | ✗ | ✗ | ✓ |
| YAML 구문 | ✗ | ✓ | ✗ | ✗ |
| 파일 크기 제한 | 2MB | 10MB | 64KB | 64KB |
| 최대 변수 수 | 500 | 500 | 50 | 50 |
| 금지 키 검사 | ✓ | ✓ | ✓ | ✓ |
| 값 검증 | ✓ | ✓ | ✓ | ✓ |

:::tip 선택 가이드
- **개발 환경**: `DevelopmentConfig()` 사용, 느슨한 제한으로 빠른 반복 가능
- **테스트 환경**: `TestingConfig()` 사용, 덮어쓰기 허용으로 테스트 격리 용이
- **프로덕션 환경**: `ProductionConfig()` 사용, 감사 및 엄격한 검증 활성화
:::

## 다중 환경 설정

### 환경별 로드

```go
// 환경에 따라 설정 파일 결정
goEnv := os.Getenv("GO_ENV")
if goEnv == "" {
    goEnv = "development"
}

// 단일 호출로 모든 설정 파일 로드 (순서대로, 나중에 로드된 것이 먼저 로드된 것을 덮어씀)
env.Load(".env", ".env."+goEnv, ".env.local")
```

### Loader 인스턴스 사용

더 많은 제어가 필요할 때 Loader 인스턴스를 사용합니다:

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // 설정 생성
    cfg := env.ProductionConfig()
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    // 로더 생성
    loader, err := env.New(cfg)
    if err != nil {
        panic(err)
    }
    defer loader.Close()

    // 파일 로드 (순서대로, 나중에 로드된 것이 먼저 로드된 것을 덮어씀)
    if err := loader.LoadFiles(".env", ".env.production"); err != nil {
        panic(err)
    }

    // 필수 키 검증
    if err := loader.Validate(); err != nil {
        panic(err)
    }

    // 사용
    host := loader.GetString("DB_HOST")
    fmt.Println("Host:", host)
}
```

## 다중 파일 및 다중 형식

### 다중 파일 로드

순서대로 로드하며, 나중에 로드된 것이 먼저 로드된 것을 덮어씁니다:

```go
// 패키지 수준 함수
env.Load(".env", "config.json", "config.yaml")

// Loader 인스턴스
loader.LoadFiles(".env", ".env.local")
```

### 다중 형식 지원

파일 형식을 자동으로 감지합니다:

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

:::details 지원 형식
| 형식 | 확장자 | 감지 방식 |
|------|--------|----------|
| .env | `.env` | 파일 확장자 |
| JSON | `.json` | 파일 확장자 |
| YAML | `.yaml`, `.yml` | 파일 확장자 |
:::

## 오류 처리

```go
import "errors"

err := loader.LoadFiles(".env")
if err != nil {
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        // 파일 없음
    case errors.Is(err, env.ErrFileTooLarge):
        // 파일이 너무 큼
    case errors.Is(err, env.ErrForbiddenKey):
        // 금지된 키
    case errors.Is(err, env.ErrInvalidKey):
        // 잘못된 키 형식
    default:
        // 기타 오류
    }
}
```

:::details 상세 오류 정보 가져오기
```go
// 파싱 오류 상세 정보
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("파일 %s %d번째 줄: %v\n", parseErr.File, parseErr.Line, parseErr.Err)
}

// 파일 오류 상세 정보
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("파일 %s 작업 %s 실패: %v\n", fileErr.Path, fileErr.Op, fileErr.Err)
}

// 보안 오류 상세 정보
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("보안 오류: %s - %s\n", secErr.Action, secErr.Reason)
}
```
:::

## 다음 단계

<div class="vp-features">

### 심화 학습
- [구조체 매핑](/ko/env/guides/struct-mapping) - 자세한 설정 바인딩
- [직렬화](/ko/env/guides/serialization) - 설정 직렬화 및 역직렬화
- [다중 형식 설정](/ko/env/guides/multi-format) - JSON/YAML 상세 설명
- [테스트 시나리오](/ko/env/guides/testing) - 테스트에서의 사용 방법

### API 참조
- [패키지 함수](/ko/env/api-reference/functions) - 패키지 수준 함수 전체 목록
- [Loader API](/ko/env/api-reference/loader) - 로더 메서드
- [Config API](/ko/env/api-reference/config) - 설정 옵션

### 보안
- [보안 개요](/ko/env/security/) - 보안 아키텍처 및 모범 사례
- [SecureValue API](/ko/env/api-reference/secure-value) - 보안 값 처리

</div>
