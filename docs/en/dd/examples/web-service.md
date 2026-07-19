---
sidebar_label: "Web Service Integration"
title: "Web Service Integration - CyberGo DD | HTTP Service Logging Example"
description: "A complete integration example of CyberGo DD in a web service, including HTTP middleware logging, request-chain tracing and TraceID propagation, multi-route layered logging configuration, graceful shutdown and log flushing, and production-grade logging configuration to help you integrate the DD logging library into HTTP service projects quickly."
sidebar_position: 2
---

# Web Service Integration

This example shows how to integrate DD into an HTTP web service for request logging, tracing, error handling, and graceful shutdown.

## Basic Integration

```go
package main

import (
    "fmt"
    "log"
    "net/http"

    "github.com/cybergodev/dd"
)

func main() {
    // Initialize the logger
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

    // Set the global logger
    dd.SetDefault(logger)

    mux := http.NewServeMux()
    mux.HandleFunc("/api/users", usersHandler)
    mux.HandleFunc("/api/orders", ordersHandler)

    server := &http.Server{Addr: ":8080", Handler: mux}

    logger.InfoWith("server started", dd.String("addr", ":8080"))
    if err := server.ListenAndServe(); err != nil {
        logger.ErrorWith("server exited abnormally", dd.Err(err))
    }
}

// usersHandler example handler
func usersHandler(w http.ResponseWriter, r *http.Request) {
    dd.Default().InfoWith("handle users request", dd.String("path", r.URL.Path))
    fmt.Fprintf(w, `{"status":"ok"}`)
}

// ordersHandler example handler
func ordersHandler(w http.ResponseWriter, r *http.Request) {
    dd.Default().InfoWith("handle orders request", dd.String("path", r.URL.Path))
    fmt.Fprintf(w, `{"status":"ok"}`)
}
```

## HTTP Middleware

```go
func LoggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            requestID := r.Header.Get("X-Request-ID")
            if requestID == "" {
                requestID = generateRequestID()
            }

            // Request-scoped logging
            reqLog := logger.WithFields(
                dd.String("request_id", requestID),
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
                dd.String("remote_addr", r.RemoteAddr),
            )

            reqLog.Info("request started")

            // Wrap ResponseWriter to capture the status code
            wrapped := &responseWriter{ResponseWriter: w, status: 200}
            next.ServeHTTP(wrapped, r)

            reqLog.InfoWith("request completed",
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

## Service-Layered Logging

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
    s.log.InfoWith("query user", dd.String("user_id", id))

    user, err := s.queryUser(ctx, id)
    if err != nil {
        s.log.ErrorWith("query user failed",
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

## Graceful Shutdown

```go
package main

import (
    "context"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    logger, _ := dd.New(dd.Config{
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.json"),
        },
    })

    server := &http.Server{Addr: ":8080"}

    // Listen for shutdown signals
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        logger.InfoWith("server started", dd.String("addr", ":8080"))
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            logger.ErrorWith("server error", dd.Err(err))
        }
    }()

    <-quit
    logger.Info("shutting down server...")

    // Graceful shutdown of the HTTP server
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        logger.ErrorWith("server shutdown failed", dd.Err(err))
    }

    // Graceful shutdown of the logger
    logger.Info("server stopped")
    logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer logCancel()
    logger.Shutdown(logCtx)
}
```

## Complete Example

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

// LoggingMiddleware request-logging middleware
func LoggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            logger.InfoWith("request started",
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
            )
            next.ServeHTTP(w, r)
            logger.InfoWith("request completed",
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
                dd.Duration("elapsed", time.Since(start)),
            )
        })
    }
}

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
        reqLog.Info("handle users request")

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
        logger.InfoWith("server started", dd.String("addr", ":8080"))
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            logger.ErrorWith("server error", dd.Err(err))
        }
    }()

    <-quit
    logger.Info("shutting down...")

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    server.Shutdown(ctx)

    logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer logCancel()
    logger.Shutdown(logCtx)
}
```

## Next Steps

- [Testing Patterns](./testing-patterns) -- Using LoggerRecorder in tests
- [Security & Audit in Practice](./security-audit) -- Security filtering and audit logging
- [Distributed Tracing](../guides/context-tracing) -- Request tracing integration
