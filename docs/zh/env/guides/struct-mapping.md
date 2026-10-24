---
sidebar_label: "结构体映射"
title: "结构体映射 - CyberGo env | 环境变量到结构体"
description: "CyberGo env 结构体映射指南，通过 env、envDefault 标签将环境变量映射到 Go 结构体字段，涵盖嵌套结构体、指针字段、切片、时间与自定义类型、默认值与必填验证，配合 ParseInto 实现类型安全配置加载。"
sidebar_position: 2
---

# 结构体映射

结构体映射从已加载的键值填充 Go 结构体：`env` 标签指定键名，`envDefault` 标签提供兜底值，类型转换由库完成。

## 基本映射

### 简单示例

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

type Config struct {
	Host  string `env:"SERVER_HOST"`
	Port  int64  `env:"SERVER_PORT"`
	Debug bool   `env:"DEBUG"`
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

默认值也可以内联写在 `env` 标签中：`env:"KEY,envDefault:VALUE"`。两种写法等价，同时存在时独立的 `envDefault` 标签优先：

```go
type Config struct {
    Host string `env:"HOST,envDefault:localhost"`
    Port int64  `env:"PORT,envDefault:8080"`
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

切片字段只读取键自身的值并按逗号 `,` 拆分（带引号的分组保留内部空格，其余元素去除首尾空格）。`HOSTS_0`、`HOSTS_1` 这类索引键不参与结构体映射，只有 `GetSlice` / `GetSliceFrom` 会优先读取索引键。

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

字符串切片保留空元素（`a,,b` 得到三个元素，中间是空串）；数字与布尔切片的空元素算转换错误。任一元素转换失败，整个映射返回 `*MarshalError`，不会跳过该元素继续填充。

## 嵌套结构体

嵌套结构体的外层字段名会成为内层键的前缀，前缀逐层累积。外层字段的键取 `env` 标签值，没有标签就取字段名的大写形式：字段 Database（无标签）下的 Host（无标签）读取 `DATABASE_HOST`。传入 `ParseInto` 的最外层结构体，其类型名本身不参与前缀。

内层字段自己写了 `env` 标签时，标签值仍会被前缀拼接：`env:"DB_HOST"` 放在 Database 字段下查的是 `DATABASE_DB_HOST`。要让内层直接读 `DB_HOST`，就把该字段放在顶层结构体里。

### 基本嵌套

```go
type DatabaseConfig struct {
    Host string `envDefault:"localhost"` // DATABASE_HOST
    Port int64  `envDefault:"5432"`      // DATABASE_PORT
    User string                          // DATABASE_USER
}

type RedisConfig struct {
    Host string `envDefault:"localhost"` // REDIS_HOST
    Port int64  `envDefault:"6379"`      // REDIS_PORT
}

type AppConfig struct {
    Database DatabaseConfig
    Redis    RedisConfig
    Debug    bool `env:"DEBUG" envDefault:"false"` // 顶层字段不带前缀
}
```

### 深层嵌套

```go
type Credentials struct {
    Username string // DATABASE_CONNECTION_CREDENTIALS_USERNAME
    Password string // DATABASE_CONNECTION_CREDENTIALS_PASSWORD
}

type Connection struct {
    Host        string // DATABASE_CONNECTION_HOST
    Port        int64  // DATABASE_CONNECTION_PORT
    Credentials Credentials
}

type Database struct {
    Connection Connection
    Name       string // DATABASE_NAME
}

// 传给 ParseInto 的顶层结构体；它自己的类型名不产生前缀
type AppConfig struct {
    Database Database
}
```

## 指针类型

支持指针字段：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/env"
)

type Config struct {
	Host    *string `env:"HOST"`
	Port    *int64  `env:"PORT"`
	Enabled *bool   `env:"ENABLED"`
}

func main() {
	cfg := Config{}
	if err := env.ParseInto(&cfg); err != nil {
		log.Fatal(err)
	}

	if cfg.Port != nil {
		fmt.Println("Port:", *cfg.Port)
	}
}
```

指针字段可以区分「未设置」与「零值」：变量未设置或值为空串时，指针保持 `nil`；值为 `PORT=0` 时 `cfg.Port` 非 `nil` 且 `*cfg.Port == 0`。值类型字段做不到这一点，两种情况都会留在零值。

## 自定义类型

### 实现 encoding.TextUnmarshaler 接口

结构体字段的自定义解码通过实现标准库 `encoding.TextUnmarshaler` 接口完成，这是逐字段填充时实际调用的接口。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

type LogLevel string

// 实现 encoding.TextUnmarshaler，字段级别会被调用
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
	// 输出：info
}
```

### 带校验的类型别名

<!-- check-code: skip -->
```go
type Port int64

// 实现 encoding.TextUnmarshaler，解析时附带范围校验
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

::: tip 关于 env.Marshaler / env.Unmarshaler 接口
`env.Marshaler`（`MarshalEnv()`）与 `env.Unmarshaler`（`UnmarshalEnv(map[string]string)`）只在直接传给 `env.Marshal` / `env.MarshalStruct` / `env.UnmarshalInto` 的顶层值上生效，结构体逐字段填充时不会调用它们。字段级自定义编解码请实现标准库 `encoding.TextMarshaler` / `encoding.TextUnmarshaler`。
:::

## 配置验证

### 结构体验证

`ParseInto` 只做取值与类型转换，不会调用结构体上的 `Validate()` 方法；校验要在映射之后自行调用：

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

### 环境区分

按环境拆分配置时，公共字段放进一个具名内嵌结构体，键前缀取该字段名（这里 Base），内层标签写短名：

```go
type BaseConfig struct {
    AppName string `env:"APP_NAME"`   // 实际读取 BASE_APP_NAME
    Version string `env:"APP_VERSION"` // 实际读取 BASE_APP_VERSION
}

type DevelopmentConfig struct {
    Base  BaseConfig
    Debug bool `env:"DEBUG" envDefault:"true"`
}

type ProductionConfig struct {
    Base  BaseConfig
    Debug bool `env:"DEBUG" envDefault:"false"`
}

func LoadConfig() interface{} {
    env.Load(".env")

    switch os.Getenv("GO_ENV") {
    case "production":
        cfg := ProductionConfig{}
        if err := env.ParseInto(&cfg); err != nil {
            log.Printf("parse production config: %v", err)
        }
        return cfg
    default:
        cfg := DevelopmentConfig{}
        if err := env.ParseInto(&cfg); err != nil {
            log.Printf("parse development config: %v", err)
        }
        return cfg
    }
}
```

## 错误处理

### 解析错误

`ParseInto` / `UnmarshalInto` 的类型转换失败统一返回 `*MarshalError`。v1.2.3 起错误消息不回显原始值，只保留失败原因（如 `invalid integer value`），避免敏感值进入日志。可用 `env.IsMarshalError` 判断，或用 `errors.As` 取出字段信息：

```go
cfg := Config{}
if err := env.ParseInto(&cfg); err != nil {
    if env.IsMarshalError(err) {
        var marshalErr *env.MarshalError
        if errors.As(err, &marshalErr) {
            log.Fatalf("字段 %s 转换失败: %s", marshalErr.Field, marshalErr.Message)
        }
    }
    log.Fatal(err)
}
```

`*ParseError` 只在**文件解析**场景返回，即 `LoadFiles` 解析 env/JSON/YAML 文件内容出错时。`ParseInto` 直接从已加载的键值快照填充结构体，不经过文件解析，因此不会返回 `*ParseError`。

### 类型转换错误

```go
type Config struct {
    Port int64 `env:"PORT"`  // PORT 不是有效整数时映射失败
}

cfg := Config{}
if err := env.ParseInto(&cfg); err != nil {
    // 类型转换失败返回 *MarshalError（不回显原始值）
}
```

## 完整示例

嵌套字段的键由「父字段前缀 + 自身键」拼接而成，所以内层字段写短名：Server 下的 `env:"HOST"` 读 `SERVER_HOST`，写 `env:"SERVER_HOST"` 会变成 `SERVER_SERVER_HOST`。

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
	Host         string        `env:"HOST" envDefault:"0.0.0.0"`
	Port         int64         `env:"PORT" envDefault:"8080"`
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
	Host     string `env:"HOST" envDefault:"localhost"`
	Port     int64  `env:"PORT" envDefault:"5432"`
	User     string `env:"USER" envDefault:"postgres"`
	Password string `env:"PASSWORD"`
	Name     string `env:"NAME" envDefault:"myapp"`
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

- [包函数 - ParseInto](../api-reference/functions#parseinto) - ParseInto 函数参考
- [Loader API - ParseInto](../api-reference/loader#parseinto) - Loader 方法参考
- [快速开始](../getting-started/) - 基本用法
