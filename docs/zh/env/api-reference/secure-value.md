---
sidebar_label: "SecureValue"
title: "SecureValue API - CyberGo env | 安全值存储"
description: "CyberGo env 的 SecureValue 安全值 API 参考，含 NewSecureValue 创建、mlock 内存锁定、Reveal 读取明文、Masked 掩码、Release 清零销毁、IsSensitiveKey 检测，安全存储密码、令牌与密钥。"
sidebar_position: 5
---

# SecureValue API

`SecureValue` 用于存放敏感数据：可选内存锁定，关闭时清零，格式化输出一律显示掩码。

## 线程安全

`SecureValue` 的所有方法都是线程安全的，可在多个 goroutine 中并发使用：

- **读取方法**（`String()`、`Bytes()`、`Length()`、`Masked()`）持读锁，支持并发读取
- **关闭方法**（`Close()`、`Release()`）持写锁，确保安全清零
- **状态检查**：`IsClosed()` 读原子关闭位；`IsMemoryLocked()`、`MemoryLockError()` 持读锁

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    // 并发读取安全
    go func() { fmt.Println(secret.Masked()) }()
    go func() { fmt.Println(secret.Length()) }()
}
```

::: warning 注意
取得 `SecureValue` 的代码负责释放它。`Close()` 与 `Release()` 的差异见下文「Close 与 Release 的区别」。
:::

## 方法总览

`SecureValue` 的全部方法（限定名形如 `SecureValue.Reveal`）见下文各小节：

| 方法 | 说明 |
|------|------|
| `SecureValue.String` | 掩码表示（实现 `fmt.Stringer`，用于格式化输出） |
| `SecureValue.Reveal` | 返回明文字符串 |
| `SecureValue.Bytes` | 返回字节切片副本（用后以 `ClearBytes` 清零） |
| `SecureValue.Length` | 值长度（不暴露内容） |
| `SecureValue.Masked` | 掩码表示（携带锁定状态后缀） |
| `SecureValue.MarshalJSON` | JSON 序列化输出掩码（实现 `json.Marshaler`） |
| `SecureValue.MarshalText` | 文本编码输出掩码（实现 `encoding.TextMarshaler`） |
| `SecureValue.Close` | 清零并解锁数据，不归还对象池 |
| `SecureValue.Release` | 清零、解锁数据并归还对象池 |
| `SecureValue.IsClosed` | 是否已关闭 |
| `SecureValue.IsMemoryLocked` | 内存是否处于锁定状态 |
| `SecureValue.MemoryLockError` | 最近一次锁定失败的错误 |

## 创建

### NewSecureValue

```go
func NewSecureValue(value string) *SecureValue
```

创建安全值包装器。

**参数：**
- `value` - 要保护的字符串值

**返回：**
- `*SecureValue` - 安全值对象

**行为：**
- 使用对象池减少分配
- 设置 GC 终结器，对象不可达时自动清零
- 启用内存锁定时尝试锁定；失败则静默忽略，错误可从 `MemoryLockError()` 读取

```go
secret := env.NewSecureValue("my-secret-password")
defer secret.Release()  // 或 Close()
```

---

### NewSecureValueStrict

```go
func NewSecureValueStrict(value string) (*SecureValue, error)
```

创建安全值，已启用内存锁定但锁定失败时返回错误。

**参数：**
- `value` - 要保护的字符串值

**返回：**
- `*SecureValue` - 安全值对象。即使同一次调用返回了错误，该对象仍有效可用，只是数据未被锁定
- `error` - 内存锁定错误。仅在 `SetMemoryLockEnabled(true)` 之后锁定失败时返回；与 `SetMemoryLockStrict` 开关无关

```go
env.SetMemoryLockEnabled(true)

secret, err := env.NewSecureValueStrict("my-secret")
if err != nil {
    // 内存锁定失败（secret 仍有效，只是未被锁定）
    log.Printf("Warning: %v", err)
}
if secret != nil {
    defer secret.Release()
}
```

---

### GetSecure (Loader 方法)

```go
func (l *Loader) GetSecure(key string) *SecureValue
```

从加载器获取安全值。键名解析规则与 `Loader.Lookup` 一致（精确匹配、大写回退、点号路径），但**不**走逗号分隔的索引回退，因为那只产生虚拟值而非真实存储键。

**参数：**
- `key` - 键名

**返回：**
- `*SecureValue` - 安全值的**防御性副本**，调用者负责释放；键不存在、加载器已关闭或存储中的值已关闭时返回 nil

```go
secret := loader.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
    // 使用 secret
}
```

::: tip 防御性副本
`GetSecure` 返回原始值的副本，独立于父 Loader。调用者负责调用 `Release()` 或 `Close()` 释放。
:::

---

## 方法

### String

```go
func (sv *SecureValue) String() string
```

返回掩码表示，可安全用于日志和格式化。实现 `fmt.Stringer`，防止 `fmt.Printf`、`log.Println` 或错误包装意外泄露密钥。输出与 `Masked()` 完全一致。

**返回：**
- `string` - 掩码表示（如 `[SECURE:32 bytes]`），nil 时返回 `[NIL]`

```go
secret := env.GetSecure("PASSWORD")
if secret != nil {
    log.Printf("Password: %s", secret)  // 安全：输出掩码表示
    // 等价于 log.Printf("Password: %s", secret.Masked())
}
```

::: warning 注意
`String()` 返回**掩码表示**，不是明文值。获取明文用 `Reveal()`。
:::

---

### Reveal

```go
func (sv *SecureValue) Reveal() string
```

返回明文值。返回值是**新分配的 string 副本**，既不受内存锁定保护，也无法清零。调用者负责安全处理它：避免写入日志、序列化，或存到持久化位置。只在确需实际值（加密操作、API 调用等）时调用。

**返回：**
- `string` - 明文值；已关闭或 nil 时返回空字符串

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
    plaintext := secret.Reveal()  // 获取明文值
    // 使用 plaintext 进行 API 调用等安全操作
    _ = plaintext
}
```

::: danger 安全警告
`Reveal()` 返回**明文字符串**。Go 字符串不可变，无法手动清零。只在必要时使用，并避免把返回值写入日志或存储。
:::

---

### Bytes

```go
func (sv *SecureValue) Bytes() []byte
```

返回值的字节切片副本，调用者可随时用 `ClearBytes` 清零。

**返回：**
- `[]byte` - 值的字节副本；已关闭或 nil 接收者返回 nil

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
	data := secret.Bytes()
	defer env.ClearBytes(data)  // 使用后清零
	// 使用 data
}
```

---

### Length

```go
func (sv *SecureValue) Length() int
```

返回值的长度，不暴露内容。

**返回：**
- `int` - 值长度；已关闭或 nil 接收者返回 0

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    fmt.Printf("API Key length: %d\n", secret.Length())
}
```

---

### Masked

```go
func (sv *SecureValue) Masked() string
```

返回掩码后的值，用于日志输出。

**返回：**
- `string` - 掩码表示

**输出格式：**
- nil 接收者：`[NIL]`
- 已关闭：`[CLOSED]`
- 空值：`[SECURE:0 bytes]`（即便启用了内存锁定也不带后缀）
- 正常：`[SECURE:N bytes]`；调用时全局内存锁定开关为 true 才追加状态后缀，取值为 `locked`、`lock-failed` 或 `unlocked`

后缀由**调用 `Masked()` 那一刻**的全局开关与该值自身的锁定结果共同决定；`IsMemoryLockEnabled()` 为 false 时一律不加后缀。各后缀的完整判定见下文「Masked 输出格式」。

::: tip
锁定状态后缀由**调用 `Masked()` 时**的全局开关决定：开关为 false 时不加任何后缀；为 true 时按该值自身的锁定结果给出 `locked`／`lock-failed`／`unlocked`（创建于启用之前的值为 `unlocked`）。状态判断与排查见[内存锁定](../security/memory-locking)。
:::

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    log.Printf("API Key: %s", secret.Masked())
    // 输出：API Key: [SECURE:32 bytes]
    // 调用时若已启用内存锁定（SetMemoryLockEnabled(true)），掩码按该值的锁定结果
    // 追加 " locked" / " lock-failed" / " unlocked" 后缀
}
```

---

### MarshalJSON

```go
func (sv *SecureValue) MarshalJSON() ([]byte, error)
```

实现 `json.Marshaler` 接口。输出掩码表示，防止 `json.Marshal` 等基于反射的序列化器意外泄露密钥；明文不会出现在 JSON 输出中。

**返回：**
- `[]byte` - JSON 安全的掩码字符串（如 `"[SECURE:32 bytes]"`），nil 时返回 `"null"`
- `error` - 总是返回 nil

```go
type Response struct {
    APIKey *env.SecureValue `json:"api_key"`
}

resp := Response{APIKey: env.NewSecureValue("sk-1234567890")}
data, _ := json.Marshal(resp)
// {"api_key":"[SECURE:13 bytes]"}
// 明文不会出现在输出中
```

::: tip 安全设计
把 `SecureValue` 嵌入结构体再做 JSON 序列化，也不会泄露明文。输出与 `String()` / `Masked()` 一致。
:::

---

### MarshalText

```go
func (sv *SecureValue) MarshalText() ([]byte, error)
```

实现 `encoding.TextMarshaler` 接口。输出与 `String()` 一致的掩码表示，防止 `encoding/xml`、`text/template`、结构化日志等文本编码器意外泄露密钥。

**返回：**
- `[]byte` - 掩码字符串（如 `"[SECURE:32 bytes]"`），nil 时返回 `"[NIL]"`
- `error` - 总是返回 nil

```go
type Config struct {
    Token *env.SecureValue `xml:"token"`
}

cfg := Config{Token: env.NewSecureValue("Bearer xyz")}
data, _ := xml.Marshal(cfg)
// <Config><token>[SECURE:10 bytes]</token></Config>
```

---

### Close

```go
func (sv *SecureValue) Close() error
```

先解锁内存（若已锁定），再安全清零内部数据并关闭对象。

**返回：**
- `error` - 总是返回 nil

**行为：**
- 若内存已锁定则先解锁，再安全清零内部数据
- 标记为已关闭，**不**归还到对象池

```go
secret := env.GetSecure("TOKEN")
if secret != nil {
    defer secret.Close()
    // Close 后内存被清零
}
```

---

### Release

```go
func (sv *SecureValue) Release()
```

清零内存并归还到对象池。

**行为：**
- 若内存已锁定则先解锁，再安全清零内部数据
- 标记为已关闭，并归还到对象池供重用
- **不**清除 GC 终结器。终结器在对象首次创建时设置一次，之后终身保持；池化对象被 runtime 逐出后即使触发终结器，也因对象已是 closed 状态而成为空操作

```go
secret := env.GetSecure("KEY")
if secret != nil {
    defer secret.Release()
    // Release 后内存被清零且对象归还池
}
```

::: tip Close vs Release
- `Close()` - 解锁并清零，不归还池
- `Release()` - 解锁、清零并归还池，高频创建场景优先用它
:::

---

### IsClosed

```go
func (sv *SecureValue) IsClosed() bool
```

检查对象是否已关闭。nil 接收者视为已关闭，返回 `true`。

**返回：**
- `bool` - 是否已关闭

```go
if secret.IsClosed() {
    // 对象已关闭，不可使用
}
```

---

### IsMemoryLocked

```go
func (sv *SecureValue) IsMemoryLocked() bool
```

检查内存是否被锁定（防止交换到磁盘）。nil 接收者或已关闭的对象返回 `false`。

**返回：**
- `bool` - 是否已锁定

```go
if secret.IsMemoryLocked() {
    fmt.Println("Memory is locked, protected from swapping")
}
```

---

### MemoryLockError

```go
func (sv *SecureValue) MemoryLockError() error
```

返回最近一次内存锁定尝试的错误（如有）。nil 接收者返回 nil。

**返回：**
- `error` - 锁定错误；锁定成功或未尝试过时返回 nil

```go
if err := secret.MemoryLockError(); err != nil {
    log.Printf("Memory lock failed: %v", err)
}
```

---

## 内存锁定配置

### SetMemoryLockEnabled

```go
func SetMemoryLockEnabled(enabled bool)
```

全局启用或禁用内存锁定，只影响此后创建的 `SecureValue`。已创建的对象保持创建时的锁定状态。

**参数：**
- `enabled` - 是否启用

```go
package main

import "github.com/cybergodev/env"

func main() {
	// 应用启动时启用
	env.SetMemoryLockEnabled(true)

	// 后续所有 SecureValue 都会尝试锁定
}
```

---

### IsMemoryLockEnabled

```go
func IsMemoryLockEnabled() bool
```

检查内存锁定是否启用。

**返回：**
- `bool` - 是否启用

```go
if env.IsMemoryLockEnabled() {
    // 内存锁定已启用
}
```

---

### SetMemoryLockStrict

```go
func SetMemoryLockStrict(strict bool)
```

设置严格模式。启用后，任何内存锁定失败都会向 stderr 输出告警（`log.Printf` 默认目标），与构造路径无关。

非严格构造器（如 `NewSecureValue`）无法返回错误，这条告警是它们唯一的失败信号；`NewSecureValueStrict` 的错误返回不受此开关影响（见上文「创建」一节）。

**参数：**
- `strict` - 是否启用严格模式

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

// NewSecureValue 无法返回错误；若锁定失败，输出：
// env: memory lock failed in strict mode: ...
secret := env.NewSecureValue("sensitive-data")
```

---

### IsMemoryLockStrict

```go
func IsMemoryLockStrict() bool
```

检查内存锁定是否处于严格模式（由 `SetMemoryLockStrict` 设置）。

**返回：**
- `bool` - 是否启用

```go
strict := env.IsMemoryLockStrict()
```

---

### IsMemoryLockSupported

```go
func IsMemoryLockSupported() bool
```

检查当前平台是否支持内存锁定。

**返回：**
- `bool` - 是否支持

| 平台 | 支持 |
|------|------|
| Linux | ✅ |
| macOS | ✅ |
| Windows | ✅ |
| FreeBSD 及其他 BSD、Solaris | ❌ |
| wasm | ❌ |

::: tip 平台降级
内存锁定只在 Linux、macOS、Windows 上实现，其余平台（FreeBSD 及其他 BSD、Solaris、wasm 等）没有锁定实现：

- `IsMemoryLockSupported()` 返回 false
- `SecureValue` 仍可正常创建与使用
- 启用内存锁定时锁定尝试失败并记录错误，`Masked()` 显示 `lock-failed` 后缀；未启用锁定时不带状态后缀
:::

::: warning 注意
返回 `true` 只表示平台支持，不代表进程有足够权限。Linux 需要 `CAP_IPC_LOCK` 或 root 权限。
:::

```go
if env.IsMemoryLockSupported() {
    env.SetMemoryLockEnabled(true)
}
```

---

## 安全工具函数

### ClearBytes

```go
func ClearBytes(b []byte)
```

安全清零字节切片。敏感数据用完后立即调用。

**参数：**
- `b` - 要清零的字节切片

```go
sensitive := []byte("secret-data")
// 使用...
env.ClearBytes(sensitive)
// sensitive 现在全是 0
```

---

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

检查键名是否匹配敏感模式。

**参数：**
- `key` - 键名

**返回：**
- `bool` - 是否敏感

```go
if env.IsSensitiveKey("DB_PASSWORD") {
    // 敏感键，使用安全方式处理
    secret := env.GetSecure("DB_PASSWORD")
    if secret != nil {
        defer secret.Release()
    }
}
```

**敏感模式：** password、secret、token、api_key、credential 等，完整模式表见[常量与错误](./constants#sensitivekeypatterns)。

匹配规则：键名包含任一模式即命中（子串匹配，不区分大小写）。短模式 `AUTH`、`PAN`、`PWD`、`USERNAME` 例外，只在**标识符边界**匹配（SEC-06），所以 `AUTHOR` 不会被判为敏感。

---

### MaskValue

```go
func MaskValue(key, value string) string
```

根据键的敏感性返回掩码值。

**参数：**
- `key` - 键名
- `value` - 原始值

**返回：**
- `string` - 掩码后的值

**规则：**
- 敏感键：返回 `[MASKED]`
- 非敏感键且值长度 ≤ 20：返回 `SanitizeForLog(value)`
- 非敏感键且值长度 > 20：先取前 17 个字符拼上 `...`，再对其调用 `SanitizeForLog`

```go
// 敏感键 - 返回固定 [MASKED]
masked := env.MaskValue("API_KEY", "secret123")
// 返回：[MASKED]

// 非敏感键 - 返回脱敏后的原值（超过 20 字符则截断）
masked := env.MaskValue("APP_NAME", "myapp")
// 返回：myapp
```

---

### MaskKey

```go
func MaskKey(key string) string
```

掩码键名用于日志。

**参数：**
- `key` - 键名

**返回：**
- `string` - 掩码后的键名，恒为 `[MASKED]`

```go
masked := env.MaskKey("DB_PASSWORD")
// 返回：[MASKED]
```

---

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

清理字符串中的敏感键值对信息。自动识别 `key=value` 与 YAML 的 `key: value` 两种形态，按键名敏感性掩码值。键名和分隔符原样保留，只替换值。同时移除控制字符，但保留 `\n` 与 `\t`。

**参数：**
- `s` - 原始字符串

**返回：**
- `string` - 清理后的字符串

```go
// 自动掩码敏感键值对
msg := "Connected with password=secret123 api_key=abc123"
clean := env.SanitizeForLog(msg)
// 返回："Connected with password=[MASKED] api_key=[MASKED]"
```

---

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

掩码字符串中的潜在敏感内容，处理分两步：

1. 超过 50 字符的字符串截断为前 47 个字符加 `...`
2. 对结果掩码 `key=value` 形态的敏感值

只截断会让 `password=...` 这类键值对原样漏出，所以两步都不能省。

**参数：**
- `s` - 原始字符串

**返回：**
- `string` - 掩码后的字符串

```go
// 长字符串会被截断（保留前 47 个字符并追加 "..."）
long := "This is a very long string that exceeds 50 characters"
clean := env.MaskSensitiveInString(long)
// 返回："This is a very long string that exceeds 50 char..."
```

::: tip 使用场景
用于错误详情、解析内容等夹带敏感数据的长字符串，截断与键值对掩码一步完成。只需掩码 `key=value` 而不需要截断时，用 `SanitizeForLog`。
:::

---

## 完整示例

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/env"
)

func main() {
	// 检查并启用内存锁定
	if env.IsMemoryLockSupported() {
		env.SetMemoryLockEnabled(true)
		fmt.Println("Memory locking enabled")
	}

	// 加载环境变量
	if err := env.Load(".env"); err != nil {
		log.Printf("Warning: %v", err)
	}

	// 安全获取敏感值
	apiKey := env.GetSecure("API_KEY")
	if apiKey == nil {
		log.Fatal("API_KEY not found")
	}
	defer apiKey.Release()

	// 安全使用
	fmt.Printf("API Key length: %d\n", apiKey.Length())
	fmt.Printf("API Key (masked): %s\n", apiKey.Masked())

	// 检查内存锁定状态
	if apiKey.IsMemoryLocked() {
		fmt.Println("Memory is locked")
	}

	// 检查锁定错误
	if err := apiKey.MemoryLockError(); err != nil {
		fmt.Printf("Memory lock warning: %v\n", err)
	}

	// 传递给其他函数
	connectAPI(apiKey.Reveal())

	// 使用安全工具函数
	logMessage := "Processing with API_KEY=secret"
	safeMessage := env.SanitizeForLog(logMessage)
	fmt.Println(safeMessage) // Processing with API_KEY=[MASKED]
}

func connectAPI(key string) {
	// 使用密钥连接...
	fmt.Printf("Connecting with key of length %d\n", len(key))
}
```

---

## 内部实现

### 对象池

`SecureValue` 使用 `sync.Pool` 减少内存分配：

```go
var secureValuePool = sync.Pool{
    New: func() any {
        sv := &SecureValue{}
        runtime.SetFinalizer(sv, (*SecureValue).finalize) // 对象首次创建时设置一次，终身保持
        return sv
    },
}
```

### GC 终结器

终结器只在对象首次创建时设置一次，之后终身保持。对象不可达时由它负责清零：

```go
runtime.SetFinalizer(sv, (*SecureValue).finalize)
```

### 安全清零

使用 `unsafe.Pointer` 防止编译器优化（必须在持有 `sv.mu` 锁时调用）：

```go
func (sv *SecureValue) clearDataLocked() {
    if len(sv.data) == 0 {
        return
    }
    // 解锁内存（如果已锁定）
    if sv.locked {
        internal.UnlockMemory(sv.data)
        sv.locked = false
    }
    dataPtr := unsafe.Pointer(&sv.data[0])
    for i := range sv.data {
        *(*byte)(unsafe.Pointer(uintptr(dataPtr) + uintptr(i))) = 0
    }
    runtime.KeepAlive(sv.data)
    sv.data = nil
    sv.lockErr = nil
}
```

---

## 防泄漏接口与生命周期细节

### 防泄漏的字符串化接口

`SecureValue` 实现了一组「安全字符串化」接口，让机密**不会**经由常见的格式化路径意外输出：

| 接口 | 行为 |
|------|------|
| `fmt.Stringer`（`String()`） | 返回掩码表示（同 `Masked()`），`fmt.Printf("%v")`、`log.Println` 均安全 |
| `json.Marshaler`（`MarshalJSON()`） | JSON 序列化输出掩码字符串，明文永不进入 JSON |
| `encoding.TextMarshaler`（`MarshalText()`） | 文本编码器（XML、text/template、结构化日志器）输出掩码 |

获取明文只有两条显式路径：`Reveal()` 返回 string 副本，`Bytes()` 返回 `[]byte` 副本。

### Close 与 Release 的区别

| 方法 | 清零并解锁数据 | 返回对象池 | 适用 |
|------|:--------------:|:-----------:|------|
| `Close()` | ✅ | ❌ | 常规一次性使用 |
| `Release()` | ✅ | ✅ | 高频创建/销毁场景（复用降低分配） |

两者重复调用都安全，不产生副作用。丢弃未关闭的对象也有兜底：对象不可达时 GC 终结器会自动清零。`runtime.SetFinalizer` 只在对象首次创建时设置一次，池化复用不会重复承担该开销。

### Masked 输出格式

掩码表示携带锁定状态，便于在日志中核对防护是否生效：

```text
[SECURE:24 bytes]             // 调用时全局未启用内存锁定（不加任何后缀）
[SECURE:24 bytes locked]      // 已锁定
[SECURE:24 bytes lock-failed] // 锁定失败（结合 MemoryLockError 排查）
[SECURE:24 bytes unlocked]    // 调用时全局已启用锁定，但该值未锁定且未记录错误
[CLOSED]                      // 已关闭
[NIL]                         // nil 接收者
```

`unlocked` 的含义是「全局已启用内存锁定，但该值没有锁定」——典型情况是该值创建于启用之前，创建时没有尝试锁定。后缀取决于调用时的全局开关：调用时开关为 false 就不加任何后缀，不要据此判断为 `unlocked`；完整的状态判定与排查见[内存锁定](../security/memory-locking)。

### 锁定状态查询

- `IsMemoryLocked()`：当前值的内存是否处于锁定状态
- `MemoryLockError()`：返回最近一次锁定失败的错误（成功或未尝试时为 nil），严格模式下排查权限问题先看它

### GetSecure 返回防御性副本

`Loader.GetSecure` 返回的 `*SecureValue` 是存储层的**独立副本**，生命周期与 Loader 互不干扰：调用方负责 `Close`/`Release`，Loader 内部持有的原值不受影响。

### ClearBytes

`Bytes()` 返回的拷贝用完后要显式清零。GC 不会清零普通字节切片：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	sv := env.NewSecureValue("my-secret")
	defer sv.Release()

	data := sv.Bytes()
	defer env.ClearBytes(data) // 用完清零，不留残留

	fmt.Println(len(data))
	// 输出：9
}
```

## 相关文档

- [常量与错误](./constants) - 禁止键、敏感键模式、错误类型
- [安全概述](../security/) - 安全架构与核心特性
- [生产检查清单](../security/production-checklist) - 上线前安全检查
- [Loader API](./loader) - GetSecure 方法
