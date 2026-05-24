---
title: "核心概念 - CyberGo DD | 架构与设计理念"
description: "深入理解 CyberGo DD 日志库的核心架构与设计理念，包括 Logger 与 LoggerEntry 的关系与生命周期、结构化字段 Field 的类型安全使用模式、日志处理管道的完整处理流程、四层递进式接口设计以及线程安全并发模型，帮助开发者建立对 DD 库的系统性认知。"
---

# 核心概念

理解 DD 的核心概念是高效使用本库的基础。本章介绍 Logger 体系、字段系统、处理管道和接口层次。

## Logger 体系

DD 的日志记录围绕三个核心类型展开：

```text
Logger（日志记录器）
  │
  ├── 直接使用 → logger.Info("message")
  │
  └── WithFields() → LoggerEntry（带预设字段的 Entry）
                        │
                        └── entry.Info("message")  // 自动携带预设字段
```

### Logger

`Logger` 是核心日志记录器，由 `dd.New()` 创建：

```go
logger, _ := dd.New(dd.DefaultConfig())
defer logger.Close()

logger.Info("服务启动")
logger.InfoWith("请求处理",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)
```

每个 Logger 拥有独立的配置、输出目标、安全过滤器和生命周期，可在不同模块间安全共享。

### LoggerEntry

`LoggerEntry` 通过 `WithFields()` 创建，是不可变的预设字段容器：

```go
// 创建带预设字段的 Entry
requestLog := logger.WithFields(
    dd.String("service", "user-api"),
    dd.String("version", "2.1.0"),
)

// 每次调用自动携带预设字段
requestLog.Info("服务启动")
// 输出: ... 服务启动 service=user-api version=2.1.0

requestLog.InfoWith("用户登录",
    dd.String("user", "alice"),
)
// 输出: ... 用户登录 service=user-api version=2.1.0 user=alice
```

:::tip 不可变设计
每次调用 `WithFields()` 都会创建新的 `LoggerEntry`，原有 Entry 不受影响。这意味着你可以在不同 goroutine 中安全地复用同一个 Entry。
:::

### 全局日志记录器

DD 提供全局日志记录器，适合简单场景或快速原型：

```go
// 直接使用包级函数（通过全局 Logger）
dd.Info("全局日志")

// 等价于
dd.Default().Info("全局日志")
```

## 字段系统

### Field 类型

`Field` 是结构化日志的基本单元，由键值对构成：

```go
// 字段构造器覆盖所有常用类型
dd.String("method", "GET")           // 字符串
dd.Int("status", 200)                // 整数
dd.Float64("latency", 0.123)         // 浮点数
dd.Bool("success", true)             // 布尔
dd.Duration("elapsed", 150*time.Millisecond) // 时间段
dd.Time("timestamp", time.Now())     // 时间戳
dd.Err(err)                          // 错误（key 固定为 "error"）
dd.ErrWithKey("db_error", err)       // 错误（自定义 key）
dd.Any("data", payload)              // 任意类型
```

### 字段链式传递

字段可以在 Logger、Entry 之间层层传递：

```go
// 第一层：服务级字段
serviceLog := logger.WithFields(
    dd.String("service", "api-gateway"),
)

// 第二层：请求级字段（追加到服务级）
requestLog := serviceLog.WithFields(
    dd.String("request_id", "req-001"),
    dd.String("path", "/api/users"),
)

// 第三层：实际日志（再追加字段）
requestLog.InfoWith("处理完成",
    dd.Int("status", 200),
    dd.Duration("elapsed", 50*time.Millisecond),
)
// 输出包含: service=api-gateway request_id=req-001 path=/api/users status=200 elapsed=50ms
```

## 日志处理管道

每条日志经过以下处理流程：

```text
用户调用 logger.InfoWith("msg", fields...)
       │
       ▼
  ① 级别检查 ─── 级别未启用 → 直接返回（零开销）
       │
       ▼
  ② 安全过滤 ─── 消息和字段中的敏感数据 → [REDACTED]
       │
       ▼
  ③ 上下文提取 ── 从已注册的提取器提取 TraceID/SpanID 等
       │
       ▼
  ④ BeforeLog 钩子
       │
       ▼
  ⑤ 格式化 ──── 文本格式 或 JSON 格式
       │
       ▼
  ⑥ 安全大小限制 ─── 超过 Security.MaxMessageSize 则截断（0 表示不限制）
       │
       ▼
  ⑦ 写入 ────── 输出到一个或多个 Writer
       │
       ▼
  ⑧ AfterLog 钩子
       │
       ▼
  ⑨ Fatal 处理 ── 仅 LevelFatal，调用 os.Exit 或自定义 FatalHandler
```

:::info 性能设计
级别检查（步骤 ①）使用原子操作，无需加锁，几乎零开销。安全过滤（步骤 ②）对小输入同步处理，对大输入使用独立 goroutine 并带超时保护，不阻塞主流程。
:::

## 接口层次

DD 定义了四个接口，支持精确的依赖注入：

```text
CoreLogger                    ← 基础日志：Debug/Info/Warn/Error/Fatal + WithFields
    │
    ├── LevelLogger           ← 级别管理：GetLevel/SetLevel/IsLevelEnabled（嵌入 CoreLogger）
    │
    └── ConfigurableLogger    ← 配置管理：Writer/安全/上下文/钩子（嵌入 CoreLogger）

LogProvider                   ← 完整功能：独立扁平接口，包含所有方法
```

```go
// 只需基础日志？注入 CoreLogger
type Service struct {
    log dd.CoreLogger
}

// 需要动态调整级别？注入 LevelLogger
type Handler struct {
    log dd.LevelLogger
}
```

:::tip 最佳实践
在构造函数中接受最小必需的接口，而不是具体类型。这使代码更易测试、更灵活。
:::

## 线程安全模型

DD 的核心设计原则：**多 goroutine 安全使用，无需额外同步**。

| 组件 | 安全机制 |
|------|----------|
| Logger | 所有方法可安全并发调用 |
| LoggerEntry | 不可变，创建后只读 |
| Config | Clone() 方法用于安全复制 |
| Writers | 原子指针，无锁读取 |
| SensitiveDataFilter | 读写分离，独立 goroutine |
| HookRegistry | 互斥锁保护注册，原子读取执行 |

```go
// 安全：多个 goroutine 共享同一个 Logger
var logger *dd.Logger  // 初始化一次

func handleRequest(w http.ResponseWriter, r *http.Request) {
    // 安全：并发调用
    logger.InfoWith("请求到达",
        dd.String("path", r.URL.Path),
        dd.String("method", r.Method),
    )
}
```

## 输出目标体系

DD 支持三种输出目标，可任意组合：

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),                    // 控制台
        dd.FileOutput("logs/app.log"),         // 文件（自动轮换）
        dd.CustomOutput(customWriter),         // 自定义 io.Writer
    },
})
```

内置 Writer 组件：

| 组件 | 用途 |
|------|------|
| `FileWriter` | 文件写入 + 大小/时间轮换 + 压缩 |
| `BufferedWriter` | 缓冲写入，减少 I/O 次数 |
| `MultiWriter` | 多目标分发，写入到多个 Writer |

## 下一步

- [结构化日志](./structured-logging) -- 字段使用详解
- [文件输出与轮换](./file-output) -- 文件日志配置
- [敏感数据过滤](./sensitive-filtering) -- 安全过滤实战
- [API 参考](../api-reference/) -- 完整 API 文档
