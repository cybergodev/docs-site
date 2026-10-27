---
sidebar_label: "快速开始"
title: "快速开始 - CyberGo env | 5 分钟入门指南"
description: "5 分钟上手 CyberGo env 环境变量管理库，涵盖 go get 安装、.env 加载、类型安全读取、GetSecure 安全值、结构体映射与 errors.Is 错误处理，并讲解四种配置预设与多环境多文件多格式加载。"
sidebar_position: 1
---

# 快速开始

env 是 Go 的环境变量管理库：从 `.env`、JSON、YAML 加载配置，按类型读取值，并映射到结构体。

## 安装

```bash
go get github.com/cybergodev/env
```

::: tip 要求
Go 1.25+
:::

## 创建 .env 文件

在项目根目录创建 `.env` 文件：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=secret

# 应用配置
DEBUG=true
APP_NAME=myapp
LOG_LEVEL=info

# 多值（逗号分隔）
ALLOWED_HOSTS=localhost,example.com,api.example.com
```

::: tip 完整语法参考
`.env` 文件的引号、转义、多行值等完整语法规则，参见[文件格式](../reference/file-format)。
:::

## 最简用法

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	// 加载 .env 文件并应用到系统环境
	if err := env.Load(".env"); err != nil {
		panic(err)
	}

	// 获取环境变量
	host := env.GetString("DB_HOST", "localhost")
	port := env.GetInt("DB_PORT", 5432)

	fmt.Printf("Server: %s:%d\n", host, port)
	// 输出：Server: localhost:5432
}
```

::: tip 两种使用模式

env 提供两种使用方式：

| 模式 | 用法 | 适用场景 |
|------|------|----------|
| **全局模式** | `env.Load()` + `env.GetString()` | 简单应用、脚本、快速原型 |
| **实例模式** | `env.New()` + `loader.GetString()` | 多实例、测试隔离、精细控制生命周期 |

全局模式使用包级函数，内部维护一个默认加载器单例：调用 `env.Load()` 后，所有 `env.GetXxx()` 都使用该实例。实例模式通过 `env.New()` 创建独立 Loader，用于需要隔离或同时管理多套配置的场景。

下文示例默认使用全局模式，实例模式的完整用法见[多环境配置](#多环境配置)一节。

未调用 `Load()` 时不报错，但各函数行为不同：`Get*` 返回默认值或零值，`Lookup` 返回 `("", false)`，`Keys`/`All` 返回 nil、`Len` 返回 0，`Set`/`Delete`/`Validate`/`ParseInto` 返回 `ErrNotInitialized`。详见[包函数](../api-reference/functions)。
:::

## 读取值 - 所有类型

### 基本类型

```go
// === 带默认值 ===

// 字符串 - 未找到时返回默认值 "localhost"
host := env.GetString("HOST", "localhost")

// 整数 (int64) - 未找到时返回默认值 8080
port := env.GetInt("PORT", 8080)

// 浮点数 (float64) - 未找到时返回默认值 0.99
rate := env.GetFloat64("RATE", 0.99)

// 无符号整数 (uint64) - 未找到时返回默认值 4096
size := env.GetUint64("MAX_SIZE", 4096)

// 布尔值 - 未找到时返回默认值 false
debug := env.GetBool("DEBUG", false)

// 时间间隔 - 未找到时返回默认值 30s
timeout := env.GetDuration("TIMEOUT", 30*time.Second)
```

```go
// === 不带默认值 ===

// 字符串 - 未找到时返回空字符串 ""
host := env.GetString("HOST")

// 整数 (int64) - 未找到时返回 0
port := env.GetInt("PORT")

// 布尔值 - 未找到时返回 false
debug := env.GetBool("DEBUG")

// 时间间隔 - 未找到时返回 0
timeout := env.GetDuration("TIMEOUT")
```

::: tip 键名解析
同一个键可以用多种写法访问：

```go
// JSON: {"app": {"name": "myapp"}}
// 存储为：APP_NAME=myapp

// 以下方式都能访问到该值（变量名不同，仅作演示）
nameFlat := env.GetString("APP_NAME")  // 扁平化键名（推荐）
nameDot := env.GetString("app.name")   // 点号路径（自动转换）
nameUpper := env.GetString("APP.NAME") // 大写点号路径

fmt.Println(nameFlat, nameDot, nameUpper) // 三者相同
```

**解析规则：**
1. **精确匹配**：优先查找精确键名 `KEY`，包括本身带点的字面键名（如 YAML 顶层键 `apnews.com` 存储为大写形式 APNEWS.COM）
2. **大写回退**：精确匹配失败时，把键名转为大写再查，`key` → `KEY`
3. **路径解析**：点号路径转换为下划线，`app.name` → `APP_NAME`
4. **数字索引**：以索引结尾的键（`hosts.0`）取逗号分隔值中对应位置的元素
:::

### 布尔值支持

`GetBool` 不区分大小写，真值为 `true`/`1`/`yes`/`on`/`enabled`，假值为 `false`/`0`/`no`/`off`/`disabled`。

空串按 `false` 处理而不取默认值，无法识别的值记审计并返回默认值；`GetInt`、`GetFloat64`、`GetDuration` 的空值则解析失败、回退到默认值。完整对照表见[常见问题 · 支持哪些布尔值格式](../reference/faq#支持哪些布尔值格式)。

### 切片类型

```go
// 字符串切片
hosts := env.GetSlice[string]("HOSTS", []string{"localhost"})

// 整数切片（支持 int, int64, uint, uint64）
ports := env.GetSlice[int64]("PORTS", []int64{80, 443})
portsInt := env.GetSlice[int]("PORTS")  // 也支持 int 类型

// 浮点数切片
rates := env.GetSlice[float64]("RATES", []float64{0.1, 0.2})

// 布尔切片
flags := env.GetSlice[bool]("FLAGS", []bool{true, false})

// Duration 切片
timeouts := env.GetSlice[time.Duration]("TIMEOUTS")
```

**解析顺序：**
1. 优先查找索引键 `KEY_0`, `KEY_1`, `KEY_2`...
2. 没有索引键时，按逗号分隔解析 `KEY` 的值

索引键逐个解析，某个元素失败时记审计事件并跳过它。若跳过之后一个元素都没剩下，按「没有索引键」处理，继续尝试逗号分隔；逗号分隔解析失败时整个列表作废，直接返回调用方给的默认值，不再尝试其他候选键。

```go
// 方式一：索引键（推荐）
// HOSTS_0=localhost
// HOSTS_1=example.com
hosts := env.GetSlice[string]("HOSTS")  // ["localhost", "example.com"]

// 方式二：逗号分隔
// PORTS=80,443,8080
ports := env.GetSlice[int64]("PORTS")  // [80, 443, 8080]
```

### 检查与查找

```go
// 检查键是否存在
value, exists := env.Lookup("API_KEY")
if !exists {
    // 键不存在
}

// 获取所有键
keys := env.Keys()

// 获取所有键值对
all := env.All()

// 获取变量数量
count := env.Len()
```

### 安全值

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    // 获取原始值（仅在需要明文时调用，如加解密、API 调用）
    value := secret.Reveal()

    // 日志使用掩码（防止泄露）；方括号里的数字是值长度，
    // API_KEY 为 32 字节时输出：[SECURE:32 bytes]（启用内存锁定后会附带锁定状态）
    log.Printf("API Key: %s", secret.Masked())
}
```

## 结构体映射

使用标签将环境变量映射到结构体：

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/env"
)

type Config struct {
	Host     string        `env:"DB_HOST" envDefault:"localhost"`
	Port     int64         `env:"DB_PORT" envDefault:"5432"`
	Password string        `env:"DB_PASSWORD"`
	Debug    bool          `env:"DEBUG" envDefault:"false"`
	Timeout  time.Duration `env:"TIMEOUT" envDefault:"30s"`
	Hosts    []string      `env:"ALLOWED_HOSTS"`
}

func main() {
	if err := env.Load(".env"); err != nil {
		panic(err)
	}

	var cfg Config
	if err := env.ParseInto(&cfg); err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", cfg)
	// 输出：{Host:localhost Port:5432 Password:secret Debug:true Timeout:30s Hosts:[localhost example.com api.example.com]}
}
```

::: details 详见
[结构体映射](../guides/struct-mapping) 指南。
:::

## 配置预设

库提供四种预设配置，对应不同运行场景：

| 预设 | 用途 | 特点 |
|------|------|------|
| `DefaultConfig()` | 通用场景 | 安全默认值，适合大多数情况 |
| `DevelopmentConfig()` | 开发环境 | 宽松限制，允许覆盖 |
| `TestingConfig()` | 测试环境 | 紧凑限制，允许覆盖，适合单元测试 |
| `ProductionConfig()` | 生产环境 | 严格验证 + 审计日志 |

```go
// 开发环境 - 宽松限制
cfg := env.DevelopmentConfig()

// 测试环境 - 紧凑限制
cfg := env.TestingConfig()

// 生产环境 - 严格验证 + 审计日志
cfg := env.ProductionConfig()
```

### 预设详细对比

| 功能 | Default | Development | Testing | Production |
|------|---------|-------------|---------|------------|
| 覆盖已存在变量 | ✗ | ✓ | ✓ | ✗ |
| 文件不存在时报错 | ✗ | ✗ | ✗ | ✓ |
| 审计日志 | ✗ | ✗ | ✗ | ✓ |
| YAML 语法 | ✗ | ✓ | ✗ | ✗ |
| 文件大小限制 | 8 MB | 10 MB | 64 KB | 64 KB |
| 最大变量数 | 1000 | 1000 | 50 | 50 |
| 禁止键检查 | ✓ | ✓ | ✓ | ✓ |
| 值验证 | ✓ | ✓ | ✓ | ✓ |

::: tip 选择建议
- **开发环境**：使用 `DevelopmentConfig()`，宽松限制便于快速迭代
- **测试环境**：使用 `TestingConfig()`，允许覆盖便于测试隔离
- **生产环境**：使用 `ProductionConfig()`，启用审计和严格验证
:::

## 多环境配置

### 按环境加载

```go
// 根据环境确定配置文件
goEnv := os.Getenv("GO_ENV")
if goEnv == "" {
    goEnv = "development"
}

// 默认（DefaultConfig）：先加载的文件优先，.env 中已存在的键不会被后续文件覆盖
env.Load(".env", ".env."+goEnv, ".env.local")

// 需要「后加载覆盖」（如 .env.local 覆盖 .env）时：
cfg := env.DefaultConfig()
cfg.OverwriteExisting = true
cfg.Filenames = []string{".env", ".env." + goEnv, ".env.local"}
if err := env.LoadWithConfig(cfg); err != nil { log.Fatal(err) }
```

::: tip 覆盖语义
默认配置（`DefaultConfig()`）与 `ProductionConfig()` 均为「先加载的文件胜出」：后加载文件中与已加载同名的键会被跳过，防止运行时覆盖已加载的配置。`DevelopmentConfig()` 与 `TestingConfig()` 预设已内置 `OverwriteExisting=true`，只有这两类预设（或手动开启该选项）才会让后加载的文件覆盖先加载的。
:::

### 使用 Loader 实例

需要更多控制时，使用 Loader 实例：

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	// 创建配置（清空 Filenames，避免 New 阶段就自动加载并校验必需键）
	cfg := env.ProductionConfig()
	cfg.Filenames = nil
	cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

	// 创建加载器
	loader, err := env.New(cfg)
	if err != nil {
		panic(err)
	}
	defer loader.Close()

	// 加载文件（按顺序；ProductionConfig 下先加载的胜出，已存在的键不会被覆盖）
	if err := loader.LoadFiles(".env", ".env.production"); err != nil {
		panic(err)
	}

	// 验证必需键（解析时已按单个文件检查过，这里按合并后的存储再确认）
	if err := loader.Validate(); err != nil {
		panic(err)
	}

	// 使用
	host := loader.GetString("DB_HOST")
	fmt.Println("Host:", host)
}
```

## 多文件与多格式

### 多文件加载

按参数顺序加载。默认（`DefaultConfig()`）**先加载的文件胜出**：后加载文件中与已有键同名的条目会被跳过。需要「后加载覆盖」时设置 `OverwriteExisting = true`（`DevelopmentConfig()`/`TestingConfig()` 预设已内置）：

::: code-group

```go [包级函数]
env.Load(".env", "config.json", "config.yaml")
```

```go [Loader 实例]
loader.LoadFiles(".env", ".env.local")
```

:::

### 多格式支持

一次加载中混用不同格式，按扩展名自动选择解析器：

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

::: details 支持的格式
| 格式 | 扩展名 | 检测方式 |
|------|--------|----------|
| .env | `.env` | 文件扩展名 |
| JSON | `.json` | 文件扩展名 |
| YAML | `.yaml`, `.yml` | 文件扩展名 |
:::

## 错误处理

```go
import "errors"

err := loader.LoadFiles(".env")
if err != nil {
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        // 文件不存在
    case errors.Is(err, env.ErrFileTooLarge):
        // 文件过大
    case errors.Is(err, env.ErrSecurityViolation):
        // 禁止键（实际返回 *SecurityError）
    default:
        // 其他错误
    }

    // 键格式非法：实际返回 *ValidationError，Field=="key"
    var valErr *env.ValidationError
    if errors.As(err, &valErr) && valErr.Field == "key" {
        // 无效键格式
    }
}
```

::: details 获取详细错误信息
```go
// 解析错误详情
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("文件 %s 第 %d 行: %v\n", parseErr.File, parseErr.Line, parseErr.Err)
}

// 文件错误详情
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("文件 %s 操作 %s 失败: %v\n", fileErr.Path, fileErr.Op, fileErr.Err)
}

// 安全错误详情
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("安全错误: %s - %s\n", secErr.Action, secErr.Reason)
}
```
:::

## 下一步

### 深入学习
- [结构体映射](../guides/struct-mapping) - 详细的配置绑定
- [序列化](../guides/serialization) - 配置序列化与反序列化
- [多格式配置](../guides/multi-format) - JSON/YAML 详解
- [测试场景](../guides/testing) - 测试中的使用方法

### API 参考
- [包函数](../api-reference/functions) - 包级函数完整列表
- [Loader API](../api-reference/loader) - 加载器方法
- [Config API](../api-reference/config) - 配置选项

### 安全
- [安全概述](../security/) - 安全架构与最佳实践
- [SecureValue API](../api-reference/secure-value) - 安全值处理
