---
title: "结构化日志 - CyberGo DD | 字段与链式调用"
description: "CyberGo DD 结构化日志使用指南，详细介绍 20+ 类型安全的字段构造器、Field 链式传递模式、LoggerEntry 不可变设计原理、字段命名规范与验证规则，以及结构化日志的最佳实践和常见使用模式，帮助开发者在项目中有效使用高性能的结构化日志记录方案。"
---

# 结构化日志

结构化日志通过键值对字段记录上下文信息，使日志可被程序解析、检索和分析。DD 提供类型安全的字段构造器和灵活的链式调用机制。

## 字段构造器

DD 提供 20+ 类型安全的字段构造器：

### 基本类型

```go
dd.InfoWith("用户注册",
    dd.String("username", "alice"),
    dd.Int("age", 25),
    dd.Float64("score", 98.5),
    dd.Bool("verified", true),
)
```

### 时间相关

```go
dd.InfoWith("定时任务执行",
    dd.Time("scheduled_at", time.Now()),
    dd.Duration("elapsed", 150*time.Millisecond),
)
```

### 整数类型族

```go
dd.InfoWith("数据包处理",
    dd.Int8("flags", 0x0F),
    dd.Int32("seq", 1001),
    dd.Int64("total_bytes", 1<<20),
    dd.Uint16("port", 8080),
    dd.Uint32("src_ip", 0xC0A80101),
)
```

### 错误处理

```go
// 默认 key 为 "error"
dd.ErrorWith("查询失败", dd.Err(err))

// 自定义 key
dd.ErrorWith("数据库错误", dd.ErrWithKey("db_error", dbErr))

// 附带堆栈信息
dd.ErrorWith("严重错误", dd.ErrWithStack(err))
```

### 任意类型

```go
// 任何类型，通过 fmt.Sprintf 格式化
dd.InfoWith("请求负载", dd.Any("body", requestBody))
```

:::warning 性能提示
`Any` 使用反射，性能低于类型明确的构造器。在高频路径上优先使用具体类型。
:::

## 链式调用

### Logger → Entry

```go
// 创建带预设字段的 Entry
reqLog := logger.WithFields(
    dd.String("service", "api"),
    dd.String("version", "1.0"),
)

// Entry 自动携带预设字段
reqLog.Info("服务启动")
reqLog.Warn("内存使用偏高")
reqLog.ErrorWith("请求失败",
    dd.String("path", "/api/users"),
    dd.Err(err),
)
```

### Entry → Entry（多层嵌套）

```go
// 服务级
svcLog := logger.WithFields(dd.String("service", "order"))

// 模块级（继承服务级字段）
dbLog := svcLog.WithFields(dd.String("module", "database"))

// 操作级（继承全部上层字段）
queryLog := dbLog.WithFields(dd.String("operation", "query"))

queryLog.InfoWith("查询完成",
    dd.Int("rows", 42),
    dd.Duration("elapsed", 10*time.Millisecond),
)
// 字段: service=order module=database operation=query rows=42 elapsed=10ms
```

### 包级函数链式调用

```go
dd.WithFields(
    dd.String("app", "myapp"),
    dd.String("env", "production"),
).Info("应用启动")
```

## 字段命名规范

DD 支持配置字段命名规范，在开发阶段自动检查：

### 内置规范

```go
// snake_case（推荐，最通用）
cfg := dd.StrictSnakeCaseConfig()

// camelCase
cfg := dd.StrictCamelCaseConfig()

// 不限制（默认）
cfg := dd.DefaultFieldValidationConfig()
```

### 在配置中启用

```go
logger, _ := dd.New(dd.Config{
    FieldValidation: dd.StrictSnakeCaseConfig(),
})
```

启用后，不合规的字段名会在日志中产生警告：

```go
logger.InfoWith("测试",
    dd.String("UserName", "alice"),   // PascalCase → 警告
    dd.String("user_name", "alice"),  // snake_case → 正常
)
```

## 常见模式

### HTTP 请求日志

```go
func loggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()

            reqLog := logger.WithFields(
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
                dd.String("remote_addr", r.RemoteAddr),
                dd.String("user_agent", r.UserAgent()),
            )

            next.ServeHTTP(w, r)

            reqLog.InfoWith("请求完成",
                dd.Duration("elapsed", time.Since(start)),
            )
        })
    }
}
```

### 服务分层日志

```go
type UserService struct {
    log *dd.LoggerEntry
}

func NewUserService(logger *dd.Logger) *UserService {
    return &UserService{
        log: logger.WithFields(dd.String("component", "user_service")),
    }
}

func (s *UserService) CreateUser(ctx context.Context, name string) error {
    s.log.InfoWith("创建用户",
        dd.String("name", name),
    )

    if err := s.validate(name); err != nil {
        s.log.ErrorWith("用户创建失败",
            dd.String("name", name),
            dd.Err(err),
        )
        return err
    }

    return nil
}
```

### 条件日志（避免不必要的计算）

```go
// 方式一：先检查级别
if logger.IsDebugEnabled() {
    data := computeExpensiveDebugInfo()
    logger.DebugWith("调试数据", dd.Any("data", data))
}

// 方式二：使用 WithFields 的延迟计算特性
reqLog := logger.WithFields(dd.String("request_id", reqID))
// WithFields 只构造字段，不产生 I/O 开销
// 只有实际调用 Info/Error 等方法时才写入日志
```

## 输出格式

### 文本格式（默认）

```text
[2026-04-16T21:16:48+08:00   INFO] main.go:13 请求完成 method=GET status=200 elapsed=150ms
```

### JSON 格式

```go
logger, _ := dd.New(dd.JSONConfig())
logger.InfoWith("请求完成",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)
```

```json
{"timestamp":"2026-04-16T21:16:48+08:00","level":"info","caller":"main.go:13","message":"请求完成","fields":{"method":"GET","status":200}}
```

## 下一步

- [文件输出与轮换](./file-output) -- 将日志写入文件
- [敏感数据过滤](./sensitive-filtering) -- 自动脱敏敏感信息
- [API 参考 - 字段](../api-reference/fields) -- 所有字段构造器
- [API 参考 - LoggerEntry](../api-reference/entry) -- Entry 完整方法
