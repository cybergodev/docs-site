---
title: "基础用法 - CyberGo DD | 实用示例"
description: "CyberGo DD 日志库的实用代码示例集合，涵盖 Gin/Echo Web 服务请求日志、gRPC 拦截器集成、数据库操作日志记录、中间件链式调用、定时任务日志输出和微服务分布式追踪集成等常见场景，提供可直接复制使用的最佳实践代码片段。"
---

# 基础用法

## Web 服务日志

```go
package main

import (
    "fmt"
    "net/http"
    "time"

    "github.com/cybergodev/dd"
)

var logger *dd.Logger

func init() {
    var err error
    logger, err = dd.New(dd.Config{Format: dd.FormatJSON, Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("logs/api.json")}})
    if err != nil {
        panic(err)
    }
}

func loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        reqID := fmt.Sprintf("req-%d", time.Now().UnixNano())

        ctx := dd.WithRequestID(r.Context(), reqID)
        ctx = dd.WithTraceID(ctx, r.Header.Get("X-Trace-ID"))

        logger.InfoWith("请求开始",
            dd.String("method", r.Method),
            dd.String("path", r.URL.Path),
            dd.String("remote", r.RemoteAddr),
        )

        next.ServeHTTP(w, r.WithContext(ctx))

        logger.InfoWith("请求完成",
            dd.String("method", r.Method),
            dd.String("path", r.URL.Path),
            dd.Duration("elapsed", time.Since(start)),
        )
    })
}

func main() {
    defer logger.Close()

    mux := http.NewServeMux()
    mux.HandleFunc("/api/users", handleUsers)

    fmt.Println("服务启动: :8080")
    http.ListenAndServe(":8080", loggingMiddleware(mux))
}
```

## 微服务日志

```go
package service

import (
    "github.com/cybergodev/dd"
)

type UserService struct {
    logger *dd.LoggerEntry
    db     Database
}

func NewUserService(db Database) *UserService {
    svcLogger, _ := dd.New(dd.Config{Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("logs/service.log")}})
    return &UserService{
        logger: svcLogger.WithFields(
            dd.String("service", "user-service"),
            dd.String("version", "1.0.0"),
        ),
        db: db,
    }
}

func (s *UserService) GetUser(id int) (*User, error) {
    log := s.logger.WithField("user_id", id)
    log.Info("查询用户")

    user, err := s.db.FindUser(id)
    if err != nil {
        log.ErrorWith("查询失败", dd.Err(err))
        return nil, err
    }

    log.InfoWith("查询成功",
        dd.String("username", user.Name),
    )
    return user, nil
}
```

## 定时任务日志

```go
package cron

import (
    "time"

    "github.com/cybergodev/dd"
)

func RunCleanup() {
    logger, _ := dd.New(dd.Config{Targets: []dd.OutputTarget{dd.FileOutput("logs/cleanup.log")}})
    defer logger.Close()

    start := time.Now()
    logger.Info("清理任务开始")

    cleaned, err := cleanupExpiredRecords()
    if err != nil {
        logger.ErrorWith("清理失败",
            dd.Err(err),
            dd.Duration("elapsed", time.Since(start)),
        )
        return
    }

    logger.InfoWith("清理完成",
        dd.Int("cleaned", cleaned),
        dd.Duration("elapsed", time.Since(start)),
    )
}
```

## 带审计的安全日志

```go
package auth

import (
    "github.com/cybergodev/dd"
)

var (
    logger *dd.Logger
    audit  *dd.AuditLogger
)

func init() {
    var err error
    logger, err = dd.New(dd.Config{
        Level:   dd.LevelInfo,
        Format:  dd.FormatJSON,
        Security: dd.FinancialConfig(),
    })
    if err != nil {
        panic(err)
    }

    audit, _ = dd.NewAuditLogger(dd.DefaultAuditConfig())
}

func HandleLogin(username, password, ip string) error {
    logger.InfoWith("登录尝试",
        dd.String("username", username),
        dd.String("ip", ip),
        // password 经过 SecurityConfig 自动过滤
    )

    if isBruteForce(ip) {
        audit.LogRateLimitExceeded("登录频率过高", map[string]any{
            "ip":      ip,
            "attempts": getAttemptCount(ip),
        })
        return ErrTooManyAttempts
    }

    return nil
}
```

## 测试中的日志

```go
package service_test

import (
    "testing"

    "github.com/cybergodev/dd"
)

func TestUserCreation(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    svc := NewService(logger)
    svc.CreateUser("admin")

    if !rec.ContainsMessage("用户创建") {
        t.Error("应记录用户创建日志")
    }

    if !rec.ContainsField("username") {
        t.Error("应包含 username 字段")
    }

    if rec.GetFieldValue("username") != "admin" {
        t.Error("username 应为 admin")
    }
}
```

## 多环境配置

```go
package logger

import (
    "github.com/cybergodev/dd"
)

func SetupLogger(env string) (*dd.Logger, error) {
    switch env {
    case "development":
        return dd.New(dd.DevelopmentConfig())

    case "staging":
        return dd.New(dd.Config{Format: dd.FormatJSON, Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("logs/app.json")}})

    case "production":
        return dd.New(dd.Config{
            Level:    dd.LevelInfo,
            Format:   dd.FormatJSON,
            Security: dd.DefaultSecurityConfig(),
            Targets:  []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("logs/app.json")},
        })

    default:
        return dd.New(dd.DevelopmentConfig())
    }
}
```

## 下一步

- [快速开始](../getting-started) -- 基础入门
- [API 参考](../api-reference/) -- 完整 API
- [安全](../security/) -- 安全配置
