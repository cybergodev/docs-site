---
title: "FAQ - CyberGo DD | 자주 묻는 질문"
description: "CyberGo DD 로그 라이브러리 자주 묻는 질문과 상세 답변 모음. 설정 튜닝 팁, 성능 최적화 조언, 민감 데이터 보안 필터링 규칙, 감사 로그 및 준수 설정 방법, 파일 순환 전략 선택 및 최적화, 오류 처리 모범 사례 및 훅 시스템 사용 예시 등 주제를 다루어 개발자가 실제 프로젝트에서 겪는 다양한 문제를 빠르게 해결할 수 있도록 돕습니다."
---

# 자주 묻는 질문

## 기본 사용

### 전역 로거와 커스텀 로거의 차이는 무엇인가요?

**전역 로거**는 `dd.Info()` 등 패키지 수준 함수로 직접 사용하며, 간단한 시나리오에 적합합니다. **커스텀 로거**는 `dd.New()`로 생성하며, 독립적인 설정과 라이프사이클 관리를 지원합니다.

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

또는 `SetDefault`를 통해:

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

`Fatal` / `Fatalf` / `FatalWith`는 로그 출력 후 `os.Exit(1)`을 호출합니다. `FatalHandler`로 동작을 커스터마이즈할 수 있습니다.

## 설정

### 콘솔과 파일에 동시에 출력하려면?

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

### 로그 레벨을 동적으로 변경하려면?

```go
_ = logger.SetLevel(dd.LevelDebug)  // 런타임 변경 (error 반환)
_ = dd.SetLevel(dd.LevelDebug)      // 전역 로거 레벨 변경
```

### 파일 순환 전략을 구성하려면?

`FileWriter`로 설정:

```go
fw, _ := dd.NewFileWriter("logs/app.log",
    dd.DefaultFileWriterConfig(),  // 100MB, 30일, 10개 백업
)
```

## 성능

### 로그가 프로그램 성능에 영향을 주나요?

DD는 고성능을 추구하도록 설계되었습니다:
- 핫 패스 제로 할당 최적화
- 원자적 레벨 확인, 락 없음
- 민감 데이터 필터링은 별도 goroutine에서 실행
- 선택적 버퍼 쓰기로 I/O 감소

### 고처리량 시나리오에서 최적화하려면?

1. `BufferedWriter`를 사용하여 I/O 감소
2. 필드 생성 전 레벨 먼저 확인
3. 로그 샘플링 활성화 고려
4. 고빈도 경로에서 `Any` 필드 사용 피하기

자세한 내용은 [성능 최적화](./advanced/performance)를 참조하세요.

## 보안

### 민감 데이터 필터링은 어떻게 작동하나요?

`SensitiveDataFilter`는 정규식 패턴 매칭을 사용하여 로그 기록 전에 매칭된 민감 값을 `[REDACTED]`로 자동 교체합니다. 작은 입력은 동기적으로 처리되고, 큰 입력은 별도 goroutine에서 타임아웃 보호와 함께 실행되어 로그 기록을 차단하지 않습니다.

### 커스텀 민감 데이터 패턴을 추가하려면?

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)my_secret_field\s*[:=]\s*\S+`,
)
```

### 로그 변조를 방지하려면?

`IntegritySigner`를 사용하여 로그에 HMAC 서명:

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
sig := signer.Sign(logMessage)
// 검증: signer.Verify(signedEntry)
```

## 오류 처리

### AddWriter가 오류를 반환하는 이유는?

가능한 원인:
- `ErrNilWriter` -- nil Writer가 전달됨
- `ErrLoggerClosed` -- 로거가 이미 종료됨
- `ErrMaxWritersExceeded` -- Writer 수가 한계를 초과함

### 쓰기 실패를 처리하려면?

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // 커스텀 처리
    metrics.WriteErrors.Inc()
})
```

## 테스트

### 테스트에서 로그를 캡처하려면?

`LoggerRecorder` 사용:

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.Info("test")

if !rec.ContainsMessage("test") {
    t.Error("예상된 로그를 찾을 수 없음")
}
```

자세한 내용은 [테스트 보조](./api-reference/recorder)를 참조하세요.

## 다음 단계

- [빠른 시작](./getting-started) -- 입문 가이드
- [API 레퍼런스](./api-reference/) -- 전체 API
- [프로덕션 체크리스트](./security/production-checklist) -- 출시 전 체크리스트
