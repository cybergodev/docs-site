---
sidebar_label: "多格式配置"
title: "多格式配置 - CyberGo env | .env/JSON/YAML"
description: "CyberGo env 多格式配置加载指南，支持 .env、JSON、YAML 自动检测与混合加载，详解嵌套对象与数组的扁平化键名、多文件加载顺序、Marshal/UnmarshalMap 格式互转与 RegisterParser 自定义格式。"
sidebar_position: 1
---

# 多格式配置

env 库可加载 `.env`、JSON、YAML 三种配置格式，按扩展名自动选择解析器，也可在同一次加载中混用。

## 格式检测

### 自动检测规则

| 扩展名 | 格式 | 常量 |
|--------|------|------|
| `.env` | .env 格式 | `FormatEnv` |
| `.json` | JSON | `FormatJSON` |
| `.yaml`, `.yml` | YAML | `FormatYAML` |
| 其他 | 未判定 | `FormatAuto`（没有对应解析器时，加载回退到 `.env` 解析器） |

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
// 每个文件按各自扩展名选择解析器
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

### 覆盖顺序

默认配置（`OverwriteExisting = false`）下**先加载的文件胜出**：后加载文件中的同名键会被跳过，值以最先设置的文件为准。`OverwriteExisting = true` 时反过来，后加载的文件覆盖先加载的。

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
`DevelopmentConfig()` 与 `TestingConfig()` 预设已内置 `OverwriteExisting = true`（后加载覆盖先加载）。包级 `env.Load()` 使用 `DefaultConfig`，需要 last-wins 时改用 `env.Overload()`（同时会用文件值覆盖进程环境中的同名变量），或 `env.LoadWithConfig` 并设置该选项。
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
嵌套对象会被扁平化为 `DATABASE_HOST`、`DATABASE_PORT` 这样的下划线键。
:::

### 键名解析

JSON/YAML 的嵌套结构在加载时扁平化存储。同一个值有三种访问写法：

```go
loader.LoadFiles("config.json")

// JSON: {"database": {"host": "localhost", "port": 5432}}
// 存储为：DATABASE_HOST=localhost, DATABASE_PORT=5432

// 方式一：扁平化键名（推荐）
hostFlat := loader.GetString("DATABASE_HOST")  // localhost
portFlat := loader.GetInt("DATABASE_PORT")     // 5432

// 方式二：点号路径（自动转换）
hostDot := loader.GetString("database.host")   // localhost
portDot := loader.GetInt("database.port")      // 5432

// 方式三：大写点号路径
hostUpper := loader.GetString("DATABASE.HOST") // localhost
```

**解析规则：**

| 输入键名 | 转换为 |
|----------|--------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"`（精确匹配） |
| `"database.host"` | `"DATABASE_HOST"`（点号转下划线） |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"`（数组索引） |

::: tip 推荐用法
- **代码中使用扁平化键名**：`GetString("DATABASE_HOST")` 无需转换，直接命中存储键
- **配置文件中用自然嵌套**：JSON/YAML 保持 `database.host` 这样的可读结构
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

对象数组（`SERVERS_N_HOST` 形态）没有整列聚合函数，只能按上面的写法按下标逐个读取。不要写「取到空字符串就停止」的循环：值本身为空与键不存在都返回 `""`，循环无法区分两者。字符串数组统一用 `GetSliceFrom`（索引键优先，逗号分隔回退）。

### JSON 解析配置

```go
cfg := env.DefaultConfig()

// null 值转为空字符串（默认 true）
cfg.JSONNullAsEmpty = true

// 数字转为规范十进制字符串（默认 true，如 "8080"、"0.5"；
// 关闭后按 Go 默认浮点格式渲染，如 1e21 → "1e+21"）
cfg.JSONNumberAsString = true

// 仅为与 YAML 对称保留，对 JSON 输出无影响（默认 false，已标记 Deprecated）：
// 解码后的 JSON 布尔没有原始文本可保留，总是渲染为 "true"/"false"
cfg.JSONBoolAsString = false

// 最大嵌套深度（默认 16，取值 1–100）
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
portStr := loader.GetString("PORT") // "8080"（字符串）
portInt := loader.GetInt("PORT")    // 8080（整数）

// JSON 布尔总是渲染为规范的 "true"/"false"，JSONBoolAsString 不参与判定
debugStr := loader.GetString("DEBUG") // "true"（字符串）
debugBool := loader.GetBool("DEBUG")  // true（布尔）
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

// 数字标量归一化为规范形式（默认 true，如 "007" → "7"；关闭后原样保留书写形式）
cfg.YAMLNumberAsString = true

// 布尔值渲染为规范的 "true"/"false"（默认 true）；关闭时保留 YAML 中的书写形式（如 False）
cfg.YAMLBoolAsString = true

// 最大嵌套深度（默认 16，取值 1–100）
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
portStr := loader.GetString("PORT") // "8080"（字符串）
portInt := loader.GetInt("PORT")    // 8080（整数）

// YAMLBoolAsString = true（默认）
debugStr := loader.GetString("DEBUG") // "true"（字符串）
debugBool := loader.GetBool("DEBUG")  // true（布尔）

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

# 字面 $ 用 $$ 转义；单引号的值不参与变量展开
PRICE=100$$
LITERAL='literal ${noexpand}'

# 变量展开
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# 日志级别
LOG_LEVEL=info
```

### 变量展开

变量展开只作用于 `.env` 文件的值，JSON 与 YAML 文档中的 `$` 保持字面量。`$$` 转义、`${VAR:-default}`、展开作用域等规则见[变量展开](./variable-expansion)指南，这里先看最小示例：

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // 可省略，DefaultConfig 已开启

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
| `${VAR:-default}` | 变量未定义时使用默认值 |

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

默认（`DefaultConfig()` 的 `AllowYamlSyntax = false`）下，**只有 `=` 是键值分隔符**。`KEY: value` 这类行没有 `=`，会被当作无分隔行跳过；开启审计时，每次跳过记一条解析审计事件。

把 `AllowYamlSyntax` 设为 `true` 后，`:` 才作为分隔符，且值按 YAML 标量语义解析（`null`、`~` → 空字符串，数字与布尔保留原样文本）：

```go
cfg := env.DefaultConfig()
cfg.AllowYamlSyntax = true  // 开启后 ':' 才可作为分隔符，值按 YAML 标量语义解析
```

```bash
# 仅在 AllowYamlSyntax = true 时生效
KEY: value
ANOTHER_KEY: "quoted value"
```

`DevelopmentConfig()` 预设已开启 `AllowYamlSyntax`；`DefaultConfig()`、`TestingConfig()`、`ProductionConfig()` 均为关闭状态。

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
默认（`OverwriteExisting = false`）为 first-wins（见[覆盖顺序](#覆盖顺序)）：后加载的环境配置与本地配置只**补充** base.json 中没有的键。若需要它们覆盖基础配置，须设置 `cfg.OverwriteExisting = true`（`DevelopmentConfig()` 预设默认开启）。
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

默认（`OverwriteExisting = false`）时先加载的文件胜出（见[覆盖顺序](#覆盖顺序)），同名键以最先出现的值为准：

```text
命令行参数 > 环境变量 > base 配置 > 环境配置 > local 配置
```

若开启 `OverwriteExisting = true`（如 `DevelopmentConfig()` 预设），则后加载的文件胜出，文件间优先级方向反转：

```text
命令行参数 > 环境变量 > local 配置 > 环境配置 > base 配置
```

## 序列化

`env.Marshal` 把 map 或结构体导出为 `.env` / JSON / YAML 文本，`env.UnmarshalMap` / `env.UnmarshalStruct` 反向解析。反序列化传入 `env.FormatAuto` 时按内容自动检测格式；`Marshal` 不做内容检测，传 `FormatAuto` 与缺省参数一样按 `.env` 输出。

两种结构化输出会改写键值。Marshal 到 JSON 时，下划线键（如 `DATABASE_HOST`）被拆回嵌套对象，`"8080"`、`"true"` 等字符串被推断回 number / bool；不能原样回写的写法（`"007"`、`"1e3"`、`"null"`）保持字符串。Marshal 到 YAML 时键保持扁平，但读回会被强制转换类型的标量自动加引号（如 `PORT: "8080"`），保证往返后仍是字符串。

函数族详解与输出形态示例见[序列化](./serialization)指南。

## 自定义格式

内置三种格式之外，可实现 `EnvParser` 接口并用 `RegisterParser` 注册自定义格式。内置的 `.env` / JSON / YAML 不能被 `RegisterParser` 覆盖，替换内置解析器要用 `ForceRegisterParser`。

`LoadFiles` 按扩展名路由，只识别 `.env` / `.json` / `.yaml` / `.yml`，自定义格式号不会被自动命中。三条可用加载路径：用 `ForceRegisterParser` 覆盖 `FormatEnv` 并把文件命名为 `*.env`；注册到 `FormatAuto`；或手动调用解析器后逐条 `Set`。完整示例见[自定义解析器](./custom-parser)指南。

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

文件加载时的转换行为受 `Config` 的 `JSONConfig` / `YAMLConfig` 控制（如 `JSONNullAsEmpty`、`JSONNumberAsString`）。`UnmarshalMap` / `UnmarshalStruct` 的字符串解析路径走内置默认规则，不读取这些配置；需要自定义时改用 `UnmarshalMapWithConfig` / `UnmarshalStructWithConfig`。

### 前缀过滤（Prefix）

`ComponentConfig.Prefix` 限定文件加载时只保留键名以指定前缀开头的变量（大小写不敏感，`Set`/`Delete` 不受影响），用于从共享配置文件中只取本应用的部分：

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
cfg.Prefix = "MYAPP_" // 只加载 MYAPP_ 开头的键
loader, _ := env.New(cfg)
```

前缀过滤先于 `OverwriteExisting` 策略判定：被过滤掉的键既不覆盖已有值，也不进入存储。

### 未知扩展名的回退行为

`DetectFormat` 对未知扩展名返回 `FormatAuto`。解析器表里没有 `FormatAuto` 条目时，加载器回退到 `.env` 解析器按行解析；若用 `RegisterParser(env.FormatAuto, ...)` 注册过，则改走该解析器。因此 `config.conf`、`config.txt` 等内容为 `KEY=value` 的文件，未注册自定义解析器时可以正常加载。

## 相关文档

- [序列化](./serialization) - 序列化/反序列化详解
- [ComponentFactory API](../api-reference/factory) - 格式检测与解析器注册
- [自定义解析器](./custom-parser) - 添加自定义格式
- [Config API](../api-reference/config) - JSON/YAML 解析配置
