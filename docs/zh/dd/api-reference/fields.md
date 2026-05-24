---
title: "结构化字段 - CyberGo DD | Field 构造器"
description: "CyberGo DD 结构化字段构造器完整 API 文档，支持 20 余种类型的类型安全字段创建，包括 String/Int/Float/Bool 等基础字段、Time/Duration 时间字段、Error 错误字段、Any 对象字段和自定义字段，提供便捷的链式调用组合方式。"
---

# 结构化字段

DD 提供 20+ 类型安全的字段构造器，用于结构化日志输出。

## 基础字段

| 构造器 | 签名 | 说明 |
|--------|------|------|
| `Any` | `(key string, value any) Field` | 任意类型 |
| `String` | `(key, value string) Field` | 字符串 |
| `Bool` | `(key string, value bool) Field` | 布尔值 |
| `Err` | `(err error) Field` | 错误（key 为 "error"） |
| `ErrWithKey` | `(key string, err error) Field` | 自定义 key 的错误 |
| `ErrWithStack` | `(err error) Field` | 错误含堆栈信息 |

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
| `Time` | `(key string, value time.Time) Field` | 时间戳 |
| `Duration` | `(key string, value time.Duration) Field` | 持续时间 |

## 错误字段

```go
// 标准错误字段（key 为 "error"）
dd.Err(err)

// 自定义 key
dd.ErrWithKey("db_error", err)

// 包含堆栈信息
dd.ErrWithStack(err)
```

## 使用方式

### 与 InfoWith 组合

```go
dd.InfoWith("用户登录",
    dd.String("username", "admin"),
    dd.Time("login_at", time.Now()),
    dd.Bool("mfa", true),
    dd.String("ip", "192.168.1.1"),
)
```

### 与 WithFields 链式调用

```go
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("pid", os.Getpid()),
)
entry.Info("服务启动")
```

### 与 Entry 追加

```go
base := logger.WithFields(dd.String("req_id", id))
base.InfoWith("响应",
    dd.Int("status", 200),
    dd.Duration("elapsed", took),
    dd.Err(err),
)
```

## 类型定义

`Field` 是结构化日志字段类型，包含 `Key`（字符串）和 `Value`（任意值）两个字段，通过构造函数创建。

## 下一步

- [Logger](./logger) -- WithFields / InfoWith 方法
- [LoggerEntry](./entry) -- 预设字段链式调用
- [上下文集成](./context) -- ContextExtractor 提取字段
