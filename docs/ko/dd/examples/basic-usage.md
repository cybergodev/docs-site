---
title: "기본 사용법 - CyberGo DD | 실용 예제"
description: "CyberGo DD 로그 라이브러리의 실용 코드 예제 모음. Gin/Echo 웹 서비스 요청 로그, gRPC 인터셉터 통합, 데이터베이스 작업 로그 기록, 미들웨어 체인 호출, 스케줄된 작업 로그 출력 및 마이크로서비스 분산 추적 통합 등 일반적인 시나리오를 다루며, 복사해서 바로 사용할 수 있는 모범 사례 코드 조각을 제공합니다."
---

# 기본 사용법

## 웹 서비스 로그

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

        logger.InfoWith("요청 시작",
            dd.String("method", r.Method),
            dd.String("path", r.URL.Path),
            dd.String("remote", r.RemoteAddr),
        )

        next.ServeHTTP(w, r.WithContext(ctx))

        logger.InfoWith("요청 완료",
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

    fmt.Println("서비스 시작: :8080")
    http.ListenAndServe(":8080", loggingMiddleware(mux))
}
```

## 마이크로서비스 로그

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
    log.Info("사용자 조회")

    user, err := s.db.FindUser(id)
    if err != nil {
        log.ErrorWith("조회 실패", dd.Err(err))
        return nil, err
    }

    log.InfoWith("조회 성공",
        dd.String("username", user.Name),
    )
    return user, nil
}
```

## 스케줄된 작업 로그

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
    logger.Info("정리 작업 시작")

    cleaned, err := cleanupExpiredRecords()
    if err != nil {
        logger.ErrorWith("정리 실패",
            dd.Err(err),
            dd.Duration("elapsed", time.Since(start)),
        )
        return
    }

    logger.InfoWith("정리 완료",
        dd.Int("cleaned", cleaned),
        dd.Duration("elapsed", time.Since(start)),
    )
}
```

## 감사가 포함된 보안 로그

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
    logger.InfoWith("로그인 시도",
        dd.String("username", username),
        dd.String("ip", ip),
        // password는 SecurityConfig에 의해 자동 필터링
    )

    if isBruteForce(ip) {
        audit.LogRateLimitExceeded("로그인 빈도 과다", map[string]any{
            "ip":      ip,
            "attempts": getAttemptCount(ip),
        })
        return ErrTooManyAttempts
    }

    return nil
}
```

## 테스트에서의 로그

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

    if !rec.ContainsMessage("사용자 생성") {
        t.Error("사용자 생성 로그가 기록되어야 함")
    }

    if !rec.ContainsField("username") {
        t.Error("username 필드가 포함되어야 함")
    }

    if rec.GetFieldValue("username") != "admin" {
        t.Error("username은 admin이어야 함")
    }
}
```

## 다중 환경 설정

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

## 다음 단계

- [빠른 시작](../getting-started) -- 기본 입문
- [API 레퍼런스](../api-reference/) -- 전체 API
- [보안](../security/) -- 보안 설정
