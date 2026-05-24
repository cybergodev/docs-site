---
title: "常量与错误 - CyberGo env | 哨兵错误与安全常量"
description: "CyberGo env 库常量与错误完整参考，涵盖 DefaultMaxFileSize 安全限制、ErrFileNotFound 哨兵错误、ParseError 结构化错误类型、IsSensitiveKey 和 MaskValue 工具函数，配合 errors.Is 和 errors.As 帮助处理各类错误场景。"
---

# 常量与错误

库定义的常量、错误类型、哨兵错误和预定义变量。

## 安全限制常量

### 默认限制

```go
const (
    // DefaultMaxFileSize - 单文件最大字节数
    DefaultMaxFileSize int64 = 2 * 1024 * 1024  // 2 MB

    // DefaultMaxLineLength - 单行最大长度
    DefaultMaxLineLength int = 1024  // 1 KB

    // DefaultMaxKeyLength - 键名最大长度
    DefaultMaxKeyLength int = 64

    // DefaultMaxValueLength - 值最大长度
    DefaultMaxValueLength int = 4096  // 4 KB

    // DefaultMaxVariables - 每文件最大变量数
    DefaultMaxVariables int = 500

    // DefaultMaxExpansionDepth - 变量展开最大深度
    DefaultMaxExpansionDepth int = 5
)
```

### 硬性上限

::: warning 注意
以下为库内部硬性上限（未导出），用于 `Config.Validate()` 内部检查。用户无法直接引用这些常量，但 `cfg.Validate()` 会自动检查配置是否超过这些限制。
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
cfg.MaxFileSize = 200 * 1024 * 1024  // 超过 100MB 上限

if err := cfg.Validate(); err != nil {
    // 返回错误: MaxFileSize exceeds hard limit
}
```

## 哨兵错误

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

### 解析错误

```go
var ErrLineTooLong = errors.New("line exceeds maximum length limit")
var ErrInvalidKey = errors.New("invalid key format")
var ErrDuplicateKey = errors.New("duplicate key encountered")
```

### 安全错误

```go
var ErrForbiddenKey = errors.New("key is forbidden for security reasons")
var ErrSecurityViolation = errors.New("security policy violation")
var ErrInvalidValue = errors.New("invalid value content")
```

检查禁止键：

```go
err := loader.Set("PATH", "value")
if errors.Is(err, env.ErrForbiddenKey) {
    // 尝试设置禁止键
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
```

**检查方式：**

```go
// 检查加载器是否已关闭
if errors.Is(err, env.ErrClosed) {
    // 加载器已关闭
}

// 检查默认加载器是否已初始化
if errors.Is(err, env.ErrAlreadyInitialized) {
    // 默认加载器已存在，无法重复调用 Load()
}

// 检查默认加载器是否未初始化
if errors.Is(err, env.ErrNotInitialized) {
    // 需要先调用 env.Load() 或 env.LoadWithConfig()
}

// 检查必需键是否缺失
if errors.Is(err, env.ErrMissingRequired) {
    // 缺少必需键
}
```

### 适配器错误

```go
var ErrValidateRequiredUnsupported = errors.New(
    "custom validator does not implement ValidateRequired; " +
    "implement Validator interface for required key validation",
)
```

当自定义验证器仅实现 `KeyValidator` 接口而未实现完整 `Validator` 接口时，调用 `ValidateRequired` 会返回此错误。

**检查方式：**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // 自定义验证器不支持必需键验证
    // 需要实现完整的 Validator 接口
}
```

::: tip 解决方法
实现 `Validator` 接口（包含 `ValidateKey`、`ValidateValue`、`ValidateRequired` 三个方法）而非仅实现 `KeyValidator`。
:::

## 错误类型

### ParseError

解析错误，包含位置信息：

```go
type ParseError struct {
    File    string  // 文件名
    Line    int     // 行号
    Content string  // 错误内容（已掩码）
    Err     error   // 原始错误
}
```

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

```go
type ValidationError struct {
    Field   string  // 字段名
    Value   string  // 值（已掩码）
    Rule    string  // 规则
    Message string  // 消息
}
```

### SecurityError

安全错误：

```go
type SecurityError struct {
    Action  string  // 操作
    Reason  string  // 原因
    Key     string  // 键名（已掩码）
    Details string  // 额外详情
}
```

使用示例：

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("安全错误: %s - %s\n", secErr.Action, secErr.Reason)
}
```

### FileError

文件操作错误：

```go
type FileError struct {
    Path  string  // 文件路径
    Op    string  // 操作（open, stat, size_check）
    Err   error   // 原始错误
    Size  int64   // 文件大小（Size 检查时）
    Limit int64   // 限制（Size 检查时）
}
```

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

```go
type ExpansionError struct {
    Key   string  // 键名
    Depth int     // 当前深度
    Limit int     // 限制
    Chain string  // 展开链
}
```

### JSONError

JSON 解析错误：

```go
type JSONError struct {
    Path    string  // 文件路径
    Message string  // 错误消息
    Err     error   // 原始错误
}
```

### YAMLError

YAML 解析错误：

```go
type YAMLError struct {
    Path    string  // 文件路径
    Line    int     // 行号
    Column  int     // 列号
    Message string  // 错误消息
    Err     error   // 原始错误
}
```

### MarshalError

序列化错误：

```go
type MarshalError struct {
    Field   string  // 字段名
    Message string  // 错误消息
}

func IsMarshalError(err error) bool  // 检查函数
```

## 预定义变量

### DefaultForbiddenKeys

内置禁止键列表，防止修改系统关键变量：

::: warning 注意
`defaultForbiddenKeys` 为库内部变量（未导出），无法直接通过 `env.DefaultForbiddenKeys` 访问。以下为内部使用的完整列表，供参考。
:::

| 类别 | 禁止键 |
|------|--------|
| 系统路径 | `PATH` |
| 动态链接器 (Linux) | `LD_PRELOAD`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64`, `LD_AUDIT`, `LD_DEBUG` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Windows | `COMSPEC`, `PATHEXT`, `SYSTEMROOT`, `WINDIR` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| 语言运行时 | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

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
// 尝试设置禁止键会返回 ErrForbiddenKey
err := loader.Set("PATH", "/malicious/path")
if errors.Is(err, env.ErrForbiddenKey) {
    // 键被禁止
}

// 添加额外的禁止键
cfg := env.DefaultConfig()
cfg.ForbiddenKeys = []string{"MY_SENSITIVE_VAR"}
```

### SensitiveKeyPatterns

敏感键模式列表，用于自动检测敏感配置。键名包含这些模式（不区分大小写）时会被识别为敏感：

::: warning 注意
`sensitiveKeyPatterns` 为库内部变量（未导出），通过 `IsSensitiveKey()` 函数间接访问。以下为主要敏感模式类别，供参考。
:::

**主要敏感模式类别：**

| 类别 | 模式示例 |
|------|----------|
| 认证与授权 | `PASSWORD`, `SECRET`, `TOKEN`, `AUTH`, `CREDENTIAL`, `PASSPHRASE`, `SESSION`, `COOKIE` |
| API 与密钥 | `API_KEY`, `APIKEY`, `ACCESS_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `PUBLIC_KEY` |
| 加密与安全 | `PRIVATE`, `ENCRYPTION_KEY`, `ENCRYPT_KEY`, `DECRYPT_KEY`, `SIGNING_KEY`, `SIGN_KEY`, `VERIFY_KEY` |
| 金融与 PII | `SSN`, `SOCIAL_SECURITY`, `CREDIT_CARD`, `CARD_NUMBER`, `CVV`, `CVC`, `CCV`, `PAN` |
| 加密货币 | `MNEMONIC`, `SEED`, `RECOVERY`, `WALLET`, `PRIVATE_ADDRESS` |
| 数据库 | `CONNECTION_STRING`, `CONN_STRING`, `DATABASE_URL`, `DB_PASSWORD` |
| 云服务 | `AWS_SECRET`, `AZURE_KEY`, `GCP_KEY`, `SERVICE_ACCOUNT` |

**匹配规则：**
- 不区分大小写
- 键名包含任一模式即被识别为敏感

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
`nil` 值启用快速字节级验证（约 10 倍性能提升）。
默认验证规则：以字母开头，只包含字母、数字、下划线。
:::

**自定义模式：**

```go
import "regexp"

cfg := env.DefaultConfig()
// 只允许大写字母开头
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,63}$`)
```

## 安全工具函数

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

检查键名是否匹配敏感模式。

```go
if env.IsSensitiveKey("DB_PASSWORD") {
    // 敏感键，使用安全方式处理
    secret := env.GetSecure("DB_PASSWORD")
    defer secret.Release()
}
```

### MaskValue

```go
func MaskValue(key, value string) string
```

根据键的敏感性返回掩码值。

```go
// 敏感键 - 返回 [MASKED:N chars] 格式
masked := env.MaskValue("API_KEY", "secret123")
// 返回: [MASKED:9 chars]

// 非敏感键 - 返回原值（超过 20 字符则截断）
masked := env.MaskValue("APP_NAME", "myapp")
// 返回: myapp
masked := env.MaskValue("DESCRIPTION", "this is a very long description text")
// 返回: this is a very lo...
```

### MaskKey

```go
func MaskKey(key string) string
```

掩码键名用于日志。

```go
masked := env.MaskKey("DB_PASSWORD")
// 返回: DB***
```

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

掩码字符串中的潜在敏感内容。截断超过 50 字符的字符串。

**参数：**
- `s` - 原始字符串

**返回：**
- `string` - 掩码后的字符串

```go
// 长字符串会被截断
log := "This is a very long log message that exceeds 50 characters and will be truncated"
clean := env.MaskSensitiveInString(log)
// 返回: "This is a very long log message that exceeds 50..."

// 短字符串保持不变
short := "Short message"
clean := env.MaskSensitiveInString(short)
// 返回: "Short message"
```

::: warning 注意
此函数主要用于截断长字符串。如需自动掩码敏感键值对，请使用 `SanitizeForLog`。
:::

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

清理字符串中的敏感键值对信息。自动检测并掩码 `key=value` 格式中的敏感值。

**参数：**
- `s` - 原始字符串

**返回：**
- `string` - 清理后的字符串

**检测的敏感键模式：**
- `password=`, `secret=`, `token=`, `auth=`, `credential=`, `passphrase=`, `session=`, `cookie=`
- `api_key=`, `apikey=`, `access_key=`, `secret_key=`, `private_key=`, `public_key=`
- `encrypt_key=`, `decrypt_key=`, `signing_key=`
- `ssn=`, `credit_card=`, `card_number=`, `cvv=`, `cvc=`
- `mnemonic=`, `seed=`, `recovery=`, `wallet=`
- `connection_string=`, `database_url=`, `db_password=`

```go
// 自动掩码敏感键值对
msg := "Connected with password=secret123 api_key=abc123"
clean := env.SanitizeForLog(msg)
// 返回: "Connected with password=[MASKED] api_key=[MASKED]"

// 非敏感键值对保持不变
msg := "Config loaded: app_name=myapp port=8080"
clean := env.SanitizeForLog(msg)
// 返回: "Config loaded: app_name=myapp port=8080"
```

::: tip 使用场景
适用于日志输出、错误消息、调试信息等需要自动过滤敏感键值对的场景。
:::

### ClearBytes

```go
func ClearBytes(b []byte)
```

安全清零字节切片。

```go
sensitive := []byte("secret-data")
// 使用...
env.ClearBytes(sensitive)
// sensitive 现在全是 0
```

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
case errors.Is(err, env.ErrForbiddenKey):
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
    "fmt"
    "log"
    "os"

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

- [SecureValue API](/zh/env/api-reference/secure-value) - 安全工具函数完整 API
- [Config API](/zh/env/api-reference/config) - 配置选项与限制设置
- [安全概述](/zh/env/security/) - 安全架构与核心特性
- [生产检查清单](/zh/env/security/production-checklist) - 上线前安全检查
