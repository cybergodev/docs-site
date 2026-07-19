---
sidebar_label: "테스트 보조"
title: "테스트 보조 - CyberGo DD | LoggerRecorder"
description: "CyberGo DD 테스트 보조 도구 LoggerRecorder의 완전한 API 문서입니다. 단위 테스트 시나리오 전용으로 로그 출력 내용을 캡처하고 단언에 사용하며, 레벨별 로그 항목 필터링, 구조화 필드값 검증, 항목 카운트 통계 및 순서 단언을 지원하여 로그 관련 단위 테스트 작성 효율성과 가독성을 크게 높여줍니다."
sidebar_position: 2
---

# 테스트 보조

DD는 `LoggerRecorder`를 테스트 시나리오에 제공하여 로그 항목을 캡처해 단언에 사용할 수 있습니다.

## LoggerRecorder

스레드 안전한 로그 레코더로, 테스트에서 로그 출력을 캡처하고 검사하는 데 사용합니다.

:::warning 경고 텍스트 형식 파싱 제한
텍스트 모드 파서는 기본 시간 형식(ISO 8601)과 기본 레벨 문자열(DEBUG/INFO/WARN/ERROR/FATAL)을 가정합니다. `TimeFormat`을 커스터마이징한 경우 텍스트 모드는 레벨과 타임스탬프를 올바르게 추출하지 못할 수 있습니다. 커스텀 형식에는 JSON 형식(`FormatJSON`)을 권장하며, `SetFormat`으로 설정할 수 있습니다.
:::

### 생성

```go
recorder := dd.NewLoggerRecorder()
```

### 핵심 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Writer` | `() io.Writer` | io.Writer 가져오기 |
| `SetFormat` | `(format LogFormat)` | 로그 형식 설정(파싱에 사용) |
| `NewLogger` | `(cfg ...Config) (*Logger, error)` | 이 레코더에 쓰는 Logger 생성 |
| `Entries` | `() []LogEntry` | 모든 로그 항목 가져오기 |
| `Count` | `() int` | 항목 수 |
| `Clear` | `()` | 모든 항목 제거 |
| `HasEntries` | `() bool` | 항목 존재 여부 |
| `LastEntry` | `() *LogEntry` | 가장 최근 항목(nil 안전) |

### 단언 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `EntriesAtLevel` | `(level LogLevel) []LogEntry` | 레벨별 항목 필터 |
| `ContainsMessage` | `(msg string) bool` | 지정 메시지 포함 여부(정확히 일치 또는 부분 문자열 일치) |
| `ContainsField` | `(key string) bool` | 지정 필드 포함 여부 |
| `GetFieldValue` | `(key string) any` | 첫 번째로 일치하는 필드값 가져오기 |

### 사용 예

#### 기본 테스트

```go
func TestLogger(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.Info("hello")
    logger.Warn("warning")

    if rec.Count() != 2 {
        t.Errorf("expected 2 entries, got %d", rec.Count())
    }

    if !rec.ContainsMessage("hello") {
        t.Error("should contain 'hello'")
    }
}
```

#### 레벨 단언

```go
func TestLogLevel(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    // 주의: Recorder는 ISO 8601 타임스탬프로 레벨을 파싱하며, DevelopmentConfig의
    // 시간 형식("15:04:05.000")은 호환되지 않으므로 DefaultConfig로 수동 설정 DEBUG.
    cfg := dd.DefaultConfig()
    cfg.Level = dd.LevelDebug
    logger, _ := rec.NewLogger(cfg)

    logger.Debug("debug")
    logger.Info("info")
    logger.Error("error")

    errors := rec.EntriesAtLevel(dd.LevelError)
    if len(errors) != 1 {
        t.Errorf("expected 1 error, got %d", len(errors))
    }

    debugs := rec.EntriesAtLevel(dd.LevelDebug)
    if len(debugs) != 1 {
        t.Errorf("expected 1 debug, got %d", len(debugs))
    }
}
```

#### 구조화 필드 단언

```go
func TestStructuredLog(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.InfoWith("user login",
        dd.String("user", "admin"),
        dd.String("ip", "192.168.1.1"),
    )

    if !rec.ContainsField("user") {
        t.Error("should contain 'user' field")
    }

    user := rec.GetFieldValue("user")
    if user != "admin" {
        t.Errorf("expected user=admin, got %v", user)
    }
}
```

#### 마지막 로그

```go
func TestLastEntry(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.Info("first")
    logger.Error("second")

    last := rec.LastEntry()
    if last.Level != dd.LevelError {
        t.Errorf("expected Error level, got %v", last.Level)
    }
    if last.Message != "second" {
        t.Errorf("expected 'second', got %s", last.Message)
    }
}
```

## LogEntry

캡처된 로그 항목 구조.

```go
type LogEntry struct {
    Level     LogLevel
    Message   string
    Fields    []Field
    Timestamp time.Time
    Format    LogFormat
    RawOutput string
}
```

## 다음 단계

- [Logger](../core/logger) -- Logger의 완전한 메서드
- [구조화 필드](../output-integration/fields) -- Field 생성자
- [상수와 오류](./constants) -- LogLevel 상수
