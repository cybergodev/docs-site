---
title: "인터페이스 정의 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 확장 인터페이스 정의 완전 레퍼런스: CustomEncoder, TypeEncoder, Validator, Hook 인터페이스, PathParser 및 DangerousPattern을 포함하여 라이브러리의 인코딩, 검증 및 보안 방어 등 핵심 기능을 유연하게 확장할 수 있으며 커스텀 직렬화와 보안 전략 요구를 충족합니다."
---

# 인터페이스 정의

json 패키지는 커스텀 JSON 처리 동작을 허용하는 여러 확장 인터페이스를 제공합니다.

## 인코더 인터페이스

### CustomEncoder

커스텀 JSON 인코더 인터페이스입니다.

```go
type CustomEncoder interface {
    // Encode는 Go 값을 JSON 문자열로 변환합니다
    Encode(value any) (string, error)
}
```

**사용 예제**

```go
import stdjson "encoding/json"

type UpperCaseEncoder struct{}

func (e *UpperCaseEncoder) Encode(value any) (string, error) {
    // 커스텀 인코딩 로직
    switch v := value.(type) {
    case string:
        return fmt.Sprintf(`"%s"`, strings.ToUpper(v)), nil
    default:
        // 표준 인코딩 사용 (무한 재귀 방지)
        data, err := stdjson.Marshal(v)
        if err != nil {
            return "", err
        }
        return string(data), nil
    }
}

// 설정 사용
cfg := json.DefaultConfig()
cfg.CustomEncoder = &UpperCaseEncoder{}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### TypeEncoder

특정 타입의 인코더 인터페이스입니다.

```go
type TypeEncoder interface {
    // Encode는 특정 타입의 값을 JSON 문자열로 인코딩합니다
    Encode(v reflect.Value) (string, error)
}
```

**사용 예제**

```go
type TimeEncoder struct{}

func (e *TimeEncoder) Encode(v reflect.Value) (string, error) {
    if v.Type() == reflect.TypeOf(time.Time{}) {
        t := v.Interface().(time.Time)
        return fmt.Sprintf(`"%s"`, t.Format(time.RFC3339)), nil
    }
    return "", fmt.Errorf("지원하지 않는 타입: %v", v.Type())
}

// 타입 인코더 등록
cfg := json.DefaultConfig()
cfg.CustomTypeEncoders = map[reflect.Type]json.TypeEncoder{
    reflect.TypeOf(time.Time{}): &TimeEncoder{},
}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## 검증기 인터페이스

### Validator

JSON 검증기 인터페이스입니다.

```go
type Validator interface {
    // Validate는 JSON 문자열에 문제가 있는지 확인합니다
    // 유효하면 nil을 반환하고, 그렇지 않으면 문제를 설명하는 오류를 반환합니다
    Validate(jsonStr string) error
}
```

**사용 예제**

```go
type SizeValidator struct {
    MaxSize int64
}

func (v *SizeValidator) Validate(jsonStr string) error {
    // 입력 데이터 크기 확인
    if int64(len(jsonStr)) > v.MaxSize {
        return fmt.Errorf("JSON이 최대 크기를 초과했습니다: %d", v.MaxSize)
    }
    return nil
}

// 검증기 설정
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}} // 1MB
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## 훅 인터페이스

### Hook

작업 가로채기 인터페이스로, 전처리/후처리를 지원합니다.

```go
type Hook interface {
    // Before는 작업 전에 호출됩니다
    // 오류를 반환하면 작업을 중단합니다
    Before(ctx HookContext) error

    // After는 작업 완료 후에 호출됩니다
    // 결과를 수정하거나 오류를 확인할 수 있습니다
    After(ctx HookContext, result any, err error) (any, error)
}
```

### HookContext

훅 컨텍스트로, 작업 정보를 제공합니다.

```go
type HookContext struct {
    Operation string        // 작업 타입: "get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string        // 입력 JSON 문자열 (marshal 시 비어있을 수 있음)
    Path      string        // 대상 경로 (marshal/unmarshal 시 비어있을 수 있음)
    Value     any           // set 작업의 값
    Config    *Config       // 활성 설정
    StartTime time.Time     // 작업 시작 시간
}
```

**사용 예제**

```go
type LoggingHook struct {
    logger *slog.Logger
}

func (h *LoggingHook) Before(ctx json.HookContext) error {
    h.logger.Info("작업 시작",
        "operation", ctx.Operation,
        "path", ctx.Path,
    )
    return nil
}

func (h *LoggingHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("작업 완료",
        "operation", ctx.Operation,
        "path", ctx.Path,
        "duration", time.Since(ctx.StartTime),
        "error", err,
    )
    return result, err
}

// 훅 추가
cfg := json.DefaultConfig()
cfg.Hooks = []json.Hook{&LoggingHook{logger: slog.Default()}}
```

### HookFunc

구조체 어댑터로, 함수를 훅으로 사용할 수 있게 합니다.

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

**사용 예제**

```go
// After만 필요한 경우
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        log.Printf("%s completed in %v", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})

// Before만 필요한 경우
p.AddHook(&json.HookFunc{
    BeforeFn: func(ctx json.HookContext) error {
        log.Printf("starting %s on path %s", ctx.Operation, ctx.Path)
        return nil
    },
})
```

### 미리 정의된 훅

#### LoggingHook

시그니처: `func LoggingHook(logger interface{ Info(msg string, args ...any) }) Hook`

로그 기록 훅을 생성합니다.

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

#### TimingHook

시그니처: `func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook`

타이밍 기록 훅을 생성합니다.

```go
type MetricsRecorder struct{}

func (r *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.RecordDuration(op, duration)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

#### ValidationHook

시그니처: `func ValidationHook(validator func(jsonStr, path string) error) Hook`

입력 검증 훅을 생성합니다.

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1_000_000 {
        return errors.New("JSON이 너무 큽니다")
    }
    return nil
}))
```

#### ErrorHook

시그니처: `func ErrorHook(handler func(ctx HookContext, err error) error) Hook`

오류 가로채기 훅을 생성합니다.

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // 원래 오류 또는 변환된 오류 반환
}))
```

## 보안 패턴 인터페이스

### PatternLevel

위험 패턴 심각도 수준입니다.

```go
type PatternLevel int

const (
    // PatternLevelCritical - 항상 작업 차단
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning - 엄격 모드에서 차단, 느슨한 모드에서 경고 기록
    PatternLevelWarning

    // PatternLevelInfo - 기록만, 절대 차단하지 않음
    PatternLevelInfo
)
```

### DangerousPattern

위험 패턴 구조체로, 커스텀 보안 규칙을 정의하는 데 사용됩니다.

```go
type DangerousPattern struct {
    // Pattern은 입력에서 감지할 부분 문자열입니다
    Pattern string

    // Name은 패턴의 설명적인 이름입니다
    Name string

    // Level은 해당 패턴의 심각도 수준을 결정합니다
    Level PatternLevel
}
```

**사용 예제**

```go
// 구조체 리터럴로 커스텀 위험 패턴 생성
customPattern := json.DangerousPattern{
    Pattern: "eval(",
    Name:    "JavaScript eval 호출",
    Level:   json.PatternLevelCritical,
}

// 설정으로 추가
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(customPattern)
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "internal_api",
    Name:    "내부 API 참조",
    Level:   json.PatternLevelWarning,
})
```

## 경로 파싱 인터페이스

### PathParser

경로 파서 인터페이스입니다.

```go
type PathParser interface {
    // ParsePath는 경로 문자열을 경로 세그먼트로 파싱합니다
    ParsePath(path string) ([]PathSegment, error)
}
```

**사용 예제**

```go
type CustomPathParser struct{}

func (p *CustomPathParser) ParsePath(path string) ([]json.PathSegment, error) {
    // 커스텀 경로 파싱 로직
    return nil, nil // 커스텀 파싱 구현
}
```

## 기본 타입

### Number

JSON 숫자 타입으로, 숫자 정밀도를 보존합니다. 큰 숫자를 처리하거나 정확한 소수가 필요할 때 사용합니다.

```go
type Number string
```

:::tip 호환성 안내
라이브러리의 `Number` 타입은 `encoding/json.Number`와 100% 호환되며, 직접 교체하여 사용할 수 있습니다.
:::

**메서드**:

```go
func (n Number) String() string              // 숫자의 리터럴 텍스트 반환
func (n Number) Float64() (float64, error)   // float64로 변환
func (n Number) Int64() (int64, error)       // int64로 변환
```

**사용 예제**:

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// Number 타입 가져오기 (Get 메서드로 가져온 후 타입 단언)
val, err := processor.Get(data, "large_number")
if err != nil {
    panic(err)
}

// 타입 단언으로 Number 가져오기
if num, ok := val.(json.Number); ok {
    // Number는 원래 정밀도를 보존
    fmt.Println(num.String()) // "9007199254740993" (완전한 정밀도)

    // 다른 타입으로 변환
    f, _ := num.Float64()
    i, _ := num.Int64()
}
```

## 표준 라이브러리 호환 인터페이스

`json` 패키지는 `encoding/json`과 호환되는 다음 표준 인터페이스를 내보내며, 커스텀 타입의 인코딩 및 디코딩 동작에 사용됩니다.

### Marshaler

```go
type Marshaler interface {
    MarshalJSON() ([]byte, error)
}
```

### Unmarshaler

```go
type Unmarshaler interface {
    UnmarshalJSON(data []byte) error
}
```

### TextMarshaler

```go
type TextMarshaler interface {
    MarshalText() ([]byte, error)
}
```

### TextUnmarshaler

```go
type TextUnmarshaler interface {
    UnmarshalText(text []byte) error
}
```

**사용 예제**

```go
type Person struct {
    Name string
}

// Marshaler 인터페이스 구현
func (p Person) MarshalJSON() ([]byte, error) {
    return []byte(`{"name":"` + p.Name + `"}`), nil
}

// Unmarshaler 인터페이스 구현
func (p *Person) UnmarshalJSON(data []byte) error {
    var v struct{ Name string `json:"name"` }
    if err := json.Unmarshal(data, &v); err != nil {
        return err
    }
    p.Name = v.Name
    return nil
}
```

`Encoder`, `Decoder`, `Token`, `Delim`, `Number` 등 인코딩/디코딩 타입에 대한 자세한 내용은 [타입 정의](./types#encoder-json-인코더)를 참조하세요.

## 타입 정의

### Result[T]

타입 안전한 작업 결과로, 제네릭을 지원하는 결과 처리를 제공합니다.

```go
type Result[T any] struct {
    Value  T     // 결과 값
    Exists bool  // 경로가 존재하는지 여부
    Error  error // 오류 정보 (있는 경우)
}
```

**메서드**:

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Ok` | `func (r Result[T]) Ok() bool` | 결과 유효성 (오류 없고 존재함) |
| `Unwrap` | `func (r Result[T]) Unwrap() T` | 값 가져오기, 유효하지 않으면 제로값 반환 |
| `UnwrapOr` | `func (r Result[T]) UnwrapOr(defaultValue T) T` | 값 또는 기본값 가져오기 |

**사용 예제**:

```go
// 제네릭으로 값 가져오기
name := json.GetTyped[string](data, "user.name")
fmt.Println(name)

// 기본값으로 가져오기
name = json.GetTyped[string](data, "user.name", "unknown")
```

---

### AccessResult

동적 타입 접근 결과로, Processor.SafeGet이 반환합니다.

```go
type AccessResult struct {
    Value  any    // 결과 값
    Exists bool   // 경로가 존재하는지 여부
    Type   string // 런타임 타입 정보
}

// 메서드
func (r AccessResult) Ok() bool                           // 존재 여부
func (r AccessResult) Unwrap() any                        // 값 가져오기
func (r AccessResult) UnwrapOr(defaultValue any) any      // 값 또는 기본값 가져오기
func (r AccessResult) AsString() (string, error)          // 엄격한 변환
func (r AccessResult) AsStringConverted() (string, error) // 포맷팅 변환
func (r AccessResult) AsInt() (int, error)                // 엄격한 변환
func (r AccessResult) AsFloat64() (float64, error)        // 엄격한 변환
func (r AccessResult) AsBool() (bool, error)              // 엄격한 변환
```

**타입 변환 메서드 설명**:

| 메서드 | 변환 동작 | 설명 |
|------|----------|------|
| `AsString()` | 엄격 | string 타입만 허용, 문자열이 아니면 오류 반환 |
| `AsStringConverted()` | 포맷팅 | fmt.Sprintf로 임의의 값을 문자열 표현으로 변환 |
| `AsInt()` | 엄격 | bool을 int로 변환하지 않음, 정수와 파싱 가능한 숫자만 허용 |
| `AsFloat64()` | 엄격 | bool을 float로 변환하지 않음, 부동소수점과 파싱 가능한 숫자만 허용 |
| `AsBool()` | 엄격 | bool과 파싱 가능한 문자열만 허용 ("true"/"false"/"yes"/"no" 등) |

```go
result := p.SafeGet(data, "user.age")

// 엄격한 변환 - 값이 정수가 아니면 오류 반환
age, err := result.AsInt()

// 포맷팅 변환 - 임의의 값을 문자열로 변환
str, err := result.AsStringConverted() // 예: 30 -> "30"
```

## Schema 타입

### Schema

JSON Schema는 구조체로 정의되며, 타입 안전한 Schema 정의를 지원합니다.

```go
type Schema struct {
    Type                 string            `json:"type,omitempty"`
    Properties           map[string]*Schema `json:"properties,omitempty"`
    Items                *Schema           `json:"items,omitempty"`
    Required             []string          `json:"required,omitempty"`
    MinLength            int               `json:"minLength,omitempty"`
    MaxLength            int               `json:"maxLength,omitempty"`
    Minimum              float64           `json:"minimum,omitempty"`
    Maximum              float64           `json:"maximum,omitempty"`
    Pattern              string            `json:"pattern,omitempty"`
    Format               string            `json:"format,omitempty"`
    AdditionalProperties bool              `json:"additionalProperties,omitempty"`
    MinItems             int               `json:"minItems,omitempty"`
    MaxItems             int               `json:"maxItems,omitempty"`
    UniqueItems          bool              `json:"uniqueItems,omitempty"`
    Enum                 []any             `json:"enum,omitempty"`
    Const                any               `json:"const,omitempty"`
    MultipleOf           float64           `json:"multipleOf,omitempty"`
    ExclusiveMinimum     bool              `json:"exclusiveMinimum,omitempty"`
    ExclusiveMaximum     bool              `json:"exclusiveMaximum,omitempty"`
    Title                string            `json:"title,omitempty"`
    Description          string            `json:"description,omitempty"`
    Default              any               `json:"default,omitempty"`
    Examples             []any             `json:"examples,omitempty"`
}
```

**사용 예제**:

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name"},
    Properties: map[string]*json.Schema{
        "name": {Type: "string"},
        "age":  {Type: "number"},
    },
}
```

### SchemaConfig

Schema 검증 설정입니다. `NewSchemaWithConfig`로 Schema 인스턴스를 생성하는 데 사용됩니다.

```go
type SchemaConfig struct {
    Type                 string
    Properties           map[string]*Schema
    Items                *Schema
    Required             []string
    MinLength            *int
    MaxLength            *int
    Minimum              *float64
    Maximum              *float64
    Pattern              string
    Format               string
    AdditionalProperties *bool
    MinItems             *int
    MaxItems             *int
    UniqueItems          bool
    Enum                 []any
    Const                any
    MultipleOf           *float64
    ExclusiveMinimum     *bool
    ExclusiveMaximum     *bool
    Title                string
    Description          string
    Default              any
    Examples             []any
}
```

**사용 예제**:

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
cfg.AdditionalProperties = ptrBool(false)
schema := json.NewSchemaWithConfig(cfg)
```

### ValidationError

Schema 검증 오류입니다.

```go
type ValidationError struct {
    Path    string // 오류 경로
    Message string // 오류 메시지
}

func (ve *ValidationError) Error() string
```

## 관련 문서

- [Hook 훅 시스템](./hooks) - 훅 자세한 사용 가이드
- [Validator 검증기](./validator) - 검증기 자세한 사용 가이드
- [CustomEncoder](./custom-encoder) - 커스텀 인코더 가이드
