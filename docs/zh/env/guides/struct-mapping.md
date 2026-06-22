---
title: "结构体映射 - CyberGo env | 环境变量到结构体"
description: "CyberGo env 结构体映射指南，通过 env 标签将环境变量自动映射到 Go 结构体字段，涵盖嵌套结构体、指针与切片、自定义转换器、默认值设置与必填验证，实现类型安全的配置加载。"
---

# 结构体映射

使用结构体标签将环境变量自动映射到 Go 结构体，实现类型安全的配置管理。

## 基本映射

### 简单示例

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

### 使用 Loader 实例

```go
loader, _ := env.New(env.DefaultConfig())
loader.LoadFiles(".env")

var cfg Config
if err := loader.ParseInto(&cfg); err != nil {
    panic(err)
}
```

## 标签语法

### env 标签

指定环境变量名：

```go
type Config struct {
    Host string `env:"SERVER_HOST"`  // 映射 SERVER_HOST
    Port int64  `env:"PORT"`         // 映射 PORT
}
```

### envDefault 标签

设置默认值：

```go
type Config struct {
    Host    string `env:"HOST" envDefault:"localhost"`
    Port    int64  `env:"PORT" envDefault:"8080"`
    Debug   bool   `env:"DEBUG" envDefault:"false"`
    Timeout int64  `env:"TIMEOUT" envDefault:"30"`
}
```

### 忽略字段

使用 `env:"-"` 跳过字段：

```go
type Config struct {
    Host    string `env:"HOST"`
    Ignored string `env:"-"`  // 不会被填充
}
```

## 支持的类型

### 基本类型

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

### 时间类型

```go
import "time"

type Config struct {
    Timeout  time.Duration `env:"TIMEOUT"`
    Interval time.Duration `env:"INTERVAL"`
}
```

支持的格式：
- `30s` - 30 秒
- `5m` - 5 分钟
- `1h30m` - 1 小时 30 分钟
- `100ms` - 100 毫秒

### 切片类型

```go
type Config struct {
    Hosts []string `env:"HOSTS"`      // 逗号分隔
    Ports []int64  `env:"PORTS"`      // 逗号分隔
}
```

`.env` 文件：

```bash
HOSTS=localhost,example.com,api.example.com
PORTS=80,443,8080
```

### 自定义分隔符

使用 `envSeparator` 标签指定自定义分隔符：

```go
type Config struct {
    // 使用分号分隔
    Servers []string `env:"SERVERS" envSeparator:";"`

    // 使用管道分隔
    Tags []string `env:"TAGS" envSeparator:"|"`

    // 使用空格分隔
    Words []string `env:"WORDS" envSeparator:" "`
}
```

`.env` 文件：

```bash
SERVERS=server1.example.com;server2.example.com;server3.example.com
TAGS=production|api|v2
WORDS=hello world go lang
```

**注意事项：**
- 默认分隔符为逗号 `,`
- `envSeparator` 只对切片类型有效
- 分隔符前后空格会自动去除

## 嵌套结构体

### 基本嵌套

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

### 深层嵌套

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

## 指针类型

支持指针字段：

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

## 自定义类型

### 实现 Unmarshaler 接口

```go
type LogLevel string

func (l *LogLevel) UnmarshalEnv(data map[string]string) error {
    *l = LogLevel(data["LOG_LEVEL"])
    return nil
}

type Config struct {
    Level LogLevel `env:"LOG_LEVEL"`
}
```

### 类型别名

```go
type Port int64

func (p *Port) UnmarshalEnv(data map[string]string) error {
    val, err := strconv.ParseInt(data["PORT"], 10, 64)
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

## 配置验证

### 结构体验证

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

### 必需字段验证

```go
type Config struct {
    APIKey    string `env:"API_KEY"`     // 必需
    APISecret string `env:"API_SECRET"`  // 必需
    Timeout   int64  `env:"TIMEOUT" envDefault:"30"`  // 可选
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

## 实用模式

### 集中配置管理

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

### 环境区分

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

## 错误处理

### 解析错误

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

### 类型转换错误

```go
type Config struct {
    Port int64 `env:"PORT"`  // 如果 PORT 不是有效整数
}

cfg := Config{}
if err := env.ParseInto(&cfg); err != nil {
    // 类型转换失败会返回错误
}
```

## 完整示例

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

## 相关文档

- [包函数 - ParseInto](/zh/env/api-reference/functions#parseinto) - ParseInto 函数参考
- [Loader API - ParseInto](/zh/env/api-reference/loader#parseinto) - Loader 方法参考
- [快速开始](/zh/env/getting-started) - 基本用法
