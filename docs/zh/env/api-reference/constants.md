---
sidebar_label: "常量与错误"
title: "常量与错误 - CyberGo env | 哨兵错误与安全常量"
description: "CyberGo env 常量与错误参考，含 DefaultMaxFileSize 与 MaxVariables 限制、ErrFileNotFound 哨兵错误、ParseError 类型、DefaultForbiddenKeys 禁止键及 IsSensitiveKey、MaskValue 工具函数。"
sidebar_position: 7
---

# 常量与错误

库定义的常量、错误类型、哨兵错误和预定义变量。

## 安全限制常量

### 默认限制

```go
const (
    // DefaultMaxFileSize - 单文件最大字节数
    DefaultMaxFileSize int64 = 8 * 1024 * 1024  // 8 MB

    // DefaultMaxLineLength - 单行最大长度
    DefaultMaxLineLength int = 8192  // 8 KB

    // DefaultMaxKeyLength - 键名最大长度
    DefaultMaxKeyLength int = 128

    // DefaultMaxValueLength - 值最大长度
    DefaultMaxValueLength int = 8192  // 8 KB

    // DefaultMaxVariables - 每文件最大变量数
    DefaultMaxVariables int = 1000

    // DefaultMaxExpansionDepth - 变量展开最大深度
    DefaultMaxExpansionDepth int = 5
)
```

六个默认限制常量与 `Config` 同名字段一一对应，可被同名字段覆盖：

| 常量 | 对应限制 |
|------|----------|
| `DefaultMaxFileSize` | 单文件字节数 |
| `DefaultMaxLineLength` | 单行长度 |
| `DefaultMaxKeyLength` | 键名长度 |
| `DefaultMaxValueLength` | 值长度 |
| `DefaultMaxVariables` | 每文件变量数 |
| `DefaultMaxExpansionDepth` | 变量展开深度 |

### 硬性上限

::: warning 注意
以下为 `Config.Validate()` 检查的库内部硬性上限（未导出）。这些常量无法直接引用，调用 `cfg.Validate()` 时会自动检查配置是否超过限制。

解析器另有 YAML 令牌数与 JSON 节点数两项硬性上限（HardMaxYAMLTokens / HardMaxJSONNodes，均为 200000，同样未导出），在解析期拦截内存放大输入，不在 `Config.Validate()` 的检查范围内。
:::

| 常量 | 值 | 说明 |
|------|-----|------|
| HardMaxFileSize | 100 MB | 文件大小硬性上限 |
| HardMaxLineLength | 64 KB | 行长度硬性上限 |
| HardMaxKeyLength | 1024 | 键长度硬性上限 |
| HardMaxValueLength | 1 MB | 值长度硬性上限 |
| HardMaxVariables | 10000 | 变量数硬性上限 |
| HardMaxExpansionDepth | 20 | 展开深度硬性上限 |

配置验证会检查是否超过硬性限制：

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 200 * 1024 * 1024  // 超过 100 MB 上限

if err := cfg.Validate(); err != nil {
    // 返回错误：MaxFileSize exceeds hard limit
}
```

## 哨兵错误

::: tip 匹配方式
下列哨兵均可通过 `errors.Is` 匹配。`*ValidationError`、`*SecurityError` 与 `*ExpansionError` 实现了 `Is()`，按 `Rule`/`Action`/`Kind` 映射到 `ErrInvalidKey`、`ErrMissingRequired`、`ErrMaxVariables`、`ErrInvalidValue`、`ErrForbiddenKey`、`ErrSecurityViolation`、`ErrExpansionDepth` 等哨兵。

具体映射见下文各类型的 `Is` 行。需要文件、行号、字段等详情时，再用 `errors.As` 提取结构化错误，两种方式互补。
:::

### 文件错误

```go
var ErrFileNotFound = errors.New("file not found")
var ErrFileTooLarge = errors.New("file exceeds maximum size limit")
```

检查方式：

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    // 文件不存在
}
if errors.Is(err, env.ErrFileTooLarge) {
    // 文件过大
}
```

`ErrFileTooLarge` 有两种返回形态，`errors.Is` 都能匹配：

- 原始哨兵：`.env` 解析期由加固读取层在超过上限时直接返回
- 包装为 `*FileError`：预检 `Stat` 体积超限或结构化格式（JSON/YAML）解析超限时，`Op` 为 `size_check`，`Size` 与 `Limit` 同时填充

`ErrFileNotFound` 则由 `*FileError`（`Op` 为 `open`）包装返回。

### 解析错误

```go
var ErrLineTooLong = errors.New("line exceeds maximum length limit")
var ErrInvalidKey = errors.New("invalid key format")
var ErrDuplicateKey = errors.New("duplicate key encountered")
```

::: tip 触发条件
`ErrDuplicateKey` 在两种情形返回，均可由 `errors.Is` 匹配：

- 采用 `DuplicateKeyPolicy = DuplicateKeyError` 时，同一 `.env`/YAML/JSON 文档（含 YAML 内联 JSON）内出现重复键
- YAML/JSON 展平时出现扁平键冲突

默认的 `DuplicateKeyInherit` 下，重复键按跳过或覆盖处理，不报错。
:::

### 安全错误

```go
var ErrForbiddenKey = errors.New("key is forbidden for security reasons")
var ErrSecurityViolation = errors.New("security policy violation")
var ErrInvalidValue = errors.New("invalid value content")
```

检查禁止键：

```go
err := loader.Set("PATH", "value")
if errors.Is(err, env.ErrSecurityViolation) {
    // 尝试设置禁止键返回 *SecurityError
}
```

### 展开错误

```go
var ErrExpansionDepth = errors.New("variable expansion depth exceeded")
```

### 限制错误

```go
var ErrMaxVariables = errors.New("maximum number of variables exceeded")
```

### 状态错误

```go
var ErrClosed = errors.New("loader has been closed")
var ErrInvalidConfig = errors.New("invalid configuration")
var ErrAlreadyInitialized = errors.New("default loader already initialized")
var ErrNotInitialized = errors.New("default loader not initialized; call Load() first")
var ErrMissingRequired = errors.New("required key is missing")
var ErrAuditFailed = errors.New("audit logging failed") // 审计事件丢失（fail-closed 审计启用时）
```

`ErrAuditFailed` 仅在启用 fail-closed 审计（`Config.AuditFailClosed = true`）时返回。处理器报错、panic 或满通道丢事件，都会使产生该事件的操作返回此错误。

并发场景下，被闩锁的失败由**最先检查的那一次操作**取走，因此错误归属是尽力而为的，不保证精确对应到最初丢失事件的那次调用。参见 [Config API](./config#auditfailclosed-bool)。

**检查方式：**

```go
// 检查加载器是否已关闭
if errors.Is(err, env.ErrClosed) {
    // 加载器已关闭
}

// 检查默认加载器是否已初始化
if errors.Is(err, env.ErrAlreadyInitialized) {
    // 默认加载器已存在：Load/Overload/LoadWithConfig 共用同一个默认加载器，只能初始化一次
}

// 检查默认加载器是否未初始化
if errors.Is(err, env.ErrNotInitialized) {
    // 需要先调用 env.Load()、env.Overload() 或 env.LoadWithConfig() 完成初始化
}

// 检查键格式是否非法（*ValidationError 的 Is() 会把它映射到哨兵）
if errors.Is(err, env.ErrInvalidKey) {
    // 键格式非法
}

// 检查必需键是否缺失
if errors.Is(err, env.ErrMissingRequired) {
    // 缺少必需键
}

// 可选：需要字段/规则等详情时，用 errors.As 提取结构化错误
var valErr *env.ValidationError
if errors.As(err, &valErr) {
    // valErr.Field / valErr.Rule 提供详细定位
}
```

### 适配器错误

```go
var ErrValidateRequiredUnsupported = errors.New(
    "custom validator does not implement ValidateRequired; " +
    "implement Validator interface for required key validation",
)
```

当自定义验证器只实现 `KeyValidator` 接口、未实现完整的 `Validator` 接口时，调用 `ValidateRequired` 会返回此错误。

**检查方式：**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // 自定义验证器不支持必需键验证
    // 需要实现完整的 Validator 接口
}
```

::: tip 解决方法
实现 `Validator` 接口而非只实现 `KeyValidator`。`Validator` 包含 `ValidateKey`、`ValidateValue`、`ValidateRequired` 三个方法。
:::

## 错误类型

以下类型均为 internal 包同名类型的公开别名，全部实现 `Error` 方法。此外：

- `ParseError`、`FileError`、`JSONError`、`YAMLError` 携带底层错误，另实现 `Unwrap`
- `ValidationError`、`SecurityError`、`ExpansionError` 参与哨兵映射，另实现 `Is`

各类型成员以下表限定名（形如 `ParseError.File`）索引。

### ParseError

解析错误，包含位置信息：

| 成员 | 类型/签名 | 说明 |
|------|-----------|------|
| `ParseError.File` | `string` | 出错的文件名 |
| `ParseError.Line` | `int` | 行号 |
| `ParseError.Content` | `string` | 错误内容（已掩码） |
| `ParseError.Err` | `error` | 原始错误 |
| `ParseError.Error` | `func (e *ParseError) Error() string` | 实现 `error` 接口，输出含文件名与行号（无文件名时省略文件段） |
| `ParseError.Unwrap` | `func (e *ParseError) Unwrap() error` | 返回底层 `Err`，供 `errors.Is` / `errors.As` 穿透 |

使用示例：

```go
err := loader.LoadFiles(".env")
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("解析错误 %s:%d: %v\n",
        parseErr.File, parseErr.Line, parseErr.Err)
}
```

### ValidationError

验证错误：

| 成员 | 类型/签名 | 说明 |
|------|-----------|------|
| `ValidationError.Field` | `string` | 失败的配置字段或键名字段 |
| `ValidationError.Value` | `string` | 值（已掩码） |
| `ValidationError.Rule` | `string` | 违反的规则 |
| `ValidationError.Message` | `string` | 人类可读说明 |
| `ValidationError.Error` | `func (e *ValidationError) Error() string` | 实现 `error` 接口，含字段名与消息 |
| `ValidationError.Is` | `func (e *ValidationError) Is(target error) bool` | 按 `Rule` 映射哨兵。`value`/`null_byte`/`control_char`/`utf8` → `ErrInvalidValue`；`required` → `ErrMissingRequired`；`max_variables` → `ErrMaxVariables`；Field 为 `key` 时的 `non_empty`/`max_length`/`ascii_only`/`pattern` → `ErrInvalidKey` |

### SecurityError

安全错误：

| 成员 | 类型/签名 | 说明 |
|------|-----------|------|
| `SecurityError.Action` | `string` | 被阻止的操作 |
| `SecurityError.Reason` | `string` | 阻止原因 |
| `SecurityError.Key` | `string` | 涉及的键名（已掩码） |
| `SecurityError.Details` | `string` | 额外详情（已掩码） |
| `SecurityError.Error` | `func (e *SecurityError) Error() string` | 实现 `error` 接口，含被阻止的操作与原因 |
| `SecurityError.Is` | `func (e *SecurityError) Is(target error) bool` | 匹配 `ErrSecurityViolation`；禁止键与白名单拒绝（Action 为 `key_access`）另匹配 `ErrForbiddenKey` |

使用示例：

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("安全错误: %s - %s\n", secErr.Action, secErr.Reason)
}
```

### FileError

文件操作错误：

| 成员 | 类型/签名 | 说明 |
|------|-----------|------|
| `FileError.Path` | `string` | 文件路径 |
| `FileError.Op` | `string` | 失败的操作：`open`（打开失败）、`stat`（取文件信息失败）、`size_check`（超过大小限制）、`parse`（找不到对应格式的解析器） |
| `FileError.Err` | `error` | 原始错误 |
| `FileError.Size` | `int64` | 文件大小（大小检查时） |
| `FileError.Limit` | `int64` | 超出的限制（大小检查时） |
| `FileError.Error` | `func (e *FileError) Error() string` | 实现 `error` 接口；`Size` 与 `Limit` 均为正时附带 `(size N exceeds limit M)` 细节 |
| `FileError.Unwrap` | `func (e *FileError) Unwrap() error` | 返回底层 `Err`，供 `errors.Is` / `errors.As` 穿透 |

使用示例：

```go
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("文件 %s 大小 %d 超过限制 %d\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}
```

### ExpansionError

变量展开错误：

| 成员 | 类型/签名 | 说明 |
|------|-----------|------|
| `ExpansionError.Key` | `string` | 被展开的键名（输出时掩码） |
| `ExpansionError.Depth` | `int` | 当前展开深度 |
| `ExpansionError.Limit` | `int` | 深度上限 |
| `ExpansionError.Chain` | `string` | 展开链（已脱敏） |
| `ExpansionError.Kind` | `ExpansionErrorKind` | 错误原因类别（零值 = 深度/循环） |
| `ExpansionError.Error` | `func (e *ExpansionError) Error() string` | 实现 `error` 接口；输出中的键名替换为 `[MASKED]`（与 `MaskKey` 一致，不暴露键名拼写与长度） |
| `ExpansionError.Is` | `func (e *ExpansionError) Is(target error) bool` | 仅在 `Kind != ExpansionRequiredKind` 时匹配 `ErrExpansionDepth`，语义见下方「`errors.Is` 行为」 |

**错误分类（Kind 字段）：**

```go
type ExpansionErrorKind int

const (
    // ExpansionDepthKind 表示展开触达递归深度限制或检测到变量循环。
    // 这是零值，因此常见的深度/循环错误无需显式分类。
    // errors.Is(err, ErrExpansionDepth) 可匹配此类错误。
    ExpansionDepthKind ExpansionErrorKind = iota

    // ExpansionRequiredKind 表示必需变量（${VAR:?message}）未设置或为空。
    // 这不属于深度溢出，因此不会匹配 ErrExpansionDepth。
    ExpansionRequiredKind
)
```

**`errors.Is` 行为：** `*ExpansionError` 仅在 `Kind != ExpansionRequiredKind` 时匹配 `ErrExpansionDepth`。必需变量错误是独立的失败模式，不通过 `ErrExpansionDepth` 匹配。

使用示例：

```go
var expErr *env.ExpansionError
if errors.As(err, &expErr) {
    switch expErr.Kind {
    case env.ExpansionDepthKind:
        // 深度溢出或循环：errors.Is(err, env.ErrExpansionDepth) == true
        fmt.Printf("深度 %d/%d，链：%s\n", expErr.Depth, expErr.Limit, expErr.Chain)
    case env.ExpansionRequiredKind:
        // 必需变量未设置：errors.Is(err, env.ErrExpansionDepth) == false
        fmt.Printf("必需变量 %s 未设置\n", expErr.Key)
    }
}
```

### JSONError

JSON 解析错误：

| 成员 | 类型/签名 | 说明 |
|------|-----------|------|
| `JSONError.Path` | `string` | JSON 文档内路径（非文件路径） |
| `JSONError.Message` | `string` | 错误消息 |
| `JSONError.Err` | `error` | 原始错误 |
| `JSONError.Error` | `func (e *JSONError) Error() string` | 实现 `error` 接口，含文档内路径 |
| `JSONError.Unwrap` | `func (e *JSONError) Unwrap() error` | 返回底层 `Err`，供 `errors.Is` / `errors.As` 穿透 |

### YAMLError

YAML 解析错误：

| 成员 | 类型/签名 | 说明 |
|------|-----------|------|
| `YAMLError.Path` | `string` | YAML 文档内路径（非文件路径） |
| `YAMLError.Line` | `int` | 行号 |
| `YAMLError.Column` | `int` | 列号 |
| `YAMLError.Message` | `string` | 错误消息 |
| `YAMLError.Err` | `error` | 原始错误 |
| `YAMLError.Error` | `func (e *YAMLError) Error() string` | 实现 `error` 接口，含文档内路径与行列号 |
| `YAMLError.Unwrap` | `func (e *YAMLError) Unwrap() error` | 返回底层 `Err`，供 `errors.Is` / `errors.As` 穿透 |

### MarshalError

序列化错误（检查函数 `IsMarshalError(err error) bool`）：

| 成员 | 类型/签名 | 说明 |
|------|-----------|------|
| `MarshalError.Field` | `string` | 出错的字段名 |
| `MarshalError.Message` | `string` | 错误消息 |
| `MarshalError.Error` | `func (e *MarshalError) Error() string` | 实现 `error` 接口，含字段名与消息 |

`MarshalError` 的字段均为普通值，没有 `Unwrap` 方法，因此不存在可解包的底层错误。

## 预定义变量

### DefaultForbiddenKeys

内置禁止键列表，防止修改系统关键变量：

::: warning 注意
该列表对应库内部变量 `defaultForbiddenKeysSlice`（未导出），无法通过 `env.DefaultForbiddenKeys` 之类的名字访问。下表为内部使用的完整列表，供参考。
:::

| 类别 | 禁止键 |
|------|--------|
| 系统路径 | `PATH` |
| 动态链接器（Linux） | `LD_PRELOAD`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64`, `LD_AUDIT`, `LD_DEBUG` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Windows | `COMSPEC`, `PATHEXT`, `SYSTEMROOT`, `WINDIR` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS`, `PS4`, `SHELLOPTS`, `BASHOPTS` |
| Python | `PYTHONPATH`, `PYTHONSTARTUP`, `PYTHONINSPECT` |
| Node.js | `NODE_PATH`, `NODE_OPTIONS` |
| Ruby | `RUBYLIB`, `RUBYOPT`, `GEM_PATH`, `GEM_HOME` |
| Perl | `PERL5OPT`, `PERL5LIB` |
| JVM | `JAVA_TOOL_OPTIONS`, `JDK_JAVA_OPTIONS`, `_JAVA_OPTIONS`, `CLASSPATH` |
| Rust | `RUSTFLAGS` |
| Git | `GIT_CONFIG_COUNT`, `GIT_PROXY_COMMAND` |

**风险说明：**

| 键 | 风险类型 | 说明 |
|----|----------|------|
| `PATH` | 命令劫持 | 修改命令搜索路径 |
| `LD_PRELOAD` | 库注入 | 预加载恶意动态库 |
| `LD_LIBRARY_PATH` | 库劫持 | 修改库搜索路径 |
| `DYLD_INSERT_LIBRARIES` | 库注入 | macOS 库注入 |
| `COMSPEC` | 命令劫持 | Windows 命令解释器路径覆盖 |
| `PATHEXT` | 命令劫持 | Windows 可执行文件扩展名篡改 |
| `SYSTEMROOT` | 系统破坏 | Windows 系统根目录篡改 |
| `WINDIR` | 系统破坏 | Windows 目录篡改 |
| `PYTHONPATH` | 模块劫持 | Python 模块搜索路径 |
| `IFS` | 解析攻击 | 修改字段分隔符 |

**使用示例：**

```go
// 设置禁止键返回 *SecurityError
err := loader.Set("PATH", "/malicious/path")
if errors.Is(err, env.ErrSecurityViolation) {
    // 键被禁止
}

// 添加额外的禁止键
cfg := env.DefaultConfig()
cfg.ForbiddenKeys = []string{"MY_SENSITIVE_VAR"}
```

### SensitiveKeyPatterns

敏感键模式列表，用于自动检测敏感配置。匹配不区分大小写。

::: warning 注意
敏感模式列表是库内部变量 `internal.Patterns`，未从 env 包导出，只能经 `IsSensitiveKey()` 函数间接使用。下表列出主要类别，供参考。
:::

**主要敏感模式类别：**

| 类别 | 模式示例 |
|------|----------|
| 认证与授权 | `PASSWORD`, `PASSWD`, `SECRET`, `TOKEN`, `AUTH`, `CREDENTIAL`, `PASSPHRASE`, `SESSION`, `COOKIE`, `PWD`, `USERNAME` |
| API 与密钥 | `API_KEY`, `APIKEY`, `ACCESS_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `PUBLIC_KEY`, `KEYSTORE` |
| 加密与安全 | `PRIVATE`, `ENCRYPTION_KEY`, `ENCRYPT_KEY`, `DECRYPT_KEY`, `SIGNING_KEY`, `SIGN_KEY`, `VERIFY_KEY`, `CERT`, `SALT`, `NONCE` |
| 金融与 PII | `SSN`, `SOCIAL_SECURITY`, `CREDIT_CARD`, `CARD_NUMBER`, `CVV`, `CVC`, `CCV`, `PAN` |
| 加密货币 | `MNEMONIC`, `SEED`, `RECOVERY`, `WALLET`, `PRIVATE_ADDRESS` |
| 数据库 | `CONNECTION_STRING`, `CONN_STRING`, `DATABASE_URL`, `DB_PASSWORD`, `DSN` |
| 云服务 | `AWS_SECRET`, `AZURE_KEY`, `GCP_KEY`, `SERVICE_ACCOUNT` |

**匹配规则：**
- 键名包含任一模式即被识别为敏感（子串匹配）
- 例外：短模式 `AUTH`、`PAN`、`PWD`、`USERNAME` 只在**标识符边界**匹配（SEC-06）
- 边界判定只看字母与数字，下划线算边界。`DB_AUTH`、`AUTH_TOKEN`、`MYSQL_PWD` 命中；`AUTHOR`、`AUTHORITY`、`COMPANY` 不命中

**使用示例：**

```go
// 检查键是否敏感
if env.IsSensitiveKey("DB_PASSWORD") {
    // 使用安全方式处理
    secret := env.GetSecure("DB_PASSWORD")
    if secret != nil {
        defer secret.Release()
    }
}
```

### DefaultKeyPattern

默认键名验证模式：

```go
var DefaultKeyPattern *regexp.Regexp = nil
```

::: tip 性能优化
`nil` 值启用快速字节级校验（比正则约快 10 倍）。内置规则等价于 `^[A-Za-z][A-Za-z0-9_]*$`：以字母开头，只含字母、数字、下划线。

它是进程级全局变量，`New()` 读取时不加锁。请在程序初始化阶段赋值，不要在并发使用该包之后再改。
:::

**自定义模式：**

```go
import "regexp"

cfg := env.DefaultConfig()
// 只允许大写字母开头
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,63}$`)
```

## 安全工具函数

`IsSensitiveKey`、`MaskValue`、`MaskKey`、`MaskSensitiveInString`、`SanitizeForLog` 与 `ClearBytes` 六个安全工具函数的完整签名、参数与示例，集中维护在 [SecureValue API 的「安全工具函数」](./secure-value#安全工具函数)一节。分工速查：

| 函数 | 作用 |
|------|------|
| `IsSensitiveKey` | 判定键名是否敏感 |
| `MaskValue` | 按键名敏感性掩码值 |
| `MaskKey` | 掩码键名（恒为 `[MASKED]`） |
| `SanitizeForLog` | 日志脱敏，掩码 `key=value` 与 `key: value` 中的敏感值 |
| `MaskSensitiveInString` | 长字符串截断后再做日志脱敏 |
| `ClearBytes` | 字节切片安全清零 |

## FileFormat 常量

文件格式类型：

```go
type FileFormat int

const (
    FormatAuto  FileFormat = iota  // 自动检测
    FormatEnv                      // .env 格式
    FormatJSON                     // JSON 格式
    FormatYAML                     // YAML 格式
)
```

使用示例：

```go
// 检测格式
format := env.DetectFormat("config.json")  // FormatJSON

// 指定格式序列化
data, _ := env.Marshal(cfg, env.FormatJSON)

// 格式字符串
fmt.Println(format.String())  // "json"
```

## 错误检查模式

### errors.Is 模式

检查哨兵错误：

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // 文件不存在
case errors.Is(err, env.ErrFileTooLarge):
    // 文件过大
case errors.Is(err, env.ErrSecurityViolation):
    // 禁止键
case errors.Is(err, env.ErrClosed):
    // 加载器已关闭
}
```

### errors.As 模式

提取详细错误信息：

```go
err := loader.LoadFiles(".env")

var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("解析错误在 %s 第 %d 行\n", parseErr.File, parseErr.Line)
}

var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("文件 %s 大小 %d 超过限制 %d\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}

var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("安全错误: %s - %s\n", secErr.Action, secErr.Reason)
}
```

## 完整错误处理示例

```go
package main

import (
	"errors"
	"log"

	"github.com/cybergodev/env"
)

func main() {
	cfg := env.ProductionConfig()
	cfg.FailOnMissingFile = true

	loader, err := env.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer loader.Close()

	err = loader.LoadFiles(".env")
	if err != nil {
		switch {
		case errors.Is(err, env.ErrFileNotFound):
			log.Fatal("配置文件不存在")

		case errors.Is(err, env.ErrFileTooLarge):
			log.Fatal("配置文件过大")

		case errors.Is(err, env.ErrClosed):
			log.Fatal("加载器已关闭")

		default:
			var parseErr *env.ParseError
			if errors.As(err, &parseErr) {
				log.Fatalf("解析错误 %s:%d - %v",
					parseErr.File, parseErr.Line, parseErr.Err)
			}

			var fileErr *env.FileError
			if errors.As(err, &fileErr) {
				log.Fatalf("文件错误 %s - %v", fileErr.Path, fileErr.Err)
			}

			var secErr *env.SecurityError
			if errors.As(err, &secErr) {
				log.Fatalf("安全错误: %s - %s", secErr.Action, secErr.Reason)
			}

			var jsonErr *env.JSONError
			if errors.As(err, &jsonErr) {
				log.Fatalf("JSON 错误 %s: %s", jsonErr.Path, jsonErr.Message)
			}

			var yamlErr *env.YAMLError
			if errors.As(err, &yamlErr) {
				log.Fatalf("YAML 错误 %s:%d:%d - %s",
					yamlErr.Path, yamlErr.Line, yamlErr.Column, yamlErr.Message)
			}

			log.Fatal(err)
		}
	}

	// 验证必需键
	if err := loader.Validate(); err != nil {
		var valErr *env.ValidationError
		if errors.As(err, &valErr) {
			log.Fatalf("验证失败: %s - %s", valErr.Field, valErr.Message)
		}
		log.Fatal(err)
	}
}
```

## 相关文档

- [SecureValue API](./secure-value) - 安全工具函数完整 API
- [Config API](./config) - 配置选项与限制设置
- [安全概述](../security/) - 安全架构与核心特性
- [生产检查清单](../security/production-checklist) - 上线前安全检查
