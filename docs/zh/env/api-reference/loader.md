---
sidebar_label: "Loader"
title: "Loader API - CyberGo env | 加载器详解"
description: "CyberGo env 的 Loader API 参考：LoadFiles 按序加载 .env/JSON/YAML，GetString/GetInt/GetBool/GetDuration 类型化读取，Set/Delete 增删改，Validate 校验必需键，Keys/All 集合视图与 Close 生命周期。"
sidebar_position: 3
---

# Loader API

`Loader` 是 env 库的核心类型，负责环境变量的加载、存储和访问。下面按功能分组列出它的方法。

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

## 方法总览

`Loader` 的全部方法按下表分组（限定名形如 `Loader.GetString`），各方法详见下文对应小节：

| 方法 | 说明 |
|------|------|
| `Loader.LoadFiles` | 按顺序加载多个文件（.env/JSON/YAML 自动检测） |
| `Loader.GetString` / `Loader.Lookup` | 字符串读取与存在性查询 |
| `Loader.GetInt` / `Loader.GetUint64` / `Loader.GetFloat64` / `Loader.GetBool` / `Loader.GetDuration` | 类型化读取 |
| `Loader.GetSecure` | 读取敏感值的防御性副本 |
| `Loader.Set` / `Loader.Delete` | 写入与删除（含键值验证） |
| `Loader.Keys` / `Loader.All` / `Loader.Len` | 集合视图 |
| `Loader.Apply` / `Loader.IsApplied` | 应用到进程环境与状态查询 |
| `Loader.LoadTime` / `Loader.Config` | 加载时间与配置只读副本 |
| `Loader.Validate` / `Loader.ParseInto` | 必需键校验与结构体映射 |
| `Loader.Close` / `Loader.IsClosed` | 生命周期：清零存储并关闭 |

---

## 创建

### New

```go
func New(cfg ...Config) (*Loader, error)
```

创建新的加载器实例。

**参数：**
- `cfg` - 可选，最多一个。不提供或传入**完全零值**的 Config 时，自动使用 `DefaultConfig()`；传入多个 Config 返回包装了 `ErrInvalidConfig` 的错误，多余的配置不会被应用

**返回：**
- `*Loader` - 加载器实例
- `error` - 配置校验失败时返回包装了 `ErrInvalidConfig` 的错误；创建期间加载文件失败也会返回错误，此时内部组件已被清理

**行为：**
- 验证配置有效性
- 创建内部组件（验证器、审计器、展开器）与各格式解析器
- `cfg.Filenames` 非空时自动加载文件；加载失败会清理内部组件并返回错误
- `cfg.AutoApply` 为 true 时自动应用到进程环境
- 不设置包级默认加载器（那是 `Load`/`LoadWithConfig` 的职责）

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
- 路径必须是**相对路径**。绝对路径、Windows 盘符、UNC 路径以及任何含 `..` 的路径都会被 `*SecurityError` 拒绝；Docker/Kubernetes 中配置挂载在绝对路径时，先 `chdir` 到配置目录，或改为传相对工作目录的路径

**返回：**
- `error` - 加载错误

**行为：**
- 按顺序加载。默认 `OverwriteExisting=false`，此时**先加载的文件优先**，后加载文件中的同名键被跳过
- `OverwriteExisting=true` 时后加载覆盖先加载（`DevelopmentConfig`/`TestingConfig` 预设已开启）
- 自动检测文件格式（.env、JSON、YAML）；无法识别的扩展名按 `.env` 解析
- 文件不存在时的行为由 `FailOnMissingFile` 决定：`false` 静默跳过，`true` 返回 `ErrFileNotFound`
- `Prefix` 非空时只保留匹配前缀的键（ASCII 大小写不敏感）
- `AutoApply` 为 true 时，加载后自动应用

```go
// 加载默认 .env 文件
err := loader.LoadFiles()

// 加载指定文件
err := loader.LoadFiles(".env", ".env.local")

// 混合格式
err := loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

**错误类型：**
- `ErrFileNotFound` - 文件不存在（`FailOnMissingFile=true` 时）
- `ErrFileTooLarge` - 文件超过大小限制。`Stat` 预检命中时返回包装在 `*FileError`（`Op=size_check`）中的错误；读取过程中超出上限时直接返回 `ErrFileTooLarge`
- `ErrClosed` - 加载器已关闭
- `*ParseError` - 解析错误
- `*JSONError` - JSON 解析错误
- `*YAMLError` - YAML 解析错误
- `*SecurityError` - 文件路径安全校验失败（如路径穿越）
- `ErrAuditFailed` - 启用 fail-closed 审计且审计事件丢失

**格式检测规则：**

| 扩展名 | 格式 |
|--------|------|
| `.env` | FormatEnv |
| `.json` | FormatJSON |
| `.yaml`、`.yml` | FormatYAML |
| 其他 | FormatAuto（加载时使用 .env 解析器） |

检测只看扩展名、不看内容：`.env.local` 的扩展名是 `.local`，因此得到 `FormatAuto`，加载时仍按 `.env` 解析。

---

## 获取值

### 键名解析

所有获取方法都支持同一套键名解析规则：

| 输入键名 | 解析结果 |
|----------|----------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"`（精确匹配） |
| `"database.host"` | `"DATABASE_HOST"`（点号转下划线） |
| `"app.name"` | `"APP_NAME"`（大写 + 下划线） |
| `"servers.0.host"` | `"SERVERS_0_HOST"`（数组索引） |

**解析顺序：**
1. 精确匹配：直接查找键名（含字面带点的键）
2. 大写转换：未命中时尝试大写版本
3. 路径解析：点号路径转换为下划线格式
4. 索引回退：索引访问未命中时，回退到逗号分隔值的对应元素

---

### GetString

```go
func (l *Loader) GetString(key string, defaultValue ...string) string
```

获取字符串值，支持点号路径解析。返回值不做 trim（见 `Lookup` 的说明）。

**参数：**
- `key` - 键名（支持精确匹配、大写转换、点号路径）
- `defaultValue` - 可选默认值

**返回：**
- `string` - 键存在时返回存储原值（即使是空字符串）；键不存在时返回默认值，未提供默认值则返回 `""`

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

获取整数值，支持点号路径解析。值无法解析为整数时记审计并返回默认值。

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

获取布尔值。支持点号路径解析，比较不区分大小写（仅 ASCII）。

**参数：**
- `key` - 键名（支持点号路径）
- `defaultValue` - 可选默认值

**返回：**
- `bool` - 值或默认值（未找到且无默认值时返回 false）

**支持的值：**
- 真值：`true`、`1`、`yes`、`on`、`enabled`
- 假值：`false`、`0`、`no`、`off`、`disabled`
- 空字符串解析为 `false`，不落到默认值
- 其他非法值记审计并返回默认值

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

获取无符号整数值，支持点号路径解析。值为负数或格式非法时解析失败，记审计并返回默认值。

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

获取浮点数值，支持点号路径解析。格式非法时记审计并返回默认值。

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

获取时间间隔值，支持点号路径解析。值必须是 Go 的 `time.ParseDuration` 格式，否则解析失败、记审计并返回默认值。

**参数：**
- `key` - 键名（支持点号路径）
- `defaultValue` - 可选默认值

**返回：**
- `time.Duration` - 值或默认值（未找到且无默认值时返回 0）

**支持格式：** `ns`、`us`、`ms`、`s`、`m`、`h`，可组合，如 `30s`、`5m`、`1h30m`

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

获取安全值（敏感数据保护）。键名解析与 `Lookup` 一致，但**不**走逗号分隔的索引回退。

**参数：**
- `key` - 键名

**返回：**
- `*SecureValue` - 安全值的**防御性副本**，独立于父 Loader，调用者负责释放（`Release()` 清零并归还对象池，`Close()` 只清零）；键不存在、加载器已关闭或存储中的值已关闭时返回 nil

```go
secret := loader.GetSecure("API_SECRET")
if secret != nil {
    defer secret.Release()

    value := secret.Reveal()   // 明文值
    masked := secret.Masked()  // [SECURE:32 bytes]
}
```

::: tip 详见
[SecureValue API](./secure-value) 获取完整文档。
:::

---

### 获取切片值

Loader 没有切片获取方法（Go 不支持泛型方法）。要从 Loader 实例取切片，用独立的泛型函数 `GetSliceFrom[T]`：

```go
// 使用独立泛型函数
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})
portsInt := env.GetSliceFrom[int](loader, "PORTS")  // 也支持 int
```

**支持的类型：** `string`、`int`、`int64`、`uint`、`uint64`、`bool`、`float64`、`time.Duration`

::: tip 详见
[包函数 - GetSliceFrom](./functions#getslicefrom-t) 获取完整文档。
:::

---

### Lookup

```go
func (l *Loader) Lookup(key string) (string, bool)
```

检查键是否存在并获取值，支持点号路径解析。索引访问（如 `hosts.0`）未命中时回退到逗号分隔值。

**参数：**
- `key` - 键名（支持点号路径）

**返回：**
- `string` - 值；返回存储原值，不做 trim。`.env` 值在解析期已去除首尾空白，JSON/YAML 值保留首尾空白
- `bool` - 是否存在；加载器已关闭时返回 `("", false)`

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
- `error` - 设置错误；启用 fail-closed 审计且事件丢失时返回 `ErrAuditFailed`

**行为：**
- 验证键名有效性
- `ValidateValues` 为 true 时验证值安全性
- `OverwriteExisting` 为 false 且键已存在时静默跳过（返回 nil）
- `AutoApply` 为 true 时同时写入进程环境；`Setenv` 失败会直接返回错误，该值不写入内存
- `AutoApply` 为 true 且进程中已有同名变量、`OverwriteExisting` 为 false 时，只更新内存，进程环境保持原值
- `AutoApply` 为 false 时只写入内存

内置验证器下，即使 `ValidateValues=false`，基础值校验仍然执行：长度上限与控制字符拒绝照旧，`ValidateUTF8` 按自身开关处理。这与 `.env` 行解析路径一致。

```go
err := loader.Set("CUSTOM_KEY", "value")
if err != nil {
    // 处理错误
}
```

**错误类型：**
- `*ValidationError` - 键名格式无效（Field 为 `key`）
- `*SecurityError` - 键被禁止，可用 `errors.Is(err, env.ErrSecurityViolation)` 或 `env.ErrForbiddenKey` 匹配
- `ErrInvalidValue` - 值无效（`ValidateValues` 为 true 时，值含空字节、控制字符等）
- `ErrClosed` - 加载器已关闭
- `ErrAuditFailed` - fail-closed 审计下事件丢失

`Set` 的键名规则比 `.env` 行解析宽松，与从 JSON/YAML 加载的键空间一致：允许 `.`、`-`、`@`，但拒绝空键、纯数字键，以及字母、数字、`_`、`@`、`-`、`.` 之外的字符。

---

### Delete

```go
func (l *Loader) Delete(key string) error
```

删除环境变量。

**参数：**
- `key` - 键名

**返回：**
- `error` - 删除错误；加载器已关闭返回 `ErrClosed`，从进程环境 unset 失败时返回底层 os 错误（键名已掩码）

**行为：**
- 从内存存储中删除并安全清零该值
- 仅当这个键是由**本 loader** 写入进程环境时，才同时从进程环境 unset；非本 loader 设置的变量不受影响

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

获取所有键名。存储分为 32 个分片，实现上用原子计数估算容量，再逐个分片加读锁遍历，结果是**近似快照**：遍历期间其他 goroutine 的并发写入会让各分片的读取时点不一致。需要严格一致的视图时，在调用方自行加锁。

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

获取所有键值对。与 `Keys()` 一样逐个分片遍历，同属**近似快照**，不保证跨分片一致。

返回的 `map[string]string` 把每个值复制为普通 Go 字符串，不受 `SecureValue` 的保护与清零机制覆盖（SEC-010）：敏感值一旦进入该 map，就无法再被库清零。

因此，配置含机密时不要记录日志、序列化或长期保存这份快照；需要保持保护的读取用 `GetSecure`。

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

将内存中的变量写入进程环境（`os.Environ`）。

**返回：**
- `error` - 应用错误；首个写入失败的键会中止整个操作

**行为：**
- 遍历所有已加载的变量，逐个写入进程环境
- `OverwriteExisting=false` 时跳过进程中已存在的键（含显式设为空的变量），并在审计日志记 `skipped (existing)`
- 写入成功的键记入 `appliedKeys`，供 `Delete` 判断归属
- 应用后可通过 `os.Getenv()` 读取

**错误类型：**
- `ErrClosed` - 加载器已关闭
- 包装的 `os` 错误 - 设置环境变量失败（键名经 `MaskKey` 处理，错误消息中不暴露敏感键名）
- 启用 fail-closed 审计时，审计事件丢失会返回 `ErrAuditFailed`

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

检查变量是否已应用到系统环境。`Apply`、`AutoApply` 开启时的加载，以及 `AutoApply` 开启时的 `Set` 都会把它置为 `true`。

**返回：**
- `bool` - 是否已应用；加载器已关闭时返回 false

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

返回最后一次加载文件的时间。只设置 `Set`/`Delete` 不更新它。

**返回：**
- `time.Time` - 最近一次加载完成的时间；从未加载过返回零值

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

返回加载器的配置。nil 接收者返回零值 `Config{}`。

**返回：**
- `Config` - 配置值拷贝（应视为只读）

::: warning 注意
`Config()` 返回的是 `l.config` 的**值拷贝**，只有值字段被真正隔离。以下内容仍与运行中的 loader 共享底层对象，修改会影响 loader 行为：

- `KeyPattern` 指针
- `FileSystem`、`AuditHandler` 等接口值指向的对象
- `AllowedKeys`、`RequiredKeys` 等切片（与 loader 共用底层数组）

需要可变副本时，手动复制所需字段。
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
- `error` - 验证错误；加载器已关闭时返回 `ErrClosed`。缺键时返回 `*ValidationError`，其 `Rule` 为 `required`（`errors.Is` 可匹配 `ErrMissingRequired`）、`Field` 为 `required_keys`，缺失的键名列在 `Message` 中

**行为：**
- 只检查 `ValidationConfig.RequiredKeys` 列出的键是否都存在
- `AllowedKeys` 与 `ForbiddenKeys` 在解析与 `Set` 时生效，不由本方法检查

```go
cfg := env.DefaultConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

if err := loader.Validate(); err != nil {
    var missingErr *env.ValidationError
    if errors.As(err, &missingErr) {
        fmt.Printf("缺少必需键：%s\n", missingErr.Message)
    }
}
```

---

### ParseInto

```go
func (l *Loader) ParseInto(v any) error
```

将环境变量映射到结构体。实现上先取全部键值的快照，再交给 `UnmarshalInto` 填充，因此填充期间不持有 loader 锁。目标类型实现 `Unmarshaler` 接口时，优先调用其 `UnmarshalEnv(data)`。

**参数：**
- `v` - 结构体指针

**返回：**
- `error` - 映射错误；加载器已关闭时返回 `ErrClosed`

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
- `error` - 关闭自有工厂时审计器的错误；已关闭或 nil 接收者返回 nil

**行为：**
- 安全清零所有存储的敏感数据（含全容量，不止当前长度）
- 关闭实现了 `io.Closer` 的自定义解析器
- 加载器拥有 ComponentFactory 时，同时关闭工厂
- 幂等，多次调用返回 nil
- **不**回滚已写入进程环境的变量，详见下方「生命周期与进程环境语义」

```go
loader, _ := env.New(cfg)
defer loader.Close()

// 使用 loader...
```

::: warning 关闭后行为
关闭后所有操作返回错误或零值：
- `LoadFiles` → `ErrClosed`
- `GetString` → 返回默认值；未提供默认值时返回空字符串
- `Set` → `ErrClosed`
- `Keys` → 返回 nil
- `Len` → 返回 0
:::

---

### IsClosed

```go
func (l *Loader) IsClosed() bool
```

检查加载器是否已关闭。nil 接收者视为已关闭，返回 `true`。

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

`Close()` 只清零**内存中的**变量副本，**不会**取消此前写入进程环境的变量。写入进程环境的途径有三种：`Apply`、`AutoApply`，以及 `AutoApply` 开启时的 `Set`。需要在关闭前从进程环境移除时，先逐键调用 `Delete`：

<!-- check-code: skip -->
```go
loader.Delete("API_KEY") // 仅当该键由本 loader 写入进程环境时才会 unset
loader.Close()
```

### Delete 的逐键归属跟踪

Loader 记录**自己**写入进程环境的键（`appliedKeys`）。`Delete` 只 unset 这些键，**绝不触碰**非本 loader 设置的进程变量（`HOME`、`TERM` 等），多 Loader 场景下互不干扰。

### Apply 区分「未设置」与「显式空值」

`Apply` 用 `LookupEnv` 判断进程环境是否已有该键。显式设置为空字符串的变量被视为「已存在」，在 `OverwriteExisting=false` 时同样跳过，不会被误判为未设置而覆盖。

### 状态与元数据方法

| 方法 | 说明 |
|------|------|
| `Config()` | 返回配置值拷贝供只读；`KeyPattern`、`FileSystem`、`AuditHandler` 等指针/接口字段仍共享底层对象，修改会影响运行中的 loader |
| `IsClosed()` | loader 是否已关闭（nil receiver 返回 true） |
| `IsApplied()` | 变量是否已应用到 os.Environ |
| `LoadTime()` | 最近一次加载完成的时间（未加载过返回零值） |

### 读取路径的键名解析细节

- **精确匹配优先**：先按原键查找，未命中时尝试大写形式回退
- **点号路径**：`database.host` 展开为 `DATABASE_HOST`（JSON/YAML 扁平化键）；索引路径 `service.cors.origins.0` 未命中时回退到逗号分隔值
- **不做 trim**：`Lookup` 返回存储原值，`.env` 值在解析期已 trim，JSON/YAML 值保留首尾空白
- **无锁快路径**：单键读取（`Lookup`/`GetSecure`）通过原子闭态标志绕过 loader 级读锁，高并发下读锁计数不再成为瓶颈；与 `Close` 竞争时，结果是「读到值」或「读到清空后的状态」中的一种，不会读到中间态

### Set 的静默跳过语义

`OverwriteExisting=false` 时，对已存在的键调用 `Set` 会**静默跳过并返回 nil**（不报错）。需要感知跳过时，查看审计日志中的 `skipped (no overwrite)` 事件。

### 文件加载的纵深防御（TOCTOU）

`Stat()` 大小检查与实际读取之间存在理论上的替换窗口，库用三层机制兜底：

1. 解析器内部用强制大小上限的加固读取路径包装文件流
2. 即使文件在检查后增长，也会在硬性上限（100 MB）处截断，防止内存耗尽
3. 解析出的内容再统一做大小、格式与安全检查，不依赖最初 `Stat()` 的结果

## 相关文档

- [包函数](./functions) - 包级便捷函数
- [Config API](./config) - 配置选项
- [SecureValue API](./secure-value) - 安全值处理
- [接口定义](./interfaces) - 所有接口定义
