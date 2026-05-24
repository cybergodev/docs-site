---
title: "LoggerEntry - CyberGo DD | 预设字段日志"
description: "CyberGo DD LoggerEntry 类型完整 API 文档，用于创建带预设字段的链式日志记录器，每次 WithFields 调用返回新的不可变 Entry 实例，支持字段累积组合、上下文绑定传播和级别继承机制，适用于请求级日志追踪和上下文关联等场景。"
---

# LoggerEntry

`LoggerEntry` 是带预设字段的日志记录器，每次 `WithFields` 调用返回新的不可变 Entry。

## 创建

```go
// 从 Logger 创建
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.String("env", "prod"),
)

// 通过全局 Logger 创建
entry := dd.Default().WithFields(
    dd.String("service", "api"),
)

// 单字段快捷方式
entry := logger.WithField("request_id", "req-123")
```

## 链式调用

```go
// 追加字段（返回新 Entry，原始 Entry 不变）
base := logger.WithFields(dd.String("svc", "api"))
enhanced := base.WithFields(dd.String("env", "prod"))

// 新字段覆盖同名旧字段
entry := base.WithField("svc", "gateway")  // svc 变为 "gateway"
```

:::tip 不可变性
每次 `WithFields` / `WithField` 调用返回新的 `LoggerEntry`，原始 Entry 不受影响，可安全并发使用。
:::

## 日志方法

所有 Logger 的日志方法在 Entry 上同样可用，输出的日志自动携带预设字段：

### 基础日志

| 方法 | 说明 |
|------|------|
| `Debug(args ...any)` | Debug 级别 |
| `Info(args ...any)` | Info 级别 |
| `Warn(args ...any)` | Warn 级别 |
| `Error(args ...any)` | Error 级别 |
| `Fatal(args ...any)` | Fatal 级别 |
| `Log(level LogLevel, args ...any)` | 指定级别 |

### 格式化日志

| 方法 | 说明 |
|------|------|
| `Debugf(format string, args ...any)` | 格式化 Debug |
| `Infof(format string, args ...any)` | 格式化 Info |
| `Warnf(format string, args ...any)` | 格式化 Warn |
| `Errorf(format string, args ...any)` | 格式化 Error |
| `Fatalf(format string, args ...any)` | 格式化 Fatal |
| `Logf(level LogLevel, format string, args ...any)` | 格式化指定级别 |

### 结构化日志

| 方法 | 说明 |
|------|------|
| `DebugWith(msg string, fields ...Field)` | 结构化 Debug（合并预设字段） |
| `InfoWith(msg string, fields ...Field)` | 结构化 Info |
| `WarnWith(msg string, fields ...Field)` | 结构化 Warn |
| `ErrorWith(msg string, fields ...Field)` | 结构化 Error |
| `FatalWith(msg string, fields ...Field)` | 结构化 Fatal |
| `LogWith(level LogLevel, msg string, fields ...Field)` | 结构化指定级别 |

### Print 方法

| 方法 | 说明 |
|------|------|
| `Print(args ...any)` | 输出到 Writer（LevelInfo，受安全过滤） |
| `Println(args ...any)` | 与 Print 行为一致 |
| `Printf(format string, args ...any)` | 格式化输出（LevelInfo，受安全过滤） |

### 字段链

| 方法 | 说明 |
|------|------|
| `WithFields(fields ...Field) *LoggerEntry` | 追加字段，返回新 Entry |
| `WithField(key string, value any) *LoggerEntry` | 添加单个字段，返回新 Entry |

## 使用示例

### HTTP 请求日志

```go
func handleRequest(w http.ResponseWriter, r *http.Request) {
    reqLog := logger.WithFields(
        dd.String("method", r.Method),
        dd.String("path", r.URL.Path),
        dd.String("remote", r.RemoteAddr),
    )

    reqLog.Info("请求开始")

    // 处理逻辑...

    reqLog.WithField("status", 200).Info("请求完成")
}
```

### 服务组件日志

```go
serviceLog := logger.WithFields(
    dd.String("service", "user-service"),
    dd.String("version", "2.1.0"),
)

serviceLog.Info("服务启动")

dbLog := serviceLog.WithField("component", "database")
dbLog.Info("连接成功")
dbLog.ErrorWith("查询失败", dd.Err(err))
```

## 下一步

- [Logger](./logger) -- Logger 实例方法
- [结构化字段](./fields) -- Field 构造器
- [包函数](./functions) -- 全局日志函数
