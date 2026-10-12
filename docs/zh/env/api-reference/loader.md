---
sidebar_label: "Loader"
title: "Loader API - CyberGo env | 加载器详解"
description: "CyberGo env Loader 加载器 API 参考，提供多格式 LoadFiles 加载、GetString/GetInt/GetSlice 类型安全读取、Set/Delete 增删改、Validate 验证、序列化导出与 Close 生命周期，所有方法线程安全。"
sidebar_position: 3
---

# Loader API

`Loader` 类型的完整方法参考。Loader 是 env 库的核心类型，提供环境变量的加载、存储和访问功能。

::: tip 线程安全
Loader 的所有方法都是线程安全的，可在多个 goroutine 中并发调用。
:::

## 类型定义

```go
type Loader struct {
    // 包含私有字段
}

// 编译时检查接口实现
var _ EnvLoader = (*Loader)(nil)
var _ io.Closer = (*Loader)(nil)
```

---

## 创建

### New

```go
func New(cfg ...Config) (*Loader, error)
```

创建新的加载器实例。

**参数：**
- `cfg` - 可选配置选项。不提供或传入零值 Config 时，自动使用 `DefaultConfig()`

**返回：**
- `*Loader` - 加载器实例
- `error` - 配置验证错误

**行为：**
- 验证配置有效性
- 创建内部组件（验证器、审计器、展开器）
- 如果 `cfg.Filenames` 非空，自动加载文件
- 如果 `cfg.AutoApply` 为 true，自动应用到系统环境

```go
// 使用默认配置
loader, err := env.New()

// 使用自定义配置
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env"}
cfg.AutoApply = true
loader, err := env.New(cfg)

if err != nil {
    panic(err)
}
defer loader.Close()
```

---

## 文件加载

### LoadFiles

```go
func (l *Loader) LoadFiles(filenames ...string) error
```

加载一个或多个配置文件。

**参数：**
- `filenames` - 文件路径列表，为空时默认加载 `.env`

**返回：**
- `error` - 加载错误

**行为：**
- 按顺序加载；默认（`OverwriteExisting=false`）**先加载的文件优先**，后加载文件中的同名键被跳过；`OverwriteExisting=true` 时后加载覆盖先加载的（Dev/Testing 预设内置）
- 自动检测文件格式（.env、JSON、YAML）
- 根据 `FailOnMissingFile` 配置决定文件不存在时的行为
- 如果 `AutoApply` 为 true，加载后自动应用

```go
// 加载默认 .env 文件
err := loader.LoadFiles()

// 加载指定文件
err := loader.LoadFiles(".env", ".env.local")

// 混合格式
err := loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

**错误类型：**
- `ErrFileNotFound` - 文件不存在（当 `FailOnMissingFile=true`）
- `ErrFileTooLarge` - 文件超过大小限制
- `ErrClosed` - 加载器已关闭
- `*ParseError` - 解析错误
- `*JSONError` - JSON 解析错误
- `*YAMLError` - YAML 解析错误
- `*SecurityError` - 文件路径安全校验失败（如路径穿越攻击）

**格式检测规则：**

| 扩展名 | 格式 |
|--------|------|
| `.env` | FormatEnv |
| `.json` | FormatJSON |
| `.yaml`, `.yml` | FormatYAML |
| 其他 | FormatAuto（使用 .env 解析器） |

---

## 获取值

### 键名解析

所有获取方法都支持智能键名解析：

| 输入键名 | 解析结果 |
|----------|----------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"`（精确匹配） |
| `"database.host"` | `"DATABASE_HOST"`（点号转下划线） |
| `"app.name"` | `"APP_NAME"`（大写 + 下划线） |
| `"servers.0.host"` | `"SERVERS_0_HOST"`（数组索引） |

**解析顺序：**
1. 精确匹配 - 直接查找键名
2. 大写转换 - 简单键尝试大写版本
3. 路径解析 - 点号路径转换为下划线格式
4. 索引回退 - 索引访问时回退到逗号分隔值

---

### GetString

```go
func (l *Loader) GetString(key string, defaultValue ...string) string
```

获取字符串值。支持点号路径解析。

**参数：**
- `key` - 键名（支持精确匹配、大写转换、点号路径）
- `defaultValue` - 可选默认值

**返回：**
- `string` - 值或默认值（未找到且无默认值时返回空字符串）

```go
// 基本用法
host := loader.GetString("HOST", "localhost")

// 点号路径访问（JSON/YAML 嵌套结构）
dbHost := loader.GetString("database.host", "localhost")
appName := loader.GetString("app.name")

// 无默认值时返回空字符串
value := loader.GetString("NON_EXISTENT")  // ""
```

---

### GetInt

```go
func (l *Loader) GetInt(key string, defaultValue ...int64) int64
```

获取整数值。支持点号路径解析。

**参数：**
- `key` - 键名（支持点号路径）
- `defaultValue` - 可选默认值，类型为 `int64`

**返回：**
- `int64` - 值或默认值（未找到且无默认值时返回 0）

```go
port := loader.GetInt("PORT", 8080)
maxConn := loader.GetInt("database.max_connections", 10)

// 无默认值时返回 0
value := loader.GetInt("NON_EXISTENT")  // 0
```

---

### GetBool

```go
func (l *Loader) GetBool(key string, defaultValue ...bool) bool
```

获取布尔值。支持点号路径解析。

**参数：**
- `key` - 键名（支持点号路径）
- `defaultValue` - 可选默认值

**返回：**
- `bool` - 值或默认值（未找到且无默认值时返回 false）

**支持的值：**
- 真值：`true`, `1`, `yes`, `on`, `enabled`
- 假值：`false`, `0`, `no`, `off`, `disabled`

```go
debug := loader.GetBool("DEBUG", false)
cacheEnabled := loader.GetBool("cache.enabled", true)

// 无默认值时返回 false
value := loader.GetBool("NON_EXISTENT")  // false
```

---

### GetUint64

```go
func (l *Loader) GetUint64(key string, defaultValue ...uint64) uint64
```

获取无符号整数值。支持点号路径解析。

**参数：**
- `key` - 键名（支持点号路径）
- `defaultValue` - 可选默认值，类型为 `uint64`

**返回：**
- `uint64` - 值或默认值（未找到且无默认值时返回 0）

```go
port := loader.GetUint64("PORT", 8080)
maxSize := loader.GetUint64("MAX_SIZE", 1024)

// 无默认值时返回 0
value := loader.GetUint64("NON_EXISTENT")  // 0
```

---

### GetFloat64

```go
func (l *Loader) GetFloat64(key string, defaultValue ...float64) float64
```

获取浮点数值。支持点号路径解析。

**参数：**
- `key` - 键名（支持点号路径）
- `defaultValue` - 可选默认值，类型为 `float64`

**返回：**
- `float64` - 值或默认值（未找到且无默认值时返回 0）

```go
rate := loader.GetFloat64("RATE", 0.5)
threshold := loader.GetFloat64("THRESHOLD")

// 无默认值时返回 0
value := loader.GetFloat64("NON_EXISTENT")  // 0
```

---

### GetDuration

```go
func (l *Loader) GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

获取时间间隔值。支持点号路径解析。

**参数：**
- `key` - 键名（支持点号路径）
- `defaultValue` - 可选默认值

**返回：**
- `time.Duration` - 值或默认值（未找到且无默认值时返回 0）

**支持格式：** `ns`, `us`, `ms`, `s`, `m`, `h`（如 `30s`, `5m`, `1h30m`）

```go
timeout := loader.GetDuration("TIMEOUT", 30*time.Second)
ttl := loader.GetDuration("cache.ttl", 5*time.Minute)

// 无默认值时返回 0
value := loader.GetDuration("NON_EXISTENT")  // 0
```

---

### GetSecure

```go
func (l *Loader) GetSecure(key string) *SecureValue
```

获取安全值（敏感数据保护）。

**参数：**
- `key` - 键名

**返回：**
- `*SecureValue` - 安全值的**防御性副本**，调用者负责释放；键不存在或加载器关闭时返回 nil

```go
secret := loader.GetSecure("API_SECRET")
if secret != nil {
    defer secret.Release()

    value := secret.Reveal()   // 明文值
    masked := secret.Masked()  // [SECURE:32 bytes]
}
```

::: warning 重要
使用后必须调用 `Release()` 或 `Close()` 释放资源。
:::

::: tip 防御性副本
`GetSecure` 返回的是原始值的副本，独立于父 Loader。调用者负责调用 `Release()` 或 `Close()` 释放。
:::

::: tip 详见
[SecureValue API](./secure-value) 获取完整文档。
:::

---

### 获取切片值

Loader 没有提供切片获取方法（Go 不支持泛型方法）。使用独立的泛型函数 `GetSliceFrom[T]` 从 Loader 实例获取切片：

```go
// 使用独立泛型函数
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})
portsInt := env.GetSliceFrom[int](loader, "PORTS")  // 也支持 int
```

**支持的类型：** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

::: tip 详见
[包函数 - GetSliceFrom](./functions#getslicefrom-t) 获取完整文档。
:::

---

### Lookup

```go
func (l *Loader) Lookup(key string) (string, bool)
```

检查键是否存在并获取值。支持点号路径解析。

**参数：**
- `key` - 键名（支持点号路径）

**返回：**
- `string` - 值（返回存储原值，不做 trim：`.env` 值在解析期已去除首尾空白，JSON/YAML 值可能保留空白）
- `bool` - 是否存在

```go
value, exists := loader.Lookup("API_KEY")
if !exists {
    // 键不存在
}

// 点号路径
if value, exists := loader.Lookup("database.host"); exists {
    fmt.Println(value)
}

// 索引访问（回退到逗号分隔值）
// HOSTS=localhost,example.com
if value, exists := loader.Lookup("hosts.0"); exists {
    fmt.Println(value)  // "localhost"
}
```

---

## 设置和删除

### Set

```go
func (l *Loader) Set(key, value string) error
```

设置环境变量。

**参数：**
- `key` - 键名
- `value` - 值

**返回：**
- `error` - 设置错误

**行为：**
- 验证键名有效性
- 如果 `ValidateValues` 为 true，验证值安全性
- 如果 `OverwriteExisting` 为 false 且键已存在，跳过（返回 nil）
- 如果 `AutoApply` 为 true，同时设置到系统环境

```go
err := loader.Set("CUSTOM_KEY", "value")
if err != nil {
    // 处理错误
}
```

**错误类型：**
- `*ValidationError` - 键名格式无效（Field="key"）
- `*SecurityError` - 键被禁止（可用 `errors.Is(err, env.ErrSecurityViolation)` 匹配）
- `ErrInvalidValue` - 值无效（当 `ValidateValues` 为 true 时，值包含空字节、控制字符等不安全内容）
- `ErrClosed` - 加载器已关闭

---

### Delete

```go
func (l *Loader) Delete(key string) error
```

删除环境变量。

**参数：**
- `key` - 键名

**返回：**
- `error` - 删除错误

**行为：**
- 如果变量已应用到系统环境，同时从系统环境删除

```go
err := loader.Delete("TEMP_KEY")
if err != nil {
    panic(err)
}
```

---

## 集合操作

### Keys

```go
func (l *Loader) Keys() []string
```

获取所有键名。

**返回：**
- `[]string` - 键名列表，加载器已关闭返回 nil

```go
keys := loader.Keys()
for _, key := range keys {
    fmt.Println(key)
}
```

---

### All

```go
func (l *Loader) All() map[string]string
```

获取所有键值对。

**返回：**
- `map[string]string` - 键值映射，加载器已关闭返回 nil

```go
all := loader.All()
for key, value := range all {
    fmt.Printf("%s=%s\n", key, value)
}
```

---

### Len

```go
func (l *Loader) Len() int
```

获取变量数量。

**返回：**
- `int` - 变量数量，加载器已关闭返回 0

```go
count := loader.Len()
fmt.Printf("已加载 %d 个变量\n", count)
```

---

## 应用到系统

### Apply

```go
func (l *Loader) Apply() error
```

将变量应用到系统环境（`os.Environ`）。

**返回：**
- `error` - 应用错误

**行为：**
- 遍历所有加载的变量
- 根据 `OverwriteExisting` 配置决定是否覆盖已存在的系统环境变量
- 应用后可通过 `os.Getenv()` 访问

**错误类型：**
- `ErrClosed` - 加载器已关闭
- 包装的 `os` 错误 - 设置环境变量失败（键名已掩码，错误消息中不暴露敏感键名）

```go
err := loader.Apply()
if err != nil {
    panic(err)
}

// 之后 os.Getenv() 也能访问
host := os.Getenv("HOST")
```

---

### IsApplied

```go
func (l *Loader) IsApplied() bool
```

检查变量是否已应用到系统环境。

**返回：**
- `bool` - 是否已应用

```go
if loader.IsApplied() {
    // 变量已应用到 os.Environ
}
```

---

## 状态查询

### LoadTime

```go
func (l *Loader) LoadTime() time.Time
```

返回最后一次加载文件的时间。

**返回：**
- `time.Time` - 加载时间，未加载返回零值

```go
loadTime := loader.LoadTime()
if !loadTime.IsZero() {
    fmt.Printf("最后加载时间: %v\n", loadTime)
}
```

---

### Config

```go
func (l *Loader) Config() Config
```

返回加载器的配置。

**返回：**
- `Config` - 配置（应视为只读）

::: warning 注意
`Config()` 返回配置**副本**供只读：值字段已拷贝隔离，但 `KeyPattern`、`FileSystem`、`AuditHandler` 等指针/接口字段（以及 `AllowedKeys`、`RequiredKeys` 等切片字段）与运行中的 loader **共享底层对象**，修改会影响 loader 行为，勿改。如需安全的可变副本，请手动复制所需字段。
:::

```go
cfg := loader.Config()
fmt.Printf("最大文件大小：%d\n", cfg.MaxFileSize)
```

---

## 验证与映射

### Validate

```go
func (l *Loader) Validate() error
```

验证必需键是否存在。

**返回：**
- `error` - 验证错误

**行为：**
- 检查 `ValidationConfig.RequiredKeys` 中指定的所有键是否存在

```go
cfg := env.DefaultConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

if err := loader.Validate(); err != nil {
    // 缺少必需键
    var missingErr *env.ValidationError
    if errors.As(err, &missingErr) {
        fmt.Printf("缺少: %s\n", missingErr.Field)
    }
}
```

---

### ParseInto

```go
func (l *Loader) ParseInto(v any) error
```

将环境变量映射到结构体。

**参数：**
- `v` - 结构体指针

**返回：**
- `error` - 映射错误

**支持的标签：**
- `env:"KEY"` - 指定环境变量名
- `env:"-"` - 忽略此字段
- `envDefault:"value"` - 指定默认值

切片字段默认按逗号 `,` 分隔（分隔符前后空格自动去除），无自定义分隔符标签。

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS"`
    Ignored string   `env:"-"`
}

var cfg Config
err := loader.ParseInto(&cfg)
if err != nil {
    panic(err)
}
```

---

## 资源释放

### Close

```go
func (l *Loader) Close() error
```

释放资源并清空存储。

**返回：**
- `error` - 关闭错误

**行为：**
- 安全清零所有存储的敏感数据
- 如果加载器拥有 ComponentFactory，同时关闭工厂
- 安全关闭，多次调用返回 nil

```go
loader, _ := env.New(cfg)
defer loader.Close()

// 使用 loader...
```

::: warning 关闭后行为
关闭后所有操作将返回错误或零值：
- `LoadFiles` → `ErrClosed`
- `GetString` → 返回空值
- `Set` → `ErrClosed`
- `Keys` → 返回 nil
- `Len` → 返回 0
:::

---

### IsClosed

```go
func (l *Loader) IsClosed() bool
```

检查加载器是否已关闭。

**返回：**
- `bool` - 是否已关闭

```go
if loader.IsClosed() {
    // 加载器已关闭
}
```

---

## 完整示例

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/cybergodev/env"
)

func main() {
	// 创建生产环境配置
	cfg := env.ProductionConfig()
	cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
	cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

	// 创建加载器
	loader, err := env.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer loader.Close()

	// 加载文件
	if err := loader.LoadFiles(".env", ".env.production"); err != nil {
		if errors.Is(err, env.ErrFileNotFound) {
			log.Fatal("配置文件不存在")
		}
		log.Fatal(err)
	}

	// 验证必需键
	if err := loader.Validate(); err != nil {
		log.Fatal("缺少必需配置：", err)
	}

	// 读取配置
	host := loader.GetString("DB_HOST")
	port := loader.GetInt("DB_PORT", 5432)
	debug := loader.GetBool("DEBUG", false)
	timeout := loader.GetDuration("TIMEOUT", 30*time.Second)

	fmt.Printf("Server: %s:%d\n", host, port)
	fmt.Printf("Debug: %v, Timeout: %v\n", debug, timeout)

	// 敏感数据
	secret := loader.GetSecure("API_KEY")
	if secret != nil {
		defer secret.Release()
		fmt.Printf("API Key length: %d\n", secret.Length())
	}

	// 应用到系统环境
	if err := loader.Apply(); err != nil {
		log.Fatal(err)
	}

	// 所有变量
	fmt.Printf("Loaded %d variables\n", loader.Len())
	fmt.Printf("Load time: %v\n", loader.LoadTime())
}
```

## 生命周期与进程环境语义

### Close 不会回滚 os.Environ

`Close()` 只清零**内存中的**变量副本，**不会**取消此前通过 `Apply`、`AutoApply` 或（`AutoApply` 开启时的）`Set` 写入进程环境的变量。若需要在关闭前从进程环境移除，先逐键调用 `Delete`：

<!-- check-code: skip -->
```go
loader.Delete("API_KEY") // 仅当该键由本 loader 写入进程环境时才会 unset
loader.Close()
```

### Delete 的逐键归属跟踪

Loader 记录**自己**写入进程环境的键（`appliedKeys`）。`Delete` 只 unset 这些键，**绝不触碰**非本 loader 设置的进程变量（`HOME`、`TERM` 等）。这保证了多 Loader 场景下互不干扰。

### Apply 区分「未设置」与「显式空值」

`Apply` 使用 `LookupEnv` 判断进程环境已有值：显式设置为空字符串的变量被视为「已存在」，在 `OverwriteExisting=false` 时同样会被跳过——不会误判为未设置而覆盖。

### 状态与元数据方法

| 方法 | 说明 |
|------|------|
| `Config()` | 返回配置副本供只读；值字段已拷贝，但 `KeyPattern`、`FileSystem`、`AuditHandler` 等指针/接口字段共享底层对象，修改会影响运行中的 loader |
| `IsClosed()` | loader 是否已关闭（nil receiver 返回 true） |
| `IsApplied()` | 变量是否已应用到 os.Environ |
| `LoadTime()` | 最近一次加载完成的时间（未加载过返回零值） |

### 读取路径的键名解析细节

- **精确匹配优先**：先按原键查找，未命中时尝试大写形式回退
- **点号路径**：`database.host` 展开为 `DATABASE_HOST`（JSON/YAML 扁平化键）；索引路径 `service.cors.origins.0` 未命中时回退到逗号分隔值
- **不做 trim**：`Lookup` 返回存储原值——`.env` 值在解析期已 trim，JSON/YAML 值可能保留首尾空白
- **无锁快路径**：单键读取（`Lookup`/`GetSecure`）通过原子闭态标志绕过 loader 级读锁，高并发下避免读锁计数成为瓶颈；与 `Close` 竞争时表现为「读到值或读到清空后状态」的优雅降级

### Set 的静默跳过语义

`OverwriteExisting=false` 时对已存在键调用 `Set` **静默跳过并返回 nil**（不报错）。需要感知跳过时，可通过审计日志（`skipped (no overwrite)` 事件）观察。

### 文件加载的纵深防御（TOCTOU）

加载文件时在 `Stat()` 大小检查与实际读取之间存在理论上的替换窗口，库通过两层机制兜底：解析器在内部以强制大小上限的加固读取路径包装文件流；即使文件在检查后增长，也会在硬性上限（100 MB）处截断，防止内存耗尽。

## 相关文档

- [包函数](./functions) - 包级便捷函数
- [Config API](./config) - 配置选项
- [SecureValue API](./secure-value) - 安全值处理
- [接口定义](./interfaces) - 所有接口定义
