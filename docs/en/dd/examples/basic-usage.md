---
title: "Basic Usage - CyberGo DD | Practical Examples"
description: "CyberGo DD practical examples: Gin/Echo request logging, gRPC interceptors, database logging, middleware chaining, and distributed tracing integration."
---

# Basic Usage

## Web Service Logging

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

        logger.InfoWith("Request started",
            dd.String("method", r.Method),
            dd.String("path", r.URL.Path),
            dd.String("remote", r.RemoteAddr),
        )

        next.ServeHTTP(w, r.WithContext(ctx))

        logger.InfoWith("Request completed",
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

    fmt.Println("Server started: :8080")
    http.ListenAndServe(":8080", loggingMiddleware(mux))
}
```

## Microservice Logging

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
    log.Info("Querying user")

    user, err := s.db.FindUser(id)
    if err != nil {
        log.ErrorWith("Query failed", dd.Err(err))
        return nil, err
    }

    log.InfoWith("Query successful",
        dd.String("username", user.Name),
    )
    return user, nil
}
```

## Scheduled Task Logging

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
    logger.Info("Cleanup task started")

    cleaned, err := cleanupExpiredRecords()
    if err != nil {
        logger.ErrorWith("Cleanup failed",
            dd.Err(err),
            dd.Duration("elapsed", time.Since(start)),
        )
        return
    }

    logger.InfoWith("Cleanup completed",
        dd.Int("cleaned", cleaned),
        dd.Duration("elapsed", time.Since(start)),
    )
}
```

## Secure Logging with Audit

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
    logger.InfoWith("Login attempt",
        dd.String("username", username),
        dd.String("ip", ip),
        // password is automatically filtered via SecurityConfig
    )

    if isBruteForce(ip) {
        audit.LogRateLimitExceeded("Login rate too high", map[string]any{
            "ip":      ip,
            "attempts": getAttemptCount(ip),
        })
        return ErrTooManyAttempts
    }

    return nil
}
```

## Testing with Logs

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

    if !rec.ContainsMessage("User created") {
        t.Error("Should log user creation")
    }

    if !rec.ContainsField("username") {
        t.Error("Should contain username field")
    }

    if rec.GetFieldValue("username") != "admin" {
        t.Error("Username should be admin")
    }
}
```

## Multi-Environment Configuration

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

## Next Steps

- [Quick Start](../getting-started) -- Getting started guide
- [API Reference](../api-reference/) -- Complete API
- [Security](../security/) -- Security configuration
