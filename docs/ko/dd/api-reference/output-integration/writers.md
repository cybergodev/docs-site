---
sidebar_label: "출력 대상"
title: "출력 대상 - CyberGo DD | FileWriter, BufferedWriter, MultiWriter"
description: "CyberGo DD 출력 대상 API: FileWriter는 크기와 시간 기반 자동 순환, BufferedWriter는 고성능 버퍼 쓰기(버퍼와 플러시 간격 설정 가능), MultiWriter는 다중 대상 병렬 출력으로 개발부터 프로덕션까지의 다양한 로그 출력 시나리오를 충족하여 신뢰할 수 있는 로그 시스템 구축을 지원합니다."
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

경로는 `internal.ValidateAndSecurePath`로 보안 검사(경로 순회, null 바이트, 심볼릭 링크, overlong UTF-8)를 거친 후, `cfg.Validate()`로 수량 상한을 검증하고, 마지막으로 `applyFileWriterDefaults`가 0 또는 음수 값을 기본값으로 되돌립니다. 오류를 반환하는 경우:

- 경로류: `ErrEmptyFilePath` / `ErrNullByte` / `ErrPathTooLong` (>4096바이트) / `ErrPathTraversal` / `ErrInvalidPath` / `ErrSymlinkNotAllowed` / `ErrOverlongEncoding` / `ErrHardlinkNotAllowed`
- 설정류: `ErrMaxSizeExceeded` (`MaxSizeMB > 10240`) / `ErrMaxBackupsExceeded` (`MaxBackups > 1000`)
- I/O류: 디렉토리 생성 또는 파일 열기 실패 (하위 오류를 래핑)

<!-- check-code: skip -->
```go
// 기본 설정 사용
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 커스텀 설정
cfg := dd.DefaultFileWriterConfig()
cfg.MaxSizeMB = 50
fw, _ = dd.NewFileWriter("logs/app.log", cfg)
```

### FileWriterConfig

파일 Writer 설정입니다.

```go
type FileWriterConfig struct {
    MaxSizeMB  int            // 파일 크기 상한 MB (기본값 100)
    MaxAge     time.Duration  // 이전 파일 보존 기간 (기본값 30일)
    MaxBackups int            // 보존 백업 수 (기본값 10)
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

파일 Writer 설정의 유효성을 검증합니다. 오류를 반환하는 경우:

- `MaxSizeMB`가 10240 초과 (`ErrMaxSizeExceeded` 반환)
- `MaxBackups`가 1000 초과 (`ErrMaxBackupsExceeded` 반환)

음수 값은 허용되며 기본값으로 되돌아갑니다.

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 데이터 쓰기 (`io.Writer` 구현); 쓰기 전 크기를 검사하여 순환을 트리거, 이미 닫힌 경우 `os.ErrClosed` 반환 |
| `SetOnRotateCallback` | `(fn func(path string))` | 파일 순환 성공 후 콜백 설정 |
| `Close` | `() error` | 정리 goroutine을 중지하고 하위 파일을 닫습니다; 여러 번 호출해도 안전 (CAS 가드) |

### 순환 콜백

```go
func (fw *FileWriter) SetOnRotateCallback(fn func(path string))
```

파일 순환 **성공 후**에 호출되는 콜백 함수를 설정합니다. 콜백 매개변수 `path`는 현재 로그 파일의 기준 경로([`NewFileWriter`](#생성)에 전달된 `path`)입니다. 이때 이전 로그는 이미 백업 파일로 보관되었으며, 새 파일이 해당 경로에 다시 열립니다. 설정 시 진행 중인 순환과의 경쟁을 피하기 위해 내부 뮤텍스를 획득합니다.

:::info 내부 용도
이 메서드는 주로 `Logger` 내부에서 사용됩니다 — `FileWriter`가 Logger의 출력 대상일 때, Logger는 이를 통해 `HookOnRotate` 훅 이벤트를 트리거합니다 (자세한 내용은 [훅 시스템](../security-audit/hooks) 참조). 일반 사용자는 보통 수동으로 호출할 필요가 없으며, 순환 후 커스텀 동작이 필요한 경우 직접 설정할 수도 있습니다.
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 순환 콜백 설정: 매 순환 후 현재 파일 경로 출력
fw.SetOnRotateCallback(func(path string) {
    fmt.Println("로그가 순환됨, 현재 파일:", path)
})

// 파일이 MaxSizeMB를 초과하여 순환이 트리거되면 콜백이 호출됨
fw.Write([]byte("로그 내용\n"))
```

### 파일 순환과 정리

FileWriter의 순환과 정리는 두 개의 독립적인 경로로 실행됩니다:

- **순환(rotation)**: `Write` 호출 시 현재 파일 크기를 검사하여 `MaxSizeMB`(기본값 100MB) 초과 시 트리거 — 이전 파일은 백업으로 이름이 변경되고, 새 파일은 `O_EXCL`로 다시 열립니다 (심볼릭 링크 TOCTOU 방지), 이후 `internal.RotateBackups`가 `MaxBackups`에 따라 백업 체인을 잘라내고, `Compress=true`인 경우 별도의 goroutine이 백업을 gzip으로 압축합니다.
- **정리(cleanup)**: `MaxAge > 0`이고 `MaxBackups > 0`인 경우에만 백그라운드 goroutine을 시작하여 매시간 스캔하고, `internal.CleanupOldFiles`를 호출해 `MaxAge`(기본값 30일)를 초과한 이전 백업을 삭제합니다.

:::tip 기본값 적용 규칙
0 또는 음수 `MaxSizeMB`는 항상 100MB로 되돌아갑니다. `MaxAge`/`MaxBackups`의 조합 규칙: ① 둘 다 0 → 전체 기본값 활성화 (30일 + 10개, 정리 goroutine 시작); ② `MaxBackups`만 설정 → 수량으로만 백업 체인을 잘라내며, `MaxAge=0`이면 정리 goroutine 시작 안 함; ③ `MaxAge`만 설정 → `MaxBackups`가 기본값 10으로 되돌아감.
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 쓰기 시 MaxSizeMB 초과하면 자동으로 순환 트리거
fw.Write([]byte("로그 내용\n"))

// 순환 후 생성되는 파일:
// logs/app.log       (현재 파일)
// logs/app_log_1.log (가장 최근 백업)
// logs/app_log_2.log (더 오래된 백업)
// Compress 활성화 시 이전 백업은 logs/app_log_1.log.gz로 비동기 압축됨
```

:::tip 보안 기능
FileWriter는 경로 순회, null 바이트, 심볼릭 링크, 하드 링크 및 overlong UTF-8 방호를 내장합니다; 새 파일은 TOCTOU 공격 방지를 위해 `O_EXCL`로 열립니다.
:::

## BufferedWriter

버퍼가 있는 Writer로 시스템 호출 횟수를 줄입니다.

### 생성

```go
func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)
```

생성 시 먼저 `nil` 하위 writer를 거부하고(`ErrNilWriter`), 이어서 `cfg.Validate()`를 호출하고, 마지막으로 `BufferSize`가 기본값(1KB) 미만인 값을 기본값으로 클램프하고, `FlushTime <= 0`을 100ms로 클램프합니다. 오류를 반환하는 경우:

- `ErrNilWriter`: `w == nil`
- `ErrBufferSizeTooLarge`: `BufferSize > 10MB` (`Validate`가 반환)
- 설정 무효: `BufferSize < 0` 또는 `FlushTime < 0` (`Validate`가 반환)

<!-- check-code: skip -->
```go
// 기본 설정 사용
bw, _ := dd.NewBufferedWriter(os.Stdout, dd.DefaultBufferedWriterConfig())

// 커스텀 설정
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 4096
bw, _ = dd.NewBufferedWriter(os.Stdout, cfg)
```

### BufferedWriterConfig

버퍼 Writer 설정입니다.

```go
type BufferedWriterConfig struct {
    BufferSize int            // 버퍼 크기 (바이트, 기본값 1024 = 1KB, 상한 10MB)
    FlushTime  time.Duration  // 정기 플러시 간격 (기본값 100ms)
}
```

### 기본 설정

```go
func DefaultBufferedWriterConfig() BufferedWriterConfig
```

기본값: 1KB 버퍼, 100ms 플러시 간격.

### Validate

```go
func (c BufferedWriterConfig) Validate() error
```

버퍼 Writer 설정의 유효성을 검증합니다. 오류를 반환하는 경우:

- `BufferSize`가 음수
- `BufferSize`가 10MB 초과 (`ErrBufferSizeTooLarge` 반환)
- `FlushTime`이 음수

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 버퍼에 쓰기; 버퍼링된 바이트 ≥ `BufferSize/2`일 때 자동으로 flush |
| `Flush` | `() error` | 버퍼를 하위 Writer로 명시적으로 플러시 |
| `Close` | `() error` | 버퍼를 먼저 flush하고 백그라운드 goroutine을 중지한 후 하위 Writer를 닫습니다 (`io.Closer`를 구현한 경우) |

백그라운드 goroutine은 `FlushTime` 주기로 검사합니다: 버퍼가 비어 있지 않고 이전 flush로부터 `FlushTime` 이상 경과한 경우에만 자동 flush를 트리거합니다. `Close`를 여러 번 호출해도 안전합니다 (CAS 가드); 이미 닫힌 경우 `Write`는 `os.ErrClosed`를 반환합니다.

<!-- check-code: skip -->
```go
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(file, cfg)
bw.Write([]byte("로그 라인\n"))
_ = bw.Flush()      // 하위로 명시적 플러시
defer bw.Close()    // Close가 먼저 Flush한 후 하위 Writer를 닫음
```

## MultiWriter

멀티 Writer 관리, 여러 대상에 동시에 기록합니다.

### 생성

```go
func NewMultiWriter(writers ...io.Writer) *MultiWriter
```

`nil` writer는 생성 시 자동으로 무시됩니다. 반환값은 절대 `nil`이 아닙니다 (생성 시 오류가 발생하지 않음).

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(os.Stdout, fileWriter)
```

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 모든 대상에 쓰기 (아래 오류 정책 참조) |
| `AddWriter` | `(w io.Writer) error` | 대상 동적 추가 (중복 writer는 자동으로 수용) |
| `RemoveWriter` | `(w io.Writer) error` | 대상 동적 제거 |
| `Close` | `() error` | 모든 하위 `io.Closer` 닫기 (표준 스트림 제외) |

`AddWriter`가 오류를 반환하는 경우: `ErrNilMultiWriter` (리시버가 `nil`) / `ErrNilWriter` (매개변수가 `nil`) / `ErrMaxWritersExceeded` (이미 100개 이상 등록됨).
`RemoveWriter`가 오류를 반환하는 경우: `ErrNilMultiWriter` / `ErrWriterNotFound`.

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(console, file)

// 동적 관리
_ = mw.AddWriter(anotherFile)
_ = mw.RemoveWriter(console)

// 모든 하위 Writer 닫기 (os.Stdout 등 표준 스트림은 닫히지 않음)
_ = mw.Close()
```

### 오류 타입

`Write` 실패 시 반환되는 오류는 두 개의 공개 타입으로 구성됩니다 (`errors.go`에 정의):

```go
// 단일 writer의 오류
type WriterError struct {
    Index  int       // 해당 writer의 MultiWriter 내 인덱스
    Writer io.Writer // 오류가 발생한 writer
    Err    error     // 하위 오류
}

// 다중 writer 오류 집계 (Write는 *MultiWriterError 반환)
type MultiWriterError struct {
    Errors []WriterError
}
```

두 타입의 메서드:

| 타입 | 메서드 | 설명 |
|------|------|------|
| `*WriterError` | `Error() string` | `writer[i]: <err>` 형태; `Err`이 nil인 경우 unknown error로 표시 |
| `*WriterError` | `Unwrap() error` | `Err`을 반환하여 `errors.Is` 체인 매칭에 사용 |
| `*MultiWriterError` | `Error() string` | 단일 오류는 직접 반환; 여러 오류는 `multiple writer errors: [...]`로 조합 |
| `*MultiWriterError` | `Unwrap() []error` | 모든 `WriterError.Err`을 반환하여 `errors.As` / `errors.Is`에 사용 |
| `*MultiWriterError` | `HasErrors() bool` | 오류 수집 여부 |
| `*MultiWriterError` | `ErrorCount() int` | 오류 수 |
| `*MultiWriterError` | `FirstError() error` | 첫 번째 오류 (`*WriterError`), 없으면 `nil` |

### 오류 정책

`Write`는 "최선의 쓰기" 전략을 사용합니다: 단일 writer 실패가 다른 writer에 영향을 주지 않습니다. 하위 writer의 오류는 `MultiWriterError`에 집계되며, `errors.As`/`errors.Is`에서 사용할 수 있도록 `Unwrap() []error`를 구현합니다. 전체 실패 시 `(0, *MultiWriterError)`를 반환; 일부 실패 시 `(pLen, *MultiWriterError)`를 반환; 기록 바이트 수가 부족한 경우 short write 오류로 기록됩니다.

:::warning 단일 writer 최적화
하위 writer가 하나뿐인 경우, `Write`는 빠른 경로를 통해 직접 전달하고 오류를 `MultiWriterError`로 래핑하지 않고 원형 그대로 반환합니다.
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
defer logger.Close()  // 버퍼 자동 플러시 및 파일 닫기
```

## 다음 단계

- [설정](../core/config) -- Config 출력 대상 설정 (OutputTarget)
- [Logger](../core/logger) -- AddWriter / RemoveWriter
- [보안 필터링](../security-audit/security) -- 경로 보안 방호
