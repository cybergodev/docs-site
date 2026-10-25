---
sidebar_label: "包函数"
title: "包函数 - CyberGo env | 全局便捷函数"
description: "CyberGo env 包级便捷函数 API 参考，提供 Load、GetString、GetInt、GetBool、GetDuration、GetSlice、GetSecure、Lookup、Keys 与 ParseInto 等基于全局默认 Loader 的线程安全接口。"
sidebar_position: 2
---

# 包函数

包级函数直接操作包级默认加载器（下文简称「默认加载器」），省去传递 Loader 实例。所有函数都是线程安全的。

::: info 初始化要求
默认加载器必须通过 `Load()`、`Overload()` 或 `LoadWithConfig()` 显式初始化，**不会**在首次调用时自动创建。未初始化时：

- `Get*` 函数（`GetString`、`GetInt`、`GetBool` 等）：返回传入的默认值，未提供时为类型零值
- `Lookup`：返回 `("", false)`
- `Keys`/`All`/`GetSecure` 返回 `nil`，`Len` 返回 `0`
- `Set`/`Delete`/`Validate`/`ParseInto`：返回 `ErrNotInitialized`
:::

## 加载函数

### Load

```go
func Load(filenames ...string) error
```

加载环境变量文件并应用到系统环境。

**参数：**
- `filenames` - 文件路径列表。未提供时默认加载 `.env`（沿用 `DefaultConfig()` 的 `Filenames`）。路径须为相对路径

**返回：**
- `error` - 加载错误；默认加载器已初始化时返回 `ErrAlreadyInitialized`

**行为：**
- 以 `DefaultConfig()` 为基础新建 Loader，设为默认加载器
- 强制 `AutoApply = true`，加载后写入进程环境（原因见 [LoadWithConfig 强制 AutoApply](#loadwithconfig-强制-autoapply)）
- `OverwriteExisting` 保持默认 `false`：先加载的文件胜出；要允许后加载覆盖先加载，用 `Overload`
- 支持多格式（.env、JSON、YAML）

::: warning 初始化失败也会留下进程环境变量
`New()` 在构造期间就会把变量写入进程环境（`AutoApply=true`）。若随后安装默认加载器失败（例如并发 `Load` 返回 `ErrAlreadyInitialized`），内部 Loader 会被关闭，但已写入的进程变量**不会**被撤销。此时应把失败的 `Load` 理解为「默认加载器未改变」，而不是「进程环境未改变」。
:::

```go
// 加载 .env 文件
if err := env.Load(".env"); err != nil {
    log.Fatal(err)
}

// 加载指定文件（按顺序；要允许后者覆盖前者需改用 Overload 或 LoadWithConfig）
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

所有获取函数都支持同一套键名解析规则：精确匹配、大写转换与点号路径。

### 解析规则

**1. 精确匹配（优先）**
```go
// .env: APP_NAME=myapp
nameExact := env.GetString("APP_NAME")  // "myapp"
```

**2. 大写转换**
```go
// 任意键名在精确匹配失败后，自动尝试大写版本
nameUpper := env.GetString("app_name")  // 查找 app_name -> APP_NAME
```

**3. 点号路径解析（嵌套键）**
```go
// JSON: {"app": {"name": "myapp"}}
// 存储为：APP_NAME=myapp

// 以下三种写法都能访问到该值
nameFlat := env.GetString("APP_NAME")  // 扁平化键名（推荐）
nameDot := env.GetString("app.name")   // 点号路径（自动转换）
nameUpperDot := env.GetString("APP.NAME") // 大写点号路径
```

### 路径转换表

| 输入键名 | 存储键名 |
|----------|----------|
| `"database.host"` | `"DATABASE_HOST"` |
| `"db.port"` | `"DB_PORT"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |

### 索引访问

数组元素可通过索引访问。索引键未命中时，回退到逗号分隔值取对应元素：

```go
// JSON: {"servers": [{"host": "a.com"}, {"host": "b.com"}]}
// 存储为：SERVERS_0_HOST=a.com、SERVERS_1_HOST=b.com

host0 := env.GetString("servers.0.host")  // "a.com"
host1 := env.GetString("servers.1.host")  // "b.com"

// 索引键不存在，但基础值是逗号分隔的
// HOSTS=localhost,example.com
firstHost := env.GetString("hosts.0")  // "localhost"
```

---

## 获取值函数

### GetString

```go
func GetString(key string, defaultValue ...string) string
```

从默认加载器读取字符串。返回值不做 trim：`.env` 值在解析期已去首尾空白，JSON/YAML 值保留首尾空白。默认加载器未初始化时返回默认值，未提供则返回 `""`。

```go
host := env.GetString("HOST", "localhost")
appName := env.GetString("app.name")  // 点号路径访问嵌套键
```

实例方法语义相同（含「键存在但值为空字符串」的取舍），见 [Loader · GetString](./loader#getstring)。

---

### GetInt

```go
func GetInt(key string, defaultValue ...int64) int64
```

从默认加载器读取整数值。值无法解析为整数时记审计并返回默认值，未提供默认值时返回 0；默认加载器未初始化时同样返回默认值（或 0）。

```go
port := env.GetInt("PORT", 8080)
maxConn := env.GetInt("database.max_connections", 10)
```

实例方法语义相同，见 [Loader · GetInt](./loader#getint)。

---

### GetBool

```go
func GetBool(key string, defaultValue ...bool) bool
```

从默认加载器读取布尔值。比较不区分大小写（仅 ASCII）。

| 真值 | 假值 |
|------|------|
| `true`、`1`、`yes`、`on`、`enabled` | `false`、`0`、`no`、`off`、`disabled` |

- **键存在且值为空字符串**：解析为 `false`，**不**回落到默认值
- **其他非法值**：记审计事件并返回默认值
- **默认加载器未初始化**：返回默认值（未提供时为 `false`）

```go
debug := env.GetBool("DEBUG", false)
cacheEnabled := env.GetBool("cache.enabled", true)
```

实例方法语义相同，见 [Loader · GetBool](./loader#getbool)。

---

### GetUint64

```go
func GetUint64(key string, defaultValue ...uint64) uint64
```

从默认加载器读取无符号整数值。负数或格式非法时记审计并返回默认值，未提供默认值时返回 0；默认加载器未初始化时同样返回默认值（或 0）。

```go
port := env.GetUint64("PORT", 8080)
maxSize := env.GetUint64("MAX_SIZE", 1024)
```

实例方法语义相同，见 [Loader · GetUint64](./loader#getuint64)。

---

### GetFloat64

```go
func GetFloat64(key string, defaultValue ...float64) float64
```

从默认加载器读取浮点数值。格式非法时记审计并返回默认值，未提供默认值时返回 0；默认加载器未初始化时同样返回默认值（或 0）。

```go
rate := env.GetFloat64("RATE", 0.5)
threshold := env.GetFloat64("THRESHOLD")
```

实例方法语义相同，见 [Loader · GetFloat64](./loader#getfloat64)。

---

### GetDuration

```go
func GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

从默认加载器读取时间间隔值。值须符合 Go `time.ParseDuration` 语法，否则记审计并返回默认值，未提供默认值时返回 0；默认加载器未初始化时同样返回默认值（或 0）。

| 示例值 | 含义 |
|--------|------|
| `300ms` | 毫秒 |
| `1.5s` | 秒 |
| `2m30s` | 分钟 + 秒 |
| `1h30m` | 小时 + 分钟 |

```go
timeout := env.GetDuration("TIMEOUT", 30*time.Second)
interval := env.GetDuration("INTERVAL", 5*time.Minute)
```

实例方法语义相同，见 [Loader · GetDuration](./loader#getduration)。

---

### GetSecure

```go
func GetSecure(key string) *SecureValue
```

从默认加载器读取敏感值，每次调用都返回新的防御性副本。键不存在、默认加载器未初始化或值已关闭时返回 nil。

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    value := secret.Reveal()   // 明文值（仅在需要时调用）
    masked := secret.Masked()  // 用于日志：[SECURE:32 bytes]
}
```

::: warning 重要
使用后必须调用 `Release()` 或 `Close()` 释放资源，推荐用 `defer`。
:::

实例方法语义相同（含键名解析与 `nil` 判定），见 [Loader · GetSecure](./loader#getsecure)。完整 API 见 [SecureValue API](./secure-value)。

---

### GetSlice[T]

```go
func GetSlice[T sliceElement](key string, defaultValue ...[]T) []T
```

泛型函数，从默认加载器获取切片值。

**支持的类型：** `string`、`int`、`int64`、`uint`、`uint64`、`bool`、`float64`、`time.Duration`

**注意：** 这是泛型函数，不是 Loader 的方法。要从指定 Loader 实例取切片，用 `GetSliceFrom[T]`。

**解析顺序：**
1. 优先查找索引键 `KEY_0`、`KEY_1`、`KEY_2`……
2. 若无索引键，则按逗号分隔解析 `KEY` 的值
3. 支持点号路径解析

两种来源的失败语义不同：索引键元素解析失败时记审计并跳过该元素，保留其余元素；全部索引键都失败时视为未命中，继续回退。逗号分隔回退解析失败时整个列表丢弃，返回默认值。详见下文「GetSliceFrom 的两套失败语义」。

**参数：**
- `key` - 键名
- `defaultValue` - 可选默认值

**返回：**
- `[]T` - 切片值；未命中且无默认值时返回 nil

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
portsUint := env.GetSlice[uint]("PORTS")
port64s := env.GetSlice[uint64]("PORTS")

// int 类型
portInts := env.GetSlice[int]("PORTS")

// 无默认值时返回 nil
value := env.GetSlice[string]("NON_EXISTENT")  // nil
```

各类型读法的差异只在元素类型；`GetSlice[T]` 与 `GetSliceFrom[T]` 共用同一套索引键/逗号回退规则（见下文「GetSliceFrom 的两套失败语义」）。

---

### GetSliceFrom[T]

```go
func GetSliceFrom[T sliceElement](loader *Loader, key string, defaultValue ...[]T) []T
```

从指定 Loader 实例获取切片值。这是独立的泛型函数，不是 Loader 方法。元素来源与失败语义同 `GetSlice[T]`（索引键优先、逗号回退），详见下文「GetSliceFrom 的两套失败语义」。

**参数：**
- `loader` - Loader 实例指针；为 nil 或已关闭时返回默认值
- `key` - 键名
- `defaultValue` - 可选默认值

**返回：**
- `[]T` - 切片值；未命中且无默认值时返回 nil

**支持的类型：** `string`、`int`、`int64`、`uint`、`uint64`、`bool`、`float64`、`time.Duration`

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

从默认加载器查询键是否存在并取值，支持点号路径解析；索引访问时同样回退到逗号分隔值。返回值不做 trim：`.env` 值在解析期已去除首尾空白，JSON/YAML 值保留首尾空白。

默认加载器未初始化或已关闭时返回 `("", false)`。

```go
value, exists := env.Lookup("API_KEY")
if !exists {
    // 键不存在
}
```

实例方法语义相同，见 [Loader · Lookup](./loader#lookup)。

---

### Keys

```go
func Keys() []string
```

从默认加载器获取所有键名。结果与 `Loader.Keys` 同为**近似快照**（逐分片遍历，不保证跨分片一致）；默认加载器未初始化或已关闭时返回 `nil`。

```go
keys := env.Keys()
for _, key := range keys {
    fmt.Println(key)
}
```

实例方法语义相同，见 [Loader · Keys](./loader#keys)。

---

### All

```go
func All() map[string]string
```

从默认加载器获取所有键值对，同为近似快照。值已复制为普通字符串，不受 `SecureValue` 保护（SEC-010）；配置含机密时不要记录或长期保存这份快照。默认加载器未初始化或已关闭时返回 `nil`。

```go
all := env.All()
for key, value := range all {
    fmt.Printf("%s=%s\n", key, value)
}
```

实例方法语义相同，见 [Loader · All](./loader#all)。

---

### Len

```go
func Len() int
```

从默认加载器获取变量数量。基于原子计数（O(1)），并发写入进行中时读数可能滞后；默认加载器未初始化或已关闭时返回 `0`。

```go
count := env.Len()
fmt.Printf("已加载 %d 个环境变量\n", count)
```

实例方法语义相同，见 [Loader · Len](./loader#len)。

---

## 设置和删除

### Set

```go
func Set(key, value string) error
```

在默认加载器上设置环境变量，等价于 `Loader.Set`。跳过与写入的判定规则（`OverwriteExisting`、`AutoApply`）与实例方法一致；包级模式的差异只有一处——默认加载器未初始化时返回 `ErrNotInitialized`。

**错误类型：**
- `*ValidationError` - 键名格式无效（Field="key"）
- `*SecurityError` - 键被禁止（可用 `errors.Is(err, env.ErrSecurityViolation)` 匹配）
- `ErrInvalidValue` - 值内容无效：含空字节或控制字符（内置验证器下始终检查）；值超过 `MaxValueLength` 时返回的是 `*ValidationError`（`Rule` 为 `max_length`），它**不**匹配 `ErrInvalidValue`
- `ErrClosed` - 加载器已关闭
- `ErrAuditFailed` - fail-closed 审计下事件丢失
- `ErrNotInitialized` - 默认加载器未初始化

```go
if err := env.Set("CUSTOM_KEY", "value"); err != nil {
    // 按上面的错误类型分支：禁止键为 *SecurityError，键格式非法为 *ValidationError
}
```

实例方法语义相同（含键名规则与 `Setenv` 失败行为），见 [Loader · Set](./loader#set)。

---

### Delete

```go
func Delete(key string) error
```

在默认加载器上删除环境变量，等价于 `Loader.Delete`：只从内存删除并清零；若该键由默认加载器写入进程环境，也一并 unset。默认加载器未初始化时返回 `ErrNotInitialized`。

```go
if err := env.Delete("TEMP_KEY"); err != nil {
    panic(err)
}
```

实例方法语义相同（含 unset 失败时的状态），见 [Loader · Delete](./loader#delete)。

---

## 验证和映射

### Validate

```go
func Validate() error
```

验证必需键是否存在，委托给默认加载器（等价于 `Loader.Validate`）。`RequiredKeys` 需在初始化默认加载器时通过 `LoadWithConfig` 的 Config 设置；未初始化默认加载器时返回 `ErrNotInitialized`。

```go
// RequiredKeys 经由 LoadWithConfig 配置到默认加载器
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
// 构造期（New）加载 Filenames 时就会在每个文件解析结束处校验必需键，
// 缺键会让 LoadWithConfig 直接失败。示例清空 Filenames，改用 Set 提供键
cfg.Filenames = nil

if err := env.LoadWithConfig(cfg); err != nil {
    log.Fatal(err)
}

// 实际项目中这些键由配置文件提供
if err := env.Set("DB_HOST", "localhost"); err != nil {
    log.Fatal(err)
}
if err := env.Set("API_KEY", "example-key"); err != nil {
    log.Fatal(err)
}

if err := env.Validate(); err != nil {
    // 缺少必需键；errors.Is(err, env.ErrMissingRequired) 为 true
}
```

实例方法语义相同（含 `*ValidationError` 的 `Rule`/`Field`），见 [Loader · Validate](./loader#validate)。

---

### ParseInto

```go
func ParseInto(v any) error
```

将默认加载器中的环境变量映射到结构体，等价于 `Loader.ParseInto`。`v` 必须是结构体指针，否则返回 `*ValidationError`（Field 为 `value`）；标签解析或类型转换失败时返回 `*MarshalError`；默认加载器未初始化时返回 `ErrNotInitialized`。

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

切片字段默认按逗号 `,` 分隔（分隔符前后空格自动去除），无自定义分隔符标签。

实例方法语义相同，见 [Loader · ParseInto](./loader#parseinto)；完整指南见[结构体映射](../guides/struct-mapping)。

---

## 工具函数

### ResetDefaultLoader

```go
func ResetDefaultLoader() error
```

重置默认加载器。主要用于测试场景。

**返回：**
- `error` - 关闭旧加载器的错误（如果存在）。此前没有加载器、或关闭成功时返回 nil

**行为：**
- 加锁后用 `defaultLoader.Swap(nil)` 原子地把默认加载器置为 nil，随即释放锁
- 在锁**外**关闭旧加载器，避免持锁期间执行清理；否则 `Close()` 里若触发需要默认加载器的代码就会死锁
- 重置后可通过 `Load()`、`Overload()` 或 `LoadWithConfig()` 创建新的默认加载器

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
该函数并发安全，但只在测试或启动阶段调用；运行期重置会让其他 goroutine 里已缓存的默认加载器引用失效。
:::

---

### LoadWithConfig

```go
func LoadWithConfig(cfg Config) error
```

使用自定义配置初始化默认加载器。

**参数：**
- `cfg` - 自定义配置。**全零 `Config` 会被拒绝**，不是「等价于 `DefaultConfig()`」：本函数先把 `AutoApply` 置为 `true`，使 `IsZero()` 不再成立，随后 `Validate` 因 `MaxFileSize` 等限制为零而失败——`env.LoadWithConfig(env.Config{})` 返回 `invalid configuration: validation error on field "MaxFileSize": must be positive`，`errors.Is(err, ErrInvalidConfig)` 为 `true`。始终从 `DefaultConfig()` 或预设开始改。`New()`、`UnmarshalMapWithConfig` 与 `UnmarshalStructWithConfig`（以及建立在它们之上的 `UnmarshalMap`／`UnmarshalStruct`）会把全零 `Config` 当作 `DefaultConfig()`

**返回：**
- `error` - 初始化错误；默认加载器已初始化时返回 `ErrAlreadyInitialized`

**行为：**
- 设置默认加载器（供 `GetString`、`GetInt` 等函数使用）
- **强制** `AutoApply = true`，忽略 cfg 中的设置（原因与取舍见 [LoadWithConfig 强制 AutoApply](#loadwithconfig-强制-autoapply)）
- 配置非法时返回包装了 `ErrInvalidConfig` 的错误

**与 Load 的区别：**
- `Load()` - 只接受文件名列表，其余配置取默认值
- `LoadWithConfig()` - 接受完整 Config，可设置所有配置项

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

---

### Overload

```go
func Overload(filenames ...string) error
```

`Load` 的「后加载覆盖」变体：以 `OverwriteExisting = true` 初始化默认加载器。多个文件定义同名键时**后加载的文件胜出**；`AutoApply` 同样被强制为 `true`（见 [LoadWithConfig 强制 AutoApply](#loadwithconfig-强制-autoapply)）。加载的值还会替换**进程环境中已存在**的同名变量（godotenv 的 Overload 约定）。

**安全提示：** `Load` 从不改动进程中已存在的变量，部署注入的变量（容器密钥、CI 变量）始终优先于文件值。`Overload` 会移除这一保护，文件值将覆盖同名进程变量。

无法确定时优先用 `Load`，并按优先级排序文件。单文件内的重复键语义仍由 `DuplicateKeyPolicy` 决定（见 [Config API](./config#duplicatekeypolicy-单文档内重复键)）。

**参数：**
- `filenames` - 文件路径列表，未提供时默认加载 `.env`

**返回：**
- `error` - 加载错误；默认加载器已初始化时返回 `ErrAlreadyInitialized`

```go
// config.yaml 的值覆盖 config.json 的同名键
if err := env.Overload("config.json", "config.yaml"); err != nil {
    log.Fatal(err)
}
key := env.GetString("database.host", "")
```

---

### ClearInternCache

```go
func ClearInternCache()
```

释放 `.env` 键名驻留（interning）缓存占用的内存。

解析 `.env` 内容时，键字符串会被驻留到一个**进程级有界缓存**中，避免重复分配。缓存上限固定，不会无限增长；但长期运行、间歇性大量解析的应用可以在批次之间调用本函数，把驻留的键提前丢掉。

```go
env.ClearInternCache() // 批次之间的间歇调用
```

**要点：**
- 并发安全；与其它进程级开关一样，**不属于** `Config`，对所有加载器生效
- 只释放缓存本身；**已加载的值不受影响**，`GetString` 等读取照旧工作
- 之后再次解析 `.env` 会重新填充缓存，因此不必在每次解析后调用

---

## 序列化函数

### Marshal

```go
func Marshal(data any, format ...FileFormat) (string, error)
```

将数据序列化为指定格式的字符串。输入可以是 `map[string]string` 或结构体。输出键始终按字典序排序。

**接口集成：** 输入类型实现 `Marshaler` 接口时，优先调用其 `MarshalEnv()` 方法进行序列化。

**参数：**
- `data` - 要序列化的数据（map 或结构体）
- `format` - 可选格式，默认 `FormatEnv`

**返回：**
- `string` - 序列化后的字符串（键已排序）
- `error` - 序列化错误，具体类型如下：
  - `data` 为 `nil` → `*ValidationError`（`Field` 为 `data`，不是 `*MarshalError`）
  - `data` 既不是 `map[string]string` 也不是结构体/结构体指针 → `*MarshalError`
  - 嵌套结构超过 100 层或存在循环引用 → `*MarshalError`（消息含 `maximum struct nesting depth (100) exceeded`）

用 `env.IsMarshalError(err)` 区分后两类。

**支持格式：**
- `FormatEnv`（默认）- .env 格式
- `FormatJSON` - JSON 格式
- `FormatYAML` - YAML 格式

`.env` 输出对需要保护的值加双引号并转义，保证 `Marshal` → `Load` 往返后取回原值：

- 含 `$` 的值加引号，并把 `$` 转义为 `\$`（SEC-009）。否则再次加载时会被当作变量引用展开
- 含空格、`#`、`'`、换行、制表符、`"` 或反斜杠的值按需加引号
- 值为 `null` 或 `~` 时加引号，否则在 `AllowYamlSyntax=true` 下重载会被折叠为空字符串
- 空值输出为 `""`

> JSON/YAML 输出的类型推断、下划线键重建嵌套、标量加引号保往返等行为详见[序列化 · 输出形态](../guides/serialization)。

```go
// map 转 .env 格式
mapData := map[string]string{"HOST": "localhost", "PORT": "8080"}
envStr, _ := env.Marshal(mapData)
// HOST=localhost
// PORT=8080

// map 转 JSON 格式（数字字符串原样输出为数字，键按字母序排列）
jsonStr, _ := env.Marshal(mapData, env.FormatJSON)
// {
//   "HOST": "localhost",
//   "PORT": 8080
// }

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

将格式化字符串解析为 map。`FormatAuto` 时按内容自动检测：空内容或首个非空行不像 JSON/YAML 时按 `.env` 处理。

**参数：**
- `data` - 格式化字符串
- `format` - 可选格式，默认 `FormatEnv`；传 `FormatAuto` 自动检测

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

### UnmarshalMapWithConfig

```go
func UnmarshalMapWithConfig(cfg Config, data string, format ...FileFormat) (map[string]string, error)
```

带完整 `Config` 语义的 `UnmarshalMap`。以下配置段全部生效：

- `LimitsConfig`：文件大小、行/键/值长度、变量数
- `ParsingConfig`：重复键策略；变量展开仅作用于 `.env` 输入，JSON/YAML 值从不展开
- `JSONConfig`/`YAMLConfig`：格式选项
- `ValidationConfig`：键值规则与 `RequiredKeys`（解析结束时检查必需键是否齐备）
- `ComponentConfig`：自定义验证器/展开器/审计器；`Prefix` 按文件加载的同一规则过滤键（前缀自动转大写后大小写不敏感比较）

`FileConfig`（`Filenames`/`FailOnMissingFile`/`OverwriteExisting`/`AutoApply`）无一次性对应，被忽略。

`cfg` 遵循零值约定：全零 `Config` 视为 `DefaultConfig()`（`New()`、`UnmarshalMapWithConfig` 与 `UnmarshalStructWithConfig`，以及建立在它们之上的 `UnmarshalMap`／`UnmarshalStruct` 均如此；`LoadWithConfig` 不接受全零值——对照见上文 [LoadWithConfig](#loadwithconfig)）；部分设置会被 `ErrInvalidConfig` 拒绝，所以始终从 `DefaultConfig()` 开始。

`UnmarshalMap` 是无配置快捷方式，内部即走此函数的 `DefaultConfig` 管线（SEC-002：各格式统一应用禁止键策略与键验证）。

**参数：**
- `cfg` - 完整配置（从 `DefaultConfig()` 或预设开始）
- `data` - 格式化字符串
- `format` - 可选格式，默认 `FormatEnv`；`FormatAuto` 从数据自动检测

**返回：**
- `map[string]string` - 解析后的键值对
- `error` - 解析错误

```go
cfg := env.DefaultConfig()
cfg.DuplicateKeyPolicy = env.DuplicateKeyError
m, err := env.UnmarshalMapWithConfig(cfg, yamlData, env.FormatYAML)
```

---

### UnmarshalStruct

```go
func UnmarshalStruct(data string, v any, format ...FileFormat) error
```

将格式化字符串解析为 map，再填入结构体。内部走 `UnmarshalMap` 的 `DefaultConfig` 管线。

**参数：**
- `data` - 格式化字符串
- `v` - 结构体指针
- `format` - 可选格式，默认 `FormatEnv`；`FormatAuto` 从数据自动检测

**返回：**
- `error` - 解析或填充错误

```go
type Config struct {
    Host string `env:"SERVER_HOST"`
    Port int    `env:"SERVER_PORT"`
}

var cfg Config
err := env.UnmarshalStruct("SERVER_HOST=localhost\nSERVER_PORT=8080", &cfg)
// cfg.Host = "localhost"，cfg.Port = 8080

// 从 JSON 解析
err = env.UnmarshalStruct(`{"server": {"host": "localhost"}}`, &cfg, env.FormatJSON)
```

---

### UnmarshalStructWithConfig

```go
func UnmarshalStructWithConfig(cfg Config, data string, v any, format ...FileFormat) error
```

`UnmarshalStruct` 的配置驱动版本。先按 `cfg` 的全部解析规则（限制、重复键策略、展开、验证、自定义组件，同 [UnmarshalMapWithConfig](#unmarshalmapwithconfig)）把字符串解析为 map，再填入结构体。

**参数：**
- `cfg` - 完整配置
- `data` - 格式化字符串
- `v` - 结构体指针
- `format` - 可选格式，默认 `FormatEnv`；`FormatAuto` 从数据自动检测

**返回：**
- `error` - 解析或填充错误

```go
cfg := env.DefaultConfig()
cfg.DuplicateKeyPolicy = env.DuplicateKeyError
var out Config
if err := env.UnmarshalStructWithConfig(cfg, yamlData, &out, env.FormatYAML); err != nil {
    log.Fatal(err)
}
```

---

### UnmarshalInto

```go
func UnmarshalInto(data map[string]string, v any) error
```

将 map 填充到结构体。支持 `env` 与 `envDefault` 标签。`v` 为 nil 或非结构体指针时返回 `*ValidationError`（Field 为 `value`）。

**接口集成：** 目标类型实现 `Unmarshaler` 接口时，优先调用其 `UnmarshalEnv(data)` 方法。

**参数：**
- `data` - 键值对映射
- `v` - 结构体指针

**返回：**
- `error` - 填充错误
  - `*ValidationError` - `v` 为 nil 或不是非 nil 的结构体指针（`Field` 为 `value`）
  - `*MarshalError` - 标签解析或类型转换失败；**循环引用或嵌套超过 100 层**同样返回它（消息含 `maximum struct nesting depth (100) exceeded`），使自引用类型如 `type Node struct { Next *Node }` 不会递归到栈溢出

切片字段按逗号切分：字符串切片保留空元素（`"a,,b"` 得到 3 个元素），数值与布尔切片的空元素则算转换错误，直接返回 `*MarshalError`。

```go
type Config struct {
    Host string `env:"HOST" envDefault:"localhost"`
    Port int    `env:"PORT" envDefault:"8080"`
}

data := map[string]string{"HOST": "example.com"}
var cfg Config
err := env.UnmarshalInto(data, &cfg)
// cfg.Host = "example.com"，cfg.Port = 8080（取自 envDefault）
```

---

### MarshalStruct

```go
func MarshalStruct(v any) (map[string]string, error)
```

将结构体转换为 `map[string]string`。支持 `env` 标签指定键名；未打标签的字段用字段名的大写形式作键。嵌套结构体按下划线拼接成扁平键，`env:"-"` 的字段跳过。

**接口集成：** 输入类型实现 `Marshaler` 接口时，优先调用其 `MarshalEnv()` 方法，再把返回内容解析为 map。

**参数：**
- `v` - 结构体或结构体指针

**返回：**
- `map[string]string` - 键值对映射；`v` 为 `nil` 时返回空 map（`nil`）与 `nil` 错误，不算失败
- `error` - 转换错误
  - `*MarshalError` - `v` 不是结构体或结构体指针
  - `*MarshalError` - 嵌套结构超过 100 层或存在循环引用（消息含 `maximum struct nesting depth (100) exceeded`）

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

检查错误链中是否含有 `*MarshalError`（内部用 `errors.As`）。

**参数：**
- `err` - 要检查的错误；nil 返回 false

**返回：**
- `bool` - 是否为 `MarshalError` 类型

```go
_, err := env.Marshal(make(chan int)) // chan 既不是 map 也不是结构体
if env.IsMarshalError(err) {
    // 处理序列化错误
}
```

注意 `Marshal(nil)` 返回的是 `*ValidationError`（Field 为 `data`），`IsMarshalError` 对它是 `false`。

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
	Host    string        `env:"APP_HOST" envDefault:"0.0.0.0"`
	Port    int64         `env:"APP_PORT" envDefault:"8080"`
	Debug   bool          `env:"DEBUG" envDefault:"false"`
	Timeout time.Duration `env:"TIMEOUT" envDefault:"30s"`
	Hosts   []string      `env:"HOSTS"`
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

## 类型化读取补充

### GetUint64 / GetFloat64

除常用类型外，包级函数与 Loader 方法都提供无符号整数与浮点读取：

<!-- check-code: skip -->
```go
limit := env.GetUint64("RATE_LIMIT", 1000)     // uint64
rate := env.GetFloat64("SAMPLE_RATE", 0.5)      // float64
u := loader.GetUint64("RATE_LIMIT", 1000)       // Loader 方法同签名
f := loader.GetFloat64("SAMPLE_RATE", 0.5)
```

### 布尔值的解析规则

`GetBool` 大小写不敏感地接受 `true`/`yes`/`on`/`1`/`enabled` 与 `false`/`no`/`off`/`0`/`disabled`；空字符串解析为 `false`，其余非法值记审计并返回默认值。完整规则见上文 [GetBool](#getbool)，实例方法的支持值与审计行为见 [Loader · GetBool](./loader#getbool)。

### 解析失败与默认值的关系

`Get*` 函数在**键不存在**或**值解析失败**时返回默认值（未提供时为类型零值），不会 panic，也不返回 error。解析失败会以 `parse failed` 记入审计日志，便于排查脏配置。

一个例外：**键存在但值为空字符串**时，`GetBool` 返回 `false`，不回退默认值——空字符串是合法的显式值，解析为 `false`。`GetInt`、`GetUint64`、`GetFloat64`、`GetDuration` 没有这个例外：空值解析失败，照常回退默认值。

```go
// DEBUG= 表示显式设为空字符串
debug := env.GetBool("DEBUG", true) // false，不是 true
port := env.GetInt("PORT", 8080)    // PORT= 时回退 8080
```

### GetSliceFrom 的两套失败语义

实例模式下 `GetSliceFrom[T](loader, key)` 按索引键（`KEY_0`、`KEY_1`……）收集元素，未命中时回退逗号分隔值。两种来源的失败语义不同：

| 来源 | 元素解析失败时 |
|------|----------------|
| 索引键（`KEY_0`……） | 记审计后**跳过该元素**，保留其余元素；若全部元素都失败，视为未命中，继续回退 |
| 逗号分隔回退 | **整表失败**，返回默认值（或 nil） |

两套语义的差别可以直接观察：索引键里非法元素只丢自己，逗号分隔里只要有一个非法元素就整表回退。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	cfg := env.DefaultConfig()
	cfg.Filenames = nil // 不读任何文件，只用 Set 写入演示数据

	loader, err := env.New(cfg)
	if err != nil {
		panic(err)
	}
	defer loader.Close()

	// 场景一：索引键，PORTS_1 是非法元素
	if err := loader.Set("PORTS_0", "80"); err != nil {
		panic(err)
	}
	if err := loader.Set("PORTS_1", "abc"); err != nil {
		panic(err)
	}
	fmt.Println(env.GetSliceFrom[int64](loader, "PORTS")) // 输出: [80]

	// 场景二：逗号分隔，abc 非法导致整表失败，返回默认值
	if err := loader.Set("LIMITS", "80,abc"); err != nil {
		panic(err)
	}
	fmt.Println(env.GetSliceFrom[int64](loader, "LIMITS", []int64{443})) // 输出: [443]
}
```

两处场景用了不同的键名，是因为索引键优先于逗号分隔：同名键一旦存在 `KEY_0`、`KEY_1`，就永远不会走到逗号回退。

泛型元素类型约束为 `string`、`int`、`int64`、`uint`、`uint64`、`bool`、`float64`、`time.Duration`。切片长度上限 10000，这是防御性限制，超限记录审计。

### LoadWithConfig 强制 AutoApply

`Load()`、`Overload()` 与 `LoadWithConfig()` 都会**强制** `AutoApply=true`，忽略传入配置。原因是包级便捷函数（`GetString`、`GetInt` 等）只读加载器内存，而 `os.Getenv` 一类的外部读者依赖变量已进入进程环境，强制应用让初始化一次即可同时满足两者。

由此带来两个后果：一是 `LoadWithConfig(env.Config{})` 的 `AutoApply` 被置位后不再被当作零值配置，会因限制为零而被拒绝；二是需要精确控制应用时机时只能用 `New()` 实例模式，自己调用 `Apply()`。

## 相关文档

- [Loader API](./loader) - Loader 实例方法
- [Config API](./config) - 配置选项
- [SecureValue API](./secure-value) - 安全值处理
- [结构体映射](../guides/struct-mapping) - 结构体映射指南
