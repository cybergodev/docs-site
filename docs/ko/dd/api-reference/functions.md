---
title: "패키지 함수 - CyberGo DD | 전역 함수와 생성자"
description: "CyberGo DD 패키지 수준 함수 전체 API 문서. New 로거 생성 함수, Default/SetDefault/InitDefault 전역 로그 관리 함수, DefaultConfig/DevelopmentConfig/JSONConfig 설정 사전 설정 함수 및 모든 생성자 팩토리 함수를 포함하며, dd. 접두사로 직접 호출할 수 있습니다."
---

# 패키지 함수

DD는 풍부한 패키지 수준 함수를 제공하며, `dd.` 접두사로 직접 호출할 수 있습니다. 이 함수들은 모두 전역 로거 (`Default()`)를 통해 실행됩니다.

## 로거 생성

### New

```go
func New(cfg ...Config) (*Logger, error)
```

새로운 Logger 인스턴스를 생성합니다. 설정을 전달하지 않으면 기본 설정을 사용합니다.

```go
// 기본 설정
logger, _ := dd.New()

// 커스텀 설정
logger, _ := dd.New(dd.DefaultConfig())

// 참고: 0개 또는 1개의 설정만 허용, 여러 개를 전달하면 오류 반환
// logger, _ := dd.New(cfg1, cfg2)  // 오류!
```

## 전역 로거

### 가져오기와 설정

| 함수 | 서명 | 설명 |
|------|------|------|
| `Default` | `func Default() *Logger` | 전역 로거 가져오기 (지연 초기화) |
| `SetDefault` | `func SetDefault(logger *Logger)` | 전역 로거 설정 |
| `InitDefault` | `func InitDefault(cfg ...Config) error` | 설정으로 전역 로거 초기화 |
| `DefaultWithErr` | `func DefaultWithErr() (*Logger, error)` | 전역 로거와 초기화 오류 가져오기 |
| `DefaultInitError` | `func DefaultInitError() error` | 초기화 오류 가져오기 |

### 전역 로거 초기화

```go
// 방법 1: 자동 초기화 (첫 호출 시 생성)
dd.Default().Info("전역 로거 자동 생성")

// 방법 2: 명시적 초기화
err := dd.InitDefault(dd.JSONConfig())
if err != nil {
    log.Fatal(err)
}
dd.Default().Info("JSON 설정 전역 로거 사용")

// 방법 3: 전역 로거 교체
custom, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
})
dd.SetDefault(custom)

// 방법 4: 초기화 오류 확인
logger, err := dd.DefaultWithErr()
if err != nil {
    log.Printf("전역 로거 초기화 실패: %v", err)
}
```

## 설정 사전 설정

| 함수 | 서명 | 설명 |
|------|------|------|
| `DefaultConfig` | `func DefaultConfig() Config` | 기본 설정 (Info 레벨, 텍스트 형식) |
| `DevelopmentConfig` | `func DevelopmentConfig() Config` | 개발 설정 (Debug 레벨) |
| `JSONConfig` | `func JSONConfig() Config` | JSON 출력 설정 |

```go
cfg := dd.DefaultConfig()
cfg.Level = dd.LevelDebug
logger, _ := dd.New(cfg)
```

## 출력 대상 생성자

| 함수 | 서명 | 설명 |
|------|------|------|
| `ConsoleOutput` | `func ConsoleOutput() OutputTarget` | 콘솔 출력 |
| `FileOutput` | `func FileOutput(path string) OutputTarget` | 파일 출력 (순환 지원) |
| `CustomOutput` | `func CustomOutput(w io.Writer) OutputTarget` | 커스텀 Writer 출력 |

```go
cfg := dd.DefaultConfig()
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
    dd.CustomOutput(customWriter),
}
logger, _ := dd.New(cfg)
```

## 기본 로그 (패키지 수준)

다음 함수는 전역 로거를 통해 로그를 출력합니다:

| 함수 | 서명 | 설명 |
|------|------|------|
| `Debug` | `func Debug(args ...any)` | Debug 레벨 로그 |
| `Info` | `func Info(args ...any)` | Info 레벨 로그 |
| `Warn` | `func Warn(args ...any)` | Warn 레벨 로그 |
| `Error` | `func Error(args ...any)` | Error 레벨 로그 |
| `Fatal` | `func Fatal(args ...any)` | Fatal 레벨 로그 (기본적으로 os.Exit(1) 호출, FatalHandler로 커스터마이즈 가능) |

```go
dd.Info("애플리케이션 시작 완료")
dd.Errorf("사용자 %s 로그인 실패", username)
dd.Warn("디스크 공간 부족")
```

## 포맷팅 로그 (패키지 수준)

| 함수 | 서명 | 설명 |
|------|------|------|
| `Debugf` | `func Debugf(format string, args ...any)` | Debug 레벨 포맷팅 로그 |
| `Infof` | `func Infof(format string, args ...any)` | Info 레벨 포맷팅 로그 |
| `Warnf` | `func Warnf(format string, args ...any)` | Warn 레벨 포맷팅 로그 |
| `Errorf` | `func Errorf(format string, args ...any)` | Error 레벨 포맷팅 로그 |
| `Fatalf` | `func Fatalf(format string, args ...any)` | Fatal 레벨 포맷팅 로그 (기본적으로 os.Exit(1) 호출, FatalHandler로 커스터마이즈 가능) |

## 범용 레벨 로그 (패키지 수준)

| 함수 | 서명 | 설명 |
|------|------|------|
| `Log` | `func Log(level LogLevel, args ...any)` | 레벨 지정 로그 |
| `Logf` | `func Logf(level LogLevel, format string, args ...any)` | 레벨 지정 포맷팅 로그 |
| `LogWith` | `func LogWith(level LogLevel, msg string, fields ...Field)` | 레벨 지정 구조화된 로그 |

```go
dd.Log(dd.LevelDebug, "디버그 정보")
dd.Logf(dd.LevelWarn, "경고: %s", reason)
dd.LogWith(dd.LevelError, "요청 실패",
    dd.String("path", "/api/users"),
    dd.Int("status", 500),
)
```

## 구조화된 로그 (패키지 수준)

다음 함수는 전역 로거를 통해 구조화된 로그를 출력합니다:

| 함수 | 서명 | 설명 |
|------|------|------|
| `DebugWith` | `func DebugWith(msg string, fields ...Field)` | Debug 레벨 구조화된 로그 |
| `InfoWith` | `func InfoWith(msg string, fields ...Field)` | Info 레벨 구조화된 로그 |
| `WarnWith` | `func WarnWith(msg string, fields ...Field)` | Warn 레벨 구조화된 로그 |
| `ErrorWith` | `func ErrorWith(msg string, fields ...Field)` | Error 레벨 구조화된 로그 |
| `FatalWith` | `func FatalWith(msg string, fields ...Field)` | Fatal 레벨 구조화된 로그 |

```go
dd.InfoWith("요청 완료",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)

dd.ErrorWith("데이터베이스 오류",
    dd.Err(err),
    dd.String("query", sql),
)
```

## 레벨 관리 (패키지 수준)

| 함수 | 서명 | 설명 |
|------|------|------|
| `SetLevel` | `func SetLevel(level LogLevel) error` | 전역 로그 레벨 설정 |
| `GetLevel` | `func GetLevel() LogLevel` | 전역 로그 레벨 가져오기 |
| `IsLevelEnabled` | `func IsLevelEnabled(level LogLevel) bool` | 지정된 레벨 활성화 여부 확인 |
| `IsDebugEnabled` | `func IsDebugEnabled() bool` | Debug 레벨 활성화 여부 확인 |
| `IsInfoEnabled` | `func IsInfoEnabled() bool` | Info 레벨 활성화 여부 확인 |
| `IsWarnEnabled` | `func IsWarnEnabled() bool` | Warn 레벨 활성화 여부 확인 |
| `IsErrorEnabled` | `func IsErrorEnabled() bool` | Error 레벨 활성화 여부 확인 |
| `IsFatalEnabled` | `func IsFatalEnabled() bool` | Fatal 레벨 활성화 여부 확인 |

```go
// 동적으로 로그 레벨 조정
dd.SetLevel(dd.LevelDebug)

// 조건부 로그 (불필요한 연산 방지)
if dd.IsDebugEnabled() {
    dd.Debug(computeExpensiveDebugInfo())
}
```

## 필드 체인 (패키지 수준)

| 함수 | 서명 | 설명 |
|------|------|------|
| `WithFields` | `func WithFields(fields ...Field) *LoggerEntry` | 사전 설정 필드가 있는 Entry 생성 |
| `WithField` | `func WithField(key string, value any) *LoggerEntry` | 단일 사전 설정 필드가 있는 Entry 생성 |

```go
dd.WithFields(dd.String("service", "api"), dd.String("version", "1.0")).
    Info("요청 처리 완료")

dd.WithField("request_id", "abc123").Info("요청 처리")
```

## 라이프사이클 (패키지 수준)

| 함수 | 서명 | 설명 |
|------|------|------|
| `Flush` | `func Flush() error` | 전역 로그 버퍼 새로고침 |

## Writer 관리 (패키지 수준)

| 함수 | 서명 | 설명 |
|------|------|------|
| `AddWriter` | `func AddWriter(writer io.Writer) error` | 출력 Writer 추가 |
| `RemoveWriter` | `func RemoveWriter(writer io.Writer) error` | 출력 Writer 제거 |
| `WriterCount` | `func WriterCount() int` | Writer 수 가져오기 |

## 샘플링 제어 (패키지 수준)

| 함수 | 서명 | 설명 |
|------|------|------|
| `SetSampling` | `func SetSampling(config *SamplingConfig)` | 샘플링 설정 구성 |
| `GetSampling` | `func GetSampling() *SamplingConfig` | 샘플링 설정 가져오기 |

## Writer 생성자

| 함수 | 서명 | 설명 |
|------|------|------|
| `NewFileWriter` | `func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)` | 파일 Writer 생성 |
| `DefaultFileWriterConfig` | `func DefaultFileWriterConfig() FileWriterConfig` | 기본 파일 Writer 설정 |
| `NewBufferedWriter` | `func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)` | 버퍼 Writer 생성 |
| `DefaultBufferedWriterConfig` | `func DefaultBufferedWriterConfig() BufferedWriterConfig` | 기본 버퍼 Writer 설정 |
| `NewMultiWriter` | `func NewMultiWriter(writers ...io.Writer) *MultiWriter` | 다중 출력 Writer 생성 |

## 보안 설정 생성자

| 함수 | 서명 | 설명 |
|------|------|------|
| `DefaultSecurityConfig` | `func DefaultSecurityConfig() *SecurityConfig` | 기본 보안 설정 (기본 필터링) |
| `DefaultSecureConfig` | `func DefaultSecureConfig() *SecurityConfig` | 전체 보안 설정 |
| `HealthcareConfig` | `func HealthcareConfig() *SecurityConfig` | HIPAA 준수 설정 |
| `FinancialConfig` | `func FinancialConfig() *SecurityConfig` | PCI-DSS 준수 설정 |
| `GovernmentConfig` | `func GovernmentConfig() *SecurityConfig` | 정부 표준 설정 |
| `SecurityConfigForLevel` | `func SecurityConfigForLevel(level SecurityLevel) *SecurityConfig` | 레벨별 보안 설정 가져오기 |

## 민감 데이터 필터 생성자

| 함수 | 서명 | 설명 |
|------|------|------|
| `NewSensitiveDataFilter` | `func NewSensitiveDataFilter() *SensitiveDataFilter` | 전체 패턴 세트 필터 |
| `NewEmptySensitiveDataFilter` | `func NewEmptySensitiveDataFilter() *SensitiveDataFilter` | 빈 필터 |
| `NewCustomSensitiveDataFilter` | `func NewCustomSensitiveDataFilter(patterns ...string) (*SensitiveDataFilter, error)` | 커스텀 패턴 필터 |

## 훅 생성자

| 함수 | 서명 | 설명 |
|------|------|------|
| `NewHookRegistry` | `func NewHookRegistry() *HookRegistry` | 훅 레지스트리 생성 |
| `NewHooksFromConfig` | `func NewHooksFromConfig(cfg HooksConfig) *HookRegistry` | 설정에서 훅 레지스트리 생성 |

## 감사 로그 생성자

| 함수 | 서명 | 설명 |
|------|------|------|
| `NewAuditLogger` | `func NewAuditLogger(cfg AuditConfig) (*AuditLogger, error)` | 감사 로거 생성 |
| `DefaultAuditConfig` | `func DefaultAuditConfig() AuditConfig` | 기본 감사 설정 |
| `VerifyAuditEvent` | `func VerifyAuditEvent(entry string, signer *IntegritySigner) *AuditVerificationResult` | 감사 이벤트 무결성 검증 |

## 무결성 서명 생성자

| 함수 | 서명 | 설명 |
|------|------|------|
| `NewIntegritySigner` | `func NewIntegritySigner(cfg IntegrityConfig) (*IntegritySigner, error)` | 무결성 서명기 생성 |
| `DefaultIntegrityConfigSafe` | `func DefaultIntegrityConfigSafe() (IntegrityConfig, error)` | 안전한 랜덤 키 설정 |

## 테스트 보조 생성자

| 함수 | 서명 | 설명 |
|------|------|------|
| `NewLoggerRecorder` | `func NewLoggerRecorder() *LoggerRecorder` | 로그 레코더 생성 (테스트용) |

## 컨텍스트 함수

| 함수 | 서명 | 설명 |
|------|------|------|
| `WithTraceID` | `func WithTraceID(ctx context.Context, traceID string) context.Context` | Trace ID 설정 |
| `WithSpanID` | `func WithSpanID(ctx context.Context, spanID string) context.Context` | Span ID 설정 |
| `WithRequestID` | `func WithRequestID(ctx context.Context, requestID string) context.Context` | Request ID 설정 |
| `GetTraceID` | `func GetTraceID(ctx context.Context) string` | Trace ID 가져오기 |
| `GetSpanID` | `func GetSpanID(ctx context.Context) string` | Span ID 가져오기 |
| `GetRequestID` | `func GetRequestID(ctx context.Context) string` | Request ID 가져오기 |

## JSON 설정

| 함수 | 서명 | 설명 |
|------|------|------|
| `DefaultJSONOptions` | `func DefaultJSONOptions() *JSONOptions` | 기본 JSON 출력 옵션 |

## 필드 생성자

구조화된 로그 필드(`Field`)를 생성하는 데 사용되며, `*With` 시리즈 메서드 또는 `WithFields`와 함께 사용합니다.

| 함수 | 서명 | 설명 |
|------|------|------|
| `Any` | `func Any(key string, value any) Field` | 임의 타입 필드 |
| `String` | `func String(key, value string) Field` | 문자열 필드 |
| `Bool` | `func Bool(key string, value bool) Field` | 불리언 필드 |
| `Int` | `func Int(key string, value int) Field` | int 필드 |
| `Int8` | `func Int8(key string, value int8) Field` | int8 필드 |
| `Int16` | `func Int16(key string, value int16) Field` | int16 필드 |
| `Int32` | `func Int32(key string, value int32) Field` | int32 필드 |
| `Int64` | `func Int64(key string, value int64) Field` | int64 필드 |
| `Uint` | `func Uint(key string, value uint) Field` | uint 필드 |
| `Uint8` | `func Uint8(key string, value uint8) Field` | uint8 필드 |
| `Uint16` | `func Uint16(key string, value uint16) Field` | uint16 필드 |
| `Uint32` | `func Uint32(key string, value uint32) Field` | uint32 필드 |
| `Uint64` | `func Uint64(key string, value uint64) Field` | uint64 필드 |
| `Float32` | `func Float32(key string, value float32) Field` | float32 필드 |
| `Float64` | `func Float64(key string, value float64) Field` | float64 필드 |
| `Duration` | `func Duration(key string, value time.Duration) Field` | 기간 필드 |
| `Time` | `func Time(key string, value time.Time) Field` | 시간 필드 |
| `Err` | `func Err(err error) Field` | 오류 필드 (key는 "error") |
| `ErrWithKey` | `func ErrWithKey(key string, err error) Field` | 커스텀 key의 오류 필드 |
| `ErrWithStack` | `func ErrWithStack(err error) Field` | 스택 트레이스가 포함된 오류 필드 |

```go
dd.InfoWith("요청 완료",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 100*time.Millisecond),
    dd.Err(err),
)
```

:::tip 성능 조언
`Any` 대신 타입이 명확한 생성자(예: `Int`, `String`)를 우선 사용하면 더 나은 성능을 얻을 수 있습니다.
:::

## 필드 검증 설정

| 함수 | 서명 | 설명 |
|------|------|------|
| `DefaultFieldValidationConfig` | `func DefaultFieldValidationConfig() *FieldValidationConfig` | 기본 필드 검증 (검증 없음) |
| `StrictSnakeCaseConfig` | `func StrictSnakeCaseConfig() *FieldValidationConfig` | 엄격한 snake_case 검증 |
| `StrictCamelCaseConfig` | `func StrictCamelCaseConfig() *FieldValidationConfig` | 엄격한 camelCase 검증 |

## 디버그 출력 함수

| 함수 | 서명 | 설명 |
|------|------|------|
| `Print` | `func Print(args ...any)` | 전역 로그 Writer에 출력 (LevelInfo, 보안 필터링 적용) |
| `Println` | `func Println(args ...any)` | Print와 동일 (내부 Log()가 자동 줄바꿈, 보안 필터링 적용) |
| `Printf` | `func Printf(format string, args ...any)` | 포맷팅 출력 (LevelInfo, 보안 필터링 적용) |
| `JSON` | `func JSON(data ...any)` | stdout에 간결한 JSON 형식 출력 (호출자 정보 포함, 보안 필터링 미적용) |
| `JSONF` | `func JSONF(format string, args ...any)` | 포맷팅 문자열을 stdout에 간결한 JSON으로 출력 (호출자 정보 포함, 보안 필터링 미적용) |
| `Text` | `func Text(data ...any)` | stdout에 예쁘게 인쇄된 형식 출력 (보안 필터링 미적용) |
| `Textf` | `func Textf(format string, args ...any)` | stdout에 포맷팅 텍스트 출력 (보안 필터링 미적용) |
| `Exit` | `func Exit(data ...any)` | 호출자 정보가 포함된 텍스트 출력 후 종료 (exit code 0), 복잡한 타입은 자동 예쁘게 인쇄, 보안 필터링 미적용 |
| `Exitf` | `func Exitf(format string, args ...any)` | 호출자 정보가 포함된 포맷팅 출력 후 종료 (exit code 0, 보안 필터링 미적용) |

:::warning 디버그 함수 보안 알림
`Print`/`Println`/`Printf`는 보안 필터링을 거치지만, `JSON`/`JSONF`/`Text`/`Textf`/`Exit`/`Exitf`는 원본 데이터를 직접 출력하며 **보안 필터링을 거치지 않습니다**.
:::

## 다음 단계

- [Logger](./logger) -- Logger 인스턴스 메서드 상세 가이드
- [LoggerEntry](./entry) -- 사전 설정 필드가 있는 로그 Entry
- [설정](./config) -- Config 구조체
- [디버그 출력](./debug-visual) -- 디버그 시각화 함수
