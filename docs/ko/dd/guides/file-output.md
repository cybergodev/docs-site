---
title: "파일 출력과 순환 - CyberGo DD | 파일 로그 설정 가이드"
description: "CyberGo DD 파일 출력과 로그 순환 설정 가이드. FileWriter 크기 순환 및 시간 정리 전략, BufferedWriter 버퍼 쓰기 최적화, MultiWriter 다중 대상 분배, 동적 Writer 관리 및 프로덕션 환경 모범 사례를 다루어 개발자가 고신뢰성 파일 로그 시스템을 구축할 수 있도록 돕습니다."
---

# 파일 출력과 순환

DD는 유연한 파일 출력 기능을 제공하며, 자동 순환, 버퍼 쓰기, 다중 대상 분배를 지원하여 프로덕션 환경에 적합합니다.

## 빠른 시작

### 기본 파일 출력

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.log"),
    },
})
defer logger.Close()

logger.Info("로그가 파일에 기록됩니다")
```

### 콘솔 + 파일 이중 출력

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
defer logger.Close()
```

## FileWriter 순환 설정

FileWriter는 크기 기반 자동 순환, 시간 기반 오래된 파일 정리를 지원합니다:

### 기본 설정

```go
cfg := dd.DefaultFileWriterConfig()
// MaxSizeMB:   100   — 단일 파일 최대 100MB
// MaxAge:      30 * 24 * time.Hour  — 30일 보존
// MaxBackups:  10    — 최대 10개 백업 보존
// Compress:    false — 압축 안 함
```

### 커스텀 순환 전략

```go
// 고트래픽 서비스: 작은 파일, 빠른 순환
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxSizeMB = 50                // 50MB 순환
fwCfg.MaxBackups = 20               // 20개 백업 보존
fwCfg.MaxAge = 7 * 24 * time.Hour   // 7일 정리
fwCfg.Compress = true      // 오래된 파일 압축

fw, _ := dd.NewFileWriter("logs/app.log", fwCfg)
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})
```

### JSON 형식 로그 파일

```go
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
    },
})
```

순환 후 파일 명명 규칙:

```text
logs/app.log           ← 현재 로그
logs/app-001.log       ← 첫 번째 순환
logs/app-002.log.gz    ← 압축된 이전 백업 (Compress 활성화 시)
```

## BufferedWriter 버퍼 쓰기

고처리량 시나리오에서 `BufferedWriter`를 사용하여 I/O 횟수를 줄입니다:

```go
// 파일 Writer 생성
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 버퍼 Writer로 래핑
bwCfg := dd.DefaultBufferedWriterConfig()
// BufferSize: 1024  — 1KB 버퍼
// FlushTime:  100ms — 100ms 자동 새로고침

bw, _ := dd.NewBufferedWriter(fw, bwCfg)

logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
defer logger.Close() // Close 시 자동 Flush
```

### 튜닝 조언

| 시나리오 | BufferSize | FlushTime | 설명 |
|------|-----------|-----------|------|
| 저지연 요구 | 512 | 50ms | 빠른 새로고침, 지연 감소 |
| 일반 시나리오 | 1024 | 100ms | 기본값, 지연과 처리량의 균형 |
| 고처리량 | 4096 | 500ms | 큰 버퍼, 최대 처리량 |
| 배치 작업 | 8192 | 1000ms | 최대 버퍼, 오프라인 처리에 적합 |

:::warning 데이터 안전
BufferedWriter는 버퍼가 가득 차거나 타이머가 트리거될 때 새로고침합니다. 프로그램이 비정상적으로 종료되면 버퍼의 데이터가 손실될 수 있습니다. 데이터 무결성을 위해 `Close()` 또는 `Flush()`를 반드시 호출하세요.
:::

## MultiWriter 다중 대상 분배

```go
// 파일과 원격 서비스에 동시 기록
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
remote := &RemoteLogWriter{endpoint: "http://log-service/ingest"}

mw := dd.NewMultiWriter(fw, remote)

logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
```

MultiWriter는 모든 Writer에 로그를 분배하며, 한 Writer의 실패가 다른 Writer에 영향을 주지 않습니다.

## 동적 Writer 관리

Logger는 런타임에 Writer 추가 및 제거를 지원합니다:

```go
// 런타임에 Writer 추가
fw, _ := dd.NewFileWriter("logs/debug.log", dd.DefaultFileWriterConfig())
err := logger.AddWriter(fw)

// 런타임에 Writer 제거
err = logger.RemoveWriter(fw)

// 현재 Writer 수 확인
count := logger.WriterCount()
```

:::tip 사용 시나리오
동적 Writer는 런타임에 로그 대상을 전환해야 하는 시나리오에 적합합니다. 예: 디버그 모드 활성화 시 상세 로그 파일 추가, 또는 디스크 공간 부족 시 원격 로그 서비스로 전환.
:::

## 커스텀 Writer

`io.Writer` 인터페이스를 구현하여 커스텀 출력 대상을 생성할 수 있습니다:

```go
// 네트워크 로그 전송기
type LogstashWriter struct {
    endpoint string
    client   *http.Client
}

func (w *LogstashWriter) Write(p []byte) (n int, err error) {
    resp, err := w.client.Post(w.endpoint, "application/json", bytes.NewReader(p))
    if err != nil {
        return 0, err
    }
    defer resp.Body.Close()
    return len(p), nil
}

// 커스텀 Writer 사용
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
        dd.CustomOutput(&LogstashWriter{
            endpoint: "http://logstash:5044",
            client:   &http.Client{Timeout: 5 * time.Second},
        }),
    },
})
```

## 프로덕션 환경 권장 설정

```go
func NewProductionLogger() (*dd.Logger, error) {
    // 파일 Writer: 중간 순환 + 압축
    fwCfg := dd.DefaultFileWriterConfig()
    fwCfg.MaxSizeMB = 100
    fwCfg.MaxAge = 30 * 24 * time.Hour
    fwCfg.MaxBackups = 15
    fwCfg.Compress = true

    fw, err := dd.NewFileWriter("logs/app.json", fwCfg)
    if err != nil {
        return nil, err
    }

    // 버퍼 래핑
    bw, err := dd.NewBufferedWriter(fw, dd.DefaultBufferedWriterConfig())
    if err != nil {
        return nil, err
    }

    return dd.New(dd.Config{
        Level:  dd.LevelInfo,
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.CustomOutput(bw),
        },
    })
}
```

## 다음 단계

- [구조화된 로그](./structured-logging) -- 필드와 체인 호출
- [민감 데이터 필터링](./sensitive-filtering) -- 자동 마스킹
- [API 레퍼런스 - Writers](../api-reference/writers) -- Writer 전체 API
- [성능 최적화](../advanced/performance) -- 성능 튜닝 조언
