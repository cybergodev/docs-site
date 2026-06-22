---
title: "快速开始 - CyberGo env | 5分钟入门指南"
description: "5 分钟上手 CyberGo env 环境变量管理库，涵盖 go get 安装、.env 加载、类型安全读取、结构体映射与变量展开，附完整代码示例助您快速入门。"
---

# 快速开始

5 分钟上手 env 库，从安装到实际使用。

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
}
```

## 读取值 - 所有类型

### 基本类型

```go
// === 带默认值 ===

// 字符串 - 未找到时返回默认值 "localhost"
host := env.GetString("HOST", "localhost")

// 整数 (int64) - 未找到时返回默认值 8080
port := env.GetInt("PORT", 8080)

// 布尔值 - 未找到时返回默认值 false
debug := env.GetBool("DEBUG", false)

// 时间间隔 - 未找到时返回默认值 30s
timeout := env.GetDuration("TIMEOUT", 30*time.Second)


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
库支持多种键名访问方式：

```go
// JSON: {"app": {"name": "myapp"}}
// 存储为: APP_NAME=myapp

// 以下方式都能访问到该值
name := env.GetString("APP_NAME")      // 扁平化键名（推荐）
name := env.GetString("app.name")      // 点号路径（自动转换）
name := env.GetString("APP.NAME")      // 大写点号路径
```

**解析规则：**
1. **精确匹配**：优先查找精确键名 `KEY`
2. **大写转换**：小写键名尝试大写版本 `key` → `KEY`
3. **路径解析**：点号路径转换为下划线 `app.name` → `APP_NAME`
:::

### 布尔值支持

`GetBool` 支持以下值（不区分大小写）：

| 真值 | 假值 |
|------|------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

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
2. 若无索引键，则按逗号分隔解析 `KEY` 的值

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

    // 日志使用掩码（防止泄露）
    log.Printf("API Key: %s", secret.Masked())  // 输出: [SECURE:32 bytes]
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
    Hosts    []string      `env:"ALLOWED_HOSTS" envSeparator:","`
}

func main() {
    env.Load(".env")

    var cfg Config
    if err := env.ParseInto(&cfg); err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", cfg)
}
```

::: details 详见
[结构体映射](/zh/env/guides/struct-mapping) 指南。
:::

## 配置预设

库提供四种预设配置，适用于不同场景：

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
| 文件大小限制 | 2MB | 10MB | 64KB | 64KB |
| 最大变量数 | 500 | 500 | 50 | 50 |
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

// 单次调用加载所有配置文件（按顺序，后加载的覆盖先加载的）
env.Load(".env", ".env."+goEnv, ".env.local")
```

### 使用 Loader 实例

需要更多控制时，使用 Loader 实例：

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // 创建配置
    cfg := env.ProductionConfig()
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    // 创建加载器
    loader, err := env.New(cfg)
    if err != nil {
        panic(err)
    }
    defer loader.Close()

    // 加载文件（按顺序，后加载的覆盖先加载的）
    if err := loader.LoadFiles(".env", ".env.production"); err != nil {
        panic(err)
    }

    // 验证必需键
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

按顺序加载，后加载的覆盖先加载的：

```go
// 包级函数
env.Load(".env", "config.json", "config.yaml")

// Loader 实例
loader.LoadFiles(".env", ".env.local")
```

### 多格式支持

自动检测文件格式：

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
    case errors.Is(err, env.ErrForbiddenKey):
        // 禁止键
    case errors.Is(err, env.ErrInvalidKey):
        // 无效键格式
    default:
        // 其他错误
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

<div class="vp-features">

### 深入学习
- [结构体映射](/zh/env/guides/struct-mapping) - 详细的配置绑定
- [序列化](/zh/env/guides/serialization) - 配置序列化与反序列化
- [多格式配置](/zh/env/guides/multi-format) - JSON/YAML 详解
- [测试场景](/zh/env/guides/testing) - 测试中的使用方法

### API 参考
- [包函数](/zh/env/api-reference/functions) - 包级函数完整列表
- [Loader API](/zh/env/api-reference/loader) - 加载器方法
- [Config API](/zh/env/api-reference/config) - 配置选项

### 安全
- [安全概述](/zh/env/security/) - 安全架构与最佳实践
- [SecureValue API](/zh/env/api-reference/secure-value) - 安全值处理

</div>
