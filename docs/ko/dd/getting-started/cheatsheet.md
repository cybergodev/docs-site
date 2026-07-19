---
sidebar_label: "치트시트"
title: "치트시트 - CyberGo DD | 자주 사용하는 API 빠른 참조"
description: "CyberGo DD 로그 라이브러리의 자주 사용하는 API 치트시트입니다. 로거 생성 및 복제, 로그 레벨 제어, 구조화 필드 생성, 파일 출력 로테이션 및 버퍼 구성, 민감 데이터 보안 필터 규칙, 훅 등록 및 콜백 처리 함수, 감사 로그 기록과 무결성 서명 검증 등 고빈도 작업을 다루어 개발자가 빠르게查阅하고 사용할 수 있도록 돕습니다."
sidebar_position: 2
---

# 치트시트

## 로거 생성

| 방법 | 코드 | 설명 |
|------|------|------|
| 전역 기본 | `dd.Info("msg")` | 제로 구성 즉시 사용 |
| 개발 모드 | `dd.New(dd.DevelopmentConfig())` | DEBUG 레벨, caller 포함 |
| 커스텀 | `dd.New(dd.Config{Targets: ...})` | 완전한 구성 |
| 파일 | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.FileOutput("path")}})` | 파일 전용 출력 |
| 이중 대상 | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | 콘솔+파일 |
| JSON 이중 대상 | `dd.New(dd.Config{Format: dd.FormatJSON, Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | JSON 형식 이중 대상 |

:::tip 팁 구성 제로값
표의 `dd.Config{...}` 리터럴에서 설정하지 않은 필드는 모두 제로값입니다(Level=Debug, IncludeTime/IncludeLevel/DynamicCaller=false, 출력에 타임스탬프/레벨/caller 없음). 프로덕션 환경에서는 `dd.DefaultConfig()`를 기반으로 필요한 필드만 덮어쓰기를 권장합니다.
:::

## 사전 설정 구성

```go
dd.DefaultConfig()       // 기본 구성: INFO 레벨, 텍스트 형식
dd.DevelopmentConfig()   // 개발 구성: DEBUG 레벨, 동적 caller
dd.JSONConfig()          // JSON 구성: DEBUG 레벨 + JSON 형식 출력
```

## 로그 레벨

| 레벨 | 상수 | 메서드 | 포맷팅 |
|------|------|------|--------|
| Debug | `LevelDebug` | `Debug()` | `Debugf()` |
| Info | `LevelInfo` | `Info()` | `Infof()` |
| Warn | `LevelWarn` | `Warn()` | `Warnf()` |
| Error | `LevelError` | `Error()` | `Errorf()` |
| Fatal | `LevelFatal` | `Fatal()` | `Fatalf()` |

구조화 버전: `DebugWith()`, `InfoWith()`, `WarnWith()`, `ErrorWith()`, `FatalWith()`

## 필드 생성자

| 유형 | 생성자 | 예 |
|------|--------|------|
| 범용 | `Any(key, val)` | `dd.Any("data", obj)` |
| 문자열 | `String(key, val)` | `dd.String("name", "test")` |
| 정수 | `Int(key, val)` | `dd.Int("count", 42)` |
| 불리언 | `Bool(key, val)` | `dd.Bool("ok", true)` |
| 시간 | `Time(key, val)` | `dd.Time("ts", time.Now())` |
| 기간 | `Duration(key, val)` | `dd.Duration("took", 100*time.Millisecond)` |
| 오류 | `Err(err)` | `dd.Err(err)` |
| 오류+스택 | `ErrWithStack(err)` | `dd.ErrWithStack(err)` |

## 필드 체인

```go
// 사전 설정 필드
entry := dd.WithFields(dd.String("svc", "api"))
entry.Info("시작")                    // 자동으로 svc=api 포함

// 필드 추가
entry2 := entry.WithField("env", "prod")
entry2.Info("환경 준비")               // svc + env 포함
```

## 출력 대상

```go
// 파일 writer(자동 로테이션)
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 버퍼 writer
bwCfg := dd.DefaultBufferedWriterConfig()
bwCfg.BufferSize = 4096
bw, _ := dd.NewBufferedWriter(os.Stdout, bwCfg)

// 다중 writer
mw := dd.NewMultiWriter(os.Stdout, fw)
```

## 컨텍스트 통합

```go
ctx = dd.WithTraceID(ctx, "trace-123")
ctx = dd.WithRequestID(ctx, "req-456")
dd.GetTraceID(ctx)     // "trace-123"
dd.GetRequestID(ctx)   // "req-456"
```

## 보안 구성

```go
dd.DefaultSecurityConfig()   // 기본 필터(권장)
dd.DefaultSecureConfig()     // 완전 필터
dd.HealthcareConfig()        // HIPAA 규정 준수
dd.FinancialConfig()         // PCI-DSS 규정 준수
dd.GovernmentConfig()        // 정부 표준
```

## 라이프사이클

```go
logger.Flush()                           // 버퍼 flush
logger.Close()                           // 로거 종료
logger.Shutdown(ctx)                     // 우아한 종료(타임아웃 포함)
dd.SetDefault(logger)                    // 전역 로거 교체
dd.InitDefault(cfg)                      // 전역 로거 초기화
```

## 디버그 출력

```go
// 전역 Logger 경유(보안 필터 적용)
dd.Print("값:", val)       // 빠른 출력
dd.Printf("형식: %v", val) // 포맷팅 출력

// 직접 출력(보안 필터 없음, 디버그 전용)
dd.JSON(data)              // JSON 형식 디버그 출력
dd.Text(data)              // 텍스트 형식 디버그 출력
dd.Exit(data)              // 출력 후 종료
```
