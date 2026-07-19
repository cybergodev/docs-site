---
sidebar_label: "测试辅助"
title: "测试辅助 - CyberGo DD | LoggerRecorder"
description: "CyberGo DD 测试辅助工具 LoggerRecorder 完整 API 文档，专为单元测试场景设计，用于捕获和断言日志输出内容，支持按级别过滤日志条目、结构化字段值验证、条目计数统计和按序断言，显著提升日志相关单元测试的编写效率和可读性。"
sidebar_position: 2
---

# 测试辅助

DD 提供 `LoggerRecorder` 用于测试场景，可捕获日志条目进行断言。

## LoggerRecorder

线程安全的日志记录器，用于测试中捕获和检查日志输出。

:::warning 文本格式解析限制
文本模式解析器假定使用默认时间格式（ISO 8601）和默认级别字符串（DEBUG/INFO/WARN/ERROR/FATAL）。如果自定义了 `TimeFormat`，文本模式可能无法正确提取级别和时间戳。对于自定义格式，建议使用 JSON 格式（`FormatJSON`），可通过 `SetFormat` 设置。
:::

### 创建

```go
recorder := dd.NewLoggerRecorder()
```

### 核心方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Writer` | `() io.Writer` | 获取 io.Writer |
| `SetFormat` | `(format LogFormat)` | 设置日志格式（用于解析） |
| `NewLogger` | `(cfg ...Config) (*Logger, error)` | 创建写入此记录器的 Logger |
| `Entries` | `() []LogEntry` | 获取所有日志条目 |
| `Count` | `() int` | 条目数量 |
| `Clear` | `()` | 清除所有条目 |
| `HasEntries` | `() bool` | 是否有条目 |
| `LastEntry` | `() *LogEntry` | 最近的条目（nil 安全） |

### 断言方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `EntriesAtLevel` | `(level LogLevel) []LogEntry` | 按级别过滤条目 |
| `ContainsMessage` | `(msg string) bool` | 是否包含指定消息（精确匹配或子串匹配） |
| `ContainsField` | `(key string) bool` | 是否包含指定字段 |
| `GetFieldValue` | `(key string) any` | 获取首个匹配字段的值 |

### 使用示例

#### 基础测试

```go
func TestLogger(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.Info("hello")
    logger.Warn("warning")

    if rec.Count() != 2 {
        t.Errorf("expected 2 entries, got %d", rec.Count())
    }

    if !rec.ContainsMessage("hello") {
        t.Error("should contain 'hello'")
    }
}
```

#### 级别断言

```go
func TestLogLevel(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    // 注意：Recorder 依 ISO 8601 时间戳解析级别，DevelopmentConfig 的
    // 时间格式（"15:04:05.000"）不兼容，故用 DefaultConfig 手动设 DEBUG。
    cfg := dd.DefaultConfig()
    cfg.Level = dd.LevelDebug
    logger, _ := rec.NewLogger(cfg)

    logger.Debug("debug")
    logger.Info("info")
    logger.Error("error")

    errors := rec.EntriesAtLevel(dd.LevelError)
    if len(errors) != 1 {
        t.Errorf("expected 1 error, got %d", len(errors))
    }

    debugs := rec.EntriesAtLevel(dd.LevelDebug)
    if len(debugs) != 1 {
        t.Errorf("expected 1 debug, got %d", len(debugs))
    }
}
```

#### 结构化字段断言

```go
func TestStructuredLog(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.InfoWith("user login",
        dd.String("user", "admin"),
        dd.String("ip", "192.168.1.1"),
    )

    if !rec.ContainsField("user") {
        t.Error("should contain 'user' field")
    }

    user := rec.GetFieldValue("user")
    if user != "admin" {
        t.Errorf("expected user=admin, got %v", user)
    }
}
```

#### 最后一条日志

```go
func TestLastEntry(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.Info("first")
    logger.Error("second")

    last := rec.LastEntry()
    if last.Level != dd.LevelError {
        t.Errorf("expected Error level, got %v", last.Level)
    }
    if last.Message != "second" {
        t.Errorf("expected 'second', got %s", last.Message)
    }
}
```

## LogEntry

捕获的日志条目结构。

```go
type LogEntry struct {
    Level     LogLevel
    Message   string
    Fields    []Field
    Timestamp time.Time
    Format    LogFormat
    RawOutput string
}
```

## 下一步

- [Logger](../core/logger) -- Logger 完整方法
- [结构化字段](../output-integration/fields) -- Field 构造器
- [常量与错误](./constants) -- LogLevel 常量
