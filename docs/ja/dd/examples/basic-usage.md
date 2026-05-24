---
title: "基本的な使い方 - CyberGo DD | 実用サンプル"
description: "CyberGo DD ログライブラリの実用的なコードサンプル集。Gin/Echo Web サービスのリクエストログ、gRPC インターセプター統合、データベース操作ログ記録、ミドルウェアチェーン呼び出し、定期タスクログ出力、マイクロサービス分散トレーシング統合など一般的なシナリオをカバーし、そのままコピーして使用できるベストプラクティスコードスニペットを提供。"
---

# 基本的な使い方

## Web サービスログ

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

        logger.InfoWith("リクエスト開始",
            dd.String("method", r.Method),
            dd.String("path", r.URL.Path),
            dd.String("remote", r.RemoteAddr),
        )

        next.ServeHTTP(w, r.WithContext(ctx))

        logger.InfoWith("リクエスト完了",
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

    fmt.Println("サービス起動: :8080")
    http.ListenAndServe(":8080", loggingMiddleware(mux))
}
```

## マイクロサービスログ

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
    log.Info("ユーザー検索")

    user, err := s.db.FindUser(id)
    if err != nil {
        log.ErrorWith("検索失敗", dd.Err(err))
        return nil, err
    }

    log.InfoWith("検索成功",
        dd.String("username", user.Name),
    )
    return user, nil
}
```

## 定期タスクログ

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
    logger.Info("クリーンアップタスク開始")

    cleaned, err := cleanupExpiredRecords()
    if err != nil {
        logger.ErrorWith("クリーンアップ失敗",
            dd.Err(err),
            dd.Duration("elapsed", time.Since(start)),
        )
        return
    }

    logger.InfoWith("クリーンアップ完了",
        dd.Int("cleaned", cleaned),
        dd.Duration("elapsed", time.Since(start)),
    )
}
```

## 監査付きセキュリティログ

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
    logger.InfoWith("ログイン試行",
        dd.String("username", username),
        dd.String("ip", ip),
        // password は SecurityConfig で自動フィルタリング
    )

    if isBruteForce(ip) {
        audit.LogRateLimitExceeded("ログイン頻度が高すぎます", map[string]any{
            "ip":      ip,
            "attempts": getAttemptCount(ip),
        })
        return ErrTooManyAttempts
    }

    return nil
}
```

## テストでのログ

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

    if !rec.ContainsMessage("ユーザー作成") {
        t.Error("ユーザー作成ログが記録されるべき")
    }

    if !rec.ContainsField("username") {
        t.Error("username フィールドが含まれるべき")
    }

    if rec.GetFieldValue("username") != "admin" {
        t.Error("username は admin であるべき")
    }
}
```

## マルチ環境設定

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

## 次のステップ

- [クイックスタート](../getting-started) -- 基礎入門
- [API リファレンス](../api-reference/) -- 完全 API
- [セキュリティ](../security/) -- セキュリティ設定
