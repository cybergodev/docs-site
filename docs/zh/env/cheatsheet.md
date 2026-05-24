---
title: "速查表 - CyberGo env | 常用 API 速查"
description: "CyberGo env 环境变量管理库常用 API 速查表，一页汇总配置文件加载、类型安全读取、变量验证过滤、安全值 SecureValue 存储、序列化反序列化、结构体映射和审计日志等高频操作的核心代码片段，方便 Go 开发者日常开发时快速查阅和复制使用。"
---

# 速查表

在对该库有所了解的前提下, 快速参考高频使用的代码片段。

## 加载配置

```go
// 通过包级别加载
env.Load(".env")                                        // 加载 .env 文件
env.Load(".env", ".env.local", "config.json")          // 多文件

// 通过加载器加载
loader, _ := env.New()
loader.LoadFiles("config.json")                         // JSON
loader.LoadFiles("config.yaml")                         // YAML
loader.LoadFiles(".env", ".env.local", "config.json")   // 多文件
```

## 读取值

```go
// 基本类型
env.GetString("KEY", "default")
env.GetInt("PORT", 8080)              // 返回 int64
env.GetBool("DEBUG", false)
env.GetDuration("TIMEOUT", 30*time.Second)

// 切片（支持 KEY_0,KEY_1 索引格式或逗号分隔）
env.GetSlice[string]("HOSTS", []string{"localhost"})
env.GetSlice[int64]("PORTS", []int64{80})
env.GetSlice[int]("PORTS", []int{80})          // 也支持 int
env.GetSlice[float64]("RATES", []float64{0.1})

// 从 Loader 获取切片
env.GetSliceFrom[string](loader, "HOSTS")
env.GetSliceFrom[int64](loader, "PORTS")

// 查询
val, ok := env.Lookup("KEY")
keys := env.Keys()
all := env.All()
count := env.Len()

// 安全值
secret := env.GetSecure("PASSWORD")
if secret != nil {
    defer secret.Release()  // 或 secret.Close()
    value := secret.String()
    masked := secret.Masked()
}
```

## 键名解析

```go
// JSON: {"app": {"name": "myapp"}}
// 存储为: APP_NAME=myapp

// 以下方式都能访问
env.GetString("APP_NAME")      // 扁平化键名（推荐）
env.GetString("app.name")      // 点号路径
env.GetString("APP.NAME")      // 大写点号路径

// 数组索引
env.GetString("servers.0.host")  // SERVERS_0_HOST
```

| 输入 | 转换为 |
|------|--------|
| `"database.host"` | `"DATABASE_HOST"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |

## 结构体映射

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS" envSeparator:","`
    Ignored string   `env:"-"`
}

cfg := Config{}
env.ParseInto(&cfg)
```

## 配置预设

| 预设 | 用途 | 特点 |
|------|------|------|
| `DefaultConfig()` | 通用 | 安全默认值 |
| `DevelopmentConfig()` | 开发 | 宽松限制、支持 YAML 语法、10MB 文件上限 |
| `TestingConfig()` | 测试 | 覆盖已存在变量、测试隔离、64KB 文件上限 |
| `ProductionConfig()` | 生产 | 严格验证 + 审计、不覆盖已存在变量、64KB 文件上限 |

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT"}
```

## Loader 实例

```go
loader, _ := env.New(cfg)
defer loader.Close()

loader.LoadFiles(".env")
loader.GetString("KEY")
loader.Set("KEY", "value")
loader.Delete("KEY")
loader.Keys()
loader.All()
loader.Validate()
loader.Apply()  // 应用到 os.Environ
loader.Len()    // 变量数量
loader.LoadTime() // 最后加载时间
loader.IsApplied() // 是否已应用到系统环境
loader.IsClosed()  // 是否已关闭
loader.Config()    // 获取配置
```

## 错误处理

```go
import "errors"

// 哨兵错误
errors.Is(err, env.ErrFileNotFound)
errors.Is(err, env.ErrFileTooLarge)
errors.Is(err, env.ErrForbiddenKey)
errors.Is(err, env.ErrInvalidKey)
errors.Is(err, env.ErrClosed)
errors.Is(err, env.ErrAlreadyInitialized)

// 结构化错误
var parseErr *env.ParseError
errors.As(err, &parseErr)
// parseErr.File, parseErr.Line

var fileErr *env.FileError
errors.As(err, &fileErr)
// fileErr.Path, fileErr.Size, fileErr.Limit

var secErr *env.SecurityError
errors.As(err, &secErr)
// secErr.Action, secErr.Reason
```

## 安全工具

```go
// 敏感值
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
}

// 掩码
log.Printf("Key: %s", secret.Masked())
log.Printf("Key: %s", env.MaskValue("API_KEY", "secret"))

// 检测
env.IsSensitiveKey("PASSWORD")  // true
env.IsMemoryLockSupported()     // Linux/macOS/Windows: true

// 清理
env.ClearBytes(sensitiveData)
clean := env.SanitizeForLog(msg)

// 键名掩码
masked := env.MaskKey("DB_PASSWORD")  // "DB***"
```

## 多环境

```go
goEnv := os.Getenv("GO_ENV")
if goEnv == "" { goEnv = "development" }
env.Load(".env", ".env."+goEnv, ".env.local")  // 单次调用，后覆盖前
```

## 多格式

```go
// 加载
loader.LoadFiles("config.env", "config.json", "config.yaml")

// 检测格式
format := env.DetectFormat("config.json")  // FormatJSON

// 序列化
env.Marshal(data, env.FormatEnv)
env.Marshal(data, env.FormatJSON)
env.Marshal(data, env.FormatYAML)

// 反序列化
env.UnmarshalMap(data, env.FormatEnv)
env.UnmarshalMap(data, env.FormatAuto)  // 自动检测
```

## .env 语法

```bash
# 注释
KEY=value
KEY="value with spaces"
KEY='literal ${noexpand}'
KEY=${OTHER_KEY}           # 变量引用
KEY=${MISSING:-default}    # 默认值（变量不存在时使用）
KEY=${MISSING:=default}    # 默认值（变量不存在时使用，同 :-）
KEY=${MISSING:?error}      # 错误提示（变量不存在或为空时报错）
export KEY=value           # bash 风格
KEY=$$                     # 转义美元符号
```

## 布尔值

| 真值 | 假值 |
|------|------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

## 时间格式

```bash
TIMEOUT=30s
INTERVAL=5m
DURATION=1h30m
```

## 限制常量

| 限制项 | 默认值 | 硬性上限 |
|--------|--------|----------|
| 文件大小 | 2 MB | 100 MB |
| 行长度 | 1 KB | 64 KB |
| 键长度 | 64 | 1024 |
| 值长度 | 4 KB | 1 MB |
| 变量数 | 500 | 10000 |
| 展开深度 | 5 | 20 |

## 测试

```go
func TestExample(t *testing.T) {
    cfg := env.TestingConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    loader.Set("KEY", "value")
    // 测试...
}

func TestMain(m *testing.M) {
    if err := env.ResetDefaultLoader(); err != nil {
        log.Printf("warning: %v", err)
    }
    os.Exit(m.Run())
}
```

## 内置禁止键

以下键名默认禁止设置：

| 类别 | 键名 |
|------|------|
| 系统路径 | `PATH` |
| Linux 动态链接 | `LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_DEBUG`, `LD_AUDIT`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| 语言运行时 | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

## 接口类型

```go
// 细粒度接口
// env.EnvFileLoader    // LoadFiles
// env.EnvGetter        // GetString, Lookup, Keys, All
// env.EnvSetter        // Set, Delete
// env.EnvApplicator    // Apply
// env.EnvCloser        // Close

// 组合接口
// env.EnvLoader        // 组合以上所有
```

## 相关文档

- [快速开始](/zh/env/getting-started) - 完整教程
- [包函数](/zh/env/api-reference/functions) - 详细 API
- [Loader API](/zh/env/api-reference/loader) - Loader 方法
- [Config API](/zh/env/api-reference/config) - 配置选项
- [错误处理](/zh/env/advanced/error-handling) - 错误处理模式
