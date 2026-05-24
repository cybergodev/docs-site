---
title: "테스트 보조 - CyberGo DD | LoggerRecorder"
description: "CyberGo DD 테스트 보조 도구 LoggerRecorder 전체 API 문서. 단위 테스트 시나리오를 위해 설계되었으며, 로그 출력 내용을 캡처하고 단언하는 데 사용됩니다. 레벨별 로그 항목 필터링, 구조화된 필드 값 검증, 항목 수 통계 및 순차적 단언을 지원하여 로그 관련 단위 테스트 작성 효율성과 가독성을 크게 향상시킵니다."
---

# 테스트 보조

DD는 `LoggerRecorder`를 테스트 시나리오에 제공하여 로그 항목을 캡처하고 단언할 수 있습니다.

## LoggerRecorder

스레드 안전한 로그 레코더로, 테스트에서 로그 출력을 캡처하고 확인하는 데 사용합니다.

:::warning 텍스트 형식 파싱 제한
텍스트 모드 파서는 기본 시간 형식 (ISO 8601)과 기본 레벨 문자열 (DEBUG/INFO/WARN/ERROR/FATAL)을 사용한다고 가정합니다. `TimeFormat`을 커스터마이즈한 경우 텍스트 모드에서 레벨과 타임스탬프를 올바르게 추출하지 못할 수 있습니다. 커스텀 형식의 경우 JSON 형식 (`FormatJSON`)을 사용하는 것을 권장하며, `SetFormat`으로 설정할 수 있습니다.
:::

### 생성

```go
recorder := dd.NewLoggerRecorder()
```

### 핵심 메서드

| 메서드 | 서명 | 설명 |
|------|------|------|
| `Writer` | `() io.Writer` | io.Writer 가져오기 |
| `SetFormat` | `(format LogFormat)` | 로그 형식 설정 (파싱용) |
| `NewLogger` | `(cfg ...Config) (*Logger, error)` | 이 레코더에 기록하는 Logger 생성 |
| `Entries` | `() []LogEntry` | 모든 로그 항목 가져오기 |
| `Count` | `() int` | 항목 수 |
| `Clear` | `()` | 모든 항목 제거 |
| `HasEntries` | `() bool` | 항목 존재 여부 |
| `LastEntry` | `() *LogEntry` | 가장 최근 항목 (nil 안전) |

### 단언 메서드

| 메서드 | 서명 | 설명 |
|------|------|------|
| `EntriesAtLevel` | `(level LogLevel) []LogEntry` | 레벨별 항목 필터링 |
| `ContainsMessage` | `(msg string) bool` | 지정된 메시지 포함 여부 (정확히 일치 또는 부분 일치) |
| `ContainsField` | `(key string) bool` | 지정된 필드 포함 여부 |
| `GetFieldValue` | `(key string) any` | 첫 번째로 일치하는 필드의 값 가져오기 |

### 사용 예시

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
    logger, _ := rec.NewLogger(dd.DevelopmentConfig())

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

#### 구조화된 필드 단언

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

#### 마지막 로그 항목

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

- [Logger](./logger) -- Logger 전체 메서드
- [구조화된 필드](./fields) -- Field 생성자
- [상수와 오류](./constants) -- LogLevel 상수
