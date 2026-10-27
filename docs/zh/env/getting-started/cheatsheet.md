---
sidebar_label: "速查表"
title: "速查表 - CyberGo env | 常用 API 速查"
description: "CyberGo env 常用 API 速查表，一页汇总文件加载、类型读取、结构体映射、变量展开、验证、SecureValue 存储、Marshal/Unmarshal 序列化、哨兵错误 errors.Is 与审计日志等高频操作的核心代码片段，方便日常查阅。"
sidebar_position: 2
---

# 速查表

熟悉 env 库基本用法后，用这页查高频代码片段。

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
    defer secret.Release()     // 清零 + 解锁 + 归还对象池
    value := secret.Reveal()   // 明文值（仅在需要时使用）
    masked := secret.Masked()  // 掩码（用于日志）
}
```

`Release()` 与 `Close()` 的区别见[内存锁定 · 优先使用 Release 而非 Close](../security/memory-locking#优先使用-release-而非-close)：`Close()` 只清零解锁，不归还对象池。

## 键名解析

扁平键名、点号路径、大写点号路径三种写法等价，数组索引用 `servers.0.host` 这类路径。完整规则与转换表见[多格式配置 · 键名解析](../guides/multi-format#键名解析)。

```go
env.GetString("APP_NAME")        // 扁平化键名（推荐）
env.GetString("app.name")        // 点号路径 → APP_NAME
env.GetString("APP.NAME")        // 大写点号路径
env.GetString("servers.0.host")  // 数组索引 → SERVERS_0_HOST
```

## 结构体映射

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS"`
    Ignored string   `env:"-"`
}

cfg := Config{}
env.ParseInto(&cfg)
```

## 配置预设

| 预设 | 用途 | 特点 |
|------|------|------|
| `DefaultConfig()` | 通用 | 安全默认值 |
| `DevelopmentConfig()` | 开发 | 宽松限制、允许覆盖、支持 YAML 语法、10 MB 文件上限 |
| `TestingConfig()` | 测试 | 覆盖已存在变量、测试隔离、64 KB 文件上限 |
| `ProductionConfig()` | 生产 | 严格验证 + 审计、不覆盖已存在变量、64 KB 文件上限 |

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT"}
```

## Loader 实例

```go
loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)  // 创建失败（如配置非法）时终止
}
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
errors.Is(err, env.ErrSecurityViolation)  // 禁止键（实际返回 *SecurityError）
errors.Is(err, env.ErrClosed)
errors.Is(err, env.ErrAlreadyInitialized)

// 键格式非法：实际返回 *ValidationError，Field=="key"
var keyErr *env.ValidationError
if errors.As(err, &keyErr) && keyErr.Field == "key" {
    // 无效键格式：keyErr.Message
}

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
env.IsMemoryLockSupported()     // linux/darwin/Windows 为 true，其他平台为 false

// 清理
env.ClearBytes(sensitiveData)
clean := env.SanitizeForLog(msg)

// 键名掩码
masked := env.MaskKey("DB_PASSWORD")  // "[MASKED]"
```

## 多环境

```go
goEnv := os.Getenv("GO_ENV")
if goEnv == "" { goEnv = "development" }
// 默认（DefaultConfig）同名键以先加载的文件为准；要后者覆盖前者，
// 改用 LoadWithConfig 并设 cfg.OverwriteExisting = true
env.Load(".env", ".env."+goEnv, ".env.local")
```

## 多格式

```go
// 加载
loader.LoadFiles("config.env", "config.json", "config.yaml")

// 检测格式
format := env.DetectFormat("config.json")  // FormatJSON

// 序列化
env.Marshal(data, env.FormatEnv)   // 值按需加引号与转义
env.Marshal(data, env.FormatJSON)
env.Marshal(data, env.FormatYAML)

// 反序列化
env.UnmarshalMap(data, env.FormatEnv)
env.UnmarshalMap(data, env.FormatAuto)  // 按内容自动检测
```

## .env 语法

```bash
# 注释
KEY=value
KEY="value with spaces"
KEY='literal \n value'     # 单引号不处理转义，值也不参与变量展开
KEY=${OTHER_KEY}           # 变量引用
KEY=${MISSING:-default}    # 默认值（变量未定义时使用）
KEY=${MISSING:=default}    # 默认值并写回变量（变量未定义时使用）
KEY=${MISSING:?error}      # 变量未定义或为空时报错
export KEY=value           # bash 风格
KEY=$$                     # 转义美元符号（得到字面量 $）
```

::: tip 变量展开与字面量 $
单引号**阻止**变量展开：`KEY='a ${UNDEF}'` 的值就是字面文本 `a ${UNDEF}`。需要字面量 `$` 而使用双引号或无引号时，用 `$$` 转义，或设置 `cfg.ExpandVariables = false` 全局关闭展开。完整规则参见[文件格式](../reference/file-format)。

`KEY: value` 形式的行默认被跳过并记审计，只有 `=` 是分隔符；启用 `cfg.AllowYamlSyntax = true` 后 `:` 才可作为分隔符。
:::

## 布尔值

真值为 `true`/`1`/`yes`/`on`/`enabled`，假值为 `false`/`0`/`no`/`off`/`disabled`，均不区分大小写。

值为空串时解析为 `false`（不取默认值），无法识别的值记审计并返回默认值。完整对照见[常见问题 · 支持哪些布尔值格式](../reference/faq#支持哪些布尔值格式)。

## 时间格式

```bash
TIMEOUT=30s
INTERVAL=5m
DURATION=1h30m
```

## 限制常量

| 限制项 | 默认值 | 硬性上限 |
|--------|--------|----------|
| 文件大小 | 8 MB | 100 MB |
| 行长度 | 8 KB | 64 KB |
| 键长度 | 128 | 1024 |
| 值长度 | 8 KB | 1 MB |
| 变量数 | 1000 | 10000 |
| 展开深度 | 5 | 20 |

## 测试

- 每个测试用 `env.TestingConfig()` 新建独立 Loader，并清空 `Filenames` 避免隐式加载 cwd 的 `.env`。
- 需要清理包级单例时，在 TestMain 里检查 `env.ResetDefaultLoader()` 的返回错误。

```go
cfg := env.TestingConfig()
cfg.Filenames = nil
loader, _ := env.New(cfg)
defer loader.Close()
```

完整的 TestMain 模板与进程变量清理见[测试场景 · 清理测试状态](../guides/testing#清理测试状态)，内存文件系统见[测试场景 · 模拟文件系统](../guides/testing#模拟文件系统)。

## 内置禁止键

以下键名默认禁止设置：

| 类别 | 键名 |
|------|------|
| 系统路径 | `PATH` |
| Linux 动态链接 | `LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_DEBUG`, `LD_AUDIT`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS`, `PS4`, `SHELLOPTS`, `BASHOPTS` |
| 语言运行时 | `PYTHONPATH`, `PYTHONSTARTUP`, `PYTHONINSPECT`, `PERL5OPT`, `PERL5LIB`, `RUBYLIB`, `RUBYOPT`, `GEM_PATH`, `GEM_HOME`, `NODE_PATH`, `NODE_OPTIONS`, `RUSTFLAGS`, `JAVA_TOOL_OPTIONS`, `JDK_JAVA_OPTIONS`, `_JAVA_OPTIONS`, `CLASSPATH` |
| Git | `GIT_CONFIG_COUNT`, `GIT_PROXY_COMMAND` |
| Windows | `COMSPEC`, `PATHEXT`, `SYSTEMROOT`, `WINDIR` |

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

- [快速开始](./) - 完整教程
- [包函数](../api-reference/functions) - 详细 API
- [Loader API](../api-reference/loader) - Loader 方法
- [Config API](../api-reference/config) - 配置选项
- [错误处理](../guides/error-handling) - 错误处理模式
