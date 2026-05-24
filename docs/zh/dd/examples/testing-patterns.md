---
title: "测试模式 - CyberGo DD | LoggerRecorder 测试示例"
description: "CyberGo DD 测试模式示例，详细介绍 LoggerRecorder 在单元测试与集成测试中的完整使用方法，包括日志消息断言、级别过滤测试、字段值检查、多测试用例隔离、并发安全测试以及提升测试覆盖率的完整技巧与最佳实践经验总结。适用于各类 Go 项目的日志测试。"
---

# 测试模式

DD 提供 `LoggerRecorder` 作为测试辅助工具，可以在单元测试中捕获日志并进行断言，无需实际写入文件或控制台。

## 基本用法

```go
package myapp_test

import (
    "testing"

    "github.com/cybergodev/dd"
)

func TestUserService_Create(t *testing.T) {
    // 创建测试用日志记录器
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    service := NewUserService(logger)

    err := service.Create("alice")
    if err != nil {
        t.Fatalf("Create failed: %v", err)
    }

    // 断言日志内容
    if !rec.ContainsMessage("创建用户") {
        t.Error("Expected log message '创建用户'")
    }

    if rec.GetFieldValue("name") != "alice" {
        t.Error("Expected field name=alice")
    }
}
```

## LoggerRecorder 方法

### 消息检查

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.Info("操作成功")
logger.Error("操作失败")

// 检查是否包含某条消息
rec.ContainsMessage("操作成功")  // true
rec.ContainsMessage("操作失败")  // true

// 获取所有日志条目
entries := rec.Entries()
for _, entry := range entries {
    fmt.Printf("[%s] %s\n", entry.Level, entry.Message)
}
```

### 级别过滤

```go
// 只检查特定级别的日志
infoEntries := rec.EntriesAtLevel(dd.LevelInfo)
errorEntries := rec.EntriesAtLevel(dd.LevelError)

if len(errorEntries) > 0 {
    t.Error("Unexpected error logs")
}

// 使用 DevelopmentConfig 捕获所有级别
rec2 := dd.NewLoggerRecorder()
logger2, _ := rec2.NewLogger(dd.DevelopmentConfig())
logger2.Debug("调试信息")
debugs := rec2.EntriesAtLevel(dd.LevelDebug)
```

### 字段检查

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.InfoWith("请求完成",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 50*time.Millisecond),
)

// 检查字段值
if rec.GetFieldValue("method") != "GET" {
    t.Error("Expected method=GET")
}

// 注意：文本格式下字段值为 string 类型
if rec.GetFieldValue("status") != "200" {
    t.Error("Expected status=200")
}
```

## 测试模式

### 测试服务层

```go
func TestOrderService_PlaceOrder(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    svc := &OrderService{log: logger}

    // 正常路径
    order, err := svc.PlaceOrder(ctx, "user-1", []string{"item-1"})
    require.NoError(t, err)
    require.True(t, rec.ContainsMessage("订单创建"))
    require.True(t, rec.ContainsField("user_id"))
    require.Equal(t, "user-1", rec.GetFieldValue("user_id"))

    // 验证没有错误日志
    errors := rec.EntriesAtLevel(dd.LevelError)
    require.Empty(t, errors)
}
```

### 测试错误处理

```go
func TestService_DatabaseError(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    svc := &Service{
        log: logger,
        db:  &failingDB{}, // 模拟数据库错误
    }

    err := svc.Process(ctx)
    require.Error(t, err)

    // 验证错误被记录
    require.True(t, rec.ContainsMessage("处理失败"))
    require.True(t, rec.ContainsField("error"))
    require.Contains(t, rec.GetFieldValue("error"), "database connection refused")

    // 验证级别为 Error
    errorEntries := rec.EntriesAtLevel(dd.LevelError)
    require.NotEmpty(t, errorEntries)
}
```

### 测试结构化日志

```go
func TestMiddleware_LogsRequestFields(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    handler := LoggingMiddleware(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(200)
    }))

    req := httptest.NewRequest("GET", "/api/users", nil)
    rr := httptest.NewRecorder()
    handler.ServeHTTP(rr, req)

    // 验证所有预期的字段
    entries := rec.EntriesAtLevel(dd.LevelInfo)
    require.Len(t, entries, 1)

    entry := entries[0]
    require.Equal(t, "请求完成", entry.Message)
    // 验证字段值（注意：文本格式下字段值为 string 类型）
    require.Equal(t, "GET", rec.GetFieldValue("method"))
    require.Equal(t, "/api/users", rec.GetFieldValue("path"))
    require.Equal(t, "200", rec.GetFieldValue("status"))
}
```

### 测试隔离

```go
func TestSuite(t *testing.T) {
    t.Run("场景A", func(t *testing.T) {
        rec := dd.NewLoggerRecorder() // 每个测试独立 recorder
        logger, _ := rec.NewLogger()
        // 测试逻辑...
    })

    t.Run("场景B", func(t *testing.T) {
        rec := dd.NewLoggerRecorder() // 独立 recorder
        logger, _ := rec.NewLogger()
        // 测试逻辑...
    })
}
```

## 表驱动测试

```go
func TestLogLevel_Behavior(t *testing.T) {
    tests := []struct {
        name     string
        level    dd.LogLevel
        logFunc  func(*dd.Logger)
        expected string
    }{
        {
            name:     "Debug级别",
            level:    dd.LevelDebug,
            logFunc:  func(l *dd.Logger) { l.Debug("调试信息") },
            expected: "调试信息",
        },
        {
            name:     "Info级别",
            level:    dd.LevelInfo,
            logFunc:  func(l *dd.Logger) { l.Info("一般信息") },
            expected: "一般信息",
        },
        {
            name:     "Error级别",
            level:    dd.LevelError,
            logFunc:  func(l *dd.Logger) { l.Error("错误信息") },
            expected: "错误信息",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            rec := dd.NewLoggerRecorder()
            cfg := dd.DefaultConfig()
            cfg.Level = tt.level
            logger, _ := rec.NewLogger(cfg)

            tt.logFunc(logger)

            if !rec.ContainsMessage(tt.expected) {
                t.Errorf("Expected message %q", tt.expected)
            }
        })
    }
}
```

## 下一步

- [Web 服务集成](./web-service) -- HTTP 服务日志集成
- [API 参考 - Recorder](../api-reference/recorder) -- LoggerRecorder 完整 API
- [钩子系统](../guides/hooks) -- 生命周期钩子
