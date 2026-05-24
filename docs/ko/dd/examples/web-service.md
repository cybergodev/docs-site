---
title: "웹 서비스 통합 - CyberGo DD | HTTP 서비스 로그 예제"
description: "CyberGo DD를 웹 서비스에 통합하는 전체 예제. HTTP 미들웨어 로그 기록, 요청 체인 추적과 TraceID 전달, 다중 라우팅 계층화 로그 설정, 정상 종료와 로그 새로고침 및 프로덕션급 로그 설정 방안을 다루어 개발자가 DD 로그 라이브러리를 HTTP 서비스 프로젝트에 빠르게 통합할 수 있도록 돕습니다."
---

# 웹 서비스 통합

이 예제에서는 DD를 HTTP 웹 서비스에 통합하여 요청 로그, 추적, 오류 처리 및 정상 종료를 구현하는 방법을 보여줍니다.

## 기본 통합

```go
package main

import (
    "log"
    "net/http"
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    // 로거 초기화
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

    // 전역 로거 설정
    dd.SetDefault(logger)

    mux := http.NewServeMux()
    mux.HandleFunc("/api/users", usersHandler)
    mux.HandleFunc("/api/orders", ordersHandler)

    server := &http.Server{Addr: ":8080", Handler: mux}

    logger.InfoWith("서비스 시작", dd.String("addr", ":8080"))
    if err := server.ListenAndServe(); err != nil {
        logger.ErrorWith("서비스 비정상 종료", dd.Err(err))
    }
}
```

## HTTP 미들웨어

```go
func LoggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            requestID := r.Header.Get("X-Request-ID")
            if requestID == "" {
                requestID = generateRequestID()
            }

            // 요청 범위 로그
            reqLog := logger.WithFields(
                dd.String("request_id", requestID),
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
                dd.String("remote_addr", r.RemoteAddr),
            )

            reqLog.Info("요청 시작")

            // ResponseWriter 래핑하여 상태 코드 캡처
            wrapped := &responseWriter{ResponseWriter: w, status: 200}
            next.ServeHTTP(wrapped, r)

            reqLog.InfoWith("요청 완료",
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

## 서비스 계층화 로그

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
    s.log.InfoWith("사용자 조회", dd.String("user_id", id))

    user, err := s.queryUser(ctx, id)
    if err != nil {
        s.log.ErrorWith("사용자 조회 실패",
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

## 정상 종료

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

    // 종료 신호 대기
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        logger.InfoWith("서비스 시작", dd.String("addr", ":8080"))
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            logger.ErrorWith("서비스 비정상", dd.Err(err))
        }
    }()

    <-quit
    logger.Info("서비스를 종료하는 중...")

    // HTTP 서비스 정상 종료
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        logger.ErrorWith("서비스 종료 실패", dd.Err(err))
    }

    // 로거 정상 종료
    logger.Info("서비스가 중지되었습니다")
    logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer logCancel()
    logger.Shutdown(logCtx)
}
```

## 전체 예시

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
        reqLog.Info("사용자 요청 처리")

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
        logger.InfoWith("서비스 시작", dd.String("addr", ":8080"))
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            logger.ErrorWith("서비스 비정상", dd.Err(err))
        }
    }()

    <-quit
    logger.Info("종료 중...")

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    server.Shutdown(ctx)

    logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer logCancel()
    logger.Shutdown(logCtx)
}
```

## 다음 단계

- [테스트 패턴](./testing-patterns) -- 테스트에서 LoggerRecorder 사용
- [보안과 감사 실전](./security-audit) -- 보안 필터링과 감사 로그
- [분산 추적](../guides/context-tracing) -- 요청 추적 통합
