---
title: "마이그레이션 가이드 - CyberGo DD | 다른 로그 라이브러리에서 마이그레이션"
description: "CyberGo DD 표준 라이브러리 log/slog 및 주요 서드파티 로그 라이브러리 (zap, logrus, zerolog)에서 마이그레이션하는 전체 비교 가이드. 상세한 API 매핑 테이블, 설정 매개변수 비교, 일반적인 마이그레이션 패턴 및 점진적 마이그레이션 전략을 제공하여 개발자가 낮은 위험으로 기존 로그 시스템을 DD 로그 라이브러리로 원활하게 전환할 수 있도록 돕습니다."
---

# 마이그레이션 가이드

다른 로그 라이브러리를 사용 중이라면, 이 가이드가 프로젝트를 DD로 빠르게 마이그레이션하는 데 도움이 됩니다.

## 표준 라이브러리 log에서 마이그레이션

### API 비교

| log | DD | 설명 |
|-----|-----|------|
| `log.Print(msg)` | `dd.Info(msg)` | Info 레벨 |
| `log.Printf(format, args)` | `dd.Infof(format, args)` | 포맷팅 |
| `log.Println(msg)` | `dd.Info(msg)` | Info 레벨 |
| `log.Fatal(msg)` | `dd.Fatal(msg)` | Fatal (os.Exit 호출) |
| `log.Fatalf(format, args)` | `dd.Fatalf(format, args)` | 포맷팅 Fatal |
| `log.Panic(msg)` | `dd.Error(msg)` + `panic()` | DD에는 내장 Panic 없음 |
| — | `dd.InfoWith(msg, fields...)` | 구조화된 로그 (새로 추가) |

### 기본 마이그레이션

```go
// Before: log
log.Printf("사용자 %s 로그인 실패: %v", username, err)

// After: DD
dd.Infof("사용자 %s 로그인 실패: %v", username, err)

// 또는 구조화된 로그 사용
dd.ErrorWith("사용자 로그인 실패",
    dd.String("username", username),
    dd.Err(err),
)
```

### 전역 Logger 교체

```go
// Before: log
log.SetOutput(file)
log.SetFlags(log.LstdFlags | log.Lshortfile)

// After: DD
logger, _ := dd.New(dd.Config{
    Format: dd.FormatText,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.log"),
    },
})
dd.SetDefault(logger)
```

## slog에서 마이그레이션

### API 비교

| slog | DD | 설명 |
|------|-----|------|
| `slog.Info(msg)` | `dd.Info(msg)` | Info 레벨 |
| `slog.Info(msg, "key", value)` | `dd.InfoWith(msg, dd.String("key", value))` | 구조화 |
| `slog.Debug(msg)` | `dd.Debug(msg)` | Debug 레벨 |
| `slog.Error(msg, "err", err)` | `dd.ErrorWith(msg, dd.Err(err))` | 오류 로그 |
| `slog.Warn(msg)` | `dd.Warn(msg)` | Warn 레벨 |
| `slog.With("key", value)` | `dd.WithFields(dd.String("key", value))` | 사전 설정 필드 |
| `slog.New(handler)` | `dd.New(cfg)` | 인스턴스 생성 |
| `slog.SetDefault(logger)` | `dd.SetDefault(logger)` | 전역 설정 |

### 구조화된 로그 마이그레이션

```go
// Before: slog
slog.Info("request completed",
    "method", "GET",
    "status", 200,
    "duration", 150*time.Millisecond,
)

// After: DD
dd.InfoWith("요청 완료",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("duration", 150*time.Millisecond),
)
```

:::tip 타입 안전
slog는 `any` 키-값 쌍을 사용하고, DD는 타입이 명확한 필드 생성자를 사용합니다. 타입 오류는 컴파일 타임에 발견할 수 있습니다.
:::

## zap에서 마이그레이션

### API 비교

| zap | DD | 설명 |
|-----|-----|------|
| `zap.L().Info(msg, zap.Field...)` | `dd.InfoWith(msg, dd.Field...)` | 구조화 |
| `zap.String(key, val)` | `dd.String(key, val)` | 문자열 필드 |
| `zap.Int(key, val)` | `dd.Int(key, val)` | 정수 필드 |
| `zap.Error(err)` | `dd.Err(err)` | 오류 필드 |
| `zap.Any(key, val)` | `dd.Any(key, val)` | 임의 타입 |
| `zap.Sugar().Infof(...)` | `dd.Infof(...)` | 포맷팅 |
| `logger.With(zap.Field...)` | `logger.WithFields(dd.Field...)` | 사전 설정 필드 |
| `zapcore.NewCore(...)` | `dd.New(dd.Config{...})` | 인스턴스 생성 |

### 설정 비교

```go
// Before: zap
cfg := zap.Config{
    Level:       zap.NewAtomicLevelAt(zap.InfoLevel),
    Encoding:    "json",
    OutputPaths: []string{"stdout", "logs/app.log"},
}
logger, _ := cfg.Build()

// After: DD
logger, _ := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
```

### 필드 비교

```go
// Before: zap
logger.Info("request",
    zap.String("method", "GET"),
    zap.Int("status", 200),
    zap.Duration("elapsed", 150*time.Millisecond),
    zap.Error(err),
)

// After: DD
dd.InfoWith("request",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
    dd.Err(err),
)
```

## logrus에서 마이그레이션

### API 비교

| logrus | DD | 설명 |
|--------|-----|------|
| `logrus.Info(msg)` | `dd.Info(msg)` | Info 레벨 |
| `logrus.WithField("k", v)` | `dd.WithField("k", v)` | 단일 필드 |
| `logrus.WithFields(logrus.Fields{...})` | `dd.WithFields(dd.String(...), ...)` | 다중 필드 |
| `logrus.SetLevel(logrus.InfoLevel)` | `dd.SetLevel(dd.LevelInfo)` | 레벨 설정 |
| `logrus.SetFormatter(&logrus.JSONFormatter{})` | `dd.New(dd.Config{Format: dd.FormatJSON})` | JSON 형식 |
| `logrus.SetOutput(file)` | `dd.Config{Targets: ...}` | 출력 대상 |
| `logrus.Fatal(msg)` | `dd.Fatal(msg)` | Fatal |

### 필드 마이그레이션

```go
// Before: logrus
logrus.WithFields(logrus.Fields{
    "method":  "GET",
    "status":  200,
    "elapsed": 150 * time.Millisecond,
}).Info("Request completed")

// After: DD
dd.WithFields(
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
).Info("Request completed")
```

## DD 고유 기능

마이그레이션 후 DD의 독특한 기능을 활용할 수 있습니다:

| 기능 | 설명 | 문서 |
|------|------|------|
| 민감 데이터 필터링 | 비밀번호, API Key 등 자동 마스킹 | [민감 데이터 필터링](./sensitive-filtering) |
| 감사 로그 | 비동기 보안 이벤트 기록 | [감사 로그](./audit-logging) |
| HMAC 서명 | 로그 변조 방지 | [HMAC 서명 실전](../advanced/integrity) |
| 업계 준수 | HIPAA/PCI-DSS 사전 설정 | [업계 준수 설정](../security/compliance) |
| 라이프사이클 훅 | 6가지 Hook 이벤트 | [훅 시스템](./hooks) |
| LoggerRecorder | 테스트 보조 | [테스트 패턴](../examples/testing-patterns) |

## 다음 단계

- [핵심 개념](./core-concepts) -- DD 아키텍처 개요
- [구조화된 로그](./structured-logging) -- 필드 사용 상세 가이드
- [치트시트](../cheatsheet) -- API 빠른 참조
