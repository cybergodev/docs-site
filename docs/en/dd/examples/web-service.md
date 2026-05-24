---
title: "Web Service Integration - CyberGo DD | HTTP Service Logging"
description: "CyberGo DD web service integration: HTTP middleware logging, TraceID propagation, layered config, graceful shutdown, and production-grade setup."
---

# Web Service Integration

This example demonstrates how to integrate DD into an HTTP web service, implementing request logging, tracing, error handling, and graceful shutdown.

## Basic Integration

```go
package main

import (
    "log"
    "net/http"
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    // Initialize logger
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

    // Set global logger
    dd.SetDefault(logger)

    mux := http.NewServeMux()
    mux.HandleFunc("/api/users", usersHandler)
    mux.HandleFunc("/api/orders", ordersHandler)

    server := &http.Server{Addr: ":8080", Handler: mux}

    logger.InfoWith("Server started", dd.String("addr", ":8080"))
    if err := server.ListenAndServe(); err != nil {
        logger.ErrorWith("Server exited abnormally", dd.Err(err))
    }
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

            // Request-scoped logger
            reqLog := logger.WithFields(
                dd.String("request_id", requestID),
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
                dd.String("remote_addr", r.RemoteAddr),
            )

            reqLog.Info("Request started")

            // Wrap ResponseWriter to capture status code
            wrapped := &responseWriter{ResponseWriter: w, status: 200}
            next.ServeHTTP(wrapped, r)

            reqLog.InfoWith("Request completed",
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

## Service-Layer Logging

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
    s.log.InfoWith("Querying user", dd.String("user_id", id))

    user, err := s.queryUser(ctx, id)
    if err != nil {
        s.log.ErrorWith("Query user failed",
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
        logger.InfoWith("Server started", dd.String("addr", ":8080"))
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            logger.ErrorWith("Server error", dd.Err(err))
        }
    }()

    <-quit
    logger.Info("Shutting down server...")

    // Gracefully shutdown HTTP server
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        logger.ErrorWith("Server shutdown failed", dd.Err(err))
    }

    // Flush and close logger
    logger.Info("Server stopped")
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
        reqLog.Info("Processing user request")

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
        logger.InfoWith("Server started", dd.String("addr", ":8080"))
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            logger.ErrorWith("Server error", dd.Err(err))
        }
    }()

    <-quit
    logger.Info("Shutting down...")

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
- [Context & Tracing](../guides/context-tracing) -- Request tracing integration
