---
title: "定数とエラー - CyberGo env | センチネルエラーとセキュリティ定数"
description: "CyberGo env ライブラリの定数とエラー完全リファレンス。DefaultMaxFileSize 安全制限、ErrFileNotFound センチネルエラー、ParseError 構造化エラー型、IsSensitiveKey や MaskValue ユーティリティ関数を網羅。errors.Is と errors.As と組み合わせて各種エラーシーンの処理に役立つ。"
---

# 常量与错误

ライブラリが定義する定数、エラー型、センチネルエラー、事前定義変数。

## セキュリティ制限定数

### デフォルト制限

```go
const (
    // DefaultMaxFileSize - 単一ファイルの最大バイト数
    DefaultMaxFileSize int64 = 2 * 1024 * 1024  // 2 MB

    // DefaultMaxLineLength - 単一行の最大長
    DefaultMaxLineLength int = 1024  // 1 KB

    // DefaultMaxKeyLength - キー名の最大長
    DefaultMaxKeyLength int = 64

    // DefaultMaxValueLength - 値の最大長
    DefaultMaxValueLength int = 4096  // 4 KB

    // DefaultMaxVariables - ファイルごとの最大変数数
    DefaultMaxVariables int = 500

    // DefaultMaxExpansionDepth - 変数展開の最大深度
    DefaultMaxExpansionDepth int = 5
)
```

### ハードリミット

::: warning 注意
以下はライブラリ内部のハードリミット（未エクスポート）で、`Config.Validate()` の内部チェックに使用されます。ユーザーはこれらの定数を直接参照できませんが、`cfg.Validate()` が設定がこれらの制限を超えていないか自動的にチェックします。
:::

| 常量 | 值 | 说明 |
|------|-----|------|
| HardMaxFileSize | 100 MB | ファイルサイズのハードリミット |
| HardMaxLineLength | 64 KB | 行の長さのハードリミット |
| HardMaxKeyLength | 1024 | キーの長さのハードリミット |
| HardMaxValueLength | 1 MB | 値の長さのハードリミット |
| HardMaxVariables | 10000 | 変数数のハードリミット |
| HardMaxExpansionDepth | 20 | 展開深度のハードリミット |

設定検証はハードリミットを超えていないか確認します：

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 200 * 1024 * 1024  // 超过 100MB 上限

if err := cfg.Validate(); err != nil {
    // 返回错误: MaxFileSize exceeds hard limit
}
```

## センチネルエラー

### ファイルエラー

```go
var ErrFileNotFound = errors.New("file not found")
var ErrFileTooLarge = errors.New("file exceeds maximum size limit")
```

確認方法：

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    // 文件不存在
}
if errors.Is(err, env.ErrFileTooLarge) {
    // ファイルが大きすぎます
}
```

### 解析エラー

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
    // 禁止キーの設定を試みました
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

**確認方法：**

```go
// ローダーがクローズ済みか確認
if errors.Is(err, env.ErrClosed) {
    // 加载器クローズ済み
}

// 检查默认加载器是否已初始化
if errors.Is(err, env.ErrAlreadyInitialized) {
    // デフォルトローダーが既に存在し、Load を繰り返し呼び出せません
}

// 检查默认加载器是否未初始化
if errors.Is(err, env.ErrNotInitialized) {
    // 需要先调用 env.Load() 或 env.LoadWithConfig()
}

// 检查必需键是否缺失
if errors.Is(err, env.ErrMissingRequired) {
    // 必須キーが不足
}
```

### 适配器错误

```go
var ErrValidateRequiredUnsupported = errors.New(
    "custom validator does not implement ValidateRequired; " +
    "implement Validator interface for required key validation",
)
```

カスタムバリデーターが `KeyValidator` インターフェースのみを実装し、完全な `Validator` インターフェースを実装していない場合、`ValidateRequired` を呼び出すとこのエラーが返されます。

**確認方法：**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // カスタムバリデーター不支持必需键検証
    // 需要实现完整的 Validator 接口
}
```

::: tip 解决方法
`KeyValidator` のみではなく、`Validator` インターフェース（`ValidateKey`、`ValidateValue`、`ValidateRequired` の3つのメソッドを含む）を実装してください。
:::

## 错误类型

### ParseError

解析エラー，包含位置信息：

```go
type ParseError struct {
    File    string  // 文件名
    Line    int     // 行号
    Content string  // 错误内容（已掩码）
    Err     error   // 原始错误
}
```

使用例：

```go
err := loader.LoadFiles(".env")
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("解析エラー %s:%d: %v\n",
        parseErr.File, parseErr.Line, parseErr.Err)
}
```

### ValidationError

検証错误：

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

使用例：

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("セキュリティエラー: %s - %s\n", secErr.Action, secErr.Reason)
}
```

### FileError

ファイル操作エラー：

```go
type FileError struct {
    Path  string  // 文件路径
    Op    string  // 操作（open, stat, size_check）
    Err   error   // 原始错误
    Size  int64   // 文件大小（Size 检查时）
    Limit int64   // 限制（Size 检查时）
}
```

使用例：

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

JSON 解析エラー：

```go
type JSONError struct {
    Path    string  // 文件路径
    Message string  // 错误消息
    Err     error   // 原始错误
}
```

### YAMLError

YAML 解析エラー：

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

シリアライズエラー：

```go
type MarshalError struct {
    Field   string  // 字段名
    Message string  // 错误消息
}

func IsMarshalError(err error) bool  // 检查函数
```

## 事前定義変数

### DefaultForbiddenKeys

組み込み禁止キー列表，防止修改系统关键变量：

::: warning 注意
`defaultForbiddenKeys` はライブラリ内部変数（未エクスポート）であり、`env.DefaultForbiddenKeys` から直接アクセスすることはできません。以下は内部で使用されている完全なリストで、参考用です。
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

**使用例：**

```go
// 禁止キーの設定を試みました会返回 ErrForbiddenKey
err := loader.Set("PATH", "/malicious/path")
if errors.Is(err, env.ErrForbiddenKey) {
    // キーが禁止されています
}

// 添加额外的禁止键
cfg := env.DefaultConfig()
cfg.ForbiddenKeys = []string{"MY_SENSITIVE_VAR"}
```

### SensitiveKeyPatterns

機密キーパターンリスト、機密設定の自動検出に使用されます。キー名にこれらのパターンが含まれる場合（大文字小文字を区別しない）、機密として識別されます：

::: warning 注意
`sensitiveKeyPatterns` はライブラリ内部変数（未エクスポート）であり、`IsSensitiveKey()` 関数を通じて間接的にアクセスします。以下は主要な機密パターンのカテゴリで、参考用です。
:::

**主要な機密パターンのカテゴリ：**

| 类别 | 模式示例 |
|------|----------|
| 认证与授权 | `PASSWORD`, `SECRET`, `TOKEN`, `AUTH`, `CREDENTIAL`, `PASSPHRASE`, `SESSION`, `COOKIE` |
| API 与密钥 | `API_KEY`, `APIKEY`, `ACCESS_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `PUBLIC_KEY` |
| 加密与安全 | `PRIVATE`, `ENCRYPTION_KEY`, `ENCRYPT_KEY`, `DECRYPT_KEY`, `SIGNING_KEY`, `SIGN_KEY`, `VERIFY_KEY` |
| 金融与 PII | `SSN`, `SOCIAL_SECURITY`, `CREDIT_CARD`, `CARD_NUMBER`, `CVV`, `CVC`, `CCV`, `PAN` |
| 加密货币 | `MNEMONIC`, `SEED`, `RECOVERY`, `WALLET`, `PRIVATE_ADDRESS` |
| 数据库 | `CONNECTION_STRING`, `CONN_STRING`, `DATABASE_URL`, `DB_PASSWORD` |
| 云服务 | `AWS_SECRET`, `AZURE_KEY`, `GCP_KEY`, `SERVICE_ACCOUNT` |

**マッチングルール：**
- 大文字小文字を区別しない
- キー名にいずれかのパターンが含まれれば機密として識別

**使用例：**

```go
// キーが機密かどうかを確認
if env.IsSensitiveKey("DB_PASSWORD") {
    // 使用安全方式处理
    secret := env.GetSecure("DB_PASSWORD")
    if secret != nil {
        defer secret.Release()
    }
}
```

### DefaultKeyPattern

默认键名検証模式：

```go
var DefaultKeyPattern *regexp.Regexp = nil
```

::: tip 性能优化
`nil` 值启用快速字节级検証（约 10 倍性能提升）。
默认検証规则：以字母开头，只包含字母、数字、下划线。
:::

**自定义模式：**

```go
import "regexp"

cfg := env.DefaultConfig()
// 大文字で始まるもののみ許可
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,63}$`)
```

## セキュリティツール関数

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

キーの機密性に基づいてマスク値を返します。

```go
// 敏感键 - 返回 [MASKED:N chars] 格式
masked := env.MaskValue("API_KEY", "secret123")
// 返回: [MASKED:9 chars]

// 非敏感键 - 返回原值（20 文字を超える場合は切り詰め）
masked := env.MaskValue("APP_NAME", "myapp")
// 返回: myapp
masked := env.MaskValue("DESCRIPTION", "this is a very long description text")
// 返回: this is a very lo...
```

### MaskKey

```go
func MaskKey(key string) string
```

掩码键名ログ用。

```go
masked := env.MaskKey("DB_PASSWORD")
// 返回: DB***
```

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

文字列内の潜在的な機密内容をマスクします。50文字を超える文字列は切り詰められます。

**パラメータ：**
- `s` - 原始字符串

**戻り値：**
- `string` - マスクされた文字列

```go
// 長い文字列は切り詰められます
log := "This is a very long log message that exceeds 50 characters and will be truncated"
clean := env.MaskSensitiveInString(log)
// 返回: "This is a very long log message that exceeds 50..."

// 短い文字列はそのまま保持
short := "Short message"
clean := env.MaskSensitiveInString(short)
// 返回: "Short message"
```

::: warning 注意
此函数主に長い文字列の切り詰めに使用。機密キーと値のペアを自動マスクする必要がある場合，请使用 `SanitizeForLog`。
:::

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

文字列内の機密キーと値のペア情報をクリーンアップします。`key=value` フォーマットの機密値を自動検出してマスクします。

**パラメータ：**
- `s` - 原始字符串

**戻り値：**
- `string` - クリーンアップされた文字列

**検出される機密キーパターン：**
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
ログ出力、エラーメッセージ、デバッグ情報など、機密キーと値のペアを自動フィルタリングする必要がある場面に適しています。
:::

### ClearBytes

```go
func ClearBytes(b []byte)
```

安全なゼロクリア字节切片。

```go
sensitive := []byte("secret-data")
// 使用...
env.ClearBytes(sensitive)
// sensitive 現在はすべて 0
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

使用例：

```go
// 检测格式
format := env.DetectFormat("config.json")  // FormatJSON

// 指定格式序列化
data, _ := env.Marshal(cfg, env.FormatJSON)

// フォーマット文字列
fmt.Println(format.String())  // "json"
```

## 错误检查模式

### errors.Is 模式

检查センチネルエラー：

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // 文件不存在
case errors.Is(err, env.ErrFileTooLarge):
    // ファイルが大きすぎます
case errors.Is(err, env.ErrForbiddenKey):
    // 禁止键
case errors.Is(err, env.ErrClosed):
    // 加载器クローズ済み
}
```

### errors.As 模式

提取详细错误信息：

```go
err := loader.LoadFiles(".env")

var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("解析エラー在 %s 第 %d 行\n", parseErr.File, parseErr.Line)
}

var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("文件 %s 大小 %d 超过限制 %d\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}

var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("セキュリティエラー: %s - %s\n", secErr.Action, secErr.Reason)
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
            log.Fatal("設定ファイルが存在しません")

        case errors.Is(err, env.ErrFileTooLarge):
            log.Fatal("設定ファイルが大きすぎます")

        case errors.Is(err, env.ErrClosed):
            log.Fatal("加载器クローズ済み")

        default:
            var parseErr *env.ParseError
            if errors.As(err, &parseErr) {
                log.Fatalf("解析エラー %s:%d - %v",
                    parseErr.File, parseErr.Line, parseErr.Err)
            }

            var fileErr *env.FileError
            if errors.As(err, &fileErr) {
                log.Fatalf("文件错误 %s - %v", fileErr.Path, fileErr.Err)
            }

            var secErr *env.SecurityError
            if errors.As(err, &secErr) {
                log.Fatalf("セキュリティエラー: %s - %s", secErr.Action, secErr.Reason)
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

    // 検証必需键
    if err := loader.Validate(); err != nil {
        var valErr *env.ValidationError
        if errors.As(err, &valErr) {
            log.Fatalf("検証失败: %s - %s", valErr.Field, valErr.Message)
        }
        log.Fatal(err)
    }
}
```

## 関連ドキュメント

- [SecureValue API](/ja/env/api-reference/secure-value) - セキュリティツール関数の完全な API
- [Config API](/ja/env/api-reference/config) - 設定オプションと制限設定
- [セキュリティ概要](/ja/env/security/) - セキュリティアーキテクチャとコア機能
- [本番チェックリスト](/ja/env/security/production-checklist) - リリース前セキュリティチェック
