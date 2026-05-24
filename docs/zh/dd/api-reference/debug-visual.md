---
title: "调试输出 - CyberGo DD | Print/JSON/Text/Exit"
description: "CyberGo DD 调试可视化输出函数完整 API 文档，包括 Print 格式化打印、JSON 结构化输出、Text 纯文本输出和 Exit 致命退出等快速调试函数，支持直接通过包级函数调用，无需创建 Logger 实例即可使用，大幅简化开发调试流程。"
---

# 调试输出

DD 提供一组快速调试输出函数，用于开发和调试阶段的数据可视化。

## 包级调试函数

通过 `dd.` 前缀直接调用：

### Print 系列

| 函数 | 签名 | 说明 |
|------|------|------|
| `Print` | `(args ...any)` | 输出到全局日志记录器的 Writer（LevelInfo，受安全过滤） |
| `Println` | `(args ...any)` | 同 Print（底层 Log() 已自动换行，受安全过滤） |
| `Printf` | `(format string, args ...any)` | 格式化输出（LevelInfo，受安全过滤） |

```go
dd.Print("值:", 42, true)
dd.Println("与 Print 行为一致")
dd.Printf("用户: %s, ID: %d", name, id)
```

:::tip 安全过滤
`Print` 系列函数经过敏感数据过滤，适合输出可能含敏感信息的调试数据。
:::

### JSON 输出

| 函数 | 签名 | 说明 |
|------|------|------|
| `JSON` | `(data ...any)` | 紧凑 JSON 格式输出到 stdout（含调用者信息） |
| `JSONF` | `(format string, args ...any)` | 格式化字符串作为紧凑 JSON 输出到 stdout（含调用者信息） |

```go
user := map[string]any{"name": "admin", "role": "super"}
dd.JSON(user)
// 输出: main.go:42 {"name":"admin","role":"super"}
```

:::warning 不经过安全过滤
`JSON`/`JSONF` 直接输出原始数据，**不经过敏感数据过滤**。请勿在生产环境使用。
:::

### Text 输出

| 函数 | 签名 | 说明 |
|------|------|------|
| `Text` | `(data ...any)` | 美化打印格式输出到 stdout |
| `Textf` | `(format string, args ...any)` | 格式化文本输出到 stdout |

```go
dd.Text(complexData)
dd.Textf("处理结果: %+v", result)
```

### Exit 函数

| 函数 | 签名 | 说明 |
|------|------|------|
| `Exit` | `(data ...any)` | 带调用者信息的文本输出后退出（exit code 0），复杂类型自动美化打印，不经过安全过滤 |
| `Exitf` | `(format string, args ...any)` | 带调用者信息的格式化输出后退出（exit code 0），不经过安全过滤 |

```go
dd.Exit("调试断点", someData)
// 输出带调用者信息的文本（复杂类型自动美化打印）后调用 os.Exit(0)
```

## Logger 方法

Logger 实例也提供同名方法（Exit/Exitf 除外，仅包级函数可用）：

```go
logger := dd.Default()

// Print 系列写入配置的 Writer（受安全过滤）
logger.Print("实例方法")

// JSON/Text 直接输出到 stdout（不经过安全过滤）
logger.JSON(data)
logger.Text(data)
```

:::warning Logger 方法与包级函数的区别
`logger.Print()` 通过当前 Logger 实例配置的 Writer 输出并经过安全过滤，`dd.Print()` 通过全局日志记录器的 Writer 输出并经过安全过滤。两者行为类似但输出目标可能不同。`logger.JSON()` 和 `logger.Text()` 与 `dd.JSON()` 和 `dd.Text()` 一样，直接输出到 stdout，**不经过安全过滤**。
:::

## 适用场景

| 场景 | 推荐函数 |
|------|----------|
| 快速打印值 | `dd.Print()` |
| 查看结构体 | `dd.JSON()` |
| 格式化输出 | `dd.Text()` |
| 调试断点 | `dd.Exit()` |
| 可能含敏感信息 | `dd.Print()`（自动过滤） |
| 性能分析数据 | `dd.JSON()` |

:::danger 仅用于调试
这些函数设计用于开发调试，**不应在生产代码中使用**。生产环境请使用 `Info`、`Error` 等标准日志方法。
:::

## 下一步

- [Logger](./logger) -- Logger 调试方法
- [包函数](./functions) -- 全局函数
- [测试辅助](./recorder) -- LoggerRecorder 测试工具
