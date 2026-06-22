---
title: "多格式配置 - CyberGo env | .env/JSON/YAML"
description: "CyberGo env 多格式配置加载指南，支持 .env、JSON、YAML 自动检测与混合加载，详解键值合并优先级规则与格式互转工具，适配微服务与容器化场景。"
---

# 多格式配置

env 库支持 `.env`、JSON、YAML 三种配置格式，可自动检测格式并加载。

## 格式检测

### 自动检测规则

| 扩展名 | 格式 | 常量 |
|--------|------|------|
| `.env` | .env 格式 | `FormatEnv` |
| `.json` | JSON | `FormatJSON` |
| `.yaml`, `.yml` | YAML | `FormatYAML` |
| 其他 | 自动 | `FormatAuto` |

### DetectFormat 函数

```go
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat("app.yml")        // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv
format = env.DetectFormat("unknown")        // FormatAuto

fmt.Println(format.String())  // "json", "yaml", "dotenv", "auto"
```

## 加载多格式文件

### 单一格式

```go
loader.LoadFiles("config.env")
loader.LoadFiles("settings.json")
loader.LoadFiles("secrets.yaml")
```

### 混合格式

```go
// 自动检测每个文件的格式
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

### 覆盖顺序

后加载的文件覆盖先加载的：

```go
// 顺序: base -> env -> json -> yaml
loader.LoadFiles(
    ".env",           // 基础配置
    "config.json",    // 覆盖 .env
    "secrets.yaml",   // 覆盖 config.json
)
```

## JSON 格式

### 文件结构

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

::: tip 注意
嵌套对象会被扁平化为 `DATABASE_HOST`、`DATABASE_PORT`。
:::

### 键名解析

JSON/YAML 的嵌套结构会被扁平化存储。库支持多种键名访问方式：

```go
loader.LoadFiles("config.json")

// JSON: {"database": {"host": "localhost", "port": 5432}}
// 存储为: DATABASE_HOST=localhost, DATABASE_PORT=5432

// 方式一：扁平化键名（推荐）
host := loader.GetString("DATABASE_HOST")   // localhost
port := loader.GetInt("DATABASE_PORT")      // 5432

// 方式二：点号路径（自动转换）
host := loader.GetString("database.host")   // localhost
port := loader.GetInt("database.port")      // 5432

// 方式三：大写点号路径
host := loader.GetString("DATABASE.HOST")   // localhost
```

**解析规则：**

| 输入键名 | 转换为 |
|----------|--------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"`（精确匹配） |
| `"database.host"` | `"DATABASE_HOST"`（点号转下划线） |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"`（数组索引） |

::: tip 推荐用法
- **代码中使用扁平化键名**：`GetString("DATABASE_HOST")` - 明确、高效
- **配置文件中可读路径**：JSON/YAML 使用自然嵌套结构
:::

**扁平化规则：**

| JSON 路径 | 存储键 |
|-----------|--------|
| `database.host` | `DATABASE_HOST` |
| `database.port` | `DATABASE_PORT` |
| `app.server.name` | `APP_SERVER_NAME` |
| `servers.0.host` | `SERVERS_0_HOST` |

### 数组访问

JSON 数组会被扁平化为带索引的键：

```json
{
    "servers": [
        { "host": "server1.example.com", "port": 8080 },
        { "host": "server2.example.com", "port": 8081 }
    ]
}
```

```go
// 使用扁平化键名访问数组元素
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// 使用循环获取所有主机
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

### JSON 解析配置

```go
cfg := env.DefaultConfig()

// null 值转为空字符串（默认 true）
cfg.JSONNullAsEmpty = true

// 数字转为字符串（默认 true）
cfg.JSONNumberAsString = true

// 布尔值转为字符串（默认 true）
cfg.JSONBoolAsString = true

// 最大嵌套深度（默认 10）
cfg.JSONMaxDepth = 20
```

### 类型转换示例

```json
{
    "PORT": 8080,
    "DEBUG": true,
    "TIMEOUT": 30,
    "RATES": [0.1, 0.2, 0.3]
}
```

```go
// JSONNumberAsString = true（默认）
port := loader.GetString("PORT")  // "8080"（字符串）
port := loader.GetInt("PORT")     // 8080（整数）

// JSONBoolAsString = true（默认）
debug := loader.GetString("DEBUG")  // "true"（字符串）
debug := loader.GetBool("DEBUG")    // true（布尔）
```

## YAML 格式

### 文件结构

```yaml
# 应用配置
APP_NAME: myapp
APP_PORT: "8080"
DEBUG: true

# 数据库配置
DATABASE:
  HOST: localhost
  PORT: "5432"
  USER: postgres
  PASSWORD: secret

# 列表值
ALLOWED_HOSTS:
  - localhost
  - example.com
```

### 键名解析

YAML 的嵌套结构与 JSON 使用相同的扁平化规则：

```go
loader.LoadFiles("config.yaml")

// 使用扁平化键名访问
host := loader.GetString("DATABASE_HOST")        // localhost
user := loader.GetString("DATABASE_USER")        // postgres
```

### 数组访问

YAML 列表被扁平化为带索引的键：

```yaml
servers:
  - host: server1.example.com
    port: 8080
  - host: server2.example.com
    port: 8081
```

```go
// 使用扁平化键名访问
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// 获取整个列表
hosts := env.GetSliceFrom[string](loader, "ALLOWED_HOSTS") // ["localhost", "example.com"]
```

### YAML 解析配置

```go
cfg := env.DefaultConfig()

// null/~ 值转为空字符串（默认 true）
cfg.YAMLNullAsEmpty = true

// 数字转为字符串（默认 true）
cfg.YAMLNumberAsString = true

// 布尔值转为字符串（默认 true）
cfg.YAMLBoolAsString = true

// 最大嵌套深度（默认 10）
cfg.YAMLMaxDepth = 15
```

### 类型转换示例

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
// YAMLNumberAsString = true（默认）
port := loader.GetString("PORT")  // "8080"（字符串）
port := loader.GetInt("PORT")     // 8080（整数）

// YAMLBoolAsString = true（默认）
debug := loader.GetString("DEBUG")  // "true"（字符串）
debug := loader.GetBool("DEBUG")    // true（布尔）

// 列表访问
rates := env.GetSliceFrom[float64](loader, "RATES")  // [0.1, 0.2, 0.3]
```

## .env 格式

### 文件结构

```bash
# 注释
APP_NAME=myapp
APP_PORT=8080
DEBUG=true

# 引号
MESSAGE="Hello World"
LITERAL='literal ${noexpand}'

# 变量展开
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# 默认值
LOG_LEVEL=${LOG_LEVEL:-info}
```

### 变量展开

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // 默认启用

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

// .env 内容:
// BASE_URL=https://api.example.com
// API_URL=${BASE_URL}/v1

apiURL := loader.GetString("API_URL")
// 输出: https://api.example.com/v1
```

### 展开语法

| 语法 | 说明 |
|------|------|
| `${VAR}` | 引用变量 |
| `${VAR:-default}` | 变量不存在时使用默认值 |

```bash
# 展开示例
HOST=localhost
PORT=8080

# 引用其他变量
URL=http://${HOST}:${PORT}

# 默认值
TIMEOUT=${TIMEOUT:-30s}
DEBUG=${DEBUG:-false}
```

### export 语法

```bash
# 支持 export 前缀（AllowExportPrefix = true 时）
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
```

### YAML 风格语法

```go
cfg := env.DefaultConfig()
cfg.AllowYamlSyntax = true  // 启用 YAML 风格
```

```bash
# 支持 YAML 风格键值对
KEY: value
ANOTHER_KEY: "quoted value"
```

## 混合配置模式

### 开发/生产分离

```text
config/
├── base.json          # 基础配置
├── development.env    # 开发覆盖
├── production.yaml    # 生产覆盖
└── local.env          # 本地覆盖（不提交）
```

```go
func loadConfig(loader *env.Loader) error {
    // 1. 基础配置
    if err := loader.LoadFiles("config/base.json"); err != nil {
        return err
    }

    // 2. 环境配置
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

    // 3. 本地覆盖（可选）
    if _, err := os.Stat("config/local.env"); err == nil {
        if err := loader.LoadFiles("config/local.env"); err != nil {
            return err
        }
    }

    return nil
}
```

### 按功能分离

```text
config/
├── app.json       # 应用配置
├── database.yaml  # 数据库配置
├── redis.env      # Redis 配置
└── secrets.json   # 密钥配置
```

```go
loader.LoadFiles(
    "config/app.json",
    "config/database.yaml",
    "config/redis.env",
    "config/secrets.json",
)
```

### 配置优先级

```text
命令行参数 > 环境变量 > local 配置 > 环境配置 > base 配置
```

## 序列化

### Marshal

将配置序列化为指定格式：

```go
data := map[string]string{
    "HOST": "localhost",
    "PORT": "8080",
}

// .env 格式（默认）
envStr, _ := env.Marshal(data)
// HOST=localhost
// PORT=8080

// JSON 格式
jsonStr, _ := env.Marshal(data, env.FormatJSON)
// {"HOST":"localhost","PORT":"8080"}

// YAML 格式
yamlStr, _ := env.Marshal(data, env.FormatYAML)
// HOST: localhost
// PORT: "8080"
```

### Marshal 结构体

```go
type Config struct {
    Host string `env:"HOST"`
    Port int    `env:"PORT"`
}

cfg := Config{Host: "localhost", Port: 8080}

// 转 .env
envStr, _ := env.Marshal(cfg, env.FormatEnv)

// 转 JSON
jsonStr, _ := env.Marshal(cfg, env.FormatJSON)

// 转 YAML
yamlStr, _ := env.Marshal(cfg, env.FormatYAML)
```

### UnmarshalMap

反序列化为 map：

```go
// 从 .env
envData := "HOST=localhost\nPORT=8080"
data, _ := env.UnmarshalMap(envData, env.FormatEnv)

// 从 JSON
jsonData := `{"HOST":"localhost","PORT":"8080"}`
data, _ := env.UnmarshalMap(jsonData, env.FormatJSON)

// 从 YAML
yamlData := "HOST: localhost\nPORT: \"8080\""
data, _ := env.UnmarshalMap(yamlData, env.FormatYAML)

// 自动检测格式
data, _ := env.UnmarshalMap(jsonData, env.FormatAuto)
```

### UnmarshalStruct

反序列化到结构体：

```go
type Config struct {
    Host string `env:"HOST"`
    Port int    `env:"PORT"`
}

var cfg Config

// 从 .env
env.UnmarshalStruct("HOST=localhost\nPORT=8080", &cfg, env.FormatEnv)

// 从 JSON
env.UnmarshalStruct(`{"HOST":"localhost","PORT":"8080"}`, &cfg, env.FormatJSON)

// 从 YAML
env.UnmarshalStruct("HOST: localhost\nPORT: \"8080\"", &cfg, env.FormatYAML)
```

## 自定义格式

### 注册解析器

```go
// 定义格式常量
const FormatTOML env.FileFormat = 100

// 实现 EnvParser 接口
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    // 实现 TOML 解析
    result := make(map[string]string)
    // ...
    return result, nil
}

// 注册解析器
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

详见 [自定义解析器](/zh/env/guides/custom-parser)。

## 完整示例

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/env"
)

func main() {
    // 创建加载器
    cfg := env.DefaultConfig()
    cfg.ExpandVariables = true

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // 加载混合格式配置
    err = loader.LoadFiles(
        "config/base.json",       // JSON 基础配置
        "config/database.yaml",   // YAML 数据库配置
        "config/app.env",         // .env 应用配置
    )
    if err != nil {
        log.Fatal(err)
    }

    // 读取配置
    fmt.Printf("App: %s\n", loader.GetString("APP_NAME"))
    fmt.Printf("DB Host: %s\n", loader.GetString("DATABASE_HOST"))
    fmt.Printf("DB Port: %d\n", loader.GetInt("DATABASE_PORT"))

    // 导出当前配置
    all := loader.All()
    exported, _ := env.Marshal(all, env.FormatEnv)
    fmt.Println("\nExported config:")
    fmt.Println(exported)
}
```

## 相关文档

- [序列化](/zh/env/guides/serialization) - 序列化/反序列化详解
- [ComponentFactory API](/zh/env/api-reference/factory) - 格式检测与解析器注册
- [自定义解析器](/zh/env/guides/custom-parser) - 添加自定义格式
- [Config API](/zh/env/api-reference/config) - JSON/YAML 解析配置
