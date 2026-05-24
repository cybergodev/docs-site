---
title: "다중 형식 구성 - CyberGo env | .env/JSON/YAML"
description: "CyberGo env 라이브러리 다중 형식 구성 파일 로딩 완전 가이드, .env, JSON, YAML 세 가지 형식의 자동 감지 및 혼합 로딩을 지원하며, 키값 병합 우선순위 규칙, 형식 변환 유틸리티 함수, JSON 및 YAML 전용 구성 옵션을 상세히 설명하여 Go 개발자가 마이크로서비스 및 컨테이너 환경에서 유연하게 환경 설정을 관리하고 전환할 수 있도록 돕습니다."
---

# 다중 형식 구성

env 라이브러리는 `.env`, JSON, YAML 세 가지 구성 형식을 지원하며, 형식을 자동으로 감지하고 로딩할 수 있습니다.

## 형식 감지

### 자동 감지 규칙

| 확장자 | 형식 | 상수 |
|--------|------|------|
| `.env` | .env 형식 | `FormatEnv` |
| `.json` | JSON | `FormatJSON` |
| `.yaml`, `.yml` | YAML | `FormatYAML` |
| 기타 | 자동 | `FormatAuto` |

### DetectFormat 함수

```go
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat("app.yml")        // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv
format = env.DetectFormat("unknown")        // FormatAuto

fmt.Println(format.String())  // "json", "yaml", "dotenv", "auto"
```

## 다중 형식 파일 로딩

### 단일 형식

```go
loader.LoadFiles("config.env")
loader.LoadFiles("settings.json")
loader.LoadFiles("secrets.yaml")
```

### 혼합 형식

```go
// 각 파일의 형식을 자동으로 감지
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

### 덮어쓰기 순서

나중에 로딩된 파일이 먼저 로딩된 파일을 덮어씁니다:

```go
// 순서: base -> env -> json -> yaml
loader.LoadFiles(
    ".env",           // 기본 설정
    "config.json",    // .env 덮어쓰기
    "secrets.yaml",   // config.json 덮어쓰기
)
```

## JSON 형식

### 파일 구조

```json
{
    "APP_NAME": "myapp",
    "APP_PORT": "8080",
    "DEBUG": "true",
    "DATABASE": {
        "HOST": "localhost",
        "PORT": "5432"
    }
}
```

::: tip 참고
중첩 객체는 `DATABASE_HOST`, `DATABASE_PORT`로 평탄화됩니다.
:::

### 키 이름 해석

JSON/YAML의 중첩 구조는 평탄화되어 저장됩니다. 라이브러리는 다양한 키 이름 접근 방식을 지원합니다:

```go
loader.LoadFiles("config.json")

// JSON: {"database": {"host": "localhost", "port": 5432}}
// 저장: DATABASE_HOST=localhost, DATABASE_PORT=5432

// 방법 1: 평탄화 키 이름 (권장)
host := loader.GetString("DATABASE_HOST")   // localhost
port := loader.GetInt("DATABASE_PORT")      // 5432

// 방법 2: 점 경로 (자동 변환)
host := loader.GetString("database.host")   // localhost
port := loader.GetInt("database.port")      // 5432

// 방법 3: 대문자 점 경로
host := loader.GetString("DATABASE.HOST")   // localhost
```

**해석 규칙:**

| 입력 키 이름 | 변환 결과 |
|----------|--------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"` (정확히 일치) |
| `"database.host"` | `"DATABASE_HOST"` (점을 밑줄로 변환) |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` (배열 인덱스) |

::: tip 권장 사용법
- **코드에서는 평탄화 키 이름 사용**: `GetString("DATABASE_HOST")` - 명확하고 효율적
- **구성 파일에서는 읽기 쉬운 경로**: JSON/YAML은 자연스러운 중첩 구조 사용
:::

**평탄화 규칙:**

| JSON 경로 | 저장 키 |
|-----------|--------|
| `database.host` | `DATABASE_HOST` |
| `database.port` | `DATABASE_PORT` |
| `app.server.name` | `APP_SERVER_NAME` |
| `servers.0.host` | `SERVERS_0_HOST` |

### 배열 접근

JSON 배열은 인덱스가 포함된 키로 평탄화됩니다:

```json
{
    "servers": [
        { "host": "server1.example.com", "port": 8080 },
        { "host": "server2.example.com", "port": 8081 }
    ]
}
```

```go
// 평탄화 키 이름으로 배열 요소 접근
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// 반복문으로 모든 호스트 가져오기
var hosts []string
for i := 0; ; i++ {
    h := loader.GetString(fmt.Sprintf("SERVERS_%d_HOST", i))
    if h == "" {
        break
    }
    hosts = append(hosts, h)
}
// hosts = ["server1.example.com", "server2.example.com"]
```

### JSON 파싱 구성

```go
cfg := env.DefaultConfig()

// null 값을 빈 문자열로 변환 (기본값 true)
cfg.JSONNullAsEmpty = true

// 숫자를 문자열로 변환 (기본값 true)
cfg.JSONNumberAsString = true

// 불리언 값을 문자열로 변환 (기본값 true)
cfg.JSONBoolAsString = true

// 최대 중첩 깊이 (기본값 10)
cfg.JSONMaxDepth = 20
```

### 타입 변환 예시

```json
{
    "PORT": 8080,
    "DEBUG": true,
    "TIMEOUT": 30,
    "RATES": [0.1, 0.2, 0.3]
}
```

```go
// JSONNumberAsString = true (기본값)
port := loader.GetString("PORT")  // "8080" (문자열)
port := loader.GetInt("PORT")     // 8080 (정수)

// JSONBoolAsString = true (기본값)
debug := loader.GetString("DEBUG")  // "true" (문자열)
debug := loader.GetBool("DEBUG")    // true (불리언)
```

## YAML 형식

### 파일 구조

```yaml
# 애플리케이션 설정
APP_NAME: myapp
APP_PORT: "8080"
DEBUG: true

# 데이터베이스 설정
DATABASE:
  HOST: localhost
  PORT: "5432"
  USER: postgres
  PASSWORD: secret

# 목록 값
ALLOWED_HOSTS:
  - localhost
  - example.com
```

### 키 이름 해석

YAML의 중첩 구조는 JSON과 동일한 평탄화 규칙을 사용합니다:

```go
loader.LoadFiles("config.yaml")

// 평탄화 키 이름으로 접근
host := loader.GetString("DATABASE_HOST")        // localhost
user := loader.GetString("DATABASE_USER")        // postgres
```

### 배열 접근

YAML 목록은 인덱스가 포함된 키로 평탄화됩니다:

```yaml
servers:
  - host: server1.example.com
    port: 8080
  - host: server2.example.com
    port: 8081
```

```go
// 평탄화 키 이름으로 접근
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// 전체 목록 가져오기
hosts := env.GetSliceFrom[string](loader, "ALLOWED_HOSTS") // ["localhost", "example.com"]
```

### YAML 파싱 구성

```go
cfg := env.DefaultConfig()

// null/~ 값을 빈 문자열로 변환 (기본값 true)
cfg.YAMLNullAsEmpty = true

// 숫자를 문자열로 변환 (기본값 true)
cfg.YAMLNumberAsString = true

// 불리언 값을 문자열로 변환 (기본값 true)
cfg.YAMLBoolAsString = true

// 최대 중첩 깊이 (기본값 10)
cfg.YAMLMaxDepth = 15
```

### 타입 변환 예시

```yaml
PORT: 8080
DEBUG: true
TIMEOUT: 30
RATES:
  - 0.1
  - 0.2
  - 0.3
```

```go
// YAMLNumberAsString = true (기본값)
port := loader.GetString("PORT")  // "8080" (문자열)
port := loader.GetInt("PORT")     // 8080 (정수)

// YAMLBoolAsString = true (기본값)
debug := loader.GetString("DEBUG")  // "true" (문자열)
debug := loader.GetBool("DEBUG")    // true (불리언)

// 목록 접근
rates := env.GetSliceFrom[float64](loader, "RATES")  // [0.1, 0.2, 0.3]
```

## .env 형식

### 파일 구조

```bash
# 주석
APP_NAME=myapp
APP_PORT=8080
DEBUG=true

# 따옴표
MESSAGE="Hello World"
LITERAL='literal ${noexpand}'

# 변수 확장
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# 기본값
LOG_LEVEL=${LOG_LEVEL:-info}
```

### 변수 확장

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // 기본적으로 활성화

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

// .env 내용:
// BASE_URL=https://api.example.com
// API_URL=${BASE_URL}/v1

apiURL := loader.GetString("API_URL")
// 출력: https://api.example.com/v1
```

### 확장 구문

| 구문 | 설명 |
|------|------|
| `${VAR}` | 변수 참조 |
| `${VAR:-default}` | 변수가 없을 때 기본값 사용 |

```bash
# 확장 예시
HOST=localhost
PORT=8080

# 다른 변수 참조
URL=http://${HOST}:${PORT}

# 기본값
TIMEOUT=${TIMEOUT:-30s}
DEBUG=${DEBUG:-false}
```

### export 구문

```bash
# export 접두사 지원 (AllowExportPrefix = true일 때)
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
```

### YAML 스타일 구문

```go
cfg := env.DefaultConfig()
cfg.AllowYamlSyntax = true  // YAML 스타일 활성화
```

```bash
# YAML 스타일 키-값 쌍 지원
KEY: value
ANOTHER_KEY: "quoted value"
```

## 혼합 구성 패턴

### 개발/프로덕션 분리

```text
config/
├── base.json          # 기본 설정
├── development.env    # 개발 환경 덮어쓰기
├── production.yaml    # 프로덕션 환경 덮어쓰기
└── local.env          # 로컬 덮어쓰기 (커밋하지 않음)
```

```go
func loadConfig(loader *env.Loader) error {
    // 1. 기본 설정
    if err := loader.LoadFiles("config/base.json"); err != nil {
        return err
    }

    // 2. 환경 설정
    env := os.Getenv("APP_ENV")
    if env == "" {
        env = "development"
    }

    switch env {
    case "production":
        if err := loader.LoadFiles("config/production.yaml"); err != nil {
            return err
        }
    default:
        if err := loader.LoadFiles("config/development.env"); err != nil {
            return err
        }
    }

    // 3. 로컬 덮어쓰기 (선택)
    if _, err := os.Stat("config/local.env"); err == nil {
        if err := loader.LoadFiles("config/local.env"); err != nil {
            return err
        }
    }

    return nil
}
```

### 기능별 분리

```text
config/
├── app.json       # 애플리케이션 설정
├── database.yaml  # 데이터베이스 설정
├── redis.env      # Redis 설정
└── secrets.json   # 시크릿 설정
```

```go
loader.LoadFiles(
    "config/app.json",
    "config/database.yaml",
    "config/redis.env",
    "config/secrets.json",
)
```

### 설정 우선순위

```text
명령줄 인수 > 환경 변수 > 로컬 설정 > 환경 설정 > 기본 설정
```

## 직렬화

### Marshal

설정을 지정된 형식으로 직렬화:

```go
data := map[string]string{
    "HOST": "localhost",
    "PORT": "8080",
}

// .env 형식 (기본값)
envStr, _ := env.Marshal(data)
// HOST=localhost
// PORT=8080

// JSON 형식
jsonStr, _ := env.Marshal(data, env.FormatJSON)
// {"HOST":"localhost","PORT":"8080"}

// YAML 형식
yamlStr, _ := env.Marshal(data, env.FormatYAML)
// HOST: localhost
// PORT: "8080"
```

### 구조체 Marshal

```go
type Config struct {
    Host string `env:"HOST"`
    Port int    `env:"PORT"`
}

cfg := Config{Host: "localhost", Port: 8080}

// .env로 변환
envStr, _ := env.Marshal(cfg, env.FormatEnv)

// JSON으로 변환
jsonStr, _ := env.Marshal(cfg, env.FormatJSON)

// YAML로 변환
yamlStr, _ := env.Marshal(cfg, env.FormatYAML)
```

### UnmarshalMap

map으로 역직렬화:

```go
// .env에서
envData := "HOST=localhost\nPORT=8080"
data, _ := env.UnmarshalMap(envData, env.FormatEnv)

// JSON에서
jsonData := `{"HOST":"localhost","PORT":"8080"}`
data, _ := env.UnmarshalMap(jsonData, env.FormatJSON)

// YAML에서
yamlData := "HOST: localhost\nPORT: \"8080\""
data, _ := env.UnmarshalMap(yamlData, env.FormatYAML)

// 자동 형식 감지
data, _ := env.UnmarshalMap(jsonData, env.FormatAuto)
```

### UnmarshalStruct

구조체로 역직렬화:

```go
type Config struct {
    Host string `env:"HOST"`
    Port int    `env:"PORT"`
}

var cfg Config

// .env에서
env.UnmarshalStruct("HOST=localhost\nPORT=8080", &cfg, env.FormatEnv)

// JSON에서
env.UnmarshalStruct(`{"HOST":"localhost","PORT":"8080"}`, &cfg, env.FormatJSON)

// YAML에서
env.UnmarshalStruct("HOST: localhost\nPORT: \"8080\"", &cfg, env.FormatYAML)
```

## 커스텀 형식

### 파서 등록

```go
// 형식 상수 정의
const FormatTOML env.FileFormat = 100

// EnvParser 인터페이스 구현
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    // TOML 파싱 구현
    result := make(map[string]string)
    // ...
    return result, nil
}

// 파서 등록
func init() {
    env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}
```

자세한 내용은 [커스텀 파서](/ko/env/guides/custom-parser)를 참조하세요.

## 전체 예시

```go
package main

import (
    "fmt"
    "log"
    "os"

    "github.com/cybergodev/env"
)

func main() {
    // 로더 생성
    cfg := env.DefaultConfig()
    cfg.ExpandVariables = true

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // 혼합 형식 설정 로딩
    err = loader.LoadFiles(
        "config/base.json",       // JSON 기본 설정
        "config/database.yaml",   // YAML 데이터베이스 설정
        "config/app.env",         // .env 애플리케이션 설정
    )
    if err != nil {
        log.Fatal(err)
    }

    // 설정 읽기
    fmt.Printf("App: %s\n", loader.GetString("APP_NAME"))
    fmt.Printf("DB Host: %s\n", loader.GetString("DATABASE_HOST"))
    fmt.Printf("DB Port: %d\n", loader.GetInt("DATABASE_PORT"))

    // 현재 설정 내보내기
    all := loader.All()
    exported, _ := env.Marshal(all, env.FormatEnv)
    fmt.Println("\nExported config:")
    fmt.Println(exported)
}
```

## 관련 문서

- [직렬화](/ko/env/guides/serialization) - 직렬화/역직렬화 상세 설명
- [ComponentFactory API](/ko/env/api-reference/factory) - 형식 감지 및 파서 등록
- [커스텀 파서](/ko/env/guides/custom-parser) - 커스텀 형식 추가
- [Config API](/ko/env/api-reference/config) - JSON/YAML 파싱 구성
