---
sidebar_label: "基础用法"
title: "基础用法 - CyberGo DD | 实用示例"
description: "CyberGo DD 实用代码示例集合：Web 服务中间件请求日志、微服务日志、定时任务日志、带审计的安全日志、测试中的日志与多环境配置等场景，提供可直接复用的最佳实践代码片段。"
sidebar_position: 1
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
	cfg := dd.DefaultConfig()
	cfg.Format = dd.FormatJSON
	cfg.Targets = []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("logs/api.json")}
	logger, err = dd.New(cfg)
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

	fmt.Println("服务启动：:8080")
	http.ListenAndServe(":8080", loggingMiddleware(mux))
}

// handleUsers 示例处理器
func handleUsers(w http.ResponseWriter, r *http.Request) {
	logger.InfoWith("处理用户请求",
		dd.String("path", r.URL.Path),
		dd.String("method", r.Method),
	)
	fmt.Fprintf(w, `{"status":"ok"}`)
}
```

## 微服务日志

<!-- check-code: skip -->
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
    cfg := dd.DefaultConfig()
    cfg.Targets = []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("logs/service.log")}
    svcLogger, _ := dd.New(cfg)
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

<!-- check-code: skip -->
```go
package cron

import (
    "time"

    "github.com/cybergodev/dd"
)

func RunCleanup() {
    cfg := dd.DefaultConfig()
    cfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/cleanup.log")}
    logger, _ := dd.New(cfg)
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

<!-- check-code: skip -->
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
    cfg := dd.DefaultConfig()
    cfg.Level = dd.LevelInfo
    cfg.Format = dd.FormatJSON
    cfg.Security = dd.FinancialConfig()
    logger, err = dd.New(cfg)
    if err != nil {
        panic(err)
    }

    audit, _ = dd.NewAuditLogger(dd.DefaultAuditConfig())
}

func HandleLogin(username, password, ip string) error {
    logger.InfoWith("登录尝试",
        dd.String("username", username),
        dd.String("ip", ip),  // FinancialConfig 会将 ip 也脱敏为 [REDACTED]
        // password 未记录到日志（安全实践：永远不要 log 原始密码）
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
		cfg := dd.DefaultConfig()
		cfg.Format = dd.FormatJSON
		cfg.Targets = []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("logs/app.json")}
		return dd.New(cfg)

	case "production":
		cfg := dd.DefaultConfig()
		cfg.Level = dd.LevelInfo
		cfg.Format = dd.FormatJSON
		cfg.Security = dd.DefaultSecurityConfig()
		cfg.Targets = []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("logs/app.json")}
		return dd.New(cfg)

	default:
		return dd.New(dd.DevelopmentConfig())
	}
}
```

## 下一步

- [快速开始](../getting-started/) -- 基础入门
- [API 参考](../api-reference/) -- 完整 API
- [安全](../guides/security/) -- 安全配置
