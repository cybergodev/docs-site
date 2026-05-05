---
title: Config API - CyberGo env | 설정 상세
description: CyberGo env 라이브러리 Config 설정 구조체 완전 API 참조 문서입니다. Config는 Loader의 모든 동작을 제어하며, 파일 검색 경로, 보안 제한 매개변수, 키-값 검증 옵션, 변수 확장 설정, 감사 로그 구성 및 사전 정의된 설정 템플릿을 포함합니다. Development와 Production 프리셋을 제공하여 다양한 환경 설정 요구를 충족합니다.
---

# Config API

`Config` 구조체의 완전한 설정 옵션 참조입니다.

## 구조체 정의

Config는 중첩 구조체를 사용하여 설정을 구성하며, Go의 필드 승격을 통해 하위 호환성을 유지합니다:

```go
type Config struct {
    FileConfig       // 파일 로드 동작
    ValidationConfig // 키와 값 검증
    LimitsConfig     // 크기와 수량 제한
    JSONConfig       // JSON 파싱 옵션
    YAMLConfig       // YAML 파싱 옵션
    ParsingConfig    // 일반 파싱 동작
    ComponentConfig  // 커스텀 컴포넌트 및 고급 옵션
}
```

**두 가지 접근 방식:**

```go
// 이전 방식 (필드 승격을 통해, 여전히 유효)
cfg.Filenames = []string{".env"}
cfg.MaxFileSize = 1024

// 새로운 방식 (권장함, 더 명확)
cfg.FileConfig.Filenames = []string{".env"}
cfg.LimitsConfig.MaxFileSize = 1024
```

### 중첩 구조체

```go
// FileConfig 파일 로드 동작 제어
type FileConfig struct {
    Filenames         []string // 로드할 파일 목록
    FailOnMissingFile bool     // 파일 없음 시 오류 발생 여부
    OverwriteExisting bool     // 기존 환경 변수 덮어쓰기 여부
    AutoApply         bool     // os.Environ에 자동 적용 여부
}

// ValidationConfig 키와 값 검증 제어
type ValidationConfig struct {
    RequiredKeys   []string       // 필수 키 이름 목록
    AllowedKeys    []string       // 허용 키 이름 화이트리스트
    ForbiddenKeys  []string       // 추가 금지 키 목록
    KeyPattern     *regexp.Regexp // 키 이름 매칭 패턴
    ValidateValues bool           // 값의 안전성 검증 여부
    ValidateUTF8   bool           // 값이 유효한 UTF-8인지 검증 여부
}

// LimitsConfig 크기와 수량 제한 제어
type LimitsConfig struct {
    MaxFileSize       int64 // 단일 파일 최대 바이트 수
    MaxVariables      int   // 파일당 최대 변수 수
    MaxLineLength     int   // 단일 행 최대 길이
    MaxKeyLength      int   // 키 이름 최대 길이
    MaxValueLength    int   // 값 최대 길이
    MaxExpansionDepth int   // 변수 확장 최대 깊이
}

// JSONConfig JSON 파싱 동작 제어
type JSONConfig struct {
    JSONNullAsEmpty    bool // null 값을 빈 문자열로 변환
    JSONNumberAsString bool // 숫자를 문자열로 변환
    JSONBoolAsString   bool // 불리언을 문자열로 변환
    JSONMaxDepth       int  // 최대 중첩 깊이
}

// YAMLConfig YAML 파싱 동작 제어
type YAMLConfig struct {
    YAMLNullAsEmpty    bool // null/~ 값을 빈 문자열로 변환
    YAMLNumberAsString bool // 숫자를 문자열로 변환
    YAMLBoolAsString   bool // 불리언을 문자열로 변환
    YAMLMaxDepth       int  // 최대 중첩 깊이
}

// ParsingConfig 일반 파싱 동작 제어
type ParsingConfig struct {
    AllowExportPrefix bool // export KEY=value 문법 허용
    AllowYamlSyntax   bool // YAML 스타일 값 허용
    ExpandVariables   bool // ${VAR} 참조 확장 여부
}

// ComponentConfig 커스텀 컴포넌트 및 고급 옵션
type ComponentConfig struct {
    CustomValidator Validator        // 커스텀 키/값 검증기
    CustomExpander  VariableExpander // 커스텀 변수 확장기
    CustomAuditor   AuditLogger      // 커스텀 감사 로거
    FileSystem      FileSystem       // 커스텀 파일 시스템 (테스트용)
    AuditHandler    AuditHandler     // 커스텀 감사 처리기
    AuditEnabled    bool             // 감사 로그 활성화
    Prefix          string           // 이 접두사가 있는 변수만 처리
}
```

## 설정 필드

### 파일 처리

이 필드들은 파일 로딩 동작을 제어합니다.

#### `Filenames` []string

로드할 파일 경로 목록.**기본 `[".env"]`**.

```go
cfg.Filenames = []string{".env", ".env.local"}
```

---

#### `FailOnMissingFile` bool

파일이 존재하지 않을 때 오류를 반환할지 여부.**기본 `false`** (조용히 건너뜀).

```go
cfg.FailOnMissingFile = true  // 파일이 없을 때 오류
```

---

#### `OverwriteExisting` bool

이미 존재하는 환경 변수를 덮어쓸지 여부.**기본 `false`**.

```go
cfg.OverwriteExisting = true  // 덮어쓰기 허용
```

---

#### `AutoApply` bool

로드 후 시스템 환경(`os.Environ`)에 자동 적용합니다.**기본 `false`**.

```go
cfg.AutoApply = true  // 로드 후 자동 적용
```

::: tip 참고
패키지 수준 `Load()` 함수는 자동으로 `AutoApply = true`를 설정합니다. `New()`로 Loader를 생성할 때는 수동으로 설정해야 합니다.
:::

### 변수 확장

#### `ExpandVariables` bool

`${VAR}` 문법 변수 확장을 활성화합니다.**기본 `true`**.

```go
cfg.ExpandVariables = true
```

지원하는 확장 문법:

| 문법 | 설명 |
|------|------|
| `${VAR}` | 변수 참조 |
| `${VAR:-default}` | 변수가 없거나 비어 있을 때 기본값 사용 |
| `${VAR:=default}` | 변수가 없거나 비어 있을 때 기본값 설정 |
| `${VAR:?error}` | 변수가 없거나 비어 있을 때 오류 발생 |

### 보안 제한

#### `MaxFileSize` int64

단일 파일 최대 바이트 수.**기본 2MB**，하드 상한 100MB。

```go
cfg.MaxFileSize = 10 * 1024 * 1024 // 10 MB
```

| 설정 | 기본값 | 하드 상한 |
|------|--------|----------|
| `MaxFileSize` | 2MB (2097152) | 100MB |

---

#### `MaxLineLength` int

단일 행 최대 길이.**기본 1024**，하드 상한 64KB。

```go
cfg.MaxLineLength = 2048
```

| 설정 | 기본값 | 하드 상한 |
|------|--------|----------|
| `MaxLineLength` | 1024 | 65536 (64KB) |

---

#### `MaxKeyLength` int

키 이름 최대 길이.**기본 64**，하드 상한 1024。

```go
cfg.MaxKeyLength = 128
```

| 설정 | 기본값 | 하드 상한 |
|------|--------|----------|
| `MaxKeyLength` | 64 | 1024 |

---

#### `MaxValueLength` int

값 최대 길이.**기본 4096**，하드 상한 1MB。

```go
cfg.MaxValueLength = 8192
```

| 설정 | 기본값 | 하드 상한 |
|------|--------|----------|
| `MaxValueLength` | 4096 | 1048576 (1MB) |

---

#### `MaxVariables` int

파일당 최대 변수 수.**기본 500**，하드 상한 10000。

```go
cfg.MaxVariables = 1000
```

| 설정 | 기본값 | 하드 상한 |
|------|--------|----------|
| `MaxVariables` | 500 | 10000 |

---

#### `MaxExpansionDepth` int

변수 확장 최대 깊이.**기본 5**，하드 상한 20。

```go
cfg.MaxExpansionDepth = 10
```

| 설정 | 기본값 | 하드 상한 |
|------|--------|----------|
| `MaxExpansionDepth` | 5 | 20 |

### 키 검증

#### `KeyPattern` *regexp.Regexp

커스텀 키 이름 매칭 패턴.**기본 `nil`** (빠른 바이트 수준 검증 사용).

::: tip 성능 최적화
`nil` 값은 빠른 바이트 수준 검증을 활성화합니다 (약 10배 성능 향상). 기본 검증 규칙: 문자로 시작, 문자, 숫자, 밑줄만 포함.
:::

```go
import "regexp"

// 커스텀패턴
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
```

---

#### `AllowedKeys` []string

허용된 키 이름 화이트리스트. 비어 있으면 모든 키가 허용됩니다 (금지 키 제외).

```go
cfg.AllowedKeys = []string{"APP_NAME", "APP_VERSION", "PORT"}
```

---

#### `ForbiddenKeys` []string

추가 금지 키 목록 (내장 금지 키에 추가됨).

```go
cfg.ForbiddenKeys = []string{"CUSTOM_DANGEROUS_VAR"}
```

::: tip 내장 금지 키
라이브러리는 `PATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_INSERT_LIBRARIES` 등 시스템 핵심 변수를 기본적으로 금지합니다. 자세한 내용은 [상수 및 오류](/ko/env/api-reference/constants#defaultforbiddenkeys)。
:::

---

#### `RequiredKeys` []string

필수 키 이름 목록. `Validate()` 호출 시 검사합니다.

```go
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
```

---

#### `ValidateValues` bool

값의 안전성을 검증합니다 (제어 문자, 널 바이트 등).**기본 `true`**.

::: warning 보안 권장 사항
항상 활성화 상태를 유지하는 것이 좋으며, 특별한 시나리오(제어 문자가 포함된 값을 저장해야 하는 경우 등)에서만 비활성화하세요.
:::

```go
cfg.ValidateValues = true  // 기본 활성화됨
```

---

#### `ValidateUTF8` bool

값이 유효한 UTF-8 인코딩인지 검증합니다.**기본 `false`**.

```go
cfg.ValidateUTF8 = true  // UTF-8 검증 활성화
```

### 파싱 옵션

#### `AllowExportPrefix` bool

`export KEY=value` 문법을 허용합니다.**기본 `true`**.

```go
cfg.AllowExportPrefix = false  // export 접두사 금지
```

---

#### `AllowYamlSyntax` bool

YAML 스타일 문법(`KEY: value`)을 허용합니다.**기본 `false`**.

```go
cfg.AllowYamlSyntax = true
```

### JSON 옵션

#### `JSONNullAsEmpty` bool

JSON `null` 값을 빈 문자열로 변환합니다.**기본 `true`**.

```go
cfg.JSONNullAsEmpty = true
```

---

#### `JSONNumberAsString` bool

JSON 숫자를 문자열로 변환합니다.**기본 `true`**.

```go
cfg.JSONNumberAsString = true
```

---

#### `JSONBoolAsString` bool

JSON 불리언을 문자열로 변환합니다.**기본 `true`**.

```go
cfg.JSONBoolAsString = true
```

---

#### `JSONMaxDepth` int

JSON 최대 중첩 깊이.**기본 10**.

```go
cfg.JSONMaxDepth = 20
```

### YAML 옵션

#### `YAMLNullAsEmpty` bool

YAML `null`/`~` 값 변환 빈문자열。**기본 `true`**.

```go
cfg.YAMLNullAsEmpty = true
```

---

#### `YAMLNumberAsString` bool

YAML 숫자를 문자열로 변환합니다.**기본 `true`**.

```go
cfg.YAMLNumberAsString = true
```

---

#### `YAMLBoolAsString` bool

YAML 불리언을 문자열로 변환합니다.**기본 `true`**.

```go
cfg.YAMLBoolAsString = true
```

---

#### `YAMLMaxDepth` int

YAML 최대 중첩 깊이.**기본 10**.

```go
cfg.YAMLMaxDepth = 15
```

### 감사

#### `AuditEnabled` bool

감사 로그를 활성화합니다.**기본 `false`**.

```go
cfg.AuditEnabled = true
```

---

#### `AuditHandler` AuditHandler

커스텀 감사 처리기.

```go
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

::: tip 자세한 내용
[감사 로그](/ko/env/guides/audit-logging)에서 완전한 감사 설정 설명을 확인하세요。
:::

### 고급 옵션

#### `Prefix` string

이 접두사가 있는 변수만 처리합니다.**기본 `""`** (모든 변수 처리).

```go
cfg.Prefix = "MYAPP_"  // MYAPP_로 시작하는 변수만 로드
```

---

#### `FileSystem` FileSystem

커스텀 파일 시스템 인터페이스 (테스트용).

```go
cfg.FileSystem = &MockFileSystem{}
```

---

#### `CustomValidator` Validator

커스텀 키/값 검증기. 내장 검증기를 덮어씁니다.

```go
cfg.CustomValidator = &MyValidator{}
```

---

#### `CustomExpander` VariableExpander

커스텀 변수 확장기. 내장 확장기를 덮어씁니다.

```go
cfg.CustomExpander = &MyExpander{}
```

---

#### `CustomAuditor` AuditLogger

커스텀 감사 로거. 내장 감사기를 덮어씁니다.

```go
cfg.CustomAuditor = &MyAuditLogger{}
```

---

## 팩토리 함수

### DefaultConfig

```go
func DefaultConfig() Config
```

안전한 기본 설정을 반환합니다.

**기본값：**

| 필드 | 값 |
|------|-----|
| `Filenames` | `[".env"]` |
| `FailOnMissingFile` | `false` |
| `OverwriteExisting` | `false` |
| `AutoApply` | `false` |
| `ExpandVariables` | `true` |
| `MaxFileSize` | 2MB |
| `MaxLineLength` | 1024 |
| `MaxKeyLength` | 64 |
| `MaxValueLength` | 4096 |
| `MaxVariables` | 500 |
| `MaxExpansionDepth` | 5 |
| `ValidateValues` | `true` |
| `KeyPattern` | `nil` (빠른 검증) |
| `AllowExportPrefix` | `true` |
| `AllowYamlSyntax` | `false` |
| `JSONNullAsEmpty` | `true` |
| `JSONNumberAsString` | `true` |
| `JSONBoolAsString` | `true` |
| `JSONMaxDepth` | 10 |
| `YAMLNullAsEmpty` | `true` |
| `YAMLNumberAsString` | `true` |
| `YAMLBoolAsString` | `true` |
| `YAMLMaxDepth` | 10 |
| `ValidateUTF8` | `false` |
| `AuditEnabled` | `false` |
| `Prefix` | `""` |

---

### DevelopmentConfig

```go
func DevelopmentConfig() Config
```

개발 환경 설정을 반환합니다 (완화된 제한).

**기본 설정과의 차이:**
- `OverwriteExisting`: `true`
- `AllowYamlSyntax`: `true`
- `MaxFileSize`: 10MB

::: tip 보안 보장
`ValidateValues`는 모든 프리셋 설정에서 항상 `true`로 유지되어 (기본값과 동일) 환경에 관계없이 보안이 보장됩니다.
:::

```go
cfg := env.DevelopmentConfig()
cfg.Filenames = []string{".env.development"}
loader, _ := env.New(cfg)
```

---

### TestingConfig

```go
func TestingConfig() Config
```

테스트 환경 설정을 반환합니다.

**기본 설정과의 차이:**
- `OverwriteExisting`: `true`
- `MaxFileSize`: 64KB
- `MaxVariables`: 50

```go
func TestSomething(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = []string{".env.test"}
    loader, _ := env.New(cfg)
    defer loader.Close()
}
```

---

### ProductionConfig

```go
func ProductionConfig() Config
```

프로덕션 환경 설정을 반환합니다 (엄격한 검증 + 감사).

**기본 설정과의 차이:**
- `FailOnMissingFile`: `true`
- `AuditEnabled`: `true`
- `MaxFileSize`: 64KB
- `MaxVariables`: 50

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
loader, _ := env.New(cfg)
```

---

### 프리셋 상세 비교

| 기능 | Default | Development | Testing | Production |
|------|---------|-------------|---------|------------|
| 기존 변수 덮어쓰기 | ✗ | ✓ | ✓ | ✗ |
| 파일이 없을 때 오류 | ✗ | ✗ | ✗ | ✓ |
| 감사 로그 | ✗ | ✗ | ✗ | ✓ |
| YAML 문법 | ✗ | ✓ | ✗ | ✗ |
| 파일크기제한 | 2MB | 10MB | 64KB | 64KB |
| 최대 변수 수 | 500 | 500 | 50 | 50 |
| 금지 키 검사 | ✓ | ✓ | ✓ | ✓ |
| 값 검증 | ✓ | ✓ | ✓ | ✓ |

::: tip 선택 가이드
- **개발 환경**：사용 `DevelopmentConfig()`，완화된 제한으로 빠른 반복 개발 가능
- **테스트 환경**：사용 `TestingConfig()`，덮어쓰기 허용으로 테스트 격리 가능
- **프로덕션 환경**：사용 `ProductionConfig()`，감사 및 엄격한 검증 활성화
:::

---

## 메서드

### Validate

```go
func (c *Config) Validate() error
```

설정의 유효성을 검증합니다. 모든 제한 값이 유효한 범위 내에 있는지 확인합니다.

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 1000

if err := cfg.Validate(); err != nil {
    // 설정이 유효하지 않음
}
```

**검증규칙：**
- 모든 제한 값은 양수여야 함
- 모든 제한 값은 하드 상한을 초과할 수 없음
- `KeyPattern`이 nil이 아닌 경우, 유효한 키 이름(예: `TEST_KEY`)은 매칭하고 빈 문자열이나 숫자로 시작하는 키 이름은 매칭하지 않아야 함
- `JSONMaxDepth`와 `YAMLMaxDepth`는 1~100 사이여야 함

---

### IsZero

```go
func (c *Config) IsZero() bool
```

Config가 초기화되지 않은 영값인지 확인합니다. `DefaultConfig()`를 사용해야 하는지 판단하는 데 사용됩니다.

**반환：**
- `bool` - 영값 설정인지 여부

**감지범위：**
- 수치 제한 (MaxFileSize, MaxVariables 등)
- 불리언필드（ValidateValues、AutoApply 등）
- 포인터/인터페이스필드（KeyPattern、FileSystem 등）
- 슬라이스필드（Filenames、RequiredKeys 등）

::: warning 참고
부분적으로 초기화된 Config는 영값으로 감지되지 않을 수 있습니다. 항상 `DefaultConfig()`에서 시작하여 커스텀 설정을 구성하는 것이 좋습니다:

```go
// 권장함
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}

// 권장하지 않음 (일부 필드가 영값)
var cfg env.Config
cfg.Filenames = []string{".env.production"}
```
:::

---

## 사용 예제

### 기본 설정

```go
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env", ".env.local"}
cfg.OverwriteExisting = true

loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer loader.Close()
```

### 프로덕션 환경 설정

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "DB_PORT", "API_KEY"}
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer loader.Close()

if err := loader.LoadFiles(".env"); err != nil {
    log.Fatal(err)
}

if err := loader.Validate(); err != nil {
    log.Fatal("필수 설정 누락:", err)
}
```

### 접두사 필터 사용

```go
cfg := env.DefaultConfig()
cfg.Prefix = "MYAPP_"  // MYAPP_KEY1, MYAPP_KEY2 등만 로드
cfg.Filenames = []string{".env"}

loader, _ := env.New(cfg)
// loader에는 MYAPP_로 시작하는 변수만 포함
```

### 커스텀 검증

```go
import "regexp"

cfg := env.DefaultConfig()
// 대문자로만 시작 허용
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
// 추가 커스텀 금지 키
cfg.ForbiddenKeys = []string{"DEBUG", "TRACE"}

loader, _ := env.New(cfg)
```

---

## 관련 문서

- [Loader API](/ko/env/api-reference/loader) - 로더 메서드
- [상수 및 오류](/ko/env/api-reference/constants) - 제한상수 및 오류타입
- [감사 로그](/ko/env/guides/audit-logging) - 감사설정가이드
