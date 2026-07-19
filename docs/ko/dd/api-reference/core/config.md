---
sidebar_label: "설정"
title: "설정 - CyberGo DD | Config 상세"
description: "CyberGo DD Config 구조체의 완전한 API 문서입니다. DefaultConfig/DevelopmentConfig/JSONConfig 사전 설정 함수, OutputTarget 출력 대상 구성, 필드 검증 규칙, 샘플링 제어, 포맷팅 옵션, Validate 검증 메서드를 포함하여 유연하고 타입 안전한 로거 동작 사용자 정의 기능을 제공합니다."
sidebar_position: 4
---

# 설정

DD는 `Config` 구조체로 로거의 동작을 구성하며, 여러 사전 설정 팩토리 함수를 제공합니다.

## 사전 설정 팩토리

```go
// 기본 구성: INFO 레벨, 텍스트 형식
cfg := dd.DefaultConfig()
```

```go
// 개발 구성: DEBUG 레벨, 동적 caller 감지
cfgDev := dd.DevelopmentConfig()
```

```go
// JSON 구성: JSON 형식 출력
cfgJSON := dd.JSONConfig()
```

| 팩토리 함수 | 반환 타입 | 레벨 | 형식 | 적용 시나리오 |
|----------|----------|------|------|----------|
| `DefaultConfig()` | `Config` | Info | Text | 프로덕션 환경 |
| `DevelopmentConfig()` | `Config` | Debug | Text | 개발 환경 |
| `JSONConfig()` | `Config` | Debug | JSON | 로그 수집 |

:::tip 팁 보안 필터 기본 활성화
모든 사전 설정 구성(`DefaultConfig`, `DevelopmentConfig`, `JSONConfig`)은 기본적으로 보안 필터가 활성화되어, 비밀번호, API Key, 신용카드 번호 등 민감 데이터를 자동으로 마스킹합니다.
:::

## Config 구조체

```go
type Config struct {
    // 로그 레벨
    Level          LogLevel         // 로그 레벨(기본 LevelInfo)
    Format         LogFormat        // 출력 형식(FormatText / FormatJSON)

    // 시간 구성
    TimeFormat     string           // 시간 형식(기본 ISO 8601)
    IncludeTime    bool             // 시간 포함 여부(기본 true)
    IncludeLevel   bool             // 레벨 포함 여부(기본 true)

    // caller 정보
    DynamicCaller  bool             // 동적 caller 감지(기본 true)
    FullPath       bool             // 전체 경로 표시 여부(기본 false)

    // 출력 대상
    Targets        []OutputTarget   // 출력 대상 목록

    // JSON 구성
    JSON           *JSONOptions     // JSON 출력 옵션

    // 보안 구성
    Security       *SecurityConfig  // 보안 구성

    // 필드 검증
    FieldValidation *FieldValidationConfig

    // 라이프사이클 핸들러
    FatalHandler      FatalHandler       // Fatal 레벨 커스텀 처리 함수
    WriteErrorHandler WriteErrorHandler  // 쓰기 오류 콜백

    // 확장성
    ContextExtractors []ContextExtractor // 컨텍스트 추출기 목록
    Hooks             *HookRegistry      // 훅 레지스트리
    Sampling          *SamplingConfig    // 샘플링 구성

    // 감사 구성
    Audit             *AuditConfig       // 감사 로그 구성(보안 이벤트 기록)
}
```

:::tip 팁 Audit 필드
`Audit`를 설정하면 민감 데이터 마스킹, 속도 제한, 위반 이벤트가 [AuditLogger](../security-audit/audit)를 통해 감사 이벤트로 기록됩니다. 자세한 내용은 [감사 로그](../security-audit/audit)를 참고하세요.
:::

### Clone

```go
func (c *Config) Clone() Config
```

구성의 복사본을 생성하여, 원본 구성에 영향을 주지 않고 안전하게 수정할 수 있습니다. nil 리시버에는 제로값 `Config{}`를 반환합니다.

복사 전략(소스 코드 `Clone` 주석과 일치):

- **딥 카피**: `Targets`(슬라이스), `JSON`(`JSONFieldNames` 포함), `Security`, `Hooks`, `Sampling`, `Audit`
- **얕은 카피**: `FatalHandler`, `WriteErrorHandler`, `FieldValidation`(함수/포인터 공유)
- **혼합**: `ContextExtractors` 슬라이스는 복사되지만 추출기 인스턴스 자체는 공유

```go
base := dd.DefaultConfig()
custom := base.Clone()
custom.Level = dd.LevelDebug
```

### Validate

```go
func (c Config) Validate() error
```

구성의 유효성을 검사하고 처음 발견한 오류를 반환합니다. `dd.New(cfg)` 내부에서 자동으로 호출되며, `New`에 전달하기 전에 미리 호출해 문제를 발견할 수도 있습니다.

검사 항목:

- `Level`은 `[LevelDebug, LevelFatal]` 범위 내여야 함
- `Format`은 `FormatText` 또는 `FormatJSON`이어야 함
- `IncludeTime=true`이고 `TimeFormat`이 비어 있지 않을 때 Go 시간 레퍼런스 레이아웃 검증(예: `time.RFC3339`)
- `Targets` 총수는 100 이하(초과 시 `ErrMaxWritersExceeded` 반환)
- 각 `Targets` 요소: `OutputCustom`은 nil이 아닌 `Writer`가 필요, `OutputFile`은 비어 있지 않은 `Path`가 필요

```go
cfg := dd.DefaultConfig()
cfg.Level = dd.LevelDebug
if err := cfg.Validate(); err != nil {
    log.Fatal(err)
}
```

## 출력 대상

### OutputType

출력 대상 유형 열거.

```go
type OutputType int
```

| 상수 | 값 | 설명 |
|------|----|------|
| `OutputConsole` | `0` | 콘솔 출력(stdout) |
| `OutputFile` | `1` | 파일 출력 |
| `OutputCustom` | `2` | 사용자 정의 Writer |

### OutputTarget

출력 대상 구성, 단일 출력 대상을 기술.

```go
type OutputTarget struct {
    Type       OutputType     // 출력 유형
    Path       string         // 파일 경로(OutputFile일 때 유효)
    MaxSizeMB  int            // 파일 크기 상한 MB(OutputFile일 때 유효)
    MaxBackups int            // 보존 백업 수(OutputFile일 때 유효)
    MaxAge     time.Duration  // 이전 파일 보존 기간(OutputFile일 때 유효)
    Compress   bool           // gzip 압축 여부(OutputFile일 때 유효)
    Writer     io.Writer      // 사용자 정의 Writer(OutputCustom일 때 유효)
}
```

### 출력 대상 생성자

```go
func ConsoleOutput() OutputTarget
func FileOutput(path string) OutputTarget
func CustomOutput(w io.Writer) OutputTarget
```

:::tip 팁 FileOutput 기본 로테이션 매개변수
`FileOutput`이 반환하는 `OutputTarget`은 기본 로테이션 값이 미리 채워져 있습니다: `MaxSizeMB=100`, `MaxBackups=10`, `MaxAge=30 * 24 * time.Hour`(30일), `Compress=false`. 커스터마이징이 필요하면 반환값의 해당 필드를 직접 수정하세요.

```go
target := dd.FileOutput("logs/app.log")
target.MaxSizeMB = 50               // 50MB 분할
target.MaxBackups = 5               // 백업 5개 보존
target.MaxAge = 7 * 24 * time.Hour  // 7일 보존
target.Compress = true              // 오래된 로그 gzip 압축
```

:::

```go
// 콘솔 출력
cfg.Targets = []dd.OutputTarget{dd.ConsoleOutput()}

// 파일 출력
cfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/app.log")}

// 사용자 정의 Writer
cfg.Targets = []dd.OutputTarget{dd.CustomOutput(customWriter)}

// 다중 대상 출력
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
}
```

## JSON 구성 옵션

### JSONOptions

JSON 출력 형식 구성.

```go
type JSONOptions struct {
    PrettyPrint bool           // 출력 보기 좋게 여부(기본 false)
    Indent      string         // 들여쓰기 문자열(기본 "  ")
    FieldNames  *JSONFieldNames // 커스텀 JSON 필드명
}
```

### JSONFieldNames

JSON 출력에서의 필드명을 사용자 정의합니다. 다양한 로그 수집 시스템에 맞출 때 사용합니다.

```go
type JSONFieldNames struct {
    Timestamp string  // 타임스탬프 필드명(기본 "timestamp")
    Level     string  // 레벨 필드명(기본 "level")
    Caller    string  // caller 필드명(기본 "caller")
    Message   string  // 메시지 필드명(기본 "message")
    Fields    string  // 필드 컨테이너명(기본 "fields")
}
```

포인터 리시버 메서드 `(*JSONFieldNames).IsComplete() bool`을 구현합니다: 5개 필드명이 모두 비어 있지 않을 때 `true`를 반환하며, 모든 필드명을 완전히 커스텀했는지 검증하는 데 사용할 수 있습니다.

사용 예:

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

기본 `JSONOptions` 출력 옵션을 반환합니다: 기본적으로 보기 좋게 출력하지 않고(들여쓰기 두 칸), 필드명은 기본값을 사용합니다.

```go
opts := dd.DefaultJSONOptions()
opts.PrettyPrint = true

logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    JSON:   opts,
})
```

## SamplingConfig

샘플링 구성, 고처리량 시나리오에서 로그량을 줄이는 데 사용합니다.

```go
type SamplingConfig struct {
    Enabled    bool          // 샘플링 활성화 여부
    Initial    int           // 샘플링 전까지 항상 기록하는 메시지 수
    Thereafter int           // 샘플링 비율(값이 10이면 10개당 1개 기록)
    Tick       time.Duration // 카운터 리셋 간격(0은 리셋 안 함)
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

필드 검증 구성, 필드 키 이름의 명명 규칙을 제어합니다.

```go
type FieldValidationConfig struct {
    Mode                     FieldValidationMode      // 검증 모드
    Convention               FieldNamingConvention    // 명명 규칙
    AllowCommonAbbreviations bool                      // 일반 약어 허용(ID, URL 등)
    EnableSecurityValidation bool                      // 보안 검증 활성화(Log4Shell, 동형자(Homograph) 공격 등)
}
```

### FieldValidationMode

| 상수 | 설명 |
|------|------|
| `FieldValidationNone` | 검증 비활성화(기본) |
| `FieldValidationWarn` | 규칙에 맞지 않는 필드를 경고하되 여전히 수락 |
| `FieldValidationStrict` | 명명이 일치하지 않을 때 stderr에 오류 출력(로그 항목은 정상적으로 기록되며 거부되지 않음) |

`String()` 메서드를 구현하여 모드 이름을 반환합니다.

### FieldNamingConvention

| 상수 | 설명 | 예 |
|------|------|------|
| `NamingConventionAny` | 모든 형식 수락(기본) | - |
| `NamingConventionSnakeCase` | snake_case | `user_id`, `created_at` |
| `NamingConventionCamelCase` | camelCase | `userId`, `createdAt` |
| `NamingConventionPascalCase` | PascalCase | UserId, CreatedAt |
| `NamingConventionKebabCase` | kebab-case | `user-id`, `created-at` |

`String()` 메서드를 구현하여 명명 규칙 이름을 반환합니다.

### ValidateFieldKey

```go
func (c *FieldValidationConfig) ValidateFieldKey(key string) error
```

필드 키 이름이 구성된 명명 규칙에 부합하는지 검증합니다.

## 필드 검증 구성

### DefaultFieldValidationConfig

```go
func DefaultFieldValidationConfig() *FieldValidationConfig
```

기본 구성: 검증 비활성화.

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

### 사용 방식

```go
logger, _ := dd.New(dd.Config{
    Level:           dd.LevelInfo,
    FieldValidation: dd.StrictSnakeCaseConfig(),
})

// 유효
logger.InfoWith("ok", dd.String("user_name", "admin"))

// 명명 규칙 위반(snake_case가 아님, 로그는 여전히 기록되며 오류는 stderr로 출력)
logger.InfoWith("fail", dd.String("userName", "admin"))
```

## 구성 예

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

- [Logger](./logger) -- 구성으로 로거 생성
- [출력 대상](../output-integration/writers) -- FileWriter, BufferedWriter, MultiWriter
- [보안 필터](../security-audit/security) -- SecurityConfig 상세
- [훅 시스템](../security-audit/hooks) -- HooksConfig 상세
- [감사 로그](../security-audit/audit) -- AuditConfig 상세
