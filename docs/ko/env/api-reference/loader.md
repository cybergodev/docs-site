---
title: "Loader API - CyberGo env | 로더 상세"
description: "CyberGo env Loader API 참조로 핵심 유형이 다중 형식 로딩·타입 안전 읽기·키 조작·검증·직렬화·Close 수명 주기를 제공하며 모두 스레드 안전합니다."
---

# Loader API

`Loader` 유형의 전체 메서드 참조입니다. Loader는 env 라이브러리의 핵심 유형으로, 환경 변수의 로드, 저장 및 접근 기능을 제공합니다.

:::tip 스레드 안전
Loader의 모든 메서드는 스레드 안전하며, 여러 goroutine에서 동시에 호출할 수 있습니다.
:::

## 유형 정의

```go
type Loader struct {
    // 개인 필드 포함
}

// 컴파일 타임 인터페이스 구현 확인
var _ EnvLoader = (*Loader)(nil)
var _ io.Closer = (*Loader)(nil)
```

---

## 생성

### New

```go
func New(cfg ...Config) (*Loader, error)
```

새로운 로더 인스턴스를 생성합니다.

**매개변수:**
- `cfg` - 선택적 설정 옵션. 제공하지 않거나 제로값 Config를 전달하면 자동으로 `DefaultConfig()` 사용

**반환값:**
- `*Loader` - 로더 인스턴스
- `error` - 설정 검증 오류

**동작:**
- 설정 유효성 검증
- 내부 컴포넌트 생성 (검증기, 감사기, 확장기)
- `cfg.Filenames`가 비어 있지 않으면 자동으로 파일 로드
- `cfg.AutoApply`가 true이면 시스템 환경에 자동 적용

```go
// 기본 설정 사용
loader, err := env.New()

// 사용자 정의 설정 사용
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env"}
cfg.AutoApply = true
loader, err := env.New(cfg)

if err != nil {
    panic(err)
}
defer loader.Close()
```

---

## 파일 로드

### LoadFiles

```go
func (l *Loader) LoadFiles(filenames ...string) error
```

하나 이상의 설정 파일을 로드합니다.

**매개변수:**
- `filenames` - 파일 경로 목록, 비어 있으면 기본적으로 `.env` 로드

**반환값:**
- `error` - 로드 오류

**동작:**
- 순서대로 로드, 나중에 로드한 것이 먼저 로드한 것을 덮어씀 (`OverwriteExisting` 설정에 의해 제어)
- 파일 형식 자동 감지 (.env, JSON, YAML)
- `FailOnMissingFile` 설정에 따라 파일이 존재하지 않을 때의 동작 결정
- `AutoApply`가 true이면 로드 후 자동 적용

```go
// 기본 .env 파일 로드
err := loader.LoadFiles()

// 지정된 파일 로드
err := loader.LoadFiles(".env", ".env.local")

// 혼합 형식
err := loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

**오류 유형:**
- `ErrFileNotFound` - 파일이 존재하지 않음 (`FailOnMissingFile=true`인 경우)
- `ErrFileTooLarge` - 파일 크기 제한 초과
- `ErrClosed` - 로더가 닫힘
- `*ParseError` - 파싱 오류
- `*JSONError` - JSON 파싱 오류
- `*YAMLError` - YAML 파싱 오류

**형식 감지 규칙:**

| 확장자 | 형식 |
|--------|------|
| `.env` | FormatEnv |
| `.json` | FormatJSON |
| `.yaml`, `.yml` | FormatYAML |
| 기타 | FormatAuto (.env 파서 사용) |

---

## 값 가져오기

### 키 이름 해석

모든 가져오기 메서드는 스마트 키 이름 해석을 지원합니다:

| 입력 키 이름 | 해석 결과 |
|----------|----------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"` (정확한 일치) |
| `"database.host"` | `"DATABASE_HOST"` (점을 밑줄로 변환) |
| `"app.name"` | `"APP_NAME"` (대문자 + 밑줄) |
| `"servers.0.host"` | `"SERVERS_0_HOST"` (배열 인덱스) |

**해석 순서:**
1. 정확한 일치 - 키 이름 직접 검색
2. 대문자 변환 - 단순 키에 대해 대문자 버전 시도
3. 경로 해석 - 점 경로를 밑줄 형식으로 변환
4. 인덱스 폴백 - 인덱스 접근 시 쉼표로 구분된 값으로 폴백

---

### GetString

```go
func (l *Loader) GetString(key string, defaultValue ...string) string
```

문자열 값을 가져옵니다. 점 경로 해석을 지원합니다.

**매개변수:**
- `key` - 키 이름 (정확한 일치, 대문자 변환, 점 경로 지원)
- `defaultValue` - 선택적 기본값

**반환값:**
- `string` - 값 또는 기본값 (찾지 못하고 기본값도 없으면 빈 문자열 반환)

```go
// 기본 사용법
host := loader.GetString("HOST", "localhost")

// 점 경로 접근 (JSON/YAML 중첩 구조)
dbHost := loader.GetString("database.host", "localhost")
appName := loader.GetString("app.name")

// 기본값이 없으면 빈 문자열 반환
value := loader.GetString("NON_EXISTENT")  // ""
```

---

### GetInt

```go
func (l *Loader) GetInt(key string, defaultValue ...int64) int64
```

정수 값을 가져옵니다. 점 경로 해석을 지원합니다.

**매개변수:**
- `key` - 키 이름 (점 경로 지원)
- `defaultValue` - 선택적 기본값, `int64` 유형

**반환값:**
- `int64` - 값 또는 기본값 (찾지 못하고 기본값도 없으면 0 반환)

```go
port := loader.GetInt("PORT", 8080)
maxConn := loader.GetInt("database.max_connections", 10)

// 기본값이 없으면 0 반환
value := loader.GetInt("NON_EXISTENT")  // 0
```

---

### GetBool

```go
func (l *Loader) GetBool(key string, defaultValue ...bool) bool
```

부울 값을 가져옵니다. 점 경로 해석을 지원합니다.

**매개변수:**
- `key` - 키 이름 (점 경로 지원)
- `defaultValue` - 선택적 기본값

**반환값:**
- `bool` - 값 또는 기본값 (찾지 못하고 기본값도 없으면 false 반환)

**지원되는 값:**
- 참 값: `true`, `1`, `yes`, `on`, `enabled`
- 거짓 값: `false`, `0`, `no`, `off`, `disabled`

```go
debug := loader.GetBool("DEBUG", false)
cacheEnabled := loader.GetBool("cache.enabled", true)

// 기본값이 없으면 false 반환
value := loader.GetBool("NON_EXISTENT")  // false
```

---

### GetUint64

```go
func (l *Loader) GetUint64(key string, defaultValue ...uint64) uint64
```

부호 없는 정수 값을 가져옵니다. 점 경로 해석을 지원합니다.

**매개변수:**
- `key` - 키 이름 (점 경로 지원)
- `defaultValue` - 선택적 기본값, `uint64` 유형

**반환값:**
- `uint64` - 값 또는 기본값 (찾지 못하고 기본값도 없으면 0 반환)

```go
port := loader.GetUint64("PORT", 8080)
maxSize := loader.GetUint64("MAX_SIZE", 1024)

// 기본값이 없으면 0 반환
value := loader.GetUint64("NON_EXISTENT")  // 0
```

---

### GetFloat64

```go
func (l *Loader) GetFloat64(key string, defaultValue ...float64) float64
```

부동소수점 값을 가져옵니다. 점 경로 해석을 지원합니다.

**매개변수:**
- `key` - 키 이름 (점 경로 지원)
- `defaultValue` - 선택적 기본값, `float64` 유형

**반환값:**
- `float64` - 값 또는 기본값 (찾지 못하고 기본값도 없으면 0 반환)

```go
rate := loader.GetFloat64("RATE", 0.5)
threshold := loader.GetFloat64("THRESHOLD")

// 기본값이 없으면 0 반환
value := loader.GetFloat64("NON_EXISTENT")  // 0
```

---

### GetDuration

```go
func (l *Loader) GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

시간 간격 값을 가져옵니다. 점 경로 해석을 지원합니다.

**매개변수:**
- `key` - 키 이름 (점 경로 지원)
- `defaultValue` - 선택적 기본값

**반환값:**
- `time.Duration` - 값 또는 기본값 (찾지 못하고 기본값도 없으면 0 반환)

**지원 형식:** `ns`, `us`, `ms`, `s`, `m`, `h` (예: `30s`, `5m`, `1h30m`)

```go
timeout := loader.GetDuration("TIMEOUT", 30*time.Second)
ttl := loader.GetDuration("cache.ttl", 5*time.Minute)

// 기본값이 없으면 0 반환
value := loader.GetDuration("NON_EXISTENT")  // 0
```

---

### GetSecure

```go
func (l *Loader) GetSecure(key string) *SecureValue
```

보안 값을 가져옵니다 (민감한 데이터 보호).

**매개변수:**
- `key` - 키 이름

**반환값:**
- `*SecureValue` - 보안 값의 **방어적 복사본**, 호출자가 해제 책임; 키가 존재하지 않거나 로더가 닫힌 경우 nil 반환

```go
secret := loader.GetSecure("API_SECRET")
if secret != nil {
    defer secret.Release()

    value := secret.Reveal()
    masked := secret.Masked()  // [SECURE:32 bytes]
}
```

:::warning 중요
사용 후 반드시 `Release()` 또는 `Close()`를 호출하여 리소스를 해제해야 합니다.
:::

:::tip 방어적 복사본
`GetSecure`는 원본 값의 복사본을 반환하며, 부모 Loader와 독립적입니다. 호출자가 `Release()` 또는 `Close()`를 호출하여 해제할 책임이 있습니다.
:::

:::tip 자세히
[SecureValue API](/ko/env/api-reference/secure-value)에서 전체 문서를 확인하세요.
:::

---

### 슬라이스 값 가져오기

Loader는 슬라이스 가져오기 메서드를 제공하지 않습니다 (Go는 제네릭 메서드를 지원하지 않음). 독립적인 제네릭 함수 `GetSliceFrom[T]`를 사용하여 Loader 인스턴스에서 슬라이스를 가져오세요:

```go
// 독립 제네릭 함수 사용
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})
portsInt := env.GetSliceFrom[int](loader, "PORTS")  // int도 지원
```

**지원 유형:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

:::tip 자세히
[패키지 함수 - GetSliceFrom](/ko/env/api-reference/functions#getslicefrom-t)에서 전체 문서를 확인하세요.
:::

---

### Lookup

```go
func (l *Loader) Lookup(key string) (string, bool)
```

키가 존재하는지 확인하고 값을 가져옵니다. 점 경로 해석을 지원합니다.

**매개변수:**
- `key` - 키 이름 (점 경로 지원)

**반환값:**
- `string` - 값 (앞뒤 공백 제거됨)
- `bool` - 존재 여부

```go
value, exists := loader.Lookup("API_KEY")
if !exists {
    // 키가 존재하지 않음
}

// 점 경로
if value, exists := loader.Lookup("database.host"); exists {
    fmt.Println(value)
}

// 인덱스 접근 (쉼표로 구분된 값으로 폴백)
// HOSTS=localhost,example.com
if value, exists := loader.Lookup("hosts.0"); exists {
    fmt.Println(value)  // "localhost"
}
```

---

## 설정 및 삭제

### Set

```go
func (l *Loader) Set(key, value string) error
```

환경 변수를 설정합니다.

**매개변수:**
- `key` - 키 이름
- `value` - 값

**반환값:**
- `error` - 설정 오류

**동작:**
- 키 이름 유효성 검증
- `ValidateValues`가 true이면 값의 안전성 검증
- `OverwriteExisting`이 false이고 키가 이미 존재하면 건너뜀 (nil 반환)
- `AutoApply`가 true이면 시스템 환경에도 동시 설정

```go
err := loader.Set("CUSTOM_KEY", "value")
if err != nil {
    // 오류 처리
}
```

**오류 유형:**
- `ErrInvalidKey` - 키 이름이 유효하지 않음
- `ErrForbiddenKey` - 금지된 키
- `ErrClosed` - 로더가 닫힘

---

### Delete

```go
func (l *Loader) Delete(key string) error
```

환경 변수를 삭제합니다.

**매개변수:**
- `key` - 키 이름

**반환값:**
- `error` - 삭제 오류

**동작:**
- 변수가 시스템 환경에 이미 적용된 경우 시스템 환경에서도 동시 삭제

```go
err := loader.Delete("TEMP_KEY")
if err != nil {
    panic(err)
}
```

---

## 컬렉션 조작

### Keys

```go
func (l *Loader) Keys() []string
```

모든 키 이름을 가져옵니다.

**반환값:**
- `[]string` - 키 이름 목록, 로더가 닫힌 경우 nil 반환

```go
keys := loader.Keys()
for _, key := range keys {
    fmt.Println(key)
}
```

---

### All

```go
func (l *Loader) All() map[string]string
```

모든 키-값 쌍을 가져옵니다.

**반환값:**
- `map[string]string` - 키-값 매핑, 로더가 닫힌 경우 nil 반환

```go
all := loader.All()
for key, value := range all {
    fmt.Printf("%s=%s\n", key, value)
}
```

---

### Len

```go
func (l *Loader) Len() int
```

변수 수를 가져옵니다.

**반환값:**
- `int` - 변수 수, 로더가 닫힌 경우 0 반환

```go
count := loader.Len()
fmt.Printf("%d개의 변수가 로드됨\n", count)
```

---

## 시스템에 적용

### Apply

```go
func (l *Loader) Apply() error
```

변수를 시스템 환경(`os.Environ`)에 적용합니다.

**반환값:**
- `error` - 적용 오류

**동작:**
- 로드된 모든 변수를 순회
- `OverwriteExisting` 설정에 따라 이미 존재하는 시스템 환경 변수를 덮어쓸지 결정
- 적용 후 `os.Getenv()`로 접근 가능

```go
err := loader.Apply()
if err != nil {
    panic(err)
}

// 이후 os.Getenv()로도 접근 가능
host := os.Getenv("HOST")
```

---

### IsApplied

```go
func (l *Loader) IsApplied() bool
```

변수가 시스템 환경에 적용되었는지 확인합니다.

**반환값:**
- `bool` - 적용 여부

```go
if loader.IsApplied() {
    // 변수가 os.Environ에 적용됨
}
```

---

## 상태 조회

### LoadTime

```go
func (l *Loader) LoadTime() time.Time
```

마지막으로 파일을 로드한 시간을 반환합니다.

**반환값:**
- `time.Time` - 로드 시간, 로드하지 않은 경우 제로값 반환

```go
loadTime := loader.LoadTime()
if !loadTime.IsZero() {
    fmt.Printf("마지막 로드 시간: %v\n", loadTime)
}
```

---

### Config

```go
func (l *Loader) Config() Config
```

로더의 설정을 반환합니다.

**반환값:**
- `Config` - 설정 (읽기 전용으로 간주해야 함)

:::warning 참고
반환된 Config는 읽기 전용으로 간주해야 합니다. `KeyPattern`, `AllowedKeys`, `ForbiddenKeys`, `RequiredKeys` 등의 필드를 수정하면 로더 동작에 영향을 줄 수 있습니다. 안전한 가변 복사본이 필요한 경우 필요한 필드를 수동으로 복사하세요.
:::

```go
cfg := loader.Config()
fmt.Printf("최대 파일 크기: %d\n", cfg.MaxFileSize)
```

---

## 검증 및 매핑

### Validate

```go
func (l *Loader) Validate() error
```

필수 키가 존재하는지 검증합니다.

**반환값:**
- `error` - 검증 오류

**동작:**
- `Config.RequiredKeys`에 지정된 모든 키가 존재하는지 확인

```go
cfg := env.DefaultConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

if err := loader.Validate(); err != nil {
    // 필수 키 누락
    var missingErr *env.ValidationError
    if errors.As(err, &missingErr) {
        fmt.Printf("누락됨: %s\n", missingErr.Field)
    }
}
```

---

### ParseInto

```go
func (l *Loader) ParseInto(v any) error
```

환경 변수를 구조체에 매핑합니다.

**매개변수:**
- `v` - 구조체 포인터

**반환값:**
- `error` - 매핑 오류

**지원되는 태그:**
- `env:"KEY"` - 환경 변수 이름 지정
- `env:"-"` - 이 필드 무시
- `envDefault:"value"` - 기본값 지정
- `envSeparator:","` - 슬라이스 구분자 지정

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS" envSeparator:","`
    Ignored string   `env:"-"`
}

var cfg Config
err := loader.ParseInto(&cfg)
if err != nil {
    panic(err)
}
```

---

## 리소스 해제

### Close

```go
func (l *Loader) Close() error
```

리소스를 해제하고 저장소를 비웁니다.

**반환값:**
- `error` - 닫기 오류

**동작:**
- 저장된 모든 민감 데이터를 안전하게 초기화
- Loader가 ComponentFactory를 소유한 경우 팩토리도 동시에 닫기
- 안전한 닫기, 여러 번 호출해도 nil 반환

```go
loader, _ := env.New(cfg)
defer loader.Close()

// loader 사용...
```

:::warning 닫은 후 동작
닫은 후 모든 작업은 오류 또는 제로값을 반환합니다:
- `LoadFiles` → `ErrClosed`
- `GetString` → 빈 값 반환
- `Set` → `ErrClosed`
- `Keys` → nil 반환
- `Len` → 0 반환
:::

---

### IsClosed

```go
func (l *Loader) IsClosed() bool
```

로더가 닫혔는지 확인합니다.

**반환값:**
- `bool` - 닫힘 여부

```go
if loader.IsClosed() {
    // 로더가 닫힘
}
```

---

## 전체 예제

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "os"
    "time"

    "github.com/cybergodev/env"
)

func main() {
    // 프로덕션 환경 설정 생성
    cfg := env.ProductionConfig()
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
    cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

    // 로더 생성
    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // 파일 로드
    if err := loader.LoadFiles(".env", ".env.production"); err != nil {
        if errors.Is(err, env.ErrFileNotFound) {
            log.Fatal("설정 파일이 존재하지 않음")
        }
        log.Fatal(err)
    }

    // 필수 키 검증
    if err := loader.Validate(); err != nil {
        log.Fatal("필수 설정 누락:", err)
    }

    // 설정 읽기
    host := loader.GetString("DB_HOST")
    port := loader.GetInt("DB_PORT", 5432)
    debug := loader.GetBool("DEBUG", false)
    timeout := loader.GetDuration("TIMEOUT", 30*time.Second)

    fmt.Printf("Server: %s:%d\n", host, port)
    fmt.Printf("Debug: %v, Timeout: %v\n", debug, timeout)

    // 민감한 데이터
    secret := loader.GetSecure("API_KEY")
    if secret != nil {
        defer secret.Release()
        fmt.Printf("API Key length: %d\n", secret.Length())
    }

    // 시스템 환경에 적용
    if err := loader.Apply(); err != nil {
        log.Fatal(err)
    }

    // 모든 변수
    fmt.Printf("Loaded %d variables\n", loader.Len())
    fmt.Printf("Load time: %v\n", loader.LoadTime())
}
```

## 관련 문서

- [패키지 함수](/ko/env/api-reference/functions) - 패키지 수준 편의 함수
- [Config API](/ko/env/api-reference/config) - 설정 옵션
- [SecureValue API](/ko/env/api-reference/secure-value) - 보안 값 처리
- [인터페이스 정의](/ko/env/api-reference/interfaces) - 모든 인터페이스 정의
