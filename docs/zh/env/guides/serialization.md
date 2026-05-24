---
title: "序列化 - CyberGo env | 多格式转换"
description: "CyberGo env 库序列化与反序列化完整指南，详解 .env、JSON、YAML 格式间的 Map 映射与 Go 结构体转换方法，涵盖 Marshal 和 Unmarshal 函数族、自定义 Marshaler/Unmarshaler 接口实现、env 标签支持、敏感字段掩码处理和多格式互转实战示例。"
---

# 序列化

使用 Marshal 和 Unmarshal 功能序列化/反序列化环境变量，支持 `.env`、JSON、YAML 格式转换。

## 基本序列化

### Map 序列化

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    data := map[string]string{
        "APP_NAME":    "my-app",
        "APP_VERSION": "1.0.0",
        "DEBUG":       "true",
    }

    // 序列化为 .env 格式
    result, err := env.Marshal(data, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
    // 输出:
    // APP_NAME=my-app
    // APP_VERSION=1.0.0
    // DEBUG=true
}
```

### JSON 格式

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    data := map[string]string{
        "HOST": "localhost",
        "PORT": "8080",
    }

    // 序列化为 JSON
    result, err := env.Marshal(data, env.FormatJSON)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
    // 输出:
    // {
    //   "HOST": "localhost",
    //   "PORT": "8080"
    // }
}
```

### YAML 格式

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    data := map[string]string{
        "DATABASE_HOST": "localhost",
        "DATABASE_PORT": "5432",
        "DATABASE_NAME": "myapp",
    }

    // 序列化为 YAML
    result, err := env.Marshal(data, env.FormatYAML)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
    // 输出:
    // DATABASE_HOST: localhost
    // DATABASE_PORT: "5432"
    // DATABASE_NAME: myapp
}
```

## 结构体序列化

### 基本序列化

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type Config struct {
    Host string `env:"HOST"`
    Port int64  `env:"PORT"`
    Debug bool  `env:"DEBUG"`
}

func main() {
    cfg := Config{
        Host:  "localhost",
        Port:  8080,
        Debug: true,
    }

    // 序列化结构体为 .env 格式
    result, err := env.Marshal(cfg, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
    // 输出:
    // HOST=localhost
    // PORT=8080
    // DEBUG=true
}
```

### 嵌套结构体

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type DatabaseConfig struct {
    Host string `env:"DB_HOST"`
    Port int64  `env:"DB_PORT"`
}

type AppConfig struct {
    Name     string         `env:"APP_NAME"`
    Database DatabaseConfig
}

func main() {
    cfg := AppConfig{
        Name: "my-app",
        Database: DatabaseConfig{
            Host: "localhost",
            Port: 5432,
        },
    }

    result, err := env.Marshal(cfg, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
}
```

### MarshalStruct 函数

将结构体转换为 `map[string]string`：

```go
func MarshalStruct(v interface{}) (map[string]string, error)
```

**参数：**
- `v` - 结构体指针或值

**返回：**
- `map[string]string` - 环境变量映射
- `error` - 序列化错误

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type Config struct {
    Host string `env:"HOST"`
    Port int64  `env:"PORT"`
    Debug bool  `env:"DEBUG"`
}

func main() {
    cfg := Config{
        Host:  "localhost",
        Port:  8080,
        Debug: true,
    }

    // 转换为 map
    data, err := env.MarshalStruct(cfg)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", data)
    // 输出: map[DEBUG:true HOST:localhost PORT:8080]

    // 可用于导出到文件
    content, _ := env.Marshal(data, env.FormatEnv)
    fmt.Println(content)
}
```

## 反序列化

### Map 反序列化

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // .env 格式字符串
    data := `
HOST=localhost
PORT=8080
DEBUG=true
`

    // 反序列化为 map
    result, err := env.UnmarshalMap(data, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", result)
    // 输出: map[DEBUG:true HOST:localhost PORT:8080]
}
```

### JSON 反序列化

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    jsonData := `{
        "API_KEY": "secret123",
        "API_URL": "https://api.example.com",
        "TIMEOUT": "30"
    }`

    result, err := env.UnmarshalMap(jsonData, env.FormatJSON)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", result)
}
```

### YAML 反序列化

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    yamlData := `
DATABASE_HOST: localhost
DATABASE_PORT: "5432"
DATABASE_USER: postgres
`

    result, err := env.UnmarshalMap(yamlData, env.FormatYAML)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", result)
}
```

## 结构体反序列化

### 从 Map 反序列化

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type Config struct {
    Host string `env:"HOST"`
    Port int64  `env:"PORT"`
}

func main() {
    data := map[string]string{
        "HOST": "example.com",
        "PORT": "443",
    }

    var cfg Config
    err := env.UnmarshalInto(data, &cfg)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", cfg)
    // 输出: {Host:example.com Port:443}
}
```

### 从字符串反序列化

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type ServerConfig struct {
    Host    string `env:"SERVER_HOST"`
    Port    int64  `env:"SERVER_PORT"`
    Enabled bool   `env:"ENABLED"`
}

func main() {
    envData := `
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
ENABLED=true
`

    var cfg ServerConfig
    err := env.UnmarshalStruct(envData, &cfg, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", cfg)
}
```

## 自定义序列化

### 实现 Marshaler 接口

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type LogLevel string

type LogConfig struct {
    Level LogLevel `env:"LOG_LEVEL"`
}

func (l LogLevel) MarshalEnv() ([]byte, error) {
    return []byte(string(l)), nil
}

func main() {
    cfg := LogConfig{
        Level: LogLevel("debug"),
    }

    result, err := env.Marshal(cfg, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
}
```

### 实现 Unmarshaler 接口

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type LogLevel string

type LogConfig struct {
    Level LogLevel `env:"LOG_LEVEL"`
}

func (l *LogLevel) UnmarshalEnv(data map[string]string) error {
    *l = LogLevel(data["LOG_LEVEL"])
    return nil
}

func main() {
    data := map[string]string{
        "LOG_LEVEL": "info",
    }

    var cfg LogConfig
    err := env.UnmarshalInto(data, &cfg)
    if err != nil {
        panic(err)
    }

    fmt.Printf("Level: %s\n", cfg.Level)
}
```

## 格式检测

### 自动检测格式

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // 自动检测格式
    format := env.DetectFormat("config.json")
    fmt.Println(format.String()) // json

    format = env.DetectFormat("settings.yaml")
    fmt.Println(format.String()) // yaml

    format = env.DetectFormat(".env")
    fmt.Println(format.String()) // dotenv

    // 使用 FormatAuto 自动检测
    data := `{"KEY": "value"}`
    result, _ := env.UnmarshalMap(data, env.FormatAuto)
    fmt.Println(result)
}
```

## 实用场景

### 保存配置到文件

```go
package main

import (
    "os"
    "github.com/cybergodev/env"
)

func main() {
    cfg := map[string]string{
        "HOST": "localhost",
        "PORT": "8080",
    }

    // 序列化
    content, err := env.Marshal(cfg, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    // 写入文件
    err = os.WriteFile(".env", []byte(content), 0644)
    if err != nil {
        panic(err)
    }
}
```

### 导出当前环境

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    env.Load(".env")

    // 获取所有环境变量
    all := env.All()

    // 导出为 JSON
    content, err := env.Marshal(all, env.FormatJSON)
    if err != nil {
        panic(err)
    }

    fmt.Println(content)

    // 或写入文件
    os.WriteFile("env-export.json", []byte(content), 0644)
}
```

### 配置迁移

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // 读取 JSON 配置
    jsonContent, _ := os.ReadFile("config.json")

    // 解析 JSON
    data, err := env.UnmarshalMap(string(jsonContent), env.FormatJSON)
    if err != nil {
        panic(err)
    }

    // 转换为 .env 格式
    envContent, err := env.Marshal(data, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    // 保存为 .env 文件
    os.WriteFile(".env", []byte(envContent), 0644)

    fmt.Println("Config migrated from JSON to .env")
}
```

## 相关文档

- [包函数](/zh/env/api-reference/functions) - Marshal、UnmarshalMap 等函数参考
- [多格式配置](/zh/env/guides/multi-format) - 多格式加载指南
- [结构体映射](/zh/env/guides/struct-mapping) - 结构体映射指南
