---
sidebar_label: "Базовое использование"
title: "Базовое использование - CyberGo DD | Практические примеры"
description: "Коллекция практических примеров кода библиотеки логирования CyberGo DD, охватывающая логирование запросов Web-сервисов Gin/Echo, интеграцию с перехватчиками gRPC, логирование операций с базой данных, цепочные вызовы посредников, вывод логов запланированных задач и интеграцию распределённой трассировки микросервисов и другие распространённые сценарии, предоставляя готовые к использованию фрагменты кода лучших практик."
sidebar_position: 1
---

# Базовое использование

## Логирование Web-сервиса

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

        logger.InfoWith("Запрос начат",
            dd.String("method", r.Method),
            dd.String("path", r.URL.Path),
            dd.String("remote", r.RemoteAddr),
        )

        next.ServeHTTP(w, r.WithContext(ctx))

        logger.InfoWith("Запрос завершён",
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

    fmt.Println("Сервис запущен: :8080")
    http.ListenAndServe(":8080", loggingMiddleware(mux))
}

// handleUsers пример обработчика
func handleUsers(w http.ResponseWriter, r *http.Request) {
    logger.InfoWith("Обработка запроса пользователя",
        dd.String("path", r.URL.Path),
        dd.String("method", r.Method),
    )
    fmt.Fprintf(w, `{"status":"ok"}`)
}
```

## Логирование микросервиса

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
    log.Info("Запрос пользователя")

    user, err := s.db.FindUser(id)
    if err != nil {
        log.ErrorWith("Ошибка запроса", dd.Err(err))
        return nil, err
    }

    log.InfoWith("Запрос выполнен",
        dd.String("username", user.Name),
    )
    return user, nil
}
```

## Логирование запланированных задач

<!-- check-code: skip -->
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
    logger.Info("Задача очистки начата")

    cleaned, err := cleanupExpiredRecords()
    if err != nil {
        logger.ErrorWith("Ошибка очистки",
            dd.Err(err),
            dd.Duration("elapsed", time.Since(start)),
        )
        return
    }

    logger.InfoWith("Очистка завершена",
        dd.Int("cleaned", cleaned),
        dd.Duration("elapsed", time.Since(start)),
    )
}
```

## Логирование безопасности с аудитом

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
    logger.InfoWith("Попытка входа",
        dd.String("username", username),
        dd.String("ip", ip), // FinancialConfig также замаскирует ip как [REDACTED]
        // password не записывается в лог (безопасная практика: никогда не логируйте исходный пароль)
    )

    if isBruteForce(ip) {
        audit.LogRateLimitExceeded("Слишком частые попытки входа", map[string]any{
            "ip":      ip,
            "attempts": getAttemptCount(ip),
        })
        return ErrTooManyAttempts
    }

    return nil
}
```

## Логирование в тестах

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

    if !rec.ContainsMessage("Создание пользователя") {
        t.Error("Должен быть записан лог создания пользователя")
    }

    if !rec.ContainsField("username") {
        t.Error("Должно содержать поле username")
    }

    if rec.GetFieldValue("username") != "admin" {
        t.Error("username должен быть admin")
    }
}
```

## Многосредовая конфигурация

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

## Следующие шаги

- [Быстрый старт](../getting-started/) -- базовое введение
- [Справочник API](../api-reference/) -- полный API
- [Безопасность](../security/) -- конфигурация безопасности
