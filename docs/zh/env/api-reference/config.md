---
title: "Config API - CyberGo env | 配置详解"
description: "CyberGo env 库 Config 配置结构体 API 参考文档，包括文件搜索路径、安全限制参数、键值验证选项、变量展开设置、审计日志配置和预定义配置模板，提供 Development 和 Production 预设满足不同环境需求。"
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
    JSONNumberAsString bool // 数字转为字符串
    JSONBoolAsString   bool // 布尔值转为字符串
    JSONMaxDepth       int  // 最大嵌套深度
}

// YAMLConfig 控制 YAML 解析行为
type YAMLConfig struct {
    YAMLNullAsEmpty    bool // null/~ 转为空字符串
    YAMLNumberAsString bool // 数字转为字符串
    YAMLBoolAsString   bool // 布尔值转为字符串
    YAMLMaxDepth       int  // 最大嵌套深度
}

// ParsingConfig 控制通用解析行为
type ParsingConfig struct {
    AllowExportPrefix bool // 允许 export KEY=value 语法
    AllowYamlSyntax   bool // 允许 YAML 风格值
    ExpandVariables   bool // 是否展开 ${VAR} 引用
}

// ComponentConfig 自定义组件和高级选项
type ComponentConfig struct {
    CustomValidator Validator        // 自定义键/值验证器
    CustomExpander  VariableExpander // 自定义变量展开器
    CustomAuditor   AuditLogger      // 自定义审计日志器
    FileSystem      FileSystem       // 自定义文件系统（用于测试）
    AuditHandler    AuditHandler     // 自定义审计处理器
    AuditEnabled    bool             // 启用审计日志
    Prefix          string           // 只处理带有此前缀的变量
}
```

## 配置字段

### 文件处理

这些字段控制文件加载行为。

#### `Filenames` []string

要加载的文件路径列表。**默认 `[".env"]`**。

```go
cfg.Filenames = []string{".env", ".env.local"}
```

---

#### `FailOnMissingFile` bool

文件不存在时是否返回错误。**默认 `false`**（静默跳过）。

```go
cfg.FailOnMissingFile = true  // 文件不存在时报错
```

---

#### `OverwriteExisting` bool

是否覆盖已存在的环境变量。**默认 `false`**。

```go
cfg.OverwriteExisting = true  // 允许覆盖
```

---

#### `AutoApply` bool

加载后自动应用到系统环境（`os.Environ`）。**默认 `false`**。

```go
cfg.AutoApply = true  // 加载后自动应用
```

::: tip 注意
包级 `Load()` 函数会自动设置 `AutoApply = true`。使用 `New()` 创建 Loader 时需手动设置。
:::

### 变量展开

#### `ExpandVariables` bool

启用 `${VAR}` 语法变量展开。**默认 `true`**。

```go
cfg.ExpandVariables = true
```

支持的展开语法：

| 语法 | 说明 |
|------|------|
| `${VAR}` | 引用变量 |
| `${VAR:-default}` | 变量不存在或为空时使用默认值 |
| `${VAR:=default}` | 变量不存在或为空时设置默认值 |
| `${VAR:?error}` | 变量不存在或为空时报错 |

### 安全限制

#### `MaxFileSize` int64

单文件最大字节数。**默认 2MB**，硬性上限 100MB。

```go
cfg.MaxFileSize = 10 * 1024 * 1024 // 10 MB
```

| 配置 | 默认值 | 硬性上限 |
|------|--------|----------|
| `MaxFileSize` | 2MB (2097152) | 100MB |

---

#### `MaxLineLength` int

单行最大长度。**默认 1024**，硬性上限 64KB。

```go
cfg.MaxLineLength = 2048
```

| 配置 | 默认值 | 硬性上限 |
|------|--------|----------|
| `MaxLineLength` | 1024 | 65536 (64KB) |

---

#### `MaxKeyLength` int

键名最大长度。**默认 64**，硬性上限 1024。

```go
cfg.MaxKeyLength = 128
```

| 配置 | 默认值 | 硬性上限 |
|------|--------|----------|
| `MaxKeyLength` | 64 | 1024 |

---

#### `MaxValueLength` int

值最大长度。**默认 4096**，硬性上限 1MB。

```go
cfg.MaxValueLength = 8192
```

| 配置 | 默认值 | 硬性上限 |
|------|--------|----------|
| `MaxValueLength` | 4096 | 1048576 (1MB) |

---

#### `MaxVariables` int

每文件最大变量数。**默认 500**，硬性上限 10000。

```go
cfg.MaxVariables = 1000
```

| 配置 | 默认值 | 硬性上限 |
|------|--------|----------|
| `MaxVariables` | 500 | 10000 |

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
`nil` 值启用快速字节级验证（约 10 倍性能提升）。默认验证规则：以字母开头，只包含字母、数字、下划线。
:::

```go
import "regexp"

// 自定义模式
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
```

---

#### `AllowedKeys` []string

允许的键名白名单。为空时允许所有键（除禁止键外）。

```go
cfg.AllowedKeys = []string{"APP_NAME", "APP_VERSION", "PORT"}
```

---

#### `ForbiddenKeys` []string

额外的禁止键列表（叠加内置禁止键）。

```go
cfg.ForbiddenKeys = []string{"CUSTOM_DANGEROUS_VAR"}
```

::: tip 内置禁止键
库内置禁止 `PATH`、`LD_PRELOAD`、`LD_LIBRARY_PATH`、`DYLD_INSERT_LIBRARIES` 等系统关键变量。详见 [常量与错误](/zh/env/api-reference/constants#defaultforbiddenkeys)。
:::

---

#### `RequiredKeys` []string

必需的键名列表。调用 `Validate()` 时检查。

```go
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
```

---

#### `ValidateValues` bool

验证值的安全性（控制字符、空字节等）。**默认 `true`**。

::: warning 安全建议
建议始终保持启用，仅在特殊场景（如需要存储包含控制字符的值）时禁用。
:::

```go
cfg.ValidateValues = true  // 默认已启用
```

---

#### `ValidateUTF8` bool

验证值是否为有效的 UTF-8 编码。**默认 `false`**。

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

允许 YAML 风格语法（`KEY: value`）。**默认 `false`**。

```go
cfg.AllowYamlSyntax = true
```

### JSON 选项

#### `JSONNullAsEmpty` bool

JSON `null` 值转为空字符串。**默认 `true`**。

```go
cfg.JSONNullAsEmpty = true
```

---

#### `JSONNumberAsString` bool

JSON 数字转为字符串。**默认 `true`**。

```go
cfg.JSONNumberAsString = true
```

---

#### `JSONBoolAsString` bool

JSON 布尔值转为字符串。**默认 `true`**。

```go
cfg.JSONBoolAsString = true
```

---

#### `JSONMaxDepth` int

JSON 最大嵌套深度。**默认 10**。

```go
cfg.JSONMaxDepth = 20
```

### YAML 选项

#### `YAMLNullAsEmpty` bool

YAML `null`/`~` 值转为空字符串。**默认 `true`**。

```go
cfg.YAMLNullAsEmpty = true
```

---

#### `YAMLNumberAsString` bool

YAML 数字转为字符串。**默认 `true`**。

```go
cfg.YAMLNumberAsString = true
```

---

#### `YAMLBoolAsString` bool

YAML 布尔值转为字符串。**默认 `true`**。

```go
cfg.YAMLBoolAsString = true
```

---

#### `YAMLMaxDepth` int

YAML 最大嵌套深度。**默认 10**。

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
[审计日志](/zh/env/guides/audit-logging) 获取完整审计配置说明。
:::

### 高级选项

#### `Prefix` string

只处理带有此前缀的变量。**默认 `""`**（处理所有变量）。

```go
cfg.Prefix = "MYAPP_"  // 只加载 MYAPP_ 开头的变量
```

---

#### `FileSystem` FileSystem

自定义文件系统接口（用于测试）。

```go
cfg.FileSystem = &MockFileSystem{}
```

---

#### `CustomValidator` Validator

自定义键/值验证器。覆盖内置验证器。

```go
cfg.CustomValidator = &MyValidator{}
```

---

#### `CustomExpander` VariableExpander

自定义变量展开器。覆盖内置展开器。

```go
cfg.CustomExpander = &MyExpander{}
```

---

#### `CustomAuditor` AuditLogger

自定义审计日志器。覆盖内置审计器。

```go
cfg.CustomAuditor = &MyAuditLogger{}
```

---

## 工厂函数

### DefaultConfig

```go
func DefaultConfig() Config
```

返回安全的默认配置。

**默认值：**

| 字段 | 值 |
|------|-----|
| `Filenames` | `[".env"]` |
| `FailOnMissingFile` | `false` |
| `OverwriteExisting` | `false` |
| `AutoApply` | `false` |
| `ExpandVariables` | `true` |
| `MaxFileSize` | 2MB |
| `MaxLineLength` | 1024 |
| `MaxKeyLength` | 64 |
| `MaxValueLength` | 4096 |
| `MaxVariables` | 500 |
| `MaxExpansionDepth` | 5 |
| `ValidateValues` | `true` |
| `KeyPattern` | `nil` (快速验证) |
| `AllowExportPrefix` | `true` |
| `AllowYamlSyntax` | `false` |
| `JSONNullAsEmpty` | `true` |
| `JSONNumberAsString` | `true` |
| `JSONBoolAsString` | `true` |
| `JSONMaxDepth` | 10 |
| `YAMLNullAsEmpty` | `true` |
| `YAMLNumberAsString` | `true` |
| `YAMLBoolAsString` | `true` |
| `YAMLMaxDepth` | 10 |
| `ValidateUTF8` | `false` |
| `AuditEnabled` | `false` |
| `Prefix` | `""` |

---

### DevelopmentConfig

```go
func DevelopmentConfig() Config
```

返回开发环境配置（宽松限制）。

**与默认配置的差异：**
- `OverwriteExisting`: `true`
- `AllowYamlSyntax`: `true`
- `MaxFileSize`: 10MB

::: tip 安全保障
`ValidateValues` 在所有预设配置中始终保持 `true`（与默认值一致），确保安全性不受环境影响。
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

返回测试环境配置。

**与默认配置的差异：**
- `OverwriteExisting`: `true`
- `MaxFileSize`: 64KB
- `MaxVariables`: 50

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

返回生产环境配置（严格验证 + 审计）。

**与默认配置的差异：**
- `FailOnMissingFile`: `true`
- `AuditEnabled`: `true`
- `MaxFileSize`: 64KB
- `MaxVariables`: 50

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
| 文件大小限制 | 2MB | 10MB | 64KB | 64KB |
| 最大变量数 | 500 | 500 | 50 | 50 |
| 禁止键检查 | ✓ | ✓ | ✓ | ✓ |
| 值验证 | ✓ | ✓ | ✓ | ✓ |

::: tip 选择建议
- **开发环境**：使用 `DevelopmentConfig()`，宽松限制便于快速迭代
- **测试环境**：使用 `TestingConfig()`，允许覆盖便于测试隔离
- **生产环境**：使用 `ProductionConfig()`，启用审计和严格验证
:::

---

## 方法

### Validate

```go
func (c *Config) Validate() error
```

验证配置有效性。检查所有限制值是否在有效范围内。

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 1000

if err := cfg.Validate(); err != nil {
    // 配置无效
}
```

**验证规则：**
- 所有限制值必须为正数
- 所有限制值不能超过硬性上限
- `KeyPattern` 如果非 nil，必须能匹配有效键名（如 `TEST_KEY`）、不能匹配空字符串、不能匹配数字开头的键名
- `JSONMaxDepth` 和 `YAMLMaxDepth` 必须在 1-100 之间

---

### IsZero

```go
func (c *Config) IsZero() bool
```

检查 Config 是否为未初始化的零值。用于判断是否应使用 `DefaultConfig()`。

**返回：**
- `bool` - 是否为零值配置

**检测范围：**
- 数值限制（MaxFileSize、MaxVariables 等）
- 布尔字段（ValidateValues、AutoApply 等）
- 指针/接口字段（KeyPattern、FileSystem 等）
- 切片字段（Filenames、RequiredKeys 等）

::: warning 注意
部分初始化的 Config 可能不被检测为零值。建议始终从 `DefaultConfig()` 开始自定义配置：

```go
// 推荐
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}

// 不推荐（部分字段为零值）
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
    log.Fatal("缺少必需配置:", err)
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

## 相关文档

- [Loader API](/zh/env/api-reference/loader) - 加载器方法
- [常量与错误](/zh/env/api-reference/constants) - 限制常量与错误类型
- [审计日志](/zh/env/guides/audit-logging) - 审计配置指南
