---
title: "Config 설정 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON Config 설정 옵션 완전 참조: DefaultConfig 기본 설정, SecurityConfig 보안 설정, PrettyConfig 포맷 설정, 캐시 설정, 크기 제한, 보안 옵션, 인코딩 옵션을 자세히 설명하며 Processor 및 모든 JSON 작업의 동작을 커스터마이즈합니다."
---

# Config

Config는 Processor와 모든 JSON 작업의 동작을 커스터마이즈하는 데 사용됩니다.

## Config 구조체

```go
type Config struct {
    // ===== 캐시 설정 =====
    MaxCacheSize int           // 최대 캐시 항목 수
    CacheTTL     time.Duration // 캐시 만료 시간
    EnableCache  bool          // 캐시 활성화 여부
    CacheResults bool          // 작업 결과 캐시 여부

    // ===== 크기 제한 =====
    MaxJSONSize  int64 // 최대 JSON 크기 (바이트)
    MaxPathDepth int   // 최대 경로 깊이
    MaxBatchSize int   // 최대 배치 작업 수

    // ===== 보안 제한 =====
    MaxNestingDepthSecurity   int   // 최대 중첩 깊이
    MaxSecurityValidationSize int64 // 보안 검증 최대 크기
    MaxObjectKeys             int   // 객체 최대 키 수
    MaxArrayElements          int   // 배열 최대 요소 수
    FullSecurityScan          bool  // 전체 보안 스캔 활성화

    // ===== 동시성 =====
    MaxConcurrency    int // 최대 동시성 수
    ParallelThreshold int // 병렬 처리 임계값

    // ===== 처리 옵션 =====
    EnableValidation bool // 유효성 검사 활성화
    StrictMode       bool // 엄격 모드
    CreatePaths      bool // 경로 자동 생성
    CleanupNulls     bool // null 값 정리
    CompactArrays    bool // 배열 압축
    ContinueOnError  bool // 배치 작업 오류 시 계속

    // ===== 입력/출력 옵션 =====
    AllowComments    bool // 주석 허용
    PreserveNumbers  bool // 숫자 정밀도 유지
    ValidateInput    bool // 입력 검증
    ValidateFilePath bool // 파일 경로 검증
    SkipValidation   bool // 검증 건너뛰기 (신뢰된 입력)

    // ===== 인코딩 옵션 =====
    Pretty          bool            // 포맷팅 출력
    Indent          string          // 들여쓰기 문자열
    Prefix          string          // 접두사
    EscapeHTML      bool            // HTML 이스케이프
    SortKeys        bool            // 키 정렬
    ValidateUTF8    bool            // UTF-8 검증
    MaxDepth        int             // 최대 인코딩 깊이
    DisallowUnknown bool            // 알 수 없는 필드 금지
    FloatPrecision  int             // 부동소수점 정밀도 (-1은 자동)
    FloatTruncate   bool            // 부동소수점 자르기
    DisableEscaping bool            // 이스케이프 비활성화
    EscapeUnicode   bool            // 유니코드 이스케이프
    EscapeSlash     bool            // 슬래시 이스케이프
    EscapeNewlines  bool            // 줄바꿈 이스케이프
    EscapeTabs      bool            // 탭 이스케이프
    IncludeNulls    bool            // null 값 포함
    CustomEscapes   map[rune]string // 커스텀 이스케이프 매핑

    // ===== 관측 가능성 =====
    EnableMetrics     bool // 메트릭 수집 활성화
    EnableHealthCheck bool // 상태 확인 활성화

    // ===== 대용량 파일 처리 =====
    ChunkSize       int64 // 청크 크기
    MaxMemory       int64 // 최대 메모리 사용량
    BufferSize      int   // 버퍼 크기
    SamplingEnabled bool  // 샘플링 활성화
    SampleSize      int   // 샘플 수

    // ===== JSONL 설정 =====
    JSONLBufferSize    int   // JSONL 버퍼 크기
    JSONLMaxLineSize   int   // JSONL 최대 줄 크기
    JSONLSkipEmpty     bool  // 빈 줄 건너뛰기
    JSONLSkipComments  bool  // 주석 줄 건너뛰기
    JSONLContinueOnErr bool  // 오류 시 계속
    JSONLWorkers       int   // JSONL 병렬 작업 수
    JSONLChunkSize     int   // JSONL 청크 크기
    JSONLMaxMemory     int64 // JSONL 최대 메모리

    // ===== 병합 옵션 =====
    MergeMode MergeMode // 병합 전략

    // ===== 확장 포인트 =====
    CustomEncoder              CustomEncoder                // 커스텀 인코더
    CustomTypeEncoders         map[reflect.Type]TypeEncoder // 커스텀 타입 인코더
    CustomValidators           []Validator                  // 커스텀 검증기
    AdditionalDangerousPatterns []DangerousPattern           // 추가 위험 패턴
    DisableDefaultPatterns     bool                         // 기본 경고 수준 패턴 비활성화
    Hooks                      []Hook                       // 작업 훅
    CustomPathParser           PathParser                   // 커스텀 경로 파서
}
```

## 설정 프리셋

### DefaultConfig

시그니처: `func DefaultConfig() Config`

대부분의 시나리오에 적합한 기본 설정을 반환합니다.

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**기본값**

| 필드 | 값 | 설명 |
|------|-----|------|
| MaxJSONSize | 100MB | JSON 크기 제한 |
| MaxNestingDepthSecurity | 200 | 중첩 깊이 |
| MaxPathDepth | 50 | 경로 깊이 |
| MaxConcurrency | 50 | 동시성 수 |
| MaxBatchSize | 2000 | 배치 작업 수 |
| CacheTTL | 5분 | 캐시 만료 |
| MaxCacheSize | 128 | 최대 캐시 항목 수 |
| EnableCache | true | 캐시 활성화 |
| CacheResults | true | 작업 결과 캐시 |
| EnableValidation | true | 유효성 검사 활성화 |
| ValidateInput | true | 입력 검증 |
| ValidateFilePath | true | 파일 경로 검증 |
| CreatePaths | true | 경로 자동 생성 |
| Pretty | false | 포맷팅 출력 안 함 |
| EscapeHTML | true | HTML 이스케이프 |
| ValidateUTF8 | true | UTF-8 검증 |
| IncludeNulls | true | null 포함 |
| EscapeNewlines | true | 줄바꿈 이스케이프 |
| EscapeTabs | true | 탭 이스케이프 |
| FloatPrecision | -1 | 자동 정밀도 |
| MaxDepth | 100 | 인코딩 깊이 |
| Indent | "  " | 기본 들여쓰기 |
| ChunkSize | 1MB | 청크 크기 |
| MaxMemory | 100MB | 최대 메모리 |
| BufferSize | 64KB | 버퍼 크기 |
| SamplingEnabled | true | 샘플링 활성화 |
| SampleSize | 1000 | 샘플 수 |
| JSONLBufferSize | 64KB | JSONL 버퍼 크기 |
| JSONLMaxLineSize | 1MB | JSONL 최대 줄 크기 |
| JSONLSkipEmpty | true | 빈 줄 건너뛰기 |
| JSONLSkipComments | false | 주석 줄 건너뛰지 않음 |
| JSONLContinueOnErr | false | 오류 시 중지 |
| JSONLWorkers | 4 | 병렬 작업 수 |
| JSONLChunkSize | 1000 | JSONL 청크 크기 |
| JSONLMaxMemory | 100MB | JSONL 최대 메모리 |
| MergeMode | MergeUnion | 통합 병합 |

### SecurityConfig

시그니처: `func SecurityConfig() Config`

신뢰할 수 없는 입력 처리에 적합한 보안 설정을 반환합니다.

```go
// 다음 시나리오에 권장:
// - 공개 API 및 웹 서비스
// - 사용자가 제출한 데이터
// - 외부 웹훅
// - 인증 엔드포인트
// - 금융 데이터 처리
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**보안 설정 특징**

| 필드 | 값 | 설명 |
|------|-----|------|
| MaxNestingDepthSecurity | 30 | 보수적 중첩 깊이 |
| MaxSecurityValidationSize | 10MB | 보안 검증 크기 |
| MaxObjectKeys | 5000 | 보수적 키 수 제한 |
| MaxArrayElements | 5000 | 보수적 요소 제한 |
| MaxJSONSize | 10MB | 보수적 크기 제한 |
| MaxPathDepth | 30 | 보수적 경로 깊이 |
| FullSecurityScan | true | 전체 보안 스캔 |
| StrictMode | true | 엄격 모드 |
| EnableValidation | true | 유효성 검사 활성화 |
| EnableCache | true | 캐시 활성화 |
| MaxCacheSize | 256 | 캐시 크기 |
| CacheTTL | 3분 | 짧은 TTL |

### PrettyConfig

시그니처: `func PrettyConfig() Config`

포맷팅 출력 설정을 반환합니다.

```go
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

## 설정 메서드

### Clone

시그니처: `func (c *Config) Clone() *Config`

설정의 깊은 복사본을 생성합니다.

```go
cfg := json.DefaultConfig()
cfgCopy := cfg.Clone()
cfgCopy.EnableValidation = true // 원래 설정에 영향 없음
```

### Validate

시그니처: `func (c *Config) Validate() error`

설정을 검증하고 유효하지 않은 값을 자동으로 수정합니다. 이 메서드는 Config를 **원본에서 수정**하며, 유효하지 않은 필드를 해당하는 최소 유효값으로 수정합니다.

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1 // 유효하지 않은 값
if err := cfg.Validate(); err != nil {
    panic(err)
}
// MaxJSONSize가 최소값으로 원본 수정됨
```

### ValidateWithWarnings

시그니처: `func (c *Config) ValidateWithWarnings() []ConfigWarning`

설정을 검증하고 수정 경고 목록을 반환합니다.

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1
warnings := cfg.ValidateWithWarnings()
for _, w := range warnings {
    fmt.Printf("%s: %s\n", w.Field, w.Reason)
}
```

### ConfigWarning 타입

`ConfigWarning`은 설정 검증 중 자동 수정된 정보를 나타냅니다.

```go
type ConfigWarning struct {
    Field    string // 수정된 필드명
    OldValue any    // 원래 값 (유효하지 않은 값은 nil일 수 있음)
    NewValue any    // 수정된 값
    Reason   string // 수정 사유
}
```

### SecurityLimits 타입

`SecurityLimits`는 Config의 보안 관련 제한 필드를 요약합니다.

```go
type SecurityLimits struct {
    MaxNestingDepth           int   `json:"max_nesting_depth"`
    MaxSecurityValidationSize int64 `json:"max_security_validation_size"`
    MaxObjectKeys             int   `json:"max_object_keys"`
    MaxArrayElements          int   `json:"max_array_elements"`
    MaxJSONSize               int64 `json:"max_json_size"`
    MaxPathDepth              int   `json:"max_path_depth"`
}
```

### AddHook

시그니처: `func (c *Config) AddHook(hook Hook)`

작업 훅을 추가합니다.

```go
cfg := json.DefaultConfig()
cfg.AddHook(json.LoggingHook(slog.Default()))
```

### AddValidator

시그니처: `func (c *Config) AddValidator(validator Validator)`

커스텀 검증기를 추가합니다.

```go
cfg := json.DefaultConfig()
cfg.AddValidator(&MyValidator{})
```

### AddDangerousPattern

시그니처: `func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

추가 보안 패턴을 추가합니다.

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "eval-call",
    Level:   json.PatternLevelCritical,
})
```

## 사용 예제

### 기본 사용

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### 보안 설정

```go
// 신뢰할 수 없는 입력 처리
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### 포맷팅 출력

```go
// JSON 포맷팅
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

### 커스텀 설정

```go
cfg := json.DefaultConfig()

// 보안 설정
cfg.MaxJSONSize = 10 * 1024 * 1024 // 10MB
cfg.MaxNestingDepthSecurity = 50
cfg.EnableValidation = true

// 훅
cfg.Hooks = []json.Hook{json.LoggingHook(slog.Default())}

// 검증기
cfg.CustomValidators = []json.Validator{&MyValidator{}}

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### 복제와 수정

```go
// 기본 설정을 기반으로 변형 생성
base := json.DefaultConfig()

// 변형 1: 개발 설정
devCfg := base.Clone()
devCfg.EnableMetrics = true

// 변형 2: 프로덕션 설정
prodCfg := base.Clone()
prodCfg.EnableValidation = true
```

## 설정 상수

```go
const (
    // 크기 제한
    DefaultMaxJSONSize       = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth   = 200
    DefaultMaxPathDepth      = 50
    DefaultMaxConcurrency    = 50
    DefaultMaxBatchSize      = 2000
    DefaultMaxSecuritySize   = 10 * 1024 * 1024   // 10MB
    DefaultMaxObjectKeys     = 100000
    DefaultMaxArrayElements  = 100000
    DefaultParallelThreshold = 10

    // 캐시
    DefaultCacheTTL = 5 * time.Minute
)
```

:::info 내부 상수
경로 검증 길이 제한(`maxPathLength`), 캐시 키 길이 제한(`maxCacheKeyLength`) 등의 상수는 내부 구현으로 전환되어 공개 API로 내보내지 않습니다. 관련 기본값은 `Config` 구조체의 필드 기본값으로 반영됩니다.
:::

---

## 병합 모드

`MergeMode`는 `MergeJSON` 및 `MergeMany` 함수의 병합 전략을 제어합니다.

### MergeUnion (기본값)

모든 키/요소를 병합하고, 충돌 시 덮어쓰기 값을 사용합니다.

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeUnion
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// 결과: {"a": 1, "b": 3, "c": 4}
```

### MergeIntersection

두 객체 모두에 존재하는 키만 유지합니다.

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// 결과: {"b": 3}
```

### MergeDifference

기본 객체에만 존재하고 덮어쓰기 객체에 존재하지 않는 키만 유지합니다.

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// 결과: {"a": 1}
```

---

## 보안 권장 사항

| 설정 항목 | 권장 값 | 설명 |
|--------|--------|------|
| MaxJSONSize | 10-100MB | 서버 메모리에 따라 조정 |
| MaxNestingDepthSecurity | 30-50 | 깊은 중첩 공격 방지 |
| MaxPathDepth | 30-50 | 경로 복잡도 제한 |
| EnableValidation | true | 항상 활성화 |
| FullSecurityScan | true (신뢰할 수 없는 입력) | 전체 보안 스캔 |

## 관련 문서

- [Processor](./processor/) - 프로세서 메서드
- [상수와 오류](./constants) - 설정 상수
- [보안 개요](../security/) - 보안 모범 사례
- [인터페이스 정의](./interfaces) - 확장 인터페이스
