---
title: "치트시트 - CyberGo env | 자주 사용하는 API 빠른 참조"
description: "CyberGo env 자주 쓰는 API 치트시트로 파일 로딩, 타입 읽기, 검증, SecureValue 저장, 직렬화, 감사 로그 등 고빈도 작업의 핵심 코드를 한 페이지에 정리해 빠르게 참조할 수 있습니다."
---

# 치트시트

이 라이브러리에 이미 익숙한 상태에서, 고빈도 사용 코드 스니펫을 빠르게 참조하세요.

## 설정 로드

```go
// 패키지 수준 로드
env.Load(".env")                                        // .env 파일 로드
env.Load(".env", ".env.local", "config.json")          // 다중 파일

// 로더를 통한 로드
loader, _ := env.New()
loader.LoadFiles("config.json")                         // JSON
loader.LoadFiles("config.yaml")                         // YAML
loader.LoadFiles(".env", ".env.local", "config.json")   // 다중 파일
```

## 값 읽기

```go
// 기본 타입
env.GetString("KEY", "default")
env.GetInt("PORT", 8080)              // int64 반환
env.GetBool("DEBUG", false)
env.GetDuration("TIMEOUT", 30*time.Second)

// 슬라이스 (KEY_0,KEY_1 인덱스 형식 또는 쉼표 구분 지원)
env.GetSlice[string]("HOSTS", []string{"localhost"})
env.GetSlice[int64]("PORTS", []int64{80})
env.GetSlice[int]("PORTS", []int{80})          // int도 지원
env.GetSlice[float64]("RATES", []float64{0.1})

// Loader에서 슬라이스 가져오기
env.GetSliceFrom[string](loader, "HOSTS")
env.GetSliceFrom[int64](loader, "PORTS")

// 조회
val, ok := env.Lookup("KEY")
keys := env.Keys()
all := env.All()
count := env.Len()

// 보안 값
secret := env.GetSecure("PASSWORD")
if secret != nil {
    defer secret.Release()  // 또는 secret.Close()
    value := secret.Reveal()
    masked := secret.Masked()
}
```

## 키 이름 해석

```go
// JSON: {"app": {"name": "myapp"}}
// 저장됨: APP_NAME=myapp

// 다음 방식 모두 접근 가능
env.GetString("APP_NAME")      // 평탄화 키 이름 (권장)
env.GetString("app.name")      // 점 경로
env.GetString("APP.NAME")      // 대문자 점 경로

// 배열 인덱스
env.GetString("servers.0.host")  // SERVERS_0_HOST
```

| 입력 | 변환 결과 |
|------|--------|
| `"database.host"` | `"DATABASE_HOST"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |

## 구조체 매핑

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS" envSeparator:","`
    Ignored string   `env:"-"`
}

cfg := Config{}
env.ParseInto(&cfg)
```

## 설정 프리셋

| 프리셋 | 용도 | 특징 |
|------|------|------|
| `DefaultConfig()` | 일반 | 안전한 기본값 |
| `DevelopmentConfig()` | 개발 | 느슨한 제한, YAML 구문 지원, 10MB 파일 상한 |
| `TestingConfig()` | 테스트 | 기존 변수 덮어쓰기, 테스트 격리, 64KB 파일 상한 |
| `ProductionConfig()` | 프로덕션 | 엄격한 검증 + 감사, 기존 변수 덮어쓰지 않음, 64KB 파일 상한 |

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT"}
```

## Loader 인스턴스

```go
loader, _ := env.New(cfg)
defer loader.Close()

loader.LoadFiles(".env")
loader.GetString("KEY")
loader.Set("KEY", "value")
loader.Delete("KEY")
loader.Keys()
loader.All()
loader.Validate()
loader.Apply()  // os.Environ에 적용
loader.Len()    // 변수 수
loader.LoadTime() // 마지막 로드 시간
loader.IsApplied() // 시스템 환경에 적용되었는지 여부
loader.IsClosed()  // 닫혔는지 여부
loader.Config()    // 설정 가져오기
```

## 오류 처리

```go
import "errors"

// 센티넬 오류
errors.Is(err, env.ErrFileNotFound)
errors.Is(err, env.ErrFileTooLarge)
errors.Is(err, env.ErrForbiddenKey)
errors.Is(err, env.ErrInvalidKey)
errors.Is(err, env.ErrClosed)
errors.Is(err, env.ErrAlreadyInitialized)

// 구조화된 오류
var parseErr *env.ParseError
errors.As(err, &parseErr)
// parseErr.File, parseErr.Line

var fileErr *env.FileError
errors.As(err, &fileErr)
// fileErr.Path, fileErr.Size, fileErr.Limit

var secErr *env.SecurityError
errors.As(err, &secErr)
// secErr.Action, secErr.Reason
```

## 보안 도구

```go
// 민감 값
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
}

// 마스크
log.Printf("Key: %s", secret.Masked())
log.Printf("Key: %s", env.MaskValue("API_KEY", "secret"))

// 감지
env.IsSensitiveKey("PASSWORD")  // true
env.IsMemoryLockSupported()     // Linux/macOS/Windows: true

// 정리
env.ClearBytes(sensitiveData)
clean := env.SanitizeForLog(msg)

// 키 이름 마스크
masked := env.MaskKey("DB_PASSWORD")  // "DB***"
```

## 다중 환경

```go
goEnv := os.Getenv("GO_ENV")
if goEnv == "" { goEnv = "development" }
env.Load(".env", ".env."+goEnv, ".env.local")  // 단일 호출, 나중 것이 앞의 것을 덮어씀
```

## 다중 형식

```go
// 로드
loader.LoadFiles("config.env", "config.json", "config.yaml")

// 형식 감지
format := env.DetectFormat("config.json")  // FormatJSON

// 직렬화
env.Marshal(data, env.FormatEnv)
env.Marshal(data, env.FormatJSON)
env.Marshal(data, env.FormatYAML)

// 역직렬화
env.UnmarshalMap(data, env.FormatEnv)
env.UnmarshalMap(data, env.FormatAuto)  // 자동 감지
```

## .env 구문

```bash
# 주석
KEY=value
KEY="value with spaces"
KEY='literal ${noexpand}'
KEY=${OTHER_KEY}           # 변수 참조
KEY=${MISSING:-default}    # 기본값 (변수가 없을 때 사용)
KEY=${MISSING:=default}    # 기본값 (변수가 없을 때 사용, :-와 동일)
KEY=${MISSING:?error}      # 오류 메시지 (변수가 없거나 비어 있을 때 오류)
export KEY=value           # bash 스타일
KEY=$$                     # 달러 기호 이스케이프
```

## 불리언 값

| 참 값 | 거짓 값 |
|------|------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

## 시간 형식

```bash
TIMEOUT=30s
INTERVAL=5m
DURATION=1h30m
```

## 제한 상수

| 제한 항목 | 기본값 | 하드 상한 |
|--------|--------|----------|
| 파일 크기 | 2 MB | 100 MB |
| 줄 길이 | 1 KB | 64 KB |
| 키 길이 | 64 | 1024 |
| 값 길이 | 4 KB | 1 MB |
| 변수 수 | 500 | 10000 |
| 전개 깊이 | 5 | 20 |

## 테스트

```go
func TestExample(t *testing.T) {
    cfg := env.TestingConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    loader.Set("KEY", "value")
    // 테스트...
}

func TestMain(m *testing.M) {
    if err := env.ResetDefaultLoader(); err != nil {
        log.Printf("warning: %v", err)
    }
    os.Exit(m.Run())
}
```

## 내장 금지 키

다음 키 이름은 기본적으로 설정이 금지되어 있습니다:

| 카테고리 | 키 이름 |
|------|------|
| 시스템 경로 | `PATH` |
| Linux 동적 링크 | `LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_DEBUG`, `LD_AUDIT`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| 언어 런타임 | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

## 인터페이스 타입

```go
// 세분화된 인터페이스
// env.EnvFileLoader    // LoadFiles
// env.EnvGetter        // GetString, Lookup, Keys, All
// env.EnvSetter        // Set, Delete
// env.EnvApplicator    // Apply
// env.EnvCloser        // Close

// 복합 인터페이스
// env.EnvLoader        // 위 모든 것을 조합
```

## 관련 문서

- [빠른 시작](/ko/env/getting-started) - 완전한 튜토리얼
- [패키지 함수](/ko/env/api-reference/functions) - 상세 API
- [Loader API](/ko/env/api-reference/loader) - Loader 메서드
- [Config API](/ko/env/api-reference/config) - 설정 옵션
- [오류 처리](/ko/env/advanced/error-handling) - 오류 처리 패턴
