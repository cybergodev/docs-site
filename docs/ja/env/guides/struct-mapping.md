---
title: "構造体マッピング - CyberGo env | 環境変数から構造体へ"
description: "CyberGo env 構造体マッピングガイド。env タグで変数を構造体にマッピングし、ネスト、ポインタ、スライス、カスタムコンバーター、デフォルト値、必須検証を説明します。"
---

# 構造体マッピング

構造体タグを使用して環境変数を Go 構造体に自動マッピングし、型安全な設定管理を実現します。

## 基本的なマッピング

### シンプルな例

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

### Loader インスタンスの使用

```go
loader, _ := env.New(env.DefaultConfig())
loader.LoadFiles(".env")

var cfg Config
if err := loader.ParseInto(&cfg); err != nil {
    panic(err)
}
```

## タグ構文

### env タグ

環境変数名を指定します：

```go
type Config struct {
    Host string `env:"SERVER_HOST"`  // SERVER_HOST にマッピング
    Port int64  `env:"PORT"`         // PORT にマッピング
}
```

### envDefault タグ

デフォルト値を設定します：

```go
type Config struct {
    Host    string `env:"HOST" envDefault:"localhost"`
    Port    int64  `env:"PORT" envDefault:"8080"`
    Debug   bool   `env:"DEBUG" envDefault:"false"`
    Timeout int64  `env:"TIMEOUT" envDefault:"30"`
}
```

### フィールドの無視

`env:"-"` を使用してフィールドをスキップします：

```go
type Config struct {
    Host    string `env:"HOST"`
    Ignored string `env:"-"`  // 値は設定されない
}
```

## サポートされる型

### 基本型

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

### 時間型

```go
import "time"

type Config struct {
    Timeout  time.Duration `env:"TIMEOUT"`
    Interval time.Duration `env:"INTERVAL"`
}
```

サポートされるフォーマット：
- `30s` - 30 秒
- `5m` - 5 分
- `1h30m` - 1 時間 30 分
- `100ms` - 100 ミリ秒

### スライス型

```go
type Config struct {
    Hosts []string `env:"HOSTS"`      // カンマ区切り
    Ports []int64  `env:"PORTS"`      // カンマ区切り
}
```

`.env` ファイル：

```bash
HOSTS=localhost,example.com,api.example.com
PORTS=80,443,8080
```

### カスタムセパレータ

`envSeparator` タグを使用してカスタムセパレータを指定します：

```go
type Config struct {
    // セミコロン区切り
    Servers []string `env:"SERVERS" envSeparator:";"`

    // パイプ区切り
    Tags []string `env:"TAGS" envSeparator:"|"`

    // スペース区切り
    Words []string `env:"WORDS" envSeparator:" "`
}
```

`.env` ファイル：

```bash
SERVERS=server1.example.com;server2.example.com;server3.example.com
TAGS=production|api|v2
WORDS=hello world go lang
```

**注意事項：**
- デフォルトのセパレータはカンマ `,`
- `envSeparator` はスライス型にのみ有効
- セパレータ前後の空白は自動的に削除される

## ネストされた構造体

### 基本的なネスト

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

### 深いネスト

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

## ポインタ型

ポインタフィールドをサポートします：

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

## カスタム型

### Unmarshaler インターフェースの実装

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

### 型エイリアス

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

## 設定の検証

### 構造体の検証

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

### 必須フィールドの検証

```go
type Config struct {
    APIKey    string `env:"API_KEY"`     // 必須
    APISecret string `env:"API_SECRET"`  // 必須
    Timeout   int64  `env:"TIMEOUT" envDefault:"30"`  // オプション
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

## 実用的なパターン

### 集中設定管理

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

### 環境の区別

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

## エラー処理

### 解析エラー

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

### 型変換エラー

```go
type Config struct {
    Port int64 `env:"PORT"`  // PORT が有効な整数でない場合
}

cfg := Config{}
if err := env.ParseInto(&cfg); err != nil {
    // 型変換の失敗はエラーを返す
}
```

## 完全な例

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

## 関連ドキュメント

- [パッケージ関数 - ParseInto](/ja/env/api-reference/functions#parseinto) - ParseInto 関数リファレンス
- [Loader API - ParseInto](/ja/env/api-reference/loader#parseinto) - Loader メソッドリファレンス
- [クイックスタート](/ja/env/getting-started) - 基本的な使い方
