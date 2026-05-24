---
title: "치트시트 - CyberGo DD | 자주 사용하는 API 빠른 참조"
description: "CyberGo DD 로그 라이브러리 자주 사용하는 API 치트시트. 로거 생성과 복제, 로그 레벨 제어, 구조화된 필드 생성, 파일 출력 순환 및 버퍼 설정, 민감 데이터 보안 필터링 규칙, 훅 등록 및 콜백 처리 함수, 감사 로그 기록 및 무결성 서명 검증 등 고빈도 작업을 다루어 개발자가 빠르게 참조하고 사용할 수 있습니다."
---

# 치트시트

## 로거 생성

| 방법 | 코드 | 설명 |
|------|------|------|
| 전역 기본 | `dd.Info("msg")` | 제로 설정으로 즉시 사용 |
| 개발 모드 | `dd.New(dd.DevelopmentConfig())` | DEBUG 레벨, caller 포함 |
| 커스텀 | `dd.New(dd.Config{Targets: ...})` | 전체 설정 |
| 파일 | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.FileOutput("path")}})` | 파일 전용 출력 |
| 이중 대상 | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | 콘솔+파일 |
| JSON 이중 대상 | `dd.New(dd.Config{Format: dd.FormatJSON, Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | JSON 형식 이중 대상 |

## 사전 설정 구성

```go
dd.DefaultConfig()       // 기본 설정: INFO 레벨, 텍스트 형식
dd.DevelopmentConfig()   // 개발 설정: DEBUG 레벨, 동적 caller
dd.JSONConfig()          // JSON 설정: JSON 형식 출력
```

## 로그 레벨

| 레벨 | 상수 | 메서드 | 포맷팅 |
|------|------|--------|--------|
| Debug | `LevelDebug` | `Debug()` | `Debugf()` |
| Info | `LevelInfo` | `Info()` | `Infof()` |
| Warn | `LevelWarn` | `Warn()` | `Warnf()` |
| Error | `LevelError` | `Error()` | `Errorf()` |
| Fatal | `LevelFatal` | `Fatal()` | `Fatalf()` |

구조화된 버전: `DebugWith()`, `InfoWith()`, `WarnWith()`, `ErrorWith()`, `FatalWith()`

## 필드 생성자

| 타입 | 생성자 | 예시 |
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
entry.Info("시작")                    // svc=api 자동 포함

// 필드 추가
entry2 := entry.WithField("env", "prod")
entry2.Info("환경 준비 완료")               // svc + env 포함
```

## 출력 대상

```go
// 파일 라이터 (자동 순환)
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 버퍼 라이터
bwCfg := dd.DefaultBufferedWriterConfig()
bwCfg.BufferSize = 4096
bw, _ := dd.NewBufferedWriter(os.Stdout, bwCfg)

// 멀티 라이터
mw := dd.NewMultiWriter(os.Stdout, fw)
```

## 컨텍스트 통합

```go
ctx = dd.WithTraceID(ctx, "trace-123")
ctx = dd.WithRequestID(ctx, "req-456")
dd.GetTraceID(ctx)     // "trace-123"
dd.GetRequestID(ctx)   // "req-456"
```

## 보안 설정

```go
dd.DefaultSecurityConfig()   // 기본 필터링 (권장)
dd.DefaultSecureConfig()     // 전체 필터링
dd.HealthcareConfig()        // HIPAA 준수
dd.FinancialConfig()         // PCI-DSS 준수
dd.GovernmentConfig()        // 정부 표준
```

## 라이프사이클

```go
logger.Flush()                           // 버퍼 새로고침
logger.Close()                           // 로거 종료
logger.Shutdown(ctx)                     // 정상 종료 (타임아웃 포함)
dd.SetDefault(logger)                    // 전역 로거 교체
dd.InitDefault(cfg)                      // 전역 로거 초기화
```

## 디버그 출력

```go
// 전역 Logger를 통해 (보안 필터링 적용)
dd.Print("값:", val)       // 빠른 출력
dd.Printf("형식: %v", val) // 포맷팅 출력

// 직접 출력 (보안 필터링 없음, 디버그 전용)
dd.JSON(data)              // JSON 형식 디버그 출력
dd.Text(data)              // 텍스트 형식 디버그 출력
dd.Exit(data)              // 출력 후 종료
```
