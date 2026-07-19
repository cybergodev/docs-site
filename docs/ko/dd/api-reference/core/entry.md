---
sidebar_label: "LoggerEntry"
title: "LoggerEntry - CyberGo DD | 사전 설정 필드 로그"
description: "CyberGo DD LoggerEntry 타입의 완전한 API 문서입니다. 사전 설정 필드를 가진 체인 로거를 생성하며, 필드 전달 시 새로운 불변 Entry 인스턴스를 반환하고(필드 미전달 시 원래 Entry 반환) 필드 누적 조합, 컨텍스트 바인딩 전파, 레벨 상속 메커니즘을 지원합니다. 요청 단위 로그 추적과 컨텍스트 연관 등의 시나리오에 적합합니다."
sidebar_position: 3
---

# LoggerEntry

`LoggerEntry`는 사전 설정 필드를 가진 로거로, 최소 한 개의 필드를 전달하면 새로운 불변 Entry를 반환합니다.

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

// 단일 필드 바로 가기
entry := logger.WithField("request_id", "req-123")
```

## 체인 호출

```go
// 필드 추가(새 Entry 반환, 원본 Entry는 불변)
base := logger.WithFields(dd.String("svc", "api"))
enhanced := base.WithFields(dd.String("env", "prod"))

// 새 필드는 같은 이름의 이전 필드를 덮어씀
entry := base.WithField("svc", "gateway")  // svc가 "gateway"로 변경
```

:::tip 팁 불변성
최소 한 개의 필드를 전달하면 `WithFields` / `WithField` 호출은 새로운 `LoggerEntry`를 반환하며, 원본 Entry는 영향을 받지 않아 안전하게 동시에 사용할 수 있습니다. `WithFields()`에 필드를 전달하지 않는 것은 무효 연산 최적화로, 원래 Entry를 그대로 반환합니다.
:::

## 로그 메서드

모든 Logger의 로그 메서드는 Entry에서도 사용할 수 있으며, 출력 로그에 자동으로 사전 설정 필드가 포함됩니다.

### 기본 로그

| 메서드 | 설명 |
|------|------|
| `Debug(args ...any)` | Debug 레벨 |
| `Info(args ...any)` | Info 레벨 |
| `Warn(args ...any)` | Warn 레벨 |
| `Error(args ...any)` | Error 레벨 |
| `Fatal(args ...any)` | Fatal 레벨(기본적으로 os.Exit(1) 호출, **defer는 실행되지 않음**; FatalHandler로 사용자 정의 가능) |
| `Log(level LogLevel, args ...any)` | 레벨 지정 |

### 포맷팅 로그

| 메서드 | 설명 |
|------|------|
| `Debugf(format string, args ...any)` | 포맷팅 Debug |
| `Infof(format string, args ...any)` | 포맷팅 Info |
| `Warnf(format string, args ...any)` | 포맷팅 Warn |
| `Errorf(format string, args ...any)` | 포맷팅 Error |
| `Fatalf(format string, args ...any)` | 포맷팅 Fatal(기본적으로 os.Exit(1) 호출, **defer는 실행되지 않음**; FatalHandler로 사용자 정의 가능) |
| `Logf(level LogLevel, format string, args ...any)` | 지정 레벨 포맷팅 |

### 구조화 로그

| 메서드 | 설명 |
|------|------|
| `DebugWith(msg string, fields ...Field)` | 구조화 Debug(사전 설정 필드와 병합) |
| `InfoWith(msg string, fields ...Field)` | 구조화 Info |
| `WarnWith(msg string, fields ...Field)` | 구조화 Warn |
| `ErrorWith(msg string, fields ...Field)` | 구조화 Error |
| `FatalWith(msg string, fields ...Field)` | 구조화 Fatal(기본적으로 os.Exit(1) 호출, **defer는 실행되지 않음**; FatalHandler로 사용자 정의 가능) |
| `LogWith(level LogLevel, msg string, fields ...Field)` | 구조화 지정 레벨 |

### Print 메서드

| 메서드 | 설명 |
|------|------|
| `Print(args ...any)` | Writer로 출력(LevelInfo, 보안 필터 적용) |
| `Println(args ...any)` | Print와 동일 동작 |
| `Printf(format string, args ...any)` | 포맷팅 출력(LevelInfo, 보안 필터 적용) |

### 필드 체인

| 메서드 | 설명 |
|------|------|
| `WithFields(fields ...Field) *LoggerEntry` | 필드 추가, 새 Entry 반환 |
| `WithField(key string, value any) *LoggerEntry` | 단일 필드 추가, 새 Entry 반환 |

## 사용 예

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
- [구조화 필드](../output-integration/fields) -- Field 생성자
- [패키지 함수](./functions) -- 전역 로그 함수
