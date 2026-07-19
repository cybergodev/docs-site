---
sidebar_label: "자주 묻는 질문"
title: "FAQ - CyberGo DD | 자주 묻는 질문"
description: "CyberGo DD 로그 라이브러리의 자주 묻는 질문과 상세한 답변 모음입니다. 구성 튜닝 팁, 성능 최적화 권장, 민감 데이터 보안 필터 규칙, 감사 로그와 규정 준수 구성 방법, 파일 로테이션 정책 선택과 최적화, 오류 처리 모범 사례와 훅 시스템 사용 예시 등의 주제를 다루어 개발자가 실제 프로젝트에서 겪는 다양한 문제를 빠르게 해결할 수 있도록 돕습니다."
sidebar_position: 1
---

# 자주 묻는 질문

## 기본 사용

### 전역 로거와 커스텀 로거의 차이는 무엇인가요?

**전역 로거**는 `dd.Info()` 등 패키지 수준 함수로 직접 사용하며 단순한 시나리오에 적합합니다. **커스텀 로거**는 `dd.New()`로 생성하여 독립적인 구성과 라이프사이클 관리를 지원합니다.

```go
// 전역 로거
dd.Info("전역 로그")

// 커스텀 로거
logger, _ := dd.New(dd.JSONConfig())
logger.Info("독립 로그")
```

### 프로그램 시작 시 전역 로거를 초기화하려면?

```go
func init() {
    err := dd.InitDefault(dd.JSONConfig())
    if err != nil {
        log.Fatal(err)
    }
}
```

또는 `SetDefault`로:

```go
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
dd.SetDefault(logger)
```

### Fatal 레벨 로그는 어떻게 동작하나요?

`Fatal` / `Fatalf` / `FatalWith`는 로그 출력 후 `os.Exit(1)`을 호출합니다(**defer 문은 실행되지 않음**; 내부적으로 먼저 `Close()`로 대기 중인 로그를 flush하며 최대 5초 대기). `FatalHandler`로 종료 동작을 커스터마이징할 수 있습니다. 리소스 정리가 필요하다면 `ErrorWith` + 명시적 `Shutdown(ctx)`을 대신 사용하세요.

## 구성

### 콘솔과 파일에 동시 출력하려면?

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
// 또는 JSON 형식
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
```

### 로그 레벨을 동적으로 수정하려면?

```go
_ = logger.SetLevel(dd.LevelDebug)  // 런타임 수정(오류 반환)
_ = dd.SetLevel(dd.LevelDebug)      // 전역 로거 레벨 수정
```

### 파일 로테이션 정책을 구성하려면?

`FileWriter`로 구성합니다.

```go
fw, _ := dd.NewFileWriter("logs/app.log",
    dd.DefaultFileWriterConfig(),  // 100MB, 30일, 10개 백업
)
```

## 성능

### 로그가 프로그램 성능에 영향을 주나요?

DD는 설계 단계부터 고성능을 추구합니다.
- 핫 패스 저할당 최적화
- 원자 레벨 검사, 락 없음
- 대용량 입력(≥10KB)의 민감 데이터 필터링은 독립 goroutine에서 실행되며 타임아웃 보호 포함; 소용량 입력은 동기 처리
- 선택적 버퍼 쓰기로 I/O 감소

### 고처리량 시나리오 최적화 방법은?

1. `BufferedWriter`로 I/O 감소
2. 필드 구성 전에 먼저 레벨 검사
3. 로그 샘플링 활성화 고려
4. 고빈도 경로에서 `Any` 필드 회피

자세한 내용은 [성능 최적화](../advanced/performance)를 참조하세요.

## 보안

### 민감 데이터 필터링은 어떻게 동작하나요?

`SensitiveDataFilter`는 정규식 패턴 매칭을 사용하여 로그 쓰기 전에 매칭된 민감 값을 자동으로 `[REDACTED]`로 교체합니다. 소용량 입력은 동기 처리, 대용량 입력은 독립 goroutine에서 실행되며 타임아웃 보호를 포함해 로그 쓰기를 차단하지 않습니다.

### 커스텀 민감 데이터 패턴을 만들려면?

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)my_secret_field\s*[:=]\s*\S+`,
)
```

### 로그가 변조되지 않도록 보장하려면?

`IntegritySigner`로 로그에 HMAC 서명을 합니다.

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
sig := signer.Sign(logMessage)
// 검증: signer.Verify(signedEntry)
```

## 오류 처리

### AddWriter가 오류를 반환하는 이유는?

가능한 원인:
- `ErrNilWriter` -- nil Writer 전달
- `ErrLoggerClosed` -- 로거가 이미 종료됨
- `ErrMaxWritersExceeded` -- Writer 수 한도 초과

### 쓰기 실패를 처리하려면?

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // 커스텀 처리
    metrics.WriteErrors.Inc()
})
```

## 테스트

### 테스트에서 로그를 캡처하려면?

`LoggerRecorder`를 사용합니다.

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.Info("test")

if !rec.ContainsMessage("test") {
    t.Error("예상 로그를 찾을 수 없음")
}
```

자세한 내용은 [테스트 보조](../api-reference/dev-tools/recorder)를 참조하세요.

## 다음 단계

- [빠른 시작](../getting-started/) -- 입문 가이드
- [API 레퍼런스](../api-reference/) -- 완전한 API
- [프로덕션 체크리스트](../security/production-checklist) -- 출시 검사
