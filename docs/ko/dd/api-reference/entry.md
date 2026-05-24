---
title: "LoggerEntry - CyberGo DD | 사전 설정 필드 로그"
description: "CyberGo DD LoggerEntry 타입 전체 API 문서. 사전 설정 필드가 있는 체인식 로거를 생성하는 데 사용되며, 매번 WithFields 호출 시 새로운 불변 Entry 인스턴스를 반환합니다. 필드 누적 조합, 컨텍스트 바인딩 전파 및 레벨 상속 메커니즘을 지원하여 요청 수준 로그 추적과 컨텍스트 연관 등 시나리오에 적합합니다."
---

# LoggerEntry

`LoggerEntry`는 사전 설정 필드가 있는 로거로, 매번 `WithFields` 호출 시 새로운 불변 Entry를 반환합니다.

## 생성

```go
// Logger에서 생성
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.String("env", "prod"),
)

// 전역 Logger에서 생성
entry := dd.Default().WithFields(
    dd.String("service", "api"),
)

// 단일 필드 바로가기
entry := logger.WithField("request_id", "req-123")
```

## 체인 호출

```go
// 필드 추가 (새 Entry 반환, 원본 Entry 불변)
base := logger.WithFields(dd.String("svc", "api"))
enhanced := base.WithFields(dd.String("env", "prod"))

// 새 필드가 동일한 이름의 이전 필드를 덮어씀
entry := base.WithField("svc", "gateway")  // svc가 "gateway"로 변경
```

:::tip 불변성
매번 `WithFields` / `WithField` 호출은 새로운 `LoggerEntry`를 반환하며, 원본 Entry는 영향을 받지 않아 동시에 안전하게 사용할 수 있습니다.
:::

## 로그 메서드

Logger의 모든 로그 메서드는 Entry에서도 사용할 수 있으며, 출력되는 로그에는 사전 설정 필드가 자동으로 포함됩니다:

### 기본 로그

| 메서드 | 설명 |
|------|------|
| `Debug(args ...any)` | Debug 레벨 |
| `Info(args ...any)` | Info 레벨 |
| `Warn(args ...any)` | Warn 레벨 |
| `Error(args ...any)` | Error 레벨 |
| `Fatal(args ...any)` | Fatal 레벨 |
| `Log(level LogLevel, args ...any)` | 레벨 지정 |

### 포맷팅 로그

| 메서드 | 설명 |
|------|------|
| `Debugf(format string, args ...any)` | 포맷팅 Debug |
| `Infof(format string, args ...any)` | 포맷팅 Info |
| `Warnf(format string, args ...any)` | 포맷팅 Warn |
| `Errorf(format string, args ...any)` | 포맷팅 Error |
| `Fatalf(format string, args ...any)` | 포맷팅 Fatal |
| `Logf(level LogLevel, format string, args ...any)` | 포맷팅 레벨 지정 |

### 구조화된 로그

| 메서드 | 설명 |
|------|------|
| `DebugWith(msg string, fields ...Field)` | 구조화된 Debug (사전 설정 필드와 병합) |
| `InfoWith(msg string, fields ...Field)` | 구조화된 Info |
| `WarnWith(msg string, fields ...Field)` | 구조화된 Warn |
| `ErrorWith(msg string, fields ...Field)` | 구조화된 Error |
| `FatalWith(msg string, fields ...Field)` | 구조화된 Fatal |
| `LogWith(level LogLevel, msg string, fields ...Field)` | 구조화된 레벨 지정 |

### Print 메서드

| 메서드 | 설명 |
|------|------|
| `Print(args ...any)` | Writer에 출력 (LevelInfo, 보안 필터링 적용) |
| `Println(args ...any)` | Print와 동일한 동작 |
| `Printf(format string, args ...any)` | 포맷팅 출력 (LevelInfo, 보안 필터링 적용) |

### 필드 체인

| 메서드 | 설명 |
|------|------|
| `WithFields(fields ...Field) *LoggerEntry` | 필드 추가, 새 Entry 반환 |
| `WithField(key string, value any) *LoggerEntry` | 단일 필드 추가, 새 Entry 반환 |

## 사용 예시

### HTTP 요청 로그

```go
func handleRequest(w http.ResponseWriter, r *http.Request) {
    reqLog := logger.WithFields(
        dd.String("method", r.Method),
        dd.String("path", r.URL.Path),
        dd.String("remote", r.RemoteAddr),
    )

    reqLog.Info("요청 시작")

    // 처리 로직...

    reqLog.WithField("status", 200).Info("요청 완료")
}
```

### 서비스 컴포넌트 로그

```go
serviceLog := logger.WithFields(
    dd.String("service", "user-service"),
    dd.String("version", "2.1.0"),
)

serviceLog.Info("서비스 시작")

dbLog := serviceLog.WithField("component", "database")
dbLog.Info("연결 성공")
dbLog.ErrorWith("쿼리 실패", dd.Err(err))
```

## 다음 단계

- [Logger](./logger) -- Logger 인스턴스 메서드
- [구조화된 필드](./fields) -- Field 생성자
- [패키지 함수](./functions) -- 전역 로그 함수
