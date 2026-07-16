---
sidebar_label: "출력 대상"
title: "출력 대상 - CyberGo DD | FileWriter, BufferedWriter, MultiWriter"
description: "CyberGo DD 출력 대상 전체 API 문서. FileWriter 파일 자동 순환 (크기 및 시간 순환 지원), BufferedWriter 고성능 버퍼 쓰기 (버퍼 크기와 새로고침 간격 설정 가능) 및 MultiWriter 다중 대상 병렬 출력을 포함하여 개발 디버그부터 프로덕션 배포까지 다양한 로그 출력 시나리오 요구를 충족합니다."
sidebar_position: 1
---

# 출력 대상

DD는 3가지 출력 Writer를 제공하며, 파일 순환, 버퍼 쓰기, 다중 대상 출력을 지원합니다.

## FileWriter

자동 순환이 포함된 파일 Writer입니다.

### 생성

```go
func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)
```

```go
// 기본 설정 사용
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 커스텀 설정
cfg := dd.DefaultFileWriterConfig()
cfg.MaxSizeMB = 50
fw, _ := dd.NewFileWriter("logs/app.log", cfg)
```

### FileWriterConfig

파일 Writer 설정.

```go
type FileWriterConfig struct {
    MaxSizeMB  int            // 파일 크기 상한 MB (기본값 100)
    MaxAge     time.Duration  // 이전 파일 보존 기간 (기본값 30일)
    MaxBackups int            // 백업 보존 수량 (기본값 10)
    Compress   bool           // gzip 압축 여부 (기본값 false)
}
```

### 기본 설정

```go
func DefaultFileWriterConfig() FileWriterConfig
```

기본값: 100MB 크기 제한, 30일 보존, 10개 백업 파일.

### Validate

```go
func (c FileWriterConfig) Validate() error
```

파일 Writer 설정의 유효성을 검증합니다.

### 메서드

| 메서드 | 서명 | 설명 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 데이터 쓰기 (io.Writer 구현) |
| `SetOnRotateCallback` | `(fn func(path string))` | 파일 순환 성공 후 호출되는 콜백 설정 |
| `Close` | `() error` | 파일 Writer 종료 |

### 순환 콜백

```go
func (fw *FileWriter) SetOnRotateCallback(fn func(path string))
```

파일 순환**이 성공한 후** 호출되는 콜백 함수를 설정합니다. 콜백 매개변수 `path`는 현재 로그 파일의 기준 경로([`NewFileWriter`](#생성)에 전달한 `path`)입니다. 이 시점에서 이전 로그는 백업 파일로 보관되었고, 해당 경로에 새 파일이 다시 열립니다.

:::info 내부 용도
이 메서드는 주로 `Logger`가 내부적으로 사용합니다. `FileWriter`가 Logger의 출력 대상일 때, Logger는 이를 통해 `HookOnRotate` 훅 이벤트를 트리거합니다(자세한 내용은 [훅 시스템](../security-audit/hooks) 참조). 일반 사용자가 직접 호출할 필요는 없으며, 순환 후 사용자 정의 동작이 필요할 때 설정할 수 있습니다.
:::

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 순환 콜백 설정: 순환 후 현재 파일 경로 출력
fw.SetOnRotateCallback(func(path string) {
    fmt.Println("로그가 순환되었습니다, 현재 파일:", path)
})

// 파일이 크기/보존기간/백업 수 제한을 초과하여 순환될 때 콜백이 호출됩니다
fw.Write([]byte("로그 내용\n"))
```

### 파일 순환

FileWriter는 다음 조건에 따라 자동 순환을 지원합니다:

- 파일 크기가 제한을 초과함 (기본값 100MB)
- 파일 보존 기간이 최대 보존 일수를 초과함 (기본값 30일)
- 백업 파일 수가 제한을 초과함 (기본값 10개)

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 쓰기 시 자동 순환
fw.Write([]byte("로그 내용\n"))

// 순환 후 생성된 파일:
// logs/app.log      (현재)
// logs/app_log_1.log (가장 최근 백업)
// logs/app_log_2.log (더 오래된 백업)
// Compress 활성화 시 이전 백업은 logs/app_log_1.log.gz로 압축됨
```

:::tip 보안 기능
FileWriter는 내장 경로 순회 방지 기능이 있어, `..`, 심볼릭 링크 등 안전하지 않은 경로를 거부합니다.
:::

## BufferedWriter

버퍼가 있는 Writer로, 시스템 콜 횟수를 줄입니다.

### 생성

```go
func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)
```

```go
// 기본 설정 사용
bw, _ := dd.NewBufferedWriter(os.Stdout, dd.DefaultBufferedWriterConfig())

// 커스텀 설정
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 4096
bw, _ := dd.NewBufferedWriter(os.Stdout, cfg)
```

### BufferedWriterConfig

버퍼 Writer 설정.

```go
type BufferedWriterConfig struct {
    BufferSize int            // 버퍼 크기 (바이트, 기본값 1024 = 1KB)
    FlushTime  time.Duration  // 정기 새로고침 간격 (기본값 100ms)
}
```

### 기본 설정

```go
func DefaultBufferedWriterConfig() BufferedWriterConfig
```

### Validate

```go
func (c BufferedWriterConfig) Validate() error
```

버퍼 Writer 설정의 유효성을 검증합니다.

### 메서드

| 메서드 | 서명 | 설명 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 버퍼에 쓰기 |
| `Flush` | `() error` | 버퍼를 기본 Writer에 새로고침 |
| `Close` | `() error` | 새로고침 후 종료 |

```go
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(file, cfg)
bw.Write([]byte("로그 행\n"))
bw.Flush()  // 디스크에 쓰기 보장
defer bw.Close()  // Close가 자동 Flush
```

## MultiWriter

다중 Writer 관리, 여러 대상에 동시에 쓰기.

### 생성

```go
func NewMultiWriter(writers ...io.Writer) *MultiWriter
```

```go
mw := dd.NewMultiWriter(os.Stdout, fileWriter)
```

### 메서드

| 메서드 | 서명 | 설명 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 모든 대상에 쓰기 |
| `AddWriter` | `(w io.Writer) error` | 동적으로 쓰기 대상 추가 |
| `RemoveWriter` | `(w io.Writer) error` | 동적으로 쓰기 대상 제거 |
| `Close` | `() error` | 모든 Writer 종료 |

```go
mw := dd.NewMultiWriter(console, file)

// 동적 관리
mw.AddWriter(anotherFile)
mw.RemoveWriter(console)

// 모든 기본 Writer 종료
mw.Close()
```

:::warning 오류 처리
MultiWriter는 "최선 쓰기" 전략을 사용합니다: 한 Writer의 실패가 다른 Writer에 영향을 주지 않습니다. 오류는 `MultiWriterError`로 반환됩니다.
:::

## 조합 사용

```go
// 파일 + 버퍼 + 다중 대상
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
bw, _ := dd.NewBufferedWriter(fw, dd.DefaultBufferedWriterConfig())
mw := dd.NewMultiWriter(os.Stdout, bw)

logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
defer logger.Close()  // 버퍼를 자동으로 새로고침하고 파일 종료
```

## 다음 단계

- [설정](../core/config) -- Config 출력 대상 설정 (OutputTarget)
- [Logger](../core/logger) -- AddWriter / RemoveWriter
- [보안 필터](../security-audit/security) -- 경로 보안 보호
