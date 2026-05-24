---
title: "包函数 - CyberGo env | 全局便捷函数"
description: "CyberGo env 库包级便捷函数 API 完整参考文档，提供 Load 加载文件、GetString 和 GetInt 按类型读取值、Keys 查询键名、Marshal 序列化导出和 ParseInto 结构体映射等简洁 API，基于全局默认 Loader 实现，采用懒加载初始化和线程安全设计。"
---

# 包函数

包级便捷函数提供简洁的 API，适合大多数使用场景。这些函数使用全局默认加载器，所有函数都是线程安全的。

::: tip 懒加载
全局默认加载器采用懒加载机制，首次调用时自动创建。
:::

## 加载函数

### Load

```go
func Load(filenames ...string) error
```

加载环境变量文件并应用到系统环境。

**参数：**
- `filenames` - 文件路径列表。未提供时不加载任何文件，需显式传入 `".env"` 来加载默认文件。

**返回：**
- `error` - 加载错误

**行为：**
- 创建新的 Loader 实例并设为默认加载器
- 自动应用到系统环境（`os.Environ`）
- 后加载的文件覆盖先加载的
- 返回 `ErrAlreadyInitialized` 如果默认加载器已初始化
- 支持多格式（.env、JSON、YAML）

```go
// 加载 .env 文件
if err := env.Load(".env"); err != nil {
    log.Fatal(err)
}

// 加载指定文件（按顺序，后覆盖前）
if err := env.Load(".env", ".env.local", "config.json"); err != nil {
    log.Fatal(err)
}

// JSON/YAML 嵌套结构支持点号访问
// config.json: {"database": {"host": "localhost", "port": 5432}}
env.Load("config.json")
host := env.GetString("database.host") // "localhost"
port := env.GetInt("database.port")    // 5432
```

---

## 键名解析

所有获取函数都支持智能键名解析，提供灵活的访问方式。

### 解析规则

**1. 精确匹配（优先）**
```go
// .env: APP_NAME=myapp
name := env.GetString("APP_NAME")  // "myapp"
```

**2. 大写转换（简单键）**
```go
// 对于不含点号的键，自动尝试大写版本
name := env.GetString("app_name")  // 查找 app_name -> APP_NAME
```

**3. 点号路径解析（嵌套键）**
```go
// JSON: {"app": {"name": "myapp"}}
// 存储为: APP_NAME=myapp

// 以下方式都能访问到该值
name := env.GetString("APP_NAME")   // 扁平化键名（推荐）
name := env.GetString("app.name")   // 点号路径（自动转换）
name := env.GetString("APP.NAME")   // 大写点号路径
```

### 路径转换表

| 输入键名 | 存储键名 |
|----------|----------|
| `"database.host"` | `"DATABASE_HOST"` |
| `"db.port"` | `"DB_PORT"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |

### 索引访问

数组元素可通过索引访问，或回退到逗号分隔值：

```go
// JSON: {"servers": [{"host": "a.com"}, {"host": "b.com"}]}
// 存储为: SERVERS_0_HOST=a.com, SERVERS_1_HOST=b.com

host0 := env.GetString("servers.0.host")  // "a.com"
host1 := env.GetString("servers.1.host")  // "b.com"

// 如果键不存在但存在逗号分隔的基础值
// HOSTS=localhost,example.com
host0 := env.GetString("hosts.0")  // "localhost" (从逗号分隔值解析)
```

---

## 获取值函数

### GetString

```go
func GetString(key string, defaultValue ...string) string
```

获取字符串值。支持点号路径解析。

**参数：**
- `key` - 键名（支持精确匹配、大写转换、点号路径）
- `defaultValue` - 可选默认值

**返回：**
- `string` - 值或默认值（未找到且无默认值时返回空字符串）

```go
// 基本用法
host := env.GetString("HOST", "localhost")

// 点号路径访问（JSON/YAML 嵌套结构）
dbHost := env.GetString("database.host", "localhost")
appName := env.GetString("app.name")

// 无默认值时返回空字符串
value := env.GetString("NON_EXISTENT")  // ""
```

---

### GetInt

```go
func GetInt(key string, defaultValue ...int64) int64
```

获取整数值。自动转换字符串为整数。支持点号路径解析。

**参数：**
- `key` - 键名（支持点号路径）
- `defaultValue` - 可选默认值，类型为 `int64`

**返回：**
- `int64` - 值或默认值（未找到且无默认值时返回 0）

```go
port := env.GetInt("PORT", 8080)
maxConn := env.GetInt("database.max_connections", 10)

// 无默认值时返回 0
value := env.GetInt("NON_EXISTENT")  // 0
```

---

### GetBool

```go
func GetBool(key string, defaultValue ...bool) bool
```

获取布尔值。支持点号路径解析。

- **真值（不区分大小写）：** `true`, `1`, `yes`, `on`, `enabled`
- **假值（不区分大小写）：** `false`, `0`, `no`, `off`, `disabled`

**参数：**
- `key` - 键名（支持点号路径）
- `defaultValue` - 可选默认值

**返回：**
- `bool` - 值或默认值（未找到且无默认值时返回 false）

```go
debug := env.GetBool("DEBUG", false)
cacheEnabled := env.GetBool("cache.enabled", true)

// 无默认值时返回 false
value := env.GetBool("NON_EXISTENT")  // false
```

---

### GetUint64

```go
func GetUint64(key string, defaultValue ...uint64) uint64
```

获取无符号整数值。支持点号路径解析。

**参数：**
- `key` - 键名（支持点号路径）
- `defaultValue` - 可选默认值，类型为 `uint64`

**返回：**
- `uint64` - 值或默认值（未找到且无默认值时返回 0）

```go
port := env.GetUint64("PORT", 8080)
maxSize := env.GetUint64("MAX_SIZE", 1024)

// 无默认值时返回 0
value := env.GetUint64("NON_EXISTENT")  // 0
```

---

### GetFloat64

```go
func GetFloat64(key string, defaultValue ...float64) float64
```

获取浮点数值。支持点号路径解析。

**参数：**
- `key` - 键名（支持点号路径）
- `defaultValue` - 可选默认值，类型为 `float64`

**返回：**
- `float64` - 值或默认值（未找到且无默认值时返回 0）

```go
rate := env.GetFloat64("RATE", 0.5)
threshold := env.GetFloat64("THRESHOLD")

// 无默认值时返回 0
value := env.GetFloat64("NON_EXISTENT")  // 0
```

---

### GetDuration

```go
func GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

获取时间间隔值。支持点号路径解析。

**支持的格式：**
- `300ms` - 毫秒
- `1.5s` - 秒
- `2m30s` - 分钟 + 秒
- `1h30m` - 小时 + 分钟

**参数：**
- `key` - 键名（支持点号路径）
- `defaultValue` - 可选默认值

**返回：**
- `time.Duration` - 值或默认值（未找到且无默认值时返回 0）

```go
timeout := env.GetDuration("TIMEOUT", 30*time.Second)
interval := env.GetDuration("INTERVAL", 5*time.Minute)

// 无默认值时返回 0
value := env.GetDuration("NON_EXISTENT")  // 0
```

---

### GetSecure

```go
func GetSecure(key string) *SecureValue
```

获取安全值（用于敏感数据）。

**参数：**
- `key` - 键名

**返回：**
- `*SecureValue` - 安全值包装器，键不存在或加载器不可用返回 nil

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    value := secret.String()
    masked := secret.Masked()  // 用于日志: [SECURE:32 bytes]
}
```

::: warning 重要
使用后必须调用 `Release()` 或 `Close()` 释放资源。推荐使用 `defer` 确保释放。
:::

::: tip 详见
[SecureValue API](/zh/env/api-reference/secure-value) 获取完整 API 文档。
:::

---

### GetSlice[T]

```go
func GetSlice[T sliceElement](key string, defaultValue ...[]T) []T
```

泛型函数，获取切片值。

**支持的类型：** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

**注意：** 这是一个泛型函数，不是 Loader 的方法。如需从指定 Loader 实例获取切片，使用 `GetSliceFrom[T]`。

**解析顺序：**
1. 优先查找索引键 `KEY_0`, `KEY_1`, `KEY_2`...
2. 若无索引键，则按逗号分隔解析 `KEY` 的值
3. 支持点号路径解析

**参数：**
- `key` - 键名
- `defaultValue` - 可选默认值

**返回：**
- `[]T` - 切片值

```go
// 索引键格式（推荐）
// HOSTS_0=localhost
// HOSTS_1=example.com
hosts := env.GetSlice[string]("HOSTS")  // ["localhost", "example.com"]

// 逗号分隔格式
// PORTS=80,443,8080
ports := env.GetSlice[int64]("PORTS", []int64{80})  // [80, 443, 8080]

// 浮点数切片
rates := env.GetSlice[float64]("RATES", []float64{0.1, 0.2})

// 布尔切片
flags := env.GetSlice[bool]("FLAGS")

// Duration 切片
timeouts := env.GetSlice[time.Duration]("TIMEOUTS")

// 无符号整数切片
ports := env.GetSlice[uint]("PORTS")
port64s := env.GetSlice[uint64]("PORTS")

// int 类型
portInts := env.GetSlice[int]("PORTS")

// 无默认值时返回 nil
value := env.GetSlice[string]("NON_EXISTENT")  // nil
```

---

### GetSliceFrom[T]

```go
func GetSliceFrom[T sliceElement](loader *Loader, key string, defaultValue ...[]T) []T
```

从指定 Loader 实例获取切片值。这是独立的泛型函数（不是 Loader 方法）。

**参数：**
- `loader` - Loader 实例指针（如果为 nil，返回默认值）
- `key` - 键名
- `defaultValue` - 可选默认值

**返回：**
- `[]T` - 切片值

**支持的类型：** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

```go
loader, _ := env.New(cfg)
defer loader.Close()

// 从 loader 实例获取切片
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})

// 也支持 int、uint、uint64 类型
portsInt := env.GetSliceFrom[int](loader, "PORTS")
portsUint := env.GetSliceFrom[uint](loader, "PORTS")
portsUint64 := env.GetSliceFrom[uint64](loader, "PORTS")
```

::: tip 区别
- `GetSlice[T]` - 使用默认加载器的包级函数
- `GetSliceFrom[T]` - 指定 Loader 实例的泛型函数（Go 不支持泛型方法）
:::

---

## 查询函数

### Lookup

```go
func Lookup(key string) (string, bool)
```

检查键是否存在并获取值。支持点号路径解析。

**参数：**
- `key` - 键名（支持点号路径）

**返回：**
- `string` - 值（首尾空白已移除）
- `bool` - 是否存在

```go
value, exists := env.Lookup("API_KEY")
if !exists {
    // 键不存在
}

// 点号路径
if value, exists := env.Lookup("database.host"); exists {
    fmt.Println(value)
}
```

---

### Keys

```go
func Keys() []string
```

获取所有键名。

**返回：**
- `[]string` - 键名列表，加载器不可用时返回 nil

```go
keys := env.Keys()
for _, key := range keys {
    fmt.Println(key)
}
```

---

### All

```go
func All() map[string]string
```

获取所有键值对。

**返回：**
- `map[string]string` - 键值映射，加载器不可用时返回 nil

```go
all := env.All()
for key, value := range all {
    fmt.Printf("%s=%s\n", key, value)
}
```

---

### Len

```go
func Len() int
```

获取变量数量。

**返回：**
- `int` - 变量数量，加载器不可用时返回 0

```go
count := env.Len()
fmt.Printf("已加载 %d 个环境变量\n", count)
```

---

## 设置和删除

### Set

```go
func Set(key, value string) error
```

设置环境变量。

**参数：**
- `key` - 键名
- `value` - 值

**返回：**
- `error` - 设置错误

**错误类型：**
- `ErrInvalidKey` - 键名无效
- `ErrForbiddenKey` - 键被禁止
- `ErrClosed` - 加载器已关闭

```go
if err := env.Set("CUSTOM_KEY", "value"); err != nil {
    // 可能是 ErrForbiddenKey 或 ErrInvalidKey
}
```

---

### Delete

```go
func Delete(key string) error
```

删除环境变量。

**参数：**
- `key` - 键名

**返回：**
- `error` - 删除错误

```go
if err := env.Delete("TEMP_KEY"); err != nil {
    panic(err)
}
```

---

## 验证和映射

### Validate

```go
func Validate() error
```

验证必需键是否存在。需要在 Config 中设置 RequiredKeys。

**返回：**
- `error` - 验证错误

```go
// 需要先配置 RequiredKeys（通过自定义加载器）
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

if err := loader.Validate(); err != nil {
    // 缺少必需键
}
```

---

### ParseInto

```go
func ParseInto(v any) error
```

将环境变量映射到结构体。

**参数：**
- `v` - 结构体指针

**返回：**
- `error` - 映射错误

```go
type Config struct {
    Host string `env:"HOST" envDefault:"localhost"`
    Port int64  `env:"PORT" envDefault:"8080"`
}

var cfg Config
if err := env.ParseInto(&cfg); err != nil {
    panic(err)
}
```

**结构体标签：**
| 标签 | 说明 |
|------|------|
| `env:"KEY"` | 映射到指定键 |
| `env:"-"` | 忽略此字段 |
| `envDefault:"value"` | 默认值 |
| `envSeparator:","` | 切片分隔符 |

::: tip 详见
[结构体映射](/zh/env/guides/struct-mapping) 获取完整指南。
:::

---

## 工具函数

### ResetDefaultLoader

```go
func ResetDefaultLoader() error
```

重置全局默认加载器。主要用于测试场景。

**返回：**
- `error` - 关闭旧加载器的错误（如果存在）；如果之前没有加载器或关闭成功则返回 nil

**行为：**
- 原子地将默认加载器交换为 nil
- 关闭旧的加载器（在锁外执行，避免阻塞）
- 允许创建新的默认加载器

```go
func TestMain(m *testing.M) {
    if err := env.ResetDefaultLoader(); err != nil {
        log.Printf("warning: failed to reset loader: %v", err)
    }
    os.Exit(m.Run())
}

func TestSomething(t *testing.T) {
    if err := env.ResetDefaultLoader(); err != nil {
        t.Logf("warning: %v", err)
    }
    defer env.ResetDefaultLoader()
    // ... 测试代码
}
```

::: warning 注意
此函数是并发安全的，但仅在测试或启动时调用以避免意外行为。
:::

---

### LoadWithConfig

```go
func LoadWithConfig(cfg Config) error
```

使用自定义配置初始化默认加载器。

**参数：**
- `cfg` - 自定义配置

**返回：**
- `error` - 初始化错误

**行为：**
- 设置包级默认加载器（`GetString`、`GetInt` 等函数使用）
- **强制** `AutoApply = true`（无论 cfg 中的设置）
- 返回 `ErrAlreadyInitialized` 如果默认加载器已初始化

**与 Load 的区别：**
- `Load()` - 仅接受文件名列表，使用默认配置
- `LoadWithConfig()` - 接受完整 Config，支持所有配置选项

```go
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}
cfg.OverwriteExisting = true
if err := env.LoadWithConfig(cfg); err != nil {
    log.Fatal(err)
}
// 现在可以使用包级函数
port := env.GetInt("PORT", 8080)
```

::: warning 注意
此函数会强制将 `cfg.AutoApply` 设为 `true`，确保变量应用到系统环境。如需控制应用时机，请使用 `New()` 创建独立实例。
:::

---

## 序列化函数

### Marshal

```go
func Marshal(data any, format ...FileFormat) (string, error)
```

将数据序列化为指定格式的字符串。支持 `map[string]string` 或结构体作为输入。

**接口集成：** 如果输入类型实现了 `Marshaler` 接口，优先调用 `MarshalEnv()` 方法进行序列化。

**参数：**
- `data` - 要序列化的数据（map 或结构体）
- `format` - 可选格式，默认 `FormatEnv`

**返回：**
- `string` - 序列化后的字符串（键已排序）
- `error` - 序列化错误

**支持格式：**
- `FormatEnv` (默认) - .env 格式
- `FormatJSON` - JSON 格式
- `FormatYAML` - YAML 格式

```go
// map 转 .env 格式
mapData := map[string]string{"HOST": "localhost", "PORT": "8080"}
envStr, _ := env.Marshal(mapData)
// HOST=localhost
// PORT=8080

// map 转 JSON 格式
jsonStr, _ := env.Marshal(mapData, env.FormatJSON)
// {"HOST":"localhost","PORT":"8080"}

// 结构体转 .env 格式
type Config struct {
    Host string `env:"HOST"`
    Port string `env:"PORT"`
}
envStr, _ := env.Marshal(Config{Host: "localhost", Port: "8080"})
```

---

### UnmarshalMap

```go
func UnmarshalMap(data string, format ...FileFormat) (map[string]string, error)
```

将格式化字符串解析为 map。支持自动格式检测。

**参数：**
- `data` - 格式化字符串
- `format` - 可选格式，默认 `FormatEnv`；使用 `FormatAuto` 自动检测

**返回：**
- `map[string]string` - 解析后的键值对
- `error` - 解析错误

```go
// .env 格式
m, _ := env.UnmarshalMap("HOST=localhost\nPORT=8080")

// JSON 格式（嵌套结构会被扁平化）
m, _ := env.UnmarshalMap(`{"database": {"host": "localhost"}}`, env.FormatJSON)
// m["DATABASE_HOST"] = "localhost"

// 自动检测格式
m, _ := env.UnmarshalMap(jsonString, env.FormatAuto)
```

---

### UnmarshalStruct

```go
func UnmarshalStruct(data string, v any, format ...FileFormat) error
```

将格式化字符串解析并填充到结构体。

**参数：**
- `data` - 格式化字符串
- `v` - 结构体指针
- `format` - 可选格式，默认 `FormatEnv`

**返回：**
- `error` - 解析错误

```go
type Config struct {
    Host string `env:"SERVER_HOST"`
    Port int    `env:"SERVER_PORT"`
}

var cfg Config
err := env.UnmarshalStruct("SERVER_HOST=localhost\nSERVER_PORT=8080", &cfg)
// cfg.Host = "localhost", cfg.Port = 8080

// 从 JSON 解析
err = env.UnmarshalStruct(`{"server": {"host": "localhost"}}`, &cfg, env.FormatJSON)
```

---

### UnmarshalInto

```go
func UnmarshalInto(data map[string]string, v any) error
```

将 map 填充到结构体。支持 `env` 和 `envDefault` 标签。

**接口集成：** 如果目标类型实现了 `Unmarshaler` 接口，优先调用 `UnmarshalEnv(data)` 方法。

**参数：**
- `data` - 键值对映射
- `v` - 结构体指针

**返回：**
- `error` - 填充错误

```go
type Config struct {
    Host string `env:"HOST" envDefault:"localhost"`
    Port int    `env:"PORT" envDefault:"8080"`
}

data := map[string]string{"HOST": "example.com"}
var cfg Config
err := env.UnmarshalInto(data, &cfg)
// cfg.Host = "example.com", cfg.Port = 8080 (使用默认值)
```

---

### MarshalStruct

```go
func MarshalStruct(v any) (map[string]string, error)
```

将结构体转换为 map。支持 `env` 标签指定键名。

**接口集成：** 如果输入类型实现了 `Marshaler` 接口，优先调用 `MarshalEnv()` 方法。

**参数：**
- `v` - 结构体或结构体指针

**返回：**
- `map[string]string` - 键值对映射
- `error` - 转换错误

```go
type Config struct {
    Host string `env:"SERVER_HOST"`
    Port int    `env:"SERVER_PORT"`
}

cfg := Config{Host: "localhost", Port: 8080}
m, _ := env.MarshalStruct(cfg)
// m["SERVER_HOST"] = "localhost"
// m["SERVER_PORT"] = "8080"
```

---

### IsMarshalError

```go
func IsMarshalError(err error) bool
```

检查错误是否为序列化/反序列化错误。

**参数：**
- `err` - 要检查的错误

**返回：**
- `bool` - 是否为 MarshalError 类型

```go
_, err := env.MarshalStruct(invalidData)
if env.IsMarshalError(err) {
    // 处理序列化错误
}
```

---

## 完整示例

```go
package main

import (
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/env"
)

type AppConfig struct {
    Host     string        `env:"APP_HOST" envDefault:"0.0.0.0"`
    Port     int64         `env:"APP_PORT" envDefault:"8080"`
    Debug    bool          `env:"DEBUG" envDefault:"false"`
    Timeout  time.Duration `env:"TIMEOUT" envDefault:"30s"`
    Hosts    []string      `env:"HOSTS" envSeparator:","`
}

func main() {
    // 加载配置文件
    if err := env.Load(".env"); err != nil {
        log.Printf("Warning: %v", err)
    }

    // 读取单个值
    host := env.GetString("APP_HOST", "localhost")
    port := env.GetInt("APP_PORT", 8080)
    debug := env.GetBool("DEBUG", false)
    timeout := env.GetDuration("TIMEOUT", 30*time.Second)

    fmt.Printf("Server: %s:%d\n", host, port)
    fmt.Printf("Debug: %v, Timeout: %v\n", debug, timeout)

    // 敏感数据
    secret := env.GetSecure("API_KEY")
    if secret != nil {
        defer secret.Release()
        fmt.Printf("API Key length: %d\n", secret.Length())
    }

    // 结构体映射
    var cfg AppConfig
    if err := env.ParseInto(&cfg); err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Config: %+v\n", cfg)

    // 所有变量
    fmt.Printf("Loaded %d variables\n", env.Len())
}
```

## 相关文档

- [Loader API](/zh/env/api-reference/loader) - Loader 实例方法
- [Config API](/zh/env/api-reference/config) - 配置选项
- [SecureValue API](/zh/env/api-reference/secure-value) - 安全值处理
- [结构体映射](/zh/env/guides/struct-mapping) - 结构体映射指南
