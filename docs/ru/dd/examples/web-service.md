---
sidebar_label: "Интеграция с веб-сервисом"
title: "Интеграция с Web-сервисом - CyberGo DD | Логирование HTTP"
description: "Полный пример интеграции CyberGo DD в Web-сервисе, включающий логирование HTTP-посредника, передачу TraceID для трассировки цепочки запросов, многоуровневую конфигурацию логирования маршрутов, изящное завершение и сброс логов, а также готовую конфигурацию логирования для продакшена, помогая разработчикам быстро интегрировать библиотеку DD в HTTP-сервисные проекты."
sidebar_position: 2
---

# Интеграция с Web-сервисом

В этом примере показано, как интегрировать DD в HTTP Web-сервис для реализации логирования запросов, трассировки, обработки ошибок и изящного завершения.

## Базовая интеграция

```go
package main

import (
    "fmt"
    "log"
    "net/http"

    "github.com/cybergodev/dd"
)

func main() {
    // Инициализация логгера
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

    // Установка глобального логгера
    dd.SetDefault(logger)

    mux := http.NewServeMux()
    mux.HandleFunc("/api/users", usersHandler)
    mux.HandleFunc("/api/orders", ordersHandler)

    server := &http.Server{Addr: ":8080", Handler: mux}

    logger.InfoWith("Сервис запущен", dd.String("addr", ":8080"))
    if err := server.ListenAndServe(); err != nil {
        logger.ErrorWith("Аварийное завершение сервиса", dd.Err(err))
    }
}

// usersHandler пример обработчика
func usersHandler(w http.ResponseWriter, r *http.Request) {
    dd.Default().InfoWith("Обработка запроса пользователя", dd.String("path", r.URL.Path))
    fmt.Fprintf(w, `{"status":"ok"}`)
}

// ordersHandler пример обработчика
func ordersHandler(w http.ResponseWriter, r *http.Request) {
    dd.Default().InfoWith("Обработка запроса заказа", dd.String("path", r.URL.Path))
    fmt.Fprintf(w, `{"status":"ok"}`)
}
```

## HTTP-посредник

```go
func LoggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            requestID := r.Header.Get("X-Request-ID")
            if requestID == "" {
                requestID = generateRequestID()
            }

            // Лог области видимости запроса
            reqLog := logger.WithFields(
                dd.String("request_id", requestID),
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
                dd.String("remote_addr", r.RemoteAddr),
            )

            reqLog.Info("Запрос начат")

            // Обёртка ResponseWriter для захвата кода состояния
            wrapped := &responseWriter{ResponseWriter: w, status: 200}
            next.ServeHTTP(wrapped, r)

            reqLog.InfoWith("Запрос завершён",
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

## Многоуровневое логирование сервиса

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
    s.log.InfoWith("Запрос пользователя", dd.String("user_id", id))

    user, err := s.queryUser(ctx, id)
    if err != nil {
        s.log.ErrorWith("Ошибка запроса пользователя",
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

## Изящное завершение

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

    // Прослушивание сигналов завершения
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        logger.InfoWith("Сервис запущен", dd.String("addr", ":8080"))
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            logger.ErrorWith("Ошибка сервиса", dd.Err(err))
        }
    }()

    <-quit
    logger.Info("Завершение сервиса...")

    // Изящное завершение HTTP-сервиса
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        logger.ErrorWith("Ошибка завершения сервиса", dd.Err(err))
    }

    // Изящное завершение логгера
    logger.Info("Сервис остановлен")
    logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer logCancel()
    logger.Shutdown(logCtx)
}
```

## Полный пример

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

// LoggingMiddleware middleware логирования запросов
func LoggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            logger.InfoWith("Запрос начат",
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
            )
            next.ServeHTTP(w, r)
            logger.InfoWith("Запрос завершён",
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
        reqLog.Info("Обработка запроса пользователя")

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
        logger.InfoWith("Сервис запущен", dd.String("addr", ":8080"))
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            logger.ErrorWith("Ошибка сервиса", dd.Err(err))
        }
    }()

    <-quit
    logger.Info("Завершение...")

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    server.Shutdown(ctx)

    logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer logCancel()
    logger.Shutdown(logCtx)
}
```

## Следующие шаги

- [Паттерны тестирования](./testing-patterns) -- использование LoggerRecorder в тестах
- [Безопасность и аудит на практике](./security-audit) -- фильтрация безопасности и аудитные логи
- [Распределённая трассировка](../guides/context-tracing) -- интеграция трассировки запросов
