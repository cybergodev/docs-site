---
sidebar_label: "Config"
title: "Config API - CyberGo env | 配置详解"
description: "CyberGo env 的 Config 配置结构体 API 参考，含文件加载选项、大小与数量限制、键值验证、JSON/YAML 解析选项、变量展开、审计配置及 Development/Production 预设模板，详解嵌套结构与字段提升两种访问方式。"
sidebar_position: 4
---

# Config API

`Config` 结构体的完整配置选项参考。

## 结构体定义

Config 使用嵌套结构体组织配置，同时通过 Go 的字段提升保持向后兼容：

```go
type Config struct {
    FileConfig       // 文件加载行为
    ValidationConfig // 键和值验证
    LimitsConfig     // 大小和数量限制
    JSONConfig       // JSON 解析选项
    YAMLConfig       // YAML 解析选项
    ParsingConfig    // 通用解析行为
    ComponentConfig  // 自定义组件和高级选项
}
```

**两种访问方式：**

```go
// 旧方式（通过字段提升，仍然有效）
cfg.Filenames = []string{".env"}
cfg.MaxFileSize = 1024

// 新方式（推荐，更清晰）
cfg.FileConfig.Filenames = []string{".env"}
cfg.LimitsConfig.MaxFileSize = 1024
```

### 嵌套结构体

```go
// FileConfig 控制文件加载行为
type FileConfig struct {
    Filenames         []string // 要加载的文件列表
    FailOnMissingFile bool     // 文件不存在时是否报错
    OverwriteExisting bool     // 是否覆盖已存在的环境变量
    AutoApply         bool     // 是否自动应用到 os.Environ
}

// ValidationConfig 控制键和值验证
type ValidationConfig struct {
    RequiredKeys   []string       // 必需的键名列表
    AllowedKeys    []string       // 允许的键名白名单
    ForbiddenKeys  []string       // 额外的禁止键列表
    KeyPattern     *regexp.Regexp // 键名匹配模式
    ValidateValues bool           // 是否验证值的安全性
    ValidateUTF8   bool           // 是否验证值为有效 UTF-8
}

// LimitsConfig 控制大小和数量限制
type LimitsConfig struct {
    MaxFileSize       int64 // 单文件最大字节数
    MaxVariables      int   // 每文件最大变量数
    MaxLineLength     int   // 单行最大长度
    MaxKeyLength      int   // 键名最大长度
    MaxValueLength    int   // 值最大长度
    MaxExpansionDepth int   // 变量展开最大深度
}

// JSONConfig 控制 JSON 解析行为
type JSONConfig struct {
    JSONNullAsEmpty    bool // null 转为空字符串
    JSONNumberAsString bool // 数字按规范十进制字符串渲染
    JSONBoolAsString   bool // 仅为对称保留，无实际效果
    JSONMaxDepth       int  // 最大嵌套深度
}

// YAMLConfig 控制 YAML 解析行为
type YAMLConfig struct {
    YAMLNullAsEmpty    bool // null/~ 转为空字符串
    YAMLNumberAsString bool // 数字形标量规范化（007 变为 7）
    YAMLBoolAsString   bool // 布尔转规范小写
    YAMLMaxDepth       int  // 最大嵌套深度
}

// ParsingConfig 控制通用解析行为
type ParsingConfig struct {
    AllowExportPrefix bool            // 允许 export KEY=value 语法
    AllowYamlSyntax   bool            // 允许 KEY: value 冒号分隔与 YAML 风格值
    ExpandVariables   bool            // 是否展开 ${VAR} 引用
    ExpansionScope    ExpansionScope  // ${VAR} 引用可解析的作用域
    DuplicateKeyPolicy DuplicateKeyPolicy // 单文档内重复键解析策略
}

// ComponentConfig 自定义组件和高级选项
type ComponentConfig struct {
    CustomValidator Validator        // 自定义键/值验证器
    CustomExpander  VariableExpander // 自定义变量展开器
    CustomAuditor   AuditLogger      // 自定义审计日志器
    FileSystem      FileSystem       // 自定义文件系统（用于测试）
    AuditHandler    AuditHandler     // 自定义审计处理器
    AuditEnabled    bool             // 启用审计日志
    AuditFailClosed  bool             // 审计事件丢失时使操作失败
    Prefix          string           // 只处理带有此前缀的变量
}
```

### 字段速查（限定名）

七个嵌入段各自对应一组限定字段名，前缀见下表。下面按段列出全部字段的限定名、默认值与简要说明；完整语义见「配置字段」一节的对应小节。

| 段 | 前缀 |
|----|------|
| 文件加载 | `Config.FileConfig` |
| 键值验证 | `Config.ValidationConfig` |
| 大小与数量限制 | `Config.LimitsConfig` |
| JSON 解析 | `Config.JSONConfig` |
| YAML 解析 | `Config.YAMLConfig` |
| 通用解析 | `Config.ParsingConfig` |
| 组件与高级选项 | `Config.ComponentConfig` |

**`FileConfig`（文件加载）**

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `FileConfig.Filenames` | `[".env"]` | 要加载的文件列表 |
| `FileConfig.FailOnMissingFile` | `false` | 文件不存在时报错（否则静默跳过） |
| `FileConfig.OverwriteExisting` | `false` | 是否覆盖已存在的变量 |
| `FileConfig.AutoApply` | `false` | 加载后自动应用到进程环境 |

**`ValidationConfig`（键值验证）**

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `ValidationConfig.RequiredKeys` | `nil` | 必需键列表，由 `Validate` 与每次解析结束时检查 |
| `ValidationConfig.AllowedKeys` | `nil` | 键白名单（空 = 全部允许） |
| `ValidationConfig.ForbiddenKeys` | `nil` | 额外禁止键（叠加内置列表） |
| `ValidationConfig.KeyPattern` | `nil` | 自定义键名正则（nil = 快速字节级校验） |
| `ValidationConfig.ValidateValues` | `true` | 值安全性检查（控制字符、空字节等） |
| `ValidationConfig.ValidateUTF8` | `false` | 值 UTF-8 有效性检查（独立于 `ValidateValues`） |

**`LimitsConfig`（大小与数量限制）**

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `LimitsConfig.MaxFileSize` | 8MB | 单文件最大字节数（硬上限 100MB） |
| `LimitsConfig.MaxVariables` | 1000 | 每文件最大变量数（硬上限 10000） |
| `LimitsConfig.MaxLineLength` | 8192 | 单行最大长度（硬上限 64KB；对所有格式生效） |
| `LimitsConfig.MaxKeyLength` | 128 | 键名最大长度（硬上限 1024） |
| `LimitsConfig.MaxValueLength` | 8192 | 值最大长度（硬上限 1MB） |
| `LimitsConfig.MaxExpansionDepth` | 5 | 变量展开最大深度（硬上限 20） |

**`JSONConfig`（JSON 解析）**

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `JSONConfig.JSONNullAsEmpty` | `true` | `null` 转为空字符串 |
| `JSONConfig.JSONNumberAsString` | `true` | 数字按规范十进制字符串渲染 |
| `JSONConfig.JSONBoolAsString` | `true` | 仅为对称保留，对 JSON 输出无效果 |
| `JSONConfig.JSONMaxDepth` | 16 | 最大嵌套深度（有效范围 1–100） |

**`YAMLConfig`（YAML 解析）**

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `YAMLConfig.YAMLNullAsEmpty` | `true` | `null`/`~` 转为空字符串 |
| `YAMLConfig.YAMLNumberAsString` | `true` | 数字形标量规范化（`007` → `7`） |
| `YAMLConfig.YAMLBoolAsString` | `true` | 布尔转规范小写（关闭时保留书写原样） |
| `YAMLConfig.YAMLMaxDepth` | 16 | 最大嵌套深度（有效范围 1–100） |

**`ParsingConfig`（.env 解析行为）**

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `ParsingConfig.AllowExportPrefix` | `true` | 允许 `export KEY=value` 语法 |
| `ParsingConfig.AllowYamlSyntax` | `false` | 允许 `KEY: value` 冒号分隔，值按 YAML 标量语义解析 |
| `ParsingConfig.ExpandVariables` | `true` | 启用 `${VAR}` 展开（仅作用于 .env） |
| `ParsingConfig.ExpansionScope` | `ExpansionFileOnly` | 展开引用的可见作用域 |
| `ParsingConfig.DuplicateKeyPolicy` | `DuplicateKeyInherit` | 单文档内重复键策略 |

**`ComponentConfig`（组件与高级选项）**

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `ComponentConfig.CustomValidator` | `nil` | 自定义键/值验证器 |
| `ComponentConfig.CustomExpander` | `nil` | 自定义变量展开器 |
| `ComponentConfig.CustomAuditor` | `nil` | 自定义审计日志器 |
| `ComponentConfig.FileSystem` | `nil` | 自定义文件系统（nil = `DefaultFileSystem`） |
| `ComponentConfig.AuditHandler` | `nil` | 审计事件处理器 |
| `ComponentConfig.AuditEnabled` | `false` | 启用审计日志 |
| `ComponentConfig.AuditFailClosed` | `false` | 审计事件丢失时使操作失败 |
| `ComponentConfig.Prefix` | `""` | 只处理带此前缀的变量（ASCII 大小写不敏感） |

## 配置字段

### 文件处理

这些字段控制文件加载行为。

#### `Filenames` []string

要加载的文件路径列表。**默认 `[".env"]`**。路径须为相对路径（见 [Loader.LoadFiles](./loader#loadfiles)）。清空该字段（设为 `nil` 或 `[]string{}`）可让 `New()` 不自动加载任何文件。

```go
cfg.Filenames = []string{".env", ".env.local"}
```

---

#### `FailOnMissingFile` bool

文件不存在时是否返回错误。**默认 `false`**（静默跳过并继续加载下一个文件）。设为 `true` 时返回 `ErrFileNotFound`。

```go
cfg.FailOnMissingFile = true  // 文件不存在时报错
```

---

#### `OverwriteExisting` bool

是否覆盖已存在的变量。**默认 `false`**。

覆盖行为的两个层面：
- 多文件加载时，`false` 表示先加载的文件胜出；`true` 表示后加载的覆盖先加载的
- 写入进程环境（`Apply`、`AutoApply` 开启时的 `Set`）时，`false` 表示不覆盖进程中已有的同名变量

```go
cfg.OverwriteExisting = true  // 允许覆盖
```

---

#### `AutoApply` bool

加载后自动应用到系统环境（`os.Environ`）。**默认 `false`**。`Set` 也会受此开关影响：为 `true` 时同时写入进程环境。

```go
cfg.AutoApply = true  // 加载后自动应用
```

::: tip 注意
包级 `Load()`、`Overload()` 与 `LoadWithConfig()` 都会强制把 `AutoApply` 设为 `true`。用 `New()` 创建 Loader 时该字段保持传入值，默认 `false`。
:::

### 变量展开

#### `ExpandVariables` bool

启用 `${VAR}` 与 `$VAR` 变量展开。**默认 `true`**。该开关只作用于 `.env` 输入，JSON/YAML 的值从不展开。

```go
cfg.ExpandVariables = true
```

支持的展开语法：

| 语法 | 说明 |
|------|------|
| `${VAR}` | 引用变量 |
| `${VAR:-default}` | 变量不存在时使用默认值；变量存在但为空时用其原值 |
| `${VAR:=default}` | 同 `${VAR:-default}`，另把默认值写回该变量 |
| `${VAR:?error}` | 变量不存在或为空时报错，错误消息不含提示文本 |

::: tip 空字符串的处理
`${VAR:-default}` 与 `${VAR:=default}` 只在变量**未设置**时使用默认值。若变量被显式设为空字符串（`VAR=`），展开结果就是空字符串。

只有 `${VAR:?error}` 会把空字符串视为错误。详见 [变量展开](../guides/variable-expansion)。
:::

### 安全限制

#### `MaxFileSize` int64

单文件最大字节数。**默认 8MB**，硬性上限 100MB。

```go
cfg.MaxFileSize = 10 * 1024 * 1024 // 10 MB
```

| 配置 | 默认值 | 硬性上限 |
|------|--------|----------|
| `MaxFileSize` | 8MB (8388608) | 100MB |

---

#### `MaxLineLength` int

单行最大长度。**默认 8192**，硬性上限 64KB。该限制对**所有格式**生效，含 JSON 与 YAML：压缩成单行的 JSON 文档按一行计，必须落在此限制内。

64KB 是硬上限，调大配置也无法突破。单行超长时改用格式化输出。

```go
cfg.MaxLineLength = 2048
```

| 配置 | 默认值 | 硬性上限 |
|------|--------|----------|
| `MaxLineLength` | 8192 | 65536 (64KB) |

---

#### `MaxKeyLength` int

键名最大长度。**默认 128**，硬性上限 1024。

```go
cfg.MaxKeyLength = 128
```

| 配置 | 默认值 | 硬性上限 |
|------|--------|----------|
| `MaxKeyLength` | 128 | 1024 |

---

#### `MaxValueLength` int

值最大长度。**默认 8192**，硬性上限 1MB。

```go
cfg.MaxValueLength = 8192
```

| 配置 | 默认值 | 硬性上限 |
|------|--------|----------|
| `MaxValueLength` | 8192 | 1048576 (1MB) |

---

#### `MaxVariables` int

每文件最大变量数。**默认 1000**，硬性上限 10000。

```go
cfg.MaxVariables = 1000
```

| 配置 | 默认值 | 硬性上限 |
|------|--------|----------|
| `MaxVariables` | 1000 | 10000 |

---

#### `MaxExpansionDepth` int

变量展开最大深度。**默认 5**，硬性上限 20。

```go
cfg.MaxExpansionDepth = 10
```

| 配置 | 默认值 | 硬性上限 |
|------|--------|----------|
| `MaxExpansionDepth` | 5 | 20 |

### 键验证

#### `KeyPattern` *regexp.Regexp

自定义键名匹配模式。**默认 `nil`**（使用快速字节级验证）。

::: tip 性能优化
`nil` 值启用快速字节级验证，比正则约快 10 倍。内置规则：以字母开头，只含字母、数字、下划线。

`Config.Validate()` 会拿自定义模式做探针测试（合法键、空串、数字开头、含 `=`/`:`/换行/控制字符）。任一不过即拒绝该配置。
:::

```go
import "regexp"

// 自定义模式
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
```

---

#### `AllowedKeys` []string

允许的键名白名单。为空时允许所有键（内置禁止键与 `ForbiddenKeys` 仍然生效）。

```go
cfg.AllowedKeys = []string{"APP_NAME", "APP_VERSION", "PORT"}
```

---

#### `ForbiddenKeys` []string

额外的禁止键列表，与内置禁止键**叠加**（不替换）。**默认 `nil`**。

```go
cfg.ForbiddenKeys = []string{"CUSTOM_DANGEROUS_VAR"}
```

::: tip 内置禁止键
库内置禁止 `PATH`、`LD_PRELOAD`、`LD_LIBRARY_PATH`、`DYLD_INSERT_LIBRARIES` 等系统关键变量，完整清单见 [常量与错误](./constants#defaultforbiddenkeys)。
:::

---

#### `RequiredKeys` []string

必需的键名列表，由 `Validate()` 检查。**默认 `nil`**（不检查）。匹配时键名按大写比较。

```go
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
```

---

#### `ValidateValues` bool

验证值的安全性（控制字符、空字节等）。**默认 `true`**。

::: warning 安全建议
保持启用。只在确实需要存储含控制字符的值时才禁用。
:::

```go
cfg.ValidateValues = true  // 默认已启用
```

---

#### `ValidateUTF8` bool

验证值是否为有效的 UTF-8 编码。**默认 `false`**。该开关独立生效，不受 `ValidateValues` 影响。

```go
cfg.ValidateUTF8 = true  // 启用 UTF-8 验证
```

### 解析选项

#### `AllowExportPrefix` bool

允许 `export KEY=value` 语法。**默认 `true`**。

```go
cfg.AllowExportPrefix = false  // 禁止 export 前缀
```

---

#### `AllowYamlSyntax` bool

允许 .env 文件使用 `KEY: value` 冒号分隔，并让值一侧按 YAML 标量语义解析：`null`/`~` 视为空字符串，YAML 布尔与数字字面量按其规则识别。**默认 `false`**。

```go
cfg.AllowYamlSyntax = true
```

::: tip 冒号分隔与值语义
`AllowYamlSyntax=false`（默认）时，行解析器只把 `=` 当作键值分隔符。`KEY: value` 这样的冒号行按「无分隔符」跳过，开启审计时记一条事件。

设为 `true` 后，冒号 `:` 才作为键值分隔符生效，值一侧同时按 YAML 标量语义解析。
:::

### JSON 选项

#### `JSONNullAsEmpty` bool

JSON `null` 值转为空字符串。**默认 `true`**。关闭时 `null` 保留为字面文本 `null`。

```go
cfg.JSONNullAsEmpty = true
```

---

#### `JSONNumberAsString` bool

JSON 数字按规范十进制字符串渲染（`8080`、`0.5`）。**默认 `true`**。关闭时数字仍会加载，但按 Go 默认浮点格式渲染，例如 1e21 变为 `1e+21`。无论何种设置，数字都不会被拒绝。

```go
cfg.JSONNumberAsString = true
```

---

#### `JSONBoolAsString` bool

仅为与 `YAMLBoolAsString` 对称而保留，**对 JSON 输出没有实际效果**：JSON 布尔解码后不再保留原始文本，始终渲染规范的 `true`/`false`。不要用它控制 JSON 布尔行为。**默认 `true`**。

```go
cfg.JSONBoolAsString = true
```

---

#### `JSONMaxDepth` int

JSON 最大嵌套深度。**默认 16**，有效范围 1–100，超出由 `Validate()` 拒绝。

```go
cfg.JSONMaxDepth = 20
```

### YAML 选项

#### `YAMLNullAsEmpty` bool

YAML `null`/`~` 值转为空字符串。**默认 `true`**。关闭时这两种字面量保留为 `null`。

```go
cfg.YAMLNullAsEmpty = true
```

---

#### `YAMLNumberAsString` bool

YAML 数字形标量规范化渲染（`007` 变为 `7`）。**默认 `true`**。关闭时标量按书写原样保留；值在任何设置下都不会被拒绝。

```go
cfg.YAMLNumberAsString = true
```

---

#### `YAMLBoolAsString` bool

YAML 布尔值的书写形式归一化为规范的 `true`/`false`。**默认 `true`**。关闭时按书写原样保留，例如 False 不会被改写成 false。

```go
cfg.YAMLBoolAsString = true
```

---

#### `YAMLMaxDepth` int

YAML 最大嵌套深度。**默认 16**，有效范围 1–100，超出由 `Validate()` 拒绝。

```go
cfg.YAMLMaxDepth = 15
```

### 审计

#### `AuditEnabled` bool

启用审计日志。**默认 `false`**。

```go
cfg.AuditEnabled = true
```

---

#### `AuditHandler` AuditHandler

自定义审计处理器。

```go
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

::: tip 详见
[审计日志](../guides/audit-logging) 获取完整审计配置说明。
:::

#### `AuditFailClosed` bool

启用审计后，丢失的审计事件会使**产生该事件的操作**返回错误，不会静默丢弃。错误可用 `errors.Is(err, ErrAuditFailed)` 匹配，通过 `LoadFiles`/`Apply`/`Set`/`Delete` 的返回值暴露。

计入丢失的情形有三种：
- 处理器返回错误
- 处理器 panic
- 满通道丢弃事件

内置审计器闩锁首个失败；自定义 `CustomAuditor` 通过实现 `TakeFailure() error` 参与。并发场景下被闩锁的失败由最先检查的操作取走，归属为尽力而为。

默认 `false`（fail-open，操作结果不依赖审计管线）。

```go
cfg := env.ProductionConfig()
cfg.AuditFailClosed = true // 审计事件丢失时，产生它的操作返回 ErrAuditFailed
```

### 高级选项

#### `Prefix` string

文件加载时只保留键名以此前缀开头的变量。**默认 `""`**（全部保留）。比较时前缀转大写、按 ASCII 大小写不敏感匹配，因此 `myapp_` 与 `MYAPP_` 等价。`Set` 与 `Delete` 不受它影响。

```go
cfg.Prefix = "MYAPP_"  // 只加载 MYAPP_ 开头的变量
```

---

#### `FileSystem` FileSystem

自定义文件系统接口，主要用于测试。**默认 `nil`**，此时使用 `DefaultFileSystem`（`OSFileSystem{}`）。

```go
cfg.FileSystem = &MockFileSystem{}
```

---

#### `CustomValidator` Validator

自定义键/值验证器，设置后完全替换内置验证器。**默认 `nil`**。

选择此路径后，内置验证器承担的安全检查（键长度、禁止键、值控制字符等）不再自动生效，需要由自定义实现自己完成。只实现 `KeyValidator` 的验证器在调用 `ValidateRequired` 时返回 `ErrValidateRequiredUnsupported`。

```go
cfg.CustomValidator = &MyValidator{}
```

---

#### `CustomExpander` VariableExpander

自定义变量展开器，设置后替换内置展开器。**默认 `nil`**。

```go
cfg.CustomExpander = &MyExpander{}
```

---

#### `CustomAuditor` AuditLogger

自定义审计日志器，设置后替换内置审计器。**默认 `nil`**。想参与 fail-closed 审计（`AuditFailClosed=true`），需额外实现 `TakeFailure() error`。

```go
cfg.CustomAuditor = &MyAuditLogger{}
```

---

## 工厂函数

### DefaultConfig

```go
func DefaultConfig() Config
```

返回安全的默认配置。`New()` 收到完全零值的 Config 时也用它。

**默认值：**

| 字段 | 值 |
|------|-----|
| `Filenames` | `[".env"]` |
| `FailOnMissingFile` | `false` |
| `OverwriteExisting` | `false` |
| `AutoApply` | `false` |
| `ExpandVariables` | `true` |
| `MaxFileSize` | 8MB |
| `MaxLineLength` | 8192 |
| `MaxKeyLength` | 128 |
| `MaxValueLength` | 8192 |
| `MaxVariables` | 1000 |
| `MaxExpansionDepth` | 5 |
| `ValidateValues` | `true` |
| `KeyPattern` | `nil`（快速字节级校验） |
| `AllowExportPrefix` | `true` |
| `AllowYamlSyntax` | `false` |
| `JSONNullAsEmpty` | `true` |
| `JSONNumberAsString` | `true` |
| `JSONBoolAsString` | `true` |
| `JSONMaxDepth` | 16 |
| `YAMLNullAsEmpty` | `true` |
| `YAMLNumberAsString` | `true` |
| `YAMLBoolAsString` | `true` |
| `YAMLMaxDepth` | 16 |
| `ValidateUTF8` | `false` |
| `AuditEnabled` | `false` |
| `Prefix` | `""` |

---

### DevelopmentConfig

```go
func DevelopmentConfig() Config
```

返回开发环境配置：便利性放宽，安全底线不变。

**与 `DefaultConfig()` 的差异：**

| 字段 | Default | Development |
|------|---------|-------------|
| `OverwriteExisting` | `false` | `true` |
| `AllowYamlSyntax` | `false` | `true` |
| `MaxFileSize` | 8MB | 10MB |

::: tip 安全保障
`ValidateValues` 在所有预设中都是 `true`（与默认值一致），环境不同不降低值校验强度。
:::

```go
cfg := env.DevelopmentConfig()
cfg.Filenames = []string{".env.development"}
loader, _ := env.New(cfg)
```

---

### TestingConfig

```go
func TestingConfig() Config
```

返回测试环境配置：限制收紧，允许覆盖以便隔离。

**与 `DefaultConfig()` 的差异：**

| 字段 | Default | Testing |
|------|---------|---------|
| `OverwriteExisting` | `false` | `true` |
| `MaxFileSize` | 8MB | 64KB |
| `MaxVariables` | 1000 | 50 |

其余字段与默认值一致，包括 `AuditEnabled=false`（测试中不产生审计噪声）与 `FailOnMissingFile=false`。

```go
func TestSomething(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = []string{".env.test"}
    loader, _ := env.New(cfg)
    defer loader.Close()
}
```

---

### ProductionConfig

```go
func ProductionConfig() Config
```

返回生产环境配置：严格校验并开启审计。

**与 `DefaultConfig()` 的差异：**

| 字段 | Default | Production |
|------|---------|------------|
| `FailOnMissingFile` | `false` | `true` |
| `AuditEnabled` | `false` | `true` |
| `MaxFileSize` | 8MB | 64KB |
| `MaxVariables` | 1000 | 50 |

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
loader, _ := env.New(cfg)
```

---

### 预设详细对比

| 功能 | Default | Development | Testing | Production |
|------|---------|-------------|---------|------------|
| 覆盖已存在变量 | ✗ | ✓ | ✓ | ✗ |
| 文件不存在时报错 | ✗ | ✗ | ✗ | ✓ |
| 审计日志 | ✗ | ✗ | ✗ | ✓ |
| YAML 语法 | ✗ | ✓ | ✗ | ✗ |
| 文件大小限制 | 8MB | 10MB | 64KB | 64KB |
| 最大变量数 | 1000 | 1000 | 50 | 50 |

::: tip 选择建议
- **开发环境**：用 `DevelopmentConfig()`，限制宽松，迭代快
- **测试环境**：用 `TestingConfig()`，允许覆盖，便于测试隔离
- **生产环境**：用 `ProductionConfig()`，开启审计与严格验证
:::

---

## 方法

Config 提供两个方法：`Config.Validate` 与 `Config.IsZero`。

### Validate

```go
func (c *Config) Validate() error
```

校验配置本身是否合法。`New()` 与 `UnmarshalMapWithConfig` 都会先调用它。

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 1000

if err := cfg.Validate(); err != nil {
    // 配置无效
}
```

**验证规则：**
- 所有限制值必须为正数，且不超过硬性上限
- `KeyPattern` 非 nil 时必须满足四条：能匹配有效键名（如 `TEST_KEY`）；不匹配空字符串；不匹配数字开头的键名；不匹配含 `=`、`:`、换行或控制字符的键名
- `JSONMaxDepth` 与 `YAMLMaxDepth` 必须在 1–100 之间
- `ExpansionScope` 必须是 `ExpansionFileThenProcess` 或 `ExpansionFileOnly`
- `DuplicateKeyPolicy` 必须是四个已定义常量之一

任一检查失败返回 `*ValidationError`；`New()` 会再把它包装为 `ErrInvalidConfig`。

---

### IsZero

```go
func (c *Config) IsZero() bool
```

检查 Config 是否为零值。返回 `true` 表示全部字段均为零值，`New()` 会把它替换为 `DefaultConfig()`。

**返回：**
- `bool` - 是否为零值配置

**检测范围（v1.3.0 起覆盖全部字段）：**
- 数值限制（MaxFileSize、MaxVariables 等）
- 布尔字段（ValidateValues、AutoApply 等）
- 指针/接口字段（KeyPattern、FileSystem 等）
- 切片字段（Filenames、RequiredKeys 等）

::: tip 零值检测
只设置部分字段的 Config 不算零值，不会被替换为 `DefaultConfig()`。后果有两条：

- 未设置的字段保持各自零值
- `New()` 随后调用 `Config.Validate()`；限制字段仍为零时，返回包装了 `ErrInvalidConfig` 的错误（如 `MaxFileSize must be positive`）

自定义配置从 `DefaultConfig()` 开始改：

```go
// 推荐
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}

// 不推荐：其余字段保持零值，New() 校验失败
var cfg env.Config
cfg.Filenames = []string{".env.production"}
```
:::

---

## 使用示例

### 基本配置

```go
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env", ".env.local"}
cfg.OverwriteExisting = true

loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer loader.Close()
```

### 生产环境配置

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "DB_PORT", "API_KEY"}
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer loader.Close()

if err := loader.LoadFiles(".env"); err != nil {
    log.Fatal(err)
}

if err := loader.Validate(); err != nil {
    log.Fatal("缺少必需配置：", err)
}
```

### 使用前缀过滤

```go
cfg := env.DefaultConfig()
cfg.Prefix = "MYAPP_"  // 只加载 MYAPP_KEY1, MYAPP_KEY2 等
cfg.Filenames = []string{".env"}

loader, _ := env.New(cfg)
// loader 中只有 MYAPP_ 开头的变量
```

### 自定义验证

```go
import "regexp"

cfg := env.DefaultConfig()
// 只允许大写字母开头
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
// 添加自定义禁止键
cfg.ForbiddenKeys = []string{"DEBUG", "TRACE"}

loader, _ := env.New(cfg)
```

---

## 预设对照表与配置陷阱

### 其余字段在预设间的取值

「预设详细对比」表只列四个预设**取值不同**的项；下表补齐其余字段，四个预设在这些项上取值相同：

| 配置项 | Default | Development | Testing | Production |
|--------|---------|-------------|---------|------------|
| `ValidateValues` | true | true | true | true |
| `AllowExportPrefix` | true | true | true | true |
| `AllowYamlSyntax` | false | **true** | false | false |
| `ExpandVariables` | true | true | true | true |
| `JSONMaxDepth`/`YAMLMaxDepth` | 16 | 16 | 16 | 16 |

内置禁止键检查（`PATH`、`LD_PRELOAD` 等）不受预设影响，四个预设始终开启。

要点：`DevelopmentConfig` 放宽的只是**便利性**（覆盖、YAML 语法、文件大小），值校验始终开启；任何预设都不会牺牲注入防护。

### DefaultConfig 关键默认值

| 项 | 默认 |
|----|------|
| 键名模式 | 内置字节级校验（等价 `^[A-Za-z][A-Za-z0-9_]*$`） |
| `ValidateValues` | true |
| `JSONNullAsEmpty`/`JSONNumberAsString`/`JSONBoolAsString` | true |
| `ExpandVariables` | true（作用域 `ExpansionFileOnly`） |
| `Prefix` | 空（不过滤） |

### IsZero 陷阱：始终从 DefaultConfig() 开始改

零值判定与部分配置的后果见上文「`IsZero`」一节的提示。做法只有一条：从 `DefaultConfig()` 开始改，不要从零值 `Config` 逐个字段赋值。

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig() // 在完整默认值之上修改
cfg.Filenames = []string{".env.production"}
cfg.OverwriteExisting = true
```

### KeyPattern 的安全校验（SEC-06）

自定义 `KeyPattern` 在 `Config.Validate()` 时会接受四类探针测试，任一不过即拒绝配置：

1. 必须能匹配合法键（如 `TEST_KEY`）
2. 必须拒绝空字符串
3. 必须拒绝数字开头的键（如 `123_INVALID`）
4. 必须拒绝含 `=`、`:`、换行或控制字符的键。这类键会让序列化往返后重新解析出**不同的行**，即往返注入

### ExpansionScope

`ExpansionScope` 是 int 枚举类型，控制值里 `${VAR}`/`$VAR` 引用可解析的作用域。配置入口是 `ParsingConfig.ExpansionScope` 字段：

```go
type ExpansionScope int

const (
    ExpansionFileThenProcess ExpansionScope = iota // 枚举零值（非运行时默认）
    ExpansionFileOnly                              // 仅文件内变量可见（DefaultConfig 默认）
)
```

| 常量 | 语义 |
|------|------|
| `ExpansionFileThenProcess` | 枚举零值（`iota`）。先查文件内变量，缺失时回退进程环境（`os.LookupEnv`），匹配传统 dotenv 语义。仅在显式设置时生效：`DefaultConfig()` 不采用它 |
| `ExpansionFileOnly` | 仅文件内变量可见；只存在于进程环境的引用展开为空字符串。`DefaultConfig()` 的默认值（SEC-03），阻止 `${VAR}` 读取进程环境，避免云凭据、令牌等进程机密被带进变量值 |

攻击场景分析与配置示例参见[变量展开指南的「展开作用域」章节](../guides/variable-expansion)。

### DuplicateKeyPolicy（单文档内重复键）

`DuplicateKeyPolicy` 是 int 枚举，控制**单个源文档内**重复键的解析方式（经 `ParsingConfig.DuplicateKeyPolicy` 配置）：

```go
type DuplicateKeyPolicy = internal.DuplicateKeyPolicy

const (
    DuplicateKeyInherit   // 零值（默认）：沿用各格式历史行为
    DuplicateKeyFirstWins // .env/YAML 保留首次出现
    DuplicateKeyLastWins  // 所有格式均保留末次出现
    DuplicateKeyError     // 文档含重复键即报错（errors.Is 匹配 ErrDuplicateKey）
)
```

| 常量 | 语义 |
|------|------|
| `DuplicateKeyInherit` | 零值（默认）。`.env` 跟随 `OverwriteExisting`（false 首次胜出，true 末次胜出）；YAML 末次胜出；JSON 末次胜出（`encoding/json` 解码顺序） |
| `DuplicateKeyFirstWins` | `.env` 与 YAML 保留首次出现。策略本身无法对 JSON 生效，因为 `encoding/json` 解码时就丢弃了较早出现者；JSON 数据（含 YAML 内联 JSON）改由与 `DuplicateKeyError` 相同的预扫描检出重复键并报错。无重复键的 JSON 文档不受影响 |
| `DuplicateKeyLastWins` | 所有格式均保留末次出现，与 `OverwriteExisting` 无关 |
| `DuplicateKeyError` | 同一对象/映射（或同一 `.env` 文件）内出现重复键即报错，`errors.Is` 匹配 `ErrDuplicateKey`。JSON 数据经保守的原始字节预扫描检测；仅转义拼写不同的等价键无法检出，回退末次胜出 |

**两条不受本策略管辖的行为：**

- **跨文件合并**：遵循文件顺序与 `OverwriteExisting`（默认 false 首次胜出，true 后加载覆盖），本策略不参与。
- **扁平键冲突始终报错**：YAML/JSON 展平时，两个不同源路径塌缩到同一键即报错，例如 `a_b: 1` 与 `a: {b: 2}`，或字面 `a_0` 与数组 `a`。`errors.Is` 匹配 `ErrDuplicateKey`。

```go
cfg := env.DefaultConfig()
cfg.DuplicateKeyPolicy = env.DuplicateKeyError // 重复键报错
```

大小写说明：YAML/JSON 键在展平时转大写，`.env` 键按原样存储。因此仅大小写不同的键不会冲突，例如 `.env` 的 `db_host` 与 YAML 的 `db: {host: ...}`（展开为 `DB_HOST`）可在存储中共存。

`DuplicateKeyPolicy.String` 返回策略的可读名称：`inherit`、`first-wins`、`last-wins`、`error`（未知值返回 `unknown`）。

## 相关文档

- [Loader API](./loader) - 加载器方法
- [常量与错误](./constants) - 限制常量与错误类型
- [审计日志](../guides/audit-logging) - 审计配置指南
