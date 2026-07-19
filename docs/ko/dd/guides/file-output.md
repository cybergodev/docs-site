---
sidebar_label: "파일 출력과 로테이션"
title: "파일 출력과 로테이션 - CyberGo DD | 파일 로그 구성 가이드"
description: "CyberGo DD 파일 출력과 로그 로테이션 구성 가이드입니다. FileWriter 크기 로테이션과 시간 정리 전략, BufferedWriter 버퍼 쓰기 최적화, MultiWriter 다중 대상 분산, 동적 Writer 관리, 프로덕션 환경 모범 사례를 다루어 개발자가 신뢰성 높은 파일 로그 시스템을 구축할 수 있도록 돕습니다."
sidebar_position: 3
---

# 파일 출력과 로테이션

DD는 유연한 파일 출력 기능을 제공하여 자동 로테이션, 버퍼 쓰기, 다중 대상 분산을 지원하며, 프로덕션 환경에 적합합니다.

## 빠른 시작

### 기본 파일 출력

```go
package main

import (
    "log"

    "github.com/cybergodev/dd"
)

func main() {
    logger, err := dd.New(dd.Config{
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/app.log"),
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    logger.Info("로그가 파일에 기록됩니다") // logs/app.log에 기록
}
```

### 콘솔 + 파일 이중 출력

```go
logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

## FileWriter 로테이션 구성

FileWriter는 크기별 자동 로테이션과 시간별 오래된 파일 정리를 지원합니다.

### 기본 구성

```go
cfg := dd.DefaultFileWriterConfig()
// MaxSizeMB:   100   — 단일 파일 최대 100MB
// MaxAge:      30 * 24 * time.Hour  — 30일 보존
// MaxBackups:  10    — 최대 10개 백업 보존
// Compress:    false — 압축 안 함
```

### 커스텀 로테이션 정책

```go
// 고트래픽 서비스: 작은 파일, 빠른 로테이션
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxSizeMB = 50                // 50MB 로테이션
fwCfg.MaxBackups = 20               // 20개 백업 보존
fwCfg.MaxAge = 7 * 24 * time.Hour   // 7일 정리
fwCfg.Compress = true      // 이전 파일 압축

fw, err := dd.NewFileWriter("logs/app.log", fwCfg)
if err != nil {
    log.Fatal(err)
}
logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### JSON 형식 로그 파일

```go
logger, err := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

로테이션 후 파일 명명 규칙:

```text
logs/app.log           ← 현재 로그
logs/app_log_1.log     ← 첫 번째 로테이션(가장 최근 백업)
logs/app_log_2.log     ← 더 이전 백업
logs/app_log_1.log.gz  ← Compress 활성화 시 이전 백업은 .gz로 압축
```

:::info 정보 압축과 백업은 공존하지 않음
`Compress` 활성화 시 압축은 로테이션 이후 별도 goroutine에서 비동기로 진행됩니다. 압축 완료 시 원본 `.log` 백업은 `.log.gz`로 **이름이 변경**되며, 두 파일은 공존하지 않습니다.
:::

## BufferedWriter 버퍼 쓰기

고처리량 시나리오에서는 `BufferedWriter`로 I/O 횟수를 줄입니다.

```go
// 파일 Writer 생성
fw, err := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
if err != nil {
    log.Fatal(err)
}

// 버퍼 Writer로 래핑
bwCfg := dd.DefaultBufferedWriterConfig()
// BufferSize: 1024  — 1KB 버퍼
// FlushTime:  100ms — 100ms 자동 flush

bw, err := dd.NewBufferedWriter(fw, bwCfg)
if err != nil {
    log.Fatal(err)
}

logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close() // Close 시 자동 Flush
```

### 튜닝 권장 사항

| 시나리오 | BufferSize | FlushTime | 설명 |
|------|-----------|-----------|------|
| 저지연 요구 | 512 | 50ms | 빠른 flush, 지연 감소 |
| 일반 시나리오 | 1024 | 100ms | 기본값, 지연과 처리량 균형 |
| 고효율 처리 | 4096 | 500ms | 대형 버퍼, 처리량 극대화 |
| 배치 작업 | 8192 | 1000ms | 최대 버퍼, 오프라인 처리에 적합 |

:::warning 경고 데이터 안전
BufferedWriter는 버퍼가 반 찰 때(BufferSize/2 도달) 또는 타이머 트리거 시 flush합니다. 프로그램 비정상 종료 시 버퍼 데이터가 유실될 수 있습니다. 데이터 무결성을 위해 `Close()` 또는 `Flush()` 호출을 보장하세요.
:::

## MultiWriter 다중 대상 분산

```go
// 파일과 원격 서비스에 동시 쓰기
fw, err := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
if err != nil {
    log.Fatal(err)
}
remote := &RemoteLogWriter{endpoint: "http://log-service/ingest"}

mw := dd.NewMultiWriter(fw, remote)

logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

MultiWriter는 모든 Writer에 로그를 분산하며, 어느 한 Writer 실패가 다른 Writer에 영향을 주지 않습니다.

## 동적 Writer 관리

Logger는 런타임에 Writer 추가와 제거를 지원합니다.

```go
// 런타임에 Writer 추가
fw, err := dd.NewFileWriter("logs/debug.log", dd.DefaultFileWriterConfig())
if err != nil {
    log.Fatal(err)
}
err = logger.AddWriter(fw)

// 런타임에 Writer 제거
err = logger.RemoveWriter(fw)

// 현재 Writer 수 조회
count := logger.WriterCount()
_ = count
```

:::tip 팁 사용 시나리오
동적 Writer는 런타임에 로그 대상을 전환해야 하는 시나리오에 적합합니다. 예: 디버그 모드 켤 때 상세 로그 파일 추가, 또는 디스크 공간 부족 시 원격 로그 서비스로 전환.
:::

## 사용자 정의 Writer

`io.Writer` 인터페이스를 구현하면 커스텀 출력 대상을 만들 수 있습니다.

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

// 사용자 정의 Writer 사용
logger, err := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
        dd.CustomOutput(&LogstashWriter{
            endpoint: "http://logstash:5044",
            client:   &http.Client{Timeout: 5 * time.Second},
        }),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

## 프로덕션 환경 권장 구성

```go
func NewProductionLogger() (*dd.Logger, error) {
    // 파일 Writer: 중간 로테이션 + 압축
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

- [구조화 로그](./structured-logging) -- 필드와 체인 호출
- [민감 데이터 필터링](./sensitive-filtering) -- 자동 마스킹
- [API 레퍼런스 - Writers](../api-reference/output-integration/writers) -- Writer의 완전한 API
- [성능 최적화](../advanced/performance) -- 성능 튜닝 권장
