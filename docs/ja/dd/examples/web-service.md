---
sidebar_label: "Web サービス統合"
title: "Web サービス統合 - CyberGo DD | HTTP サービスログサンプル"
description: "CyberGo DD の Web サービス統合サンプル。HTTP ミドルウェアログ、リクエストチェーン追跡と TraceID 伝播、マルチルート階層設定、グレースフルシャットダウン、本番ログ設定を含む HTTP 統合ガイドで、プロジェクトへの迅速な統合を支援。"
sidebar_position: 2
---

# Web サービス統合

このサンプルでは、DD を HTTP Web サービスに統合し、リクエストログ、トレーシング、エラー処理、グレースフルシャットダウンを実現する方法を示します。

## 基本的な統合

```go
package main

import (
    "fmt"
    "log"
    "net/http"

    "github.com/cybergodev/dd"
)

func main() {
    // ロガーを初期化
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

    // グローバルロガーを設定
    dd.SetDefault(logger)

    mux := http.NewServeMux()
    mux.HandleFunc("/api/users", usersHandler)
    mux.HandleFunc("/api/orders", ordersHandler)

    server := &http.Server{Addr: ":8080", Handler: mux}

    logger.InfoWith("サービス起動", dd.String("addr", ":8080"))
    if err := server.ListenAndServe(); err != nil {
        logger.ErrorWith("サービス異常終了", dd.Err(err))
    }
}

// usersHandler サンプルハンドラ
func usersHandler(w http.ResponseWriter, r *http.Request) {
    dd.Default().InfoWith("ユーザーリクエストを処理", dd.String("path", r.URL.Path))
    fmt.Fprintf(w, `{"status":"ok"}`)
}

// ordersHandler サンプルハンドラ
func ordersHandler(w http.ResponseWriter, r *http.Request) {
    dd.Default().InfoWith("注文リクエストを処理", dd.String("path", r.URL.Path))
    fmt.Fprintf(w, `{"status":"ok"}`)
}
```

## HTTP ミドルウェア

```go
func LoggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            requestID := r.Header.Get("X-Request-ID")
            if requestID == "" {
                requestID = generateRequestID()
            }

            // リクエストスコープログ
            reqLog := logger.WithFields(
                dd.String("request_id", requestID),
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
                dd.String("remote_addr", r.RemoteAddr),
            )

            reqLog.Info("リクエスト開始")

            // ResponseWriter をラップしてステータスコードをキャプチャ
            wrapped := &responseWriter{ResponseWriter: w, status: 200}
            next.ServeHTTP(wrapped, r)

            reqLog.InfoWith("リクエスト完了",
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

## サービス階層ログ

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
    s.log.InfoWith("ユーザー検索", dd.String("user_id", id))

    user, err := s.queryUser(ctx, id)
    if err != nil {
        s.log.ErrorWith("ユーザー検索失敗",
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

## グレースフルシャットダウン

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

    // シャットダウンシグナルを監視
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        logger.InfoWith("サービス起動", dd.String("addr", ":8080"))
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            logger.ErrorWith("サービス異常", dd.Err(err))
        }
    }()

    <-quit
    logger.Info("サービスをシャットダウン中...")

    // HTTP サービスをグレースフルシャットダウン
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        logger.ErrorWith("サービスシャットダウン失敗", dd.Err(err))
    }

    // ロガーをグレースフルシャットダウン
    logger.Info("サービス停止完了")
    logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer logCancel()
    logger.Shutdown(logCtx)
}
```

## 完全な例

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

// LoggingMiddleware リクエストログミドルウェア
func LoggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            logger.InfoWith("リクエスト開始",
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
            )
            next.ServeHTTP(w, r)
            logger.InfoWith("リクエスト完了",
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
        reqLog.Info("ユーザーリクエストを処理")

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
        logger.InfoWith("サービス起動", dd.String("addr", ":8080"))
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            logger.ErrorWith("サービス異常", dd.Err(err))
        }
    }()

    <-quit
    logger.Info("シャットダウン中...")

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    server.Shutdown(ctx)

    logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer logCancel()
    logger.Shutdown(logCtx)
}
```

## 次のステップ

- [テストパターン](./testing-patterns) -- テストで LoggerRecorder を使用
- [セキュリティと監査実践](./security-audit) -- セキュリティフィルタリングと監査ログ
- [分散トレーシング](../guides/context-tracing) -- リクエストトレーシング統合
