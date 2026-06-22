---
title: "설정 - CyberGo DD | Config 상세 가이드"
description: "CyberGo DD Config 구조체 전체 API 문서. DefaultConfig/DevelopmentConfig/JSONConfig 사전 설정 함수, OutputTarget 출력 대상 설정, 필드 검증 규칙, 샘플링 제어, 포맷팅 옵션 및 Validate 검증 메서드를 포함하여 유연하고 타입 안전한 로거 동작 커스터마이징 기능을 제공합니다."
---

# 설정

DD는 `Config` 구조체를 통해 로거의 동작을 설정하며, 여러 사전 설정 팩토리 함수를 제공합니다.

## 사전 설정 팩토리

```go
// 기본 설정: INFO 레벨, 텍스트 형식
cfg := dd.DefaultConfig()

// 개발 설정: DEBUG 레벨, 동적 caller 감지
cfg := dd.DevelopmentConfig()

// JSON 설정: JSON 형식 출력
cfg := dd.JSONConfig()
```

| 팩토리 함수 | 반환 타입 | 레벨 | 형식 | 적용 시나리오 |
|----------|----------|------|------|----------|
| `DefaultConfig()` | `Config` | Info | Text | 프로덕션 환경 |
| `DevelopmentConfig()` | `Config` | Debug | Text | 개발 환경 |
| `JSONConfig()` | `Config` | Debug | JSON | 로그 수집 |

:::tip 보안 필터링 기본 활성화
모든 사전 설정 (`DefaultConfig`, `DevelopmentConfig`, `JSONConfig`)은 기본적으로 보안 필터링이 활성화되어 있어, 비밀번호, API Key, 신용카드 번호 등 민감 데이터를 자동으로 마스킹합니다.
:::

## Config 구조체

```go
type Config struct {
    // 로그 레벨
    Level          LogLevel         // 로그 레벨 (기본값 LevelInfo)
    Format         LogFormat        // 출력 형식 (FormatText / FormatJSON)

    // 시간 설정
    TimeFormat     string           // 시간 형식 (기본값 ISO 8601)
    IncludeTime    bool             // 시간 포함 여부 (기본값 true)
    IncludeLevel   bool             // 레벨 포함 여부 (기본값 true)

    // 호출자 정보
    DynamicCaller  bool             // 동적 호출자 감지 (기본값 true)
    FullPath       bool             // 전체 경로 표시 여부 (기본값 false)

    // 출력 대상
    Targets        []OutputTarget   // 출력 대상 목록

    // JSON 설정
    JSON           *JSONOptions     // JSON 출력 옵션

    // 보안 설정
    Security       *SecurityConfig  // 보안 설정

    // 필드 검증
    FieldValidation *FieldValidationConfig

    // 라이프사이클 핸들러
    FatalHandler      FatalHandler       // Fatal 레벨 커스텀 처리 함수
    WriteErrorHandler WriteErrorHandler  // 쓰기 오류 콜백

    // 확장성
    ContextExtractors []ContextExtractor // 컨텍스트 추출기 목록
    Hooks             *HookRegistry      // 훅 레지스트리
    Sampling          *SamplingConfig    // 샘플링 설정

    // 감사 설정
    Audit             *AuditConfig       // 감사 로그 설정 (보안 이벤트)
}
```

:::tip Audit 필드
`Audit`를 설정하면 민감 데이터 마스킹, 속도 제한 이벤트, 보안 위반이 [AuditLogger](./audit)를 통해 감사 이벤트로 기록됩니다. [감사 로그](./audit)를 참조하세요.
:::

### Clone

```go
func (c *Config) Clone() Config
```

설정의 깊은 복사를 생성하여, 원본 설정에 영향을 주지 않고 안전하게 수정할 수 있습니다.

```go
base := dd.DefaultConfig()
custom := base.Clone()
custom.Level = dd.LevelDebug
```

### Validate

```go
func (c Config) Validate() error
```

설정의 유효성을 검증하여, 출력 대상, 레벨, 형식 등이 올바른지 확인합니다.

```go
cfg := dd.DefaultConfig()
cfg.Level = dd.LevelDebug
if err := cfg.Validate(); err != nil {
    log.Fatal(err)
}
```

## 출력 대상

### OutputType

출력 대상 타입 열거형.

```go
type OutputType int
```

| 상수 | 값 | 설명 |
|------|----|------|
| `OutputConsole` | `0` | 콘솔 출력 (stdout) |
| `OutputFile` | `1` | 파일 출력 |
| `OutputCustom` | `2` | 커스텀 Writer |

### OutputTarget

출력 대상 설정, 단일 출력 대상을 설명합니다.

```go
type OutputTarget struct {
    Type       OutputType     // 출력 타입
    Path       string         // 파일 경로 (OutputFile 시 유효)
    MaxSizeMB  int            // 파일 크기 상한 MB (OutputFile 시 유효)
    MaxBackups int            // 백업 보존 수량 (OutputFile 시 유효)
    MaxAge     time.Duration  // 이전 파일 보존 기간 (OutputFile 시 유효)
    Compress   bool           // gzip 압축 여부 (OutputFile 시 유효)
    Writer     io.Writer      // 커스텀 Writer (OutputCustom 시 유효)
}
```

### 출력 대상 생성자

```go
func ConsoleOutput() OutputTarget
func FileOutput(path string) OutputTarget
func CustomOutput(w io.Writer) OutputTarget
```

```go
// 콘솔 출력
cfg.Targets = []dd.OutputTarget{dd.ConsoleOutput()}

// 파일 출력
cfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/app.log")}

// 커스텀 Writer
cfg.Targets = []dd.OutputTarget{dd.CustomOutput(customWriter)}

// 다중 대상 출력
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
}
```

## JSON 설정 옵션

### JSONOptions

JSON 출력 형식 설정.

```go
type JSONOptions struct {
    PrettyPrint bool           // 예쁘게 출력 여부 (기본값 false)
    Indent      string         // 들여쓰기 문자열 (기본값 "  ")
    FieldNames  *JSONFieldNames // 커스텀 JSON 필드명
}
```

### JSONFieldNames

JSON 출력의 필드명을 커스터마이즈합니다. 다양한 로그 수집 시스템에 적응하는 데 사용합니다.

```go
type JSONFieldNames struct {
    Timestamp string  // 타임스탬프 필드명 (기본값 "timestamp")
    Level     string  // 레벨 필드명 (기본값 "level")
    Caller    string  // 호출자 필드명 (기본값 "caller")
    Message   string  // 메시지 필드명 (기본값 "message")
    Fields    string  // 필드 컨테이너명 (기본값 "fields")
}
```

포인터 리시버 메서드 `(*JSONFieldNames).IsComplete() bool`를 구현합니다. 5개 필드명이 모두 비어 있지 않을 때 `true`를 반환하며, 모든 필드명이 완전히 커스터마이즈되었는지 확인하는 데 사용할 수 있습니다.

사용 예시:

```go
cfg := dd.DefaultJSONOptions()
cfg.FieldNames = &dd.JSONFieldNames{
    Timestamp: "ts",
    Level:     "lvl",
    Message:   "msg",
}
```

### DefaultJSONOptions

```go
func DefaultJSONOptions() *JSONOptions
```

기본 JSON 출력 옵션을 반환합니다.

```go
cfg := dd.JSONConfig()
// 기본 JSONOptions 포함
```

## SamplingConfig

샘플링 설정, 고처리량 시나리오에서 로그량을 줄이는 데 사용합니다.

```go
type SamplingConfig struct {
    Enabled    bool          // 샘플링 활성화 여부
    Initial    int           // 샘플링 전 항상 기록할 메시지 수
    Thereafter int           // 샘플링 비율 (값이 10이면 10개 중 1개 기록)
    Tick       time.Duration // 카운터 초기화 간격 (0은 초기화 안 함)
}
```

```go
cfg := dd.DefaultConfig()
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,
    Thereafter: 10,
    Tick:       time.Minute,
}
logger, _ := dd.New(cfg)
```

## FieldValidationConfig

필드 검증 설정, 필드 키명의 명명 규칙을 제어합니다.

```go
type FieldValidationConfig struct {
    Mode                     FieldValidationMode      // 검증 모드
    Convention               FieldNamingConvention    // 명명 규칙
    AllowCommonAbbreviations bool                      // 일반적인 약어 허용 (ID, URL 등)
    EnableSecurityValidation bool                      // 보안 검증 활성화 (Log4Shell, 동형문자 공격 등)
}
```

### FieldValidationMode

| 상수 | 설명 |
|------|------|
| `FieldValidationNone` | 검증 비활성화 (기본값) |
| `FieldValidationWarn` | 규칙에 맞지 않는 필드에 경고하지만 여전히 허용 |
| `FieldValidationStrict` | 규칙에 맞지 않는 필드를 거부하고 오류 출력 |

`String()` 메서드를 구현하여 모드 이름을 반환합니다.

### FieldNamingConvention

| 상수 | 설명 | 예시 |
|------|------|------|
| `NamingConventionAny` | 모든 형식 허용 (기본값) | - |
| `NamingConventionSnakeCase` | snake_case | `user_id`, `created_at` |
| `NamingConventionCamelCase` | camelCase | `userId`, `createdAt` |
| `NamingConventionPascalCase` | PascalCase | `UserId`, `CreatedAt` |
| `NamingConventionKebabCase` | kebab-case | `user-id`, `created-at` |

`String()` 메서드를 구현하여 명명 규칙 이름을 반환합니다.

### ValidateFieldKey

```go
func (c *FieldValidationConfig) ValidateFieldKey(key string) error
```

필드 키명이 설정된 명명 규칙에 맞는지 검증합니다.

## 필드 검증 설정

### DefaultFieldValidationConfig

```go
func DefaultFieldValidationConfig() *FieldValidationConfig
```

기본 설정: 검증 비활성화.

### StrictSnakeCaseConfig

```go
func StrictSnakeCaseConfig() *FieldValidationConfig
```

엄격한 snake_case 검증, 필드명은 `snake_case` 형식이어야 합니다.

### StrictCamelCaseConfig

```go
func StrictCamelCaseConfig() *FieldValidationConfig
```

엄격한 camelCase 검증, 필드명은 `camelCase` 형식이어야 합니다.

### 사용 방법

```go
logger, _ := dd.New(dd.Config{
    Level:           dd.LevelInfo,
    FieldValidation: dd.StrictSnakeCaseConfig(),
})

// 유효함
logger.InfoWith("ok", dd.String("user_name", "admin"))

// 유효하지 않음 (snake_case가 아님)
logger.InfoWith("fail", dd.String("userName", "admin"))
```

## 설정 예시

### 프로덕션 환경

```go
logger, _ := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
    Security: dd.DefaultSecurityConfig(),
})
```

### 개발 환경

```go
logger, _ := dd.New(dd.DevelopmentConfig())
```

### 다중 출력 대상

```go
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
```

## 다음 단계

- [Logger](./logger) -- 설정으로 로거 생성
- [출력 대상](./writers) -- FileWriter, BufferedWriter, MultiWriter
- [보안 필터](./security) -- SecurityConfig 상세 가이드
- [훅 시스템](./hooks) -- HooksConfig 상세 가이드
- [감사 로그](./audit) -- AuditConfig 상세 가이드
