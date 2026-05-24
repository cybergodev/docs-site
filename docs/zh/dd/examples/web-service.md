---
title: "Web 服务集成 - CyberGo DD | HTTP 服务日志示例"
description: "CyberGo DD 在 Web 服务中的完整集成示例，包括 HTTP 中间件日志记录、请求链路追踪与 TraceID 传递、多路由分层日志配置、优雅关闭与日志刷新以及生产级日志配置方案，帮助开发者将 DD 日志库快速集成到 HTTP 服务项目中。"
---

# Web 服务集成

本示例展示如何将 DD 集成到 HTTP Web 服务中，实现请求日志、追踪、错误处理和优雅关闭。

## 基本集成

```go
package main

import (
    "log"
    "net/http"
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    // 初始化日志记录器
    logger, err := dd.New(dd.Config{
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.json"),
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    // 设置全局日志记录器
    dd.SetDefault(logger)

    mux := http.NewServeMux()
    mux.HandleFunc("/api/users", usersHandler)
    mux.HandleFunc("/api/orders", ordersHandler)

    server := &http.Server{Addr: ":8080", Handler: mux}

    logger.InfoWith("服务启动", dd.String("addr", ":8080"))
    if err := server.ListenAndServe(); err != nil {
        logger.ErrorWith("服务异常退出", dd.Err(err))
    }
}
```

## HTTP 中间件

```go
func LoggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            requestID := r.Header.Get("X-Request-ID")
            if requestID == "" {
                requestID = generateRequestID()
            }

            // 请求作用域日志
            reqLog := logger.WithFields(
                dd.String("request_id", requestID),
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
                dd.String("remote_addr", r.RemoteAddr),
            )

            reqLog.Info("请求开始")

            // 包装 ResponseWriter 捕获状态码
            wrapped := &responseWriter{ResponseWriter: w, status: 200}
            next.ServeHTTP(wrapped, r)

            reqLog.InfoWith("请求完成",
                dd.Int("status", wrapped.status),
                dd.Duration("elapsed", time.Since(start)),
            )
        })
    }
}

type responseWriter struct {
    http.ResponseWriter
    status int
}

func (rw *responseWriter) WriteHeader(code int) {
    rw.status = code
    rw.ResponseWriter.WriteHeader(code)
}
```

## 服务分层日志

```go
type UserService struct {
    log *dd.LoggerEntry
    db  *sql.DB
}

func NewUserService(logger *dd.Logger, db *sql.DB) *UserService {
    return &UserService{
        log: logger.WithFields(dd.String("component", "user_service")),
        db:  db,
    }
}

func (s *UserService) GetUser(ctx context.Context, id string) (*User, error) {
    s.log.InfoWith("查询用户", dd.String("user_id", id))

    user, err := s.queryUser(ctx, id)
    if err != nil {
        s.log.ErrorWith("查询用户失败",
            dd.String("user_id", id),
            dd.Err(err),
        )
        return nil, err
    }

    return user, nil
}

type OrderService struct {
    log *dd.LoggerEntry
}

func NewOrderService(logger *dd.Logger) *OrderService {
    return &OrderService{
        log: logger.WithFields(dd.String("component", "order_service")),
    }
}
```

## 优雅关闭

```go
func main() {
    logger, _ := dd.New(dd.Config{
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.json"),
        },
    })

    server := &http.Server{Addr: ":8080"}

    // 监听关闭信号
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        logger.InfoWith("服务启动", dd.String("addr", ":8080"))
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            logger.ErrorWith("服务异常", dd.Err(err))
        }
    }()

    <-quit
    logger.Info("正在关闭服务...")

    // 优雅关闭 HTTP 服务
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        logger.ErrorWith("服务关闭失败", dd.Err(err))
    }

    // 优雅关闭日志记录器
    logger.Info("服务已停止")
    logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer logCancel()
    logger.Shutdown(logCtx)
}
```

## 完整示例

```go
package main

import (
    "context"
    "fmt"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    logger, err := dd.New(dd.Config{
        Format: dd.FormatJSON,
        Security: dd.DefaultSecurityConfig(),
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.json"),
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    dd.SetDefault(logger)

    mux := http.NewServeMux()
    mux.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
        reqLog := logger.WithFields(
            dd.String("method", r.Method),
            dd.String("path", r.URL.Path),
        )
        reqLog.Info("处理用户请求")

        w.Header().Set("Content-Type", "application/json")
        fmt.Fprintf(w, `{"status":"ok"}`)
    })

    server := &http.Server{
        Addr:    ":8080",
        Handler: LoggingMiddleware(logger)(mux),
    }

    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        logger.InfoWith("服务启动", dd.String("addr", ":8080"))
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            logger.ErrorWith("服务异常", dd.Err(err))
        }
    }()

    <-quit
    logger.Info("正在关闭...")

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    server.Shutdown(ctx)

    logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer logCancel()
    logger.Shutdown(logCtx)
}
```

## 下一步

- [测试模式](./testing-patterns) -- 在测试中使用 LoggerRecorder
- [安全与审计实战](./security-audit) -- 安全过滤和审计日志
- [分布式追踪](../guides/context-tracing) -- 请求追踪集成
