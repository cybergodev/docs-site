---
sidebar_label: "多格式配置"
title: "多格式配置 - CyberGo env | .env/JSON/YAML"
description: "CyberGo env 多格式配置加载指南，支持 .env、JSON、YAML 自动检测与混合加载，详解嵌套对象与数组的扁平化键名、多文件加载顺序、Marshal/UnmarshalMap 格式互转与 RegisterParser 自定义格式。"
sidebar_position: 1
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

默认配置（`OverwriteExisting = false`）下**先加载的文件胜出**：后加载文件中的同名键会被跳过，值以最先设置的文件为准。仅当 `OverwriteExisting = true` 时，后加载的文件才覆盖先加载的。

```go
// 默认 first-wins：同名键以 .env 中的值为准
loader.LoadFiles(
    ".env",           // 基础配置（同名键在此生效）
    "config.json",    // 只补充 .env 中没有的键
    "secrets.yaml",   // 只补充前两个文件都没有的键
)

// 对照：需要 last-wins（后加载覆盖先加载）时，开启 OverwriteExisting
cfg := env.DefaultConfig()
cfg.OverwriteExisting = true
loader2, _ := env.New(cfg)
loader2.LoadFiles(".env", "config.json", "secrets.yaml")
// 此时同名键以 secrets.yaml 为准：secrets.yaml > config.json > .env
```

::: tip 提示
`DevelopmentConfig()` 与 `TestingConfig()` 预设默认开启 `OverwriteExisting = true`（后加载覆盖先加载）；包级 `env.Load()` 使用 `DefaultConfig` 保持 first-wins，需要 last-wins 时改用 `env.LoadWithConfig` 并设置 `cfg.OverwriteExisting = true`。
:::

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
// 存储为：DATABASE_HOST=localhost, DATABASE_PORT=5432

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
    ],
    "hosts": ["server1.example.com", "server2.example.com"]
}
```

```go
// 对象数组：使用扁平化键名按下标访问元素
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// 字符串数组：用 GetSliceFrom 聚合整个列表（HOSTS_0、HOSTS_1 → 切片）
hosts := env.GetSliceFrom[string](loader, "HOSTS")
// hosts = ["server1.example.com", "server2.example.com"]
```

对象数组（`SERVERS_N_HOST` 形态）没有整列聚合函数，只能像上面那样按下标逐个读取；不要用「取到空字符串即终止」的循环——空值与缺失键都会返回 `""`，无法区分。字符串数组则统一用 `GetSliceFrom`（索引键优先、逗号分隔回退）。

### JSON 解析配置

```go
cfg := env.DefaultConfig()

// null 值转为空字符串（默认 true）
cfg.JSONNullAsEmpty = true

// 数字转为字符串（默认 true）
cfg.JSONNumberAsString = true

// 布尔值转为字符串（默认 true）
cfg.JSONBoolAsString = true

// 最大嵌套深度（默认 16）
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

// 最大嵌套深度（默认 16）
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

# 字面 $ 用 $$ 转义（注意：单引号不阻止变量展开，
# LITERAL='literal ${noexpand}' 中的 ${noexpand} 仍会被展开）
PRICE=100$$

# 变量展开
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# 日志级别
LOG_LEVEL=info
```

### 变量展开

完整的展开语法（`$$` 转义、`${VAR:-default}`、展开作用域等）见[变量展开](./variable-expansion)指南，本节为速览：

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // 默认启用

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

// .env 内容：
// BASE_URL=https://api.example.com
// API_URL=${BASE_URL}/v1

apiURL := loader.GetString("API_URL")
// 输出：https://api.example.com/v1
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

# 默认值（引用其他变量，未定义时使用默认值）
TIMEOUT_VALUE=${TIMEOUT:-30s}
DEBUG_VALUE=${DEBUG:-false}
```

### export 语法

```bash
# 支持 export 前缀（AllowExportPrefix = true 时）
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
```

### YAML 风格语法

`KEY: value` 的冒号分隔写法**始终可用**（行解析器无条件接受 `=` 与 `:` 作为分隔符，无需开关）。`AllowYamlSyntax` 控制的是值的 YAML 标量语义：

```go
cfg := env.DefaultConfig()
cfg.AllowYamlSyntax = true  // 值按 YAML 标量语义解析（null/~ → 空字符串）
```

```bash
# 冒号分隔键值对（始终支持）
KEY: value
ANOTHER_KEY: "quoted value"
```

## 混合配置模式

### 开发/生产分离

```text
config/
├── base.json          # 基础配置
├── development.env    # 开发环境配置
├── production.yaml    # 生产环境配置
└── local.env          # 本地配置（不提交）
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

    // 3. 本地配置（可选）
    if _, err := os.Stat("config/local.env"); err == nil {
        if err := loader.LoadFiles("config/local.env"); err != nil {
            return err
        }
    }

    return nil
}
```

::: tip 注意
默认（`OverwriteExisting = false`）为 first-wins：后加载的环境配置与本地配置只**补充** base.json 中没有的键，同名键仍以 base.json 为准。若需要环境/本地配置覆盖基础配置，须设置 `cfg.OverwriteExisting = true`（如改用 `DevelopmentConfig()` 预设，该选项默认开启）。
:::

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

默认（`OverwriteExisting = false`）时先加载的文件胜出，同名键以最先出现的值为准：

```text
命令行参数 > 环境变量 > base 配置 > 环境配置 > local 配置
```

若开启 `OverwriteExisting = true`（如 `DevelopmentConfig()` 预设），则后加载的文件胜出，文件间优先级方向反转：

```text
命令行参数 > 环境变量 > local 配置 > 环境配置 > base 配置
```

## 序列化

`env.Marshal` 将 map 或结构体导出为 `.env` / JSON / YAML，`env.UnmarshalMap` / `env.UnmarshalStruct` 反向解析；传入 `env.FormatAuto` 可按内容自动检测格式。

注意两种结构化输出的加工行为：Marshal 到 JSON 会把下划线键（如 `DATABASE_HOST`）重建为嵌套对象，并把 `"8080"`、`"true"` 等字符串推断回 number / bool；Marshal 到 YAML 对可被强制转换类型的标量自动加引号（如 `PORT: "8080"`），保证读回往返一致。

函数族详解与输出形态示例见[序列化](./serialization)指南。

## 自定义格式

内置三格式之外，可实现 `EnvParser` 接口并用 `RegisterParser` 注册自定义格式（内置的 `.env` / JSON / YAML 不可覆盖，`ForceRegisterParser` 除外）。

注意 `LoadFiles` 按扩展名路由，只识别 `.env` / `.json` / `.yaml` / `.yml`——自定义格式号不会被自动路由到。完整示例与两条加载路径见[自定义解析器](./custom-parser)指南。

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

	// 加载混合格式配置（默认同名键以先加载的文件为准，见「覆盖顺序」一节）
	err = loader.LoadFiles(
		"config/base.json",     // JSON 基础配置
		"config/database.yaml", // YAML 数据库配置
		"config/app.env",       // .env 应用配置
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

## 结构化解析细节与前缀过滤

### JSON/YAML 扁平化规则

嵌套结构在加载时被扁平化为环境变量键，默认规则：

| 规则 | 示例 |
|------|------|
| 嵌套键以下划线连接 | `{"database": {"host": "..."}}` → `DATABASE_HOST` |
| 数组元素使用 `键_索引` | `{"hosts": ["a", "b"]}` → `HOSTS_0`、`HOSTS_1` |
| `null` 转为空字符串 | `{"name": null}` → `NAME=""` |
| 数字与布尔转为字符串 | `{"port": 5432}` → `PORT="5432"` |
| 嵌套深度上限默认 16 | 由 `JSONMaxDepth`/`YAMLMaxDepth` 控制（1–100） |

文件加载时的转换行为受 `Config` 的 `JSONConfig`/`YAMLConfig` 控制（如 `JSONNullAsEmpty`、`JSONNumberAsString`）；而 `UnmarshalMap`/`UnmarshalStruct` 的字符串解析路径使用内置默认规则，不读取这些配置。

### 前缀过滤（Prefix）

`ComponentConfig.Prefix` 限定只加载以指定前缀开头的变量（大小写不敏感），常用于共享配置文件中只取本应用的部分：

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
cfg.Prefix = "MYAPP_" // 只加载 MYAPP_ 开头的键
loader, _ := env.New(cfg)
```

前缀过滤与 `OverwriteExisting` 策略叠加生效：被过滤掉的键不会覆盖也不会进入存储。

### 未知扩展名的回退行为

`DetectFormat` 对未知扩展名返回 `FormatAuto`，此时加载器**回退到 `.env` 解析器**按行解析。因此 `config.conf`、`config.txt` 等文件若内容是 `KEY=value` 形式，仍可正常加载。

## 相关文档

- [序列化](./serialization) - 序列化/反序列化详解
- [ComponentFactory API](../api-reference/factory) - 格式检测与解析器注册
- [自定义解析器](./custom-parser) - 添加自定义格式
- [Config API](../api-reference/config) - JSON/YAML 解析配置
