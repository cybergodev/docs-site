---
sidebar_label: "结构化字段"
title: "结构化字段 - CyberGo DD | Field 构造器与校验"
description: "CyberGo DD 结构化字段 API：20 种类型安全字段构造器（String/Int/Float/Bool/Time/Duration/Err 等）、Field 类型与字段键校验（命名约定与 Log4Shell 安全检测），支持自定义校验模式与预设配置。"
sidebar_position: 3
---

# 结构化字段

DD 提供 20 种类型安全的字段构造器、统一的 `Field` 类型，以及可选的字段键校验机制，用于结构化日志输出。

## Field 类型

`Field` 是结构化日志字段类型，通过 `internal.Field` 的**类型别名**对外暴露：

```go
type Field = internal.Field

// 实际结构（internal/fields.go）
type Field struct {
    Key   string  // 字段键
    Value any     // 字段值（任意类型）
}
```

所有字段构造器返回 `Field` 值；格式化器（`internal.FormatFields`）按 `Key=Value` 形式输出。基础类型（string / 数值 / bool / `time.Duration` / `time.Time` / nil）走快速路径；切片、数组、map、struct 等「复杂类型」会回退到 JSON 序列化（`internal.IsComplexValue` 判定），其他类型（如实现 `fmt.Stringer` 或 `error` 接口的值）走 `fmt.Fprint`。

## 基础字段

| 构造器 | 签名 | 说明 |
|--------|------|------|
| `Any` | `(key string, value any) Field` | 任意类型 |
| `String` | `(key, value string) Field` | 字符串 |
| `Bool` | `(key string, value bool) Field` | 布尔值 |
| `Err` | `(err error) Field` | 错误（key 固定 `"error"`；`err == nil` 时 Value 为 `nil`，否则为 `err.Error()`） |
| `ErrWithKey` | `(key string, err error) Field` | 自定义 key 的错误（同 `Err`，`err == nil` 时 Value 为 `nil`） |
| `ErrWithStack` | `(err error) Field` | 错误含调用栈（key 为 `"error"`，`err == nil` 时 Value 为 `nil`；栈帧过滤 runtime/ 与 dd 包内帧，捕获有少量开销） |

## 数值字段

| 构造器 | 类型 | 示例 |
|--------|------|------|
| `Int` | `int` | `dd.Int("count", 42)` |
| `Int8` | `int8` | `dd.Int8("flags", 1)` |
| `Int16` | `int16` | `dd.Int16("port", 8080)` |
| `Int32` | `int32` | `dd.Int32("code", 200)` |
| `Int64` | `int64` | `dd.Int64("id", 123456789)` |
| `Uint` | `uint` | `dd.Uint("size", 1024)` |
| `Uint8` | `uint8` | `dd.Uint8("level", 3)` |
| `Uint16` | `uint16` | `dd.Uint16("year", 2026)` |
| `Uint32` | `uint32` | `dd.Uint32("seq", 1000)` |
| `Uint64` | `uint64` | `dd.Uint64("hash", 0xABCD)` |
| `Float32` | `float32` | `dd.Float32("rate", 0.95)` |
| `Float64` | `float64` | `dd.Float64("elapsed", 1.234)` |

## 时间字段

| 构造器 | 签名 | 说明 |
|--------|------|------|
| `Time` | `(key string, value time.Time) Field` | 时间戳（按 RFC3339 格式化） |
| `Duration` | `(key string, value time.Duration) Field` | 持续时间（调用 `Duration.String()`） |

## 错误字段

<!-- check-code: skip -->
```go
// 标准错误字段（key 固定为 "error"，nil error → Value 为 nil）
dd.Err(err)

// 自定义 key
dd.ErrWithKey("db_error", err)

// 包含堆栈信息（栈帧过滤掉 runtime/ 与 dd 自身帧）
dd.ErrWithStack(err)
```

## 使用方式

### 与 InfoWith 组合

<!-- check-code: skip -->
```go
dd.InfoWith("用户登录",
    dd.String("username", "admin"),
    dd.Time("login_at", time.Now()),
    dd.Bool("mfa", true),
    dd.String("ip", "192.168.1.1"),
)
```

### 与 WithFields 链式调用

<!-- check-code: skip -->
```go
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("pid", os.Getpid()),
)
entry.Info("服务启动")
```

### 与 Entry 追加

<!-- check-code: skip -->
```go
base := logger.WithFields(dd.String("req_id", id))
base.InfoWith("响应",
    dd.Int("status", 200),
    dd.Duration("elapsed", took),
    dd.Err(err),
)
```

## 字段校验

DD 提供字段键校验机制，支持命名约定检查与安全验证（Log4Shell 注入、同形异义攻击、overlong UTF-8）。校验配置 `FieldValidationConfig` 可挂在 [`Config.FieldValidation`](../core/config) 上随构造生效，或运行时由 [`Logger.SetFieldValidation`](../core/logger) 动态替换。每次 `*With` 调用会对每个字段的 Key 调用 `ValidateFieldKey`，Strict 模式下失败会以日志形式报错（日志方法本身不返回 error）。

### FieldValidationMode

校验模式，决定校验失败时的处理方式。

```go
type FieldValidationMode int

const (
    FieldValidationNone   FieldValidationMode = iota // 禁用校验（默认，短路所有检查）
    FieldValidationWarn                              // 命名不匹配时记一条 warning 日志
    FieldValidationStrict                            // 命名不匹配时记一条 error 日志
)
```

`FieldValidationMode` 的 `String()` 方法返回：`"none"` / `"warn"` / `"strict"`（未知值返回 `"unknown"`）。

### FieldNamingConvention

命名约定。

```go
type FieldNamingConvention int

const (
    NamingConventionAny         FieldNamingConvention = iota // 接受任意有效键（默认）
    NamingConventionSnakeCase                                // snake_case：user_id
    NamingConventionCamelCase                                // camelCase：userId
    NamingConventionPascalCase                               // PascalCase：UserId
    NamingConventionKebabCase                                // kebab-case：user-id
)
```

`FieldNamingConvention` 的 `String()` 方法返回：`"any"` / `"snake_case"` / `"camelCase"` / `"PascalCase"` / `"kebab-case"`（未知值返回 `"unknown"`）。

### FieldValidationConfig

字段校验配置。

```go
type FieldValidationConfig struct {
    Mode                     FieldValidationMode    // 校验模式
    Convention               FieldNamingConvention  // 命名约定
    AllowCommonAbbreviations bool                   // 允许常见缩写（ID、URL、HTTP、JSON 等）
    EnableSecurityValidation bool                   // 启用安全校验（Log4Shell / 同形异义 / overlong UTF-8）
}
```

:::warning 零值陷阱
字面量 `FieldValidationConfig{}` 会令 `EnableSecurityValidation=false`，**静默关闭安全校验**——优先使用 [`DefaultFieldValidationConfig`](#预设配置) 构造（其将该项设为 `true`）。此外，`Mode == FieldValidationNone` 时会短路在安全校验之前，即使开启了 `EnableSecurityValidation` 也不会执行。
:::

### 预设配置

```go
// 默认配置：禁用命名校验，但开启安全校验
func DefaultFieldValidationConfig() *FieldValidationConfig

// 严格 snake_case
func StrictSnakeCaseConfig() *FieldValidationConfig

// 严格 camelCase
func StrictCamelCaseConfig() *FieldValidationConfig
```

三种预设均将 `AllowCommonAbbreviations=true` 且 `EnableSecurityValidation=true`；后两者 `Mode=FieldValidationStrict`。

### ValidateFieldKey

```go
func (c *FieldValidationConfig) ValidateFieldKey(key string) error
```

校验字段键是否匹配配置。失败时返回描述原因的 error，校验通过返回 `nil`。接收者为 `nil` 或 `Mode == FieldValidationNone` 时直接返回 `nil`。校验顺序：

1. 空键 → 返回 `"field key cannot be empty"`
2. 启用 `EnableSecurityValidation` 时执行 `internal.ValidateFieldKeyStrict`（Log4Shell / 同形异义 / overlong UTF-8）
3. `Convention == NamingConventionAny` → 跳过命名检查
4. `AllowCommonAbbreviations` 开启且键命中常见缩写表（`id`/`url`/`http`/`json`/`jwt` 等，或以 `_id`/`_url`/`_uri`/`_ip`/`_api` 结尾）→ 通过
5. 按约定逐项校验：snake_case / camelCase / PascalCase / kebab-case

```go
package main

import (
    "fmt"

    "github.com/cybergodev/dd"
)

func main() {
    // 严格 snake_case 预设
    cfg := dd.StrictSnakeCaseConfig()

    if err := cfg.ValidateFieldKey("user_id"); err != nil {
        fmt.Println("user_id:", err)
    } else {
        fmt.Println("user_id OK")
        // 输出: user_id OK
    }

    if err := cfg.ValidateFieldKey("userId"); err != nil {
        fmt.Println("userId:", err)
        // 输出: userId: field key "userId" does not match snake_case convention
    }

    // 常见缩写豁免：URL 不符合 snake_case，但命中缩写表故通过
    if err := cfg.ValidateFieldKey("URL"); err != nil {
        fmt.Println("URL:", err)
    } else {
        fmt.Println("URL OK (缩写豁免)")
        // 输出: URL OK (缩写豁免)
    }

    // 默认配置 Mode=None，不校验命名
    defaultCfg := dd.DefaultFieldValidationConfig()
    if err := defaultCfg.ValidateFieldKey("anyKey"); err != nil {
        fmt.Println("anyKey:", err)
    } else {
        fmt.Println("anyKey OK (Mode=None)")
        // 输出: anyKey OK (Mode=None)
    }
}
```

## 下一步

- [Logger](../core/logger) -- `WithFields` / `InfoWith` / `SetFieldValidation`
- [LoggerEntry](../core/entry) -- 预设字段链式调用
- [上下文集成](./context) -- `ContextExtractor` 提取字段
- [配置](../core/config) -- `Config.FieldValidation`
