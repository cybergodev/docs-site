---
sidebar_label: "구조체 매핑"
title: "구조체 매핑 - CyberGo env | 환경 변수에서 구조체로"
description: "CyberGo env 구조체 매핑 가이드로 env·envDefault 태그로 환경 변수를 Go 구조체 필드에 자동 매핑하며, 중첩 구조체·포인터·슬라이스·커스텀 타입 디코딩·필드 무시·기본값·필수 검증을 다루어 타입 안전한 설정 로딩을 구현합니다."
sidebar_position: 1
---

# 구조체 매핑

구조체 태그를 사용하여 환경 변수를 Go 구조체에 자동으로 매핑하고, 타입 안전한 설정 관리를 구현합니다.

## 기본 매핑

### 간단한 예시

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type Config struct {
    Host string `env:"SERVER_HOST"`
    Port int64  `env:"SERVER_PORT"`
    Debug bool  `env:"DEBUG"`
}

func main() {
    env.Load(".env")

    cfg := Config{}
    if err := env.ParseInto(&cfg); err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", cfg)
}
```

### Loader 인스턴스 사용

```go
loader, _ := env.New(env.DefaultConfig())
loader.LoadFiles(".env")

var cfg Config
if err := loader.ParseInto(&cfg); err != nil {
    panic(err)
}
```

## 태그 구문

### env 태그

환경 변수 이름 지정:

```go
type Config struct {
    Host string `env:"SERVER_HOST"`  // SERVER_HOST 매핑
    Port int64  `env:"PORT"`         // PORT 매핑
}
```

### envDefault 태그

기본값 설정:

```go
type Config struct {
    Host    string `env:"HOST" envDefault:"localhost"`
    Port    int64  `env:"PORT" envDefault:"8080"`
    Debug   bool   `env:"DEBUG" envDefault:"false"`
    Timeout int64  `env:"TIMEOUT" envDefault:"30"`
}
```

### 필드 무시

`env:"-"`을 사용하여 필드를 건너뜁니다:

```go
type Config struct {
    Host    string `env:"HOST"`
    Ignored string `env:"-"`  // 채워지지 않음
}
```

## 지원 타입

### 기본 타입

```go
type Config struct {
    String  string  `env:"STRING_VALUE"`
    Int     int     `env:"INT_VALUE"`
    Int8    int8    `env:"INT8_VALUE"`
    Int16   int16   `env:"INT16_VALUE"`
    Int32   int32   `env:"INT32_VALUE"`
    Int64   int64   `env:"INT64_VALUE"`
    Uint    uint    `env:"UINT_VALUE"`
    Uint64  uint64  `env:"UINT64_VALUE"`
    Float32 float32 `env:"FLOAT32_VALUE"`
    Float64 float64 `env:"FLOAT64_VALUE"`
    Bool    bool    `env:"BOOL_VALUE"`
}
```

### 시간 타입

```go
import "time"

type Config struct {
    Timeout  time.Duration `env:"TIMEOUT"`
    Interval time.Duration `env:"INTERVAL"`
}
```

지원 형식:
- `30s` - 30초
- `5m` - 5분
- `1h30m` - 1시간 30분
- `100ms` - 100밀리초

### 슬라이스 타입

슬라이스 필드는 쉼표 `,`로 구분되며, 구분자 앞뒤의 공백은 자동으로 제거됩니다.

```go
type Config struct {
    Hosts []string `env:"HOSTS"`      // 쉼표 구분
    Ports []int64  `env:"PORTS"`      // 쉼표 구분
}
```

`.env` 파일:

```bash
HOSTS=localhost,example.com,api.example.com
PORTS=80,443,8080
```

## 중첩 구조체

### 기본 중첩

```go
type DatabaseConfig struct {
    Host string `env:"DB_HOST" envDefault:"localhost"`
    Port int64  `env:"DB_PORT" envDefault:"5432"`
    User string `env:"DB_USER"`
    Password string `env:"DB_PASSWORD"`
}

type RedisConfig struct {
    Host string `env:"REDIS_HOST" envDefault:"localhost"`
    Port int64  `env:"REDIS_PORT" envDefault:"6379"`
}

type AppConfig struct {
    Database DatabaseConfig
    Redis    RedisConfig
    Debug    bool `env:"DEBUG" envDefault:"false"`
}
```

### 깊은 중첩

```go
type Credentials struct {
    Username string `env:"DB_USER"`
    Password string `env:"DB_PASSWORD"`
}

type Connection struct {
    Host        string      `env:"DB_HOST"`
    Port        int64       `env:"DB_PORT"`
    Credentials Credentials
}

type Database struct {
    Connection Connection
    Name       string `env:"DB_NAME"`
}
```

## 포인터 타입

포인터 필드를 지원합니다:

```go
package main

import (
    "fmt"

    "github.com/cybergodev/env"
)

type Config struct {
    Host    *string `env:"HOST"`
    Port    *int64  `env:"PORT"`
    Enabled *bool   `env:"ENABLED"`
}

func main() {
    cfg := Config{}
    env.ParseInto(&cfg)

    if cfg.Port != nil {
        fmt.Println("Port:", *cfg.Port)
    }
}
```

## 커스텀 타입

### encoding.TextUnmarshaler 인터페이스 구현

구조체 필드의 커스텀 디코딩은 표준 라이브러리 `encoding.TextUnmarshaler` 인터페이스를 구현하여 수행합니다 — 이 인터페이스가 필드 단위 채우기에서 **실제로 호출되는** 인터페이스입니다.

```go
package main

import (
    "fmt"

    "github.com/cybergodev/env"
)

type LogLevel string

// encoding.TextUnmarshaler 구현 — 필드 수준에서 호출됨
func (l *LogLevel) UnmarshalText(text []byte) error {
    switch string(text) {
    case "debug", "info", "warn", "error":
        *l = LogLevel(text)
        return nil
    default:
        return fmt.Errorf("invalid log level: %s", string(text))
    }
}

type Config struct {
    Level LogLevel `env:"LOG_LEVEL"`
}

func main() {
    data := map[string]string{"LOG_LEVEL": "info"}

    var cfg Config
    if err := env.UnmarshalInto(data, &cfg); err != nil {
        panic(err)
    }

    fmt.Println(cfg.Level)
    // 출력: info
}
```

### 검증을 포함한 타입 별칭

<!-- check-code: skip -->
```go
type Port int64

// encoding.TextUnmarshaler 구현, 파싱 시 범위 검증 포함
func (p *Port) UnmarshalText(text []byte) error {
    val, err := strconv.ParseInt(string(text), 10, 64)
    if err != nil {
        return err
    }
    if val < 1 || val > 65535 {
        return errors.New("port must be 1-65535")
    }
    *p = Port(val)
    return nil
}
```

:::tip env.Marshaler / env.Unmarshaler 인터페이스에 대해
`env.Marshaler`(`MarshalEnv()`)와 `env.Unmarshaler`(`UnmarshalEnv(map[string]string)`) 인터페이스는 **`env.Marshal`/`env.MarshalStruct`/`env.UnmarshalInto`에 전달된 최상위 값에서만 동작**하며, 구조체의 필드 단위 채우기 로직에서는 호출되지 않습니다. 구조체 필드에 커스텀 인코딩/디코딩을 적용하려면 표준 라이브러리 `encoding.TextMarshaler` / `encoding.TextUnmarshaler`를 구현하세요. 이들은 필드 수준에서 인식됩니다.
:::

## 설정 검증

### 구조체 검증

```go
package main

import (
    "errors"
    "log"

    "github.com/cybergodev/env"
)

type ServerConfig struct {
    Host string `env:"SERVER_HOST" envDefault:"0.0.0.0"`
    Port int64  `env:"SERVER_PORT" envDefault:"8080"`
}

func (c *ServerConfig) Validate() error {
    if c.Port < 1024 || c.Port > 65535 {
        return errors.New("port must be 1024-65535")
    }
    return nil
}

func main() {
    cfg := ServerConfig{}
    if err := env.ParseInto(&cfg); err != nil {
        log.Fatal(err)
    }

    if err := cfg.Validate(); err != nil {
        log.Fatal(err)
    }
}
```

### 필수 필드 검증

```go
type Config struct {
    APIKey    string `env:"API_KEY"`     // 필수
    APISecret string `env:"API_SECRET"`  // 필수
    Timeout   int64  `env:"TIMEOUT" envDefault:"30"`  // 선택
}

func (c *Config) Validate() error {
    if c.APIKey == "" {
        return errors.New("API_KEY is required")
    }
    if c.APISecret == "" {
        return errors.New("API_SECRET is required")
    }
    return nil
}
```

## 실용 패턴

### 중앙 집중식 설정 관리

<!-- check-code: skip -->
```go
// config/config.go
package config

import "github.com/cybergodev/env"

type Config struct {
    Server   ServerConfig
    Database DatabaseConfig
    Redis    RedisConfig
    Log      LogConfig
}

func Load() (*Config, error) {
    if err := env.Load(".env"); err != nil {
        return nil, err
    }

    cfg := &Config{
        Server:   ServerConfig{},
        Database: DatabaseConfig{},
        Redis:    RedisConfig{},
        Log:      LogConfig{},
    }

    if err := env.ParseInto(cfg); err != nil {
        return nil, err
    }

    return cfg, nil
}
```

### 환경 구분

```go
type BaseConfig struct {
    AppName string `env:"APP_NAME"`
    Version string `env:"APP_VERSION"`
}

type DevelopmentConfig struct {
    BaseConfig
    Debug bool `env:"DEBUG" envDefault:"true"`
}

type ProductionConfig struct {
    BaseConfig
    Debug bool `env:"DEBUG" envDefault:"false"`
}

func LoadConfig() interface{} {
    env.Load(".env")

    switch os.Getenv("GO_ENV") {
    case "production":
        cfg := ProductionConfig{}
        env.ParseInto(&cfg)
        return cfg
    default:
        cfg := DevelopmentConfig{}
        env.ParseInto(&cfg)
        return cfg
    }
}
```

## 오류 처리

### 파싱 오류

```go
cfg := Config{}
if err := env.ParseInto(&cfg); err != nil {
    var parseErr *env.ParseError
    if errors.As(err, &parseErr) {
        log.Fatalf("Parse error at %s:%d", parseErr.File, parseErr.Line)
    }
    log.Fatal(err)
}
```

### 타입 변환 오류

```go
type Config struct {
    Port int64 `env:"PORT"`  // PORT가 유효한 정수가 아닌 경우
}

cfg := Config{}
if err := env.ParseInto(&cfg); err != nil {
    // 타입 변환 실패 시 오류 반환
}
```

## 전체 예시

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/env"
)

type ServerConfig struct {
    Host         string        `env:"SERVER_HOST" envDefault:"0.0.0.0"`
    Port         int64         `env:"SERVER_PORT" envDefault:"8080"`
    ReadTimeout  time.Duration `env:"READ_TIMEOUT" envDefault:"30s"`
    WriteTimeout time.Duration `env:"WRITE_TIMEOUT" envDefault:"30s"`
}

func (c *ServerConfig) Validate() error {
    if c.Port < 1024 || c.Port > 65535 {
        return errors.New("port must be 1024-65535")
    }
    return nil
}

type DatabaseConfig struct {
    Host     string `env:"DB_HOST" envDefault:"localhost"`
    Port     int64  `env:"DB_PORT" envDefault:"5432"`
    User     string `env:"DB_USER" envDefault:"postgres"`
    Password string `env:"DB_PASSWORD"`
    Name     string `env:"DB_NAME" envDefault:"myapp"`
}

func (c *DatabaseConfig) Validate() error {
    if c.Password == "" {
        return errors.New("DB_PASSWORD is required")
    }
    return nil
}

type Config struct {
    Server   ServerConfig
    Database DatabaseConfig
}

func LoadConfig() (*Config, error) {
    if err := env.Load(".env"); err != nil {
        return nil, fmt.Errorf("load env: %w", err)
    }

    cfg := &Config{
        Server:   ServerConfig{},
        Database: DatabaseConfig{},
    }

    if err := env.ParseInto(cfg); err != nil {
        return nil, fmt.Errorf("parse config: %w", err)
    }

    if err := cfg.Server.Validate(); err != nil {
        return nil, fmt.Errorf("server config: %w", err)
    }

    if err := cfg.Database.Validate(); err != nil {
        return nil, fmt.Errorf("database config: %w", err)
    }

    return cfg, nil
}

func main() {
    cfg, err := LoadConfig()
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Server: %s:%d\n", cfg.Server.Host, cfg.Server.Port)
    fmt.Printf("Database: %s@%s:%d/%s\n",
        cfg.Database.User,
        cfg.Database.Host,
        cfg.Database.Port,
        cfg.Database.Name,
    )
}
```

## 관련 문서

- [패키지 함수 - ParseInto](/ko/env/api-reference/functions#parseinto) - ParseInto 함수 참조
- [Loader API - ParseInto](/ko/env/api-reference/loader#parseinto) - Loader 메서드 참조
- [빠른 시작](/ko/env/getting-started/) - 기본 사용법
