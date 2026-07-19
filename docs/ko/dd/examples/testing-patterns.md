---
sidebar_label: "테스트 패턴"
title: "테스트 패턴 - CyberGo DD | LoggerRecorder 테스트 예제"
description: "CyberGo DD 테스트 패턴 예제입니다. LoggerRecorder를 단위 테스트와 통합 테스트에서 사용하는 완전한 방법을 자세히 소개합니다. 로그 메시지 단언, 레벨 필터 테스트, 필드값 검사, 다중 테스트 케이스 격리, 동시성 안전 테스트, 테스트 커버리지를 높이는 완전한 팁과 모범 사례를 다룹니다. 다양한 Go 프로젝트의 로그 테스트에 적합합니다."
sidebar_position: 4
---

# 테스트 패턴

DD는 `LoggerRecorder`를 테스트 보조 도구로 제공하여 단위 테스트에서 로그를 캡처하고 단언할 수 있으며, 실제로 파일이나 콘솔에 쓸 필요가 없습니다.

## 기본 사용

```go
package myapp_test

import (
    "testing"

    "github.com/cybergodev/dd"
)

func TestUserService_Create(t *testing.T) {
    // 테스트용 로거 생성
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    service := NewUserService(logger)

    err := service.Create("alice")
    if err != nil {
        t.Fatalf("Create failed: %v", err)
    }

    // 로그 내용 단언
    if !rec.ContainsMessage("사용자 생성") {
        t.Error("Expected log message '사용자 생성'")
    }

    if rec.GetFieldValue("name") != "alice" {
        t.Error("Expected field name=alice")
    }
}
```

## LoggerRecorder 메서드

### 메시지 검사

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.Info("작업 성공")
logger.Error("작업 실패")

// 특정 메시지 포함 여부 검사
rec.ContainsMessage("작업 성공")  // true
rec.ContainsMessage("작업 실패")  // true

// 모든 로그 항목 가져오기
entries := rec.Entries()
for _, entry := range entries {
    fmt.Printf("[%s] %s\n", entry.Level, entry.Message)
}
```

### 레벨 필터

```go
// 특정 레벨의 로그만 검사
infoEntries := rec.EntriesAtLevel(dd.LevelInfo)
errorEntries := rec.EntriesAtLevel(dd.LevelError)

if len(errorEntries) > 0 {
    t.Error("Unexpected error logs")
}

// DEBUG 레벨로 모든 레벨 캡처
// 주의: Recorder는 ISO 8601 타임스탬프로 레벨을 파싱하며, DevelopmentConfig의 시간 형식은
// 호환되지 않으므로 DefaultConfig로 수동 설정 DEBUG.
rec2 := dd.NewLoggerRecorder()
devCfg := dd.DefaultConfig()
devCfg.Level = dd.LevelDebug
logger2, _ := rec2.NewLogger(devCfg)
logger2.Debug("디버그 정보")
debugs := rec2.EntriesAtLevel(dd.LevelDebug)
```

### 필드 검사

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.InfoWith("요청 완료",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 50*time.Millisecond),
)

// 필드값 검사
if rec.GetFieldValue("method") != "GET" {
    t.Error("Expected method=GET")
}

// 주의: 텍스트 형식에서 필드값은 string 타입
if rec.GetFieldValue("status") != "200" {
    t.Error("Expected status=200")
}
```

## 테스트 패턴

### 서비스 레이어 테스트

```go
func TestOrderService_PlaceOrder(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    svc := &OrderService{log: logger}

    // 정상 경로
    order, err := svc.PlaceOrder(ctx, "user-1", []string{"item-1"})
    require.NoError(t, err)
    require.True(t, rec.ContainsMessage("주문 생성"))
    require.True(t, rec.ContainsField("user_id"))
    require.Equal(t, "user-1", rec.GetFieldValue("user_id"))

    // 오류 로그 없음 검증
    errors := rec.EntriesAtLevel(dd.LevelError)
    require.Empty(t, errors)
}
```

### 오류 처리 테스트

```go
func TestService_DatabaseError(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    svc := &Service{
        log: logger,
        db:  &failingDB{}, // 데이터베이스 오류 시뮬레이션
    }

    err := svc.Process(ctx)
    require.Error(t, err)

    // 오류가 기록되었는지 검증
    require.True(t, rec.ContainsMessage("처리 실패"))
    require.True(t, rec.ContainsField("error"))
    require.Contains(t, rec.GetFieldValue("error"), "database connection refused")

    // 레벨이 Error인지 검증
    errorEntries := rec.EntriesAtLevel(dd.LevelError)
    require.NotEmpty(t, errorEntries)
}
```

### 구조화 로그 테스트

```go
func TestMiddleware_LogsRequestFields(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    handler := LoggingMiddleware(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(200)
    }))

    req := httptest.NewRequest("GET", "/api/users", nil)
    rr := httptest.NewRecorder()
    handler.ServeHTTP(rr, req)

    // 모든 예상 필드 검증
    entries := rec.EntriesAtLevel(dd.LevelInfo)
    require.Len(t, entries, 1)

    entry := entries[0]
    require.Equal(t, "요청 완료", entry.Message)
    // 필드값 검증(주의: 텍스트 형식에서 필드값은 string 타입)
    require.Equal(t, "GET", rec.GetFieldValue("method"))
    require.Equal(t, "/api/users", rec.GetFieldValue("path"))
    require.Equal(t, "200", rec.GetFieldValue("status"))
}
```

### 테스트 격리

```go
func TestSuite(t *testing.T) {
    t.Run("시나리오A", func(t *testing.T) {
        rec := dd.NewLoggerRecorder() // 각 테스트마다 독립 recorder
        logger, _ := rec.NewLogger()
        // 테스트 로직...
    })

    t.Run("시나리오B", func(t *testing.T) {
        rec := dd.NewLoggerRecorder() // 독립 recorder
        logger, _ := rec.NewLogger()
        // 테스트 로직...
    })
}
```

## 테이블 기반 테스트

```go
func TestLogLevel_Behavior(t *testing.T) {
    tests := []struct {
        name     string
        level    dd.LogLevel
        logFunc  func(*dd.Logger)
        expected string
    }{
        {
            name:     "Debug 레벨",
            level:    dd.LevelDebug,
            logFunc:  func(l *dd.Logger) { l.Debug("디버그 정보") },
            expected: "디버그 정보",
        },
        {
            name:     "Info 레벨",
            level:    dd.LevelInfo,
            logFunc:  func(l *dd.Logger) { l.Info("일반 정보") },
            expected: "일반 정보",
        },
        {
            name:     "Error 레벨",
            level:    dd.LevelError,
            logFunc:  func(l *dd.Logger) { l.Error("오류 정보") },
            expected: "오류 정보",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            rec := dd.NewLoggerRecorder()
            cfg := dd.DefaultConfig()
            cfg.Level = tt.level
            logger, _ := rec.NewLogger(cfg)

            tt.logFunc(logger)

            if !rec.ContainsMessage(tt.expected) {
                t.Errorf("Expected message %q", tt.expected)
            }
        })
    }
}
```

## 다음 단계

- [웹 서비스 통합](./web-service) -- HTTP 서비스 로그 통합
- [API 레퍼런스 - Recorder](../api-reference/dev-tools/recorder) -- LoggerRecorder 완전한 API
- [훅 시스템](../guides/hooks) -- 라이프사이클 훅
