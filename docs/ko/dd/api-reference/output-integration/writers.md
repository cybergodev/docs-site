---
sidebar_label: "출력 대상"
title: "출력 대상 - CyberGo DD | FileWriter, BufferedWriter, MultiWriter"
description: "CyberGo DD 출력 대상 API입니다. FileWriter는 파일 크기별 자동 로테이션과 시간별 오래된 백업 정리를, BufferedWriter는 고성능 버퍼 쓰기(버퍼와 flush 간격 구성 가능)를, MultiWriter는 다중 대상 병렬 출력을 지원하여 개발부터 프로덕션까지 모든 로그 출력 시나리오 요구를 충족하고 신뢰할 수 있는 로그 시스템 구축을 돕습니다."
sidebar_position: 1
---

# 출력 대상

DD는 3종의 출력 writer를 제공하여 파일 로테이션, 버퍼 쓰기, 다중 대상 출력을 지원합니다.

## FileWriter

자동 로테이션이 있는 파일 writer.

### 생성

```go
func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)
```

경로는 내부 경로 보안 검사(경로 순회, null 바이트, overlong UTF-8)를 거친 후 `cfg.Validate()`로 수량 상한을 검사하며, 제로/음수값에는 기본 구성으로 폴백합니다. 오류를 반환하는 경우:

- 경로류: `ErrEmptyFilePath` / `ErrNullByte` / `ErrPathTooLong`(>4096바이트) / `ErrPathTraversal` / `ErrInvalidPath` / `ErrOverlongEncoding`
- 구성류: `ErrMaxSizeExceeded`(`MaxSizeMB > 10240`) / `ErrMaxBackupsExceeded`(`MaxBackups > 1000`)
- I/O류: 디렉터리 생성 실패(`failed to create directory: …`로 래핑) 또는 파일 열기 실패(`failed to open file …: %w`로 래핑, `ErrSymlinkNotAllowed` / `ErrHardlinkNotAllowed` 포함)

<!-- check-code: skip -->
```go
// 기본 구성 사용
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 커스텀 구성
cfg := dd.DefaultFileWriterConfig()
cfg.MaxSizeMB = 50
fw, _ = dd.NewFileWriter("logs/app.log", cfg)
```

### FileWriterConfig

파일 writer 구성.

```go
type FileWriterConfig struct {
    MaxSizeMB  int            // 파일 크기 상한 MB(기본 100)
    MaxAge     time.Duration  // 이전 파일 보존 기간(기본 30일)
    MaxBackups int            // 보존 백업 수(기본 10)
    Compress   bool           // gzip 압축 여부(기본 false)
}
```

### 기본 구성

```go
func DefaultFileWriterConfig() FileWriterConfig
```

기본값: 100MB 크기 제한, 30일 보존, 10개 백업 파일.

### Validate

```go
func (c FileWriterConfig) Validate() error
```

파일 writer 구성의 유효성을 검증합니다. 오류를 반환하는 경우:

- `MaxSizeMB`가 10240 초과(`ErrMaxSizeExceeded` 반환)
- `MaxBackups`가 1000 초과(`ErrMaxBackupsExceeded` 반환)

음수값은 Validate 오류를 트리거하지 않습니다. 그중 제로 또는 음수 `MaxSizeMB`는 기본값 적용 시 100MB로 폴백하며, `MaxBackups` / `MaxAge`의 음수값은 원래대로 유지됩니다(아래 '기본값 적용 규칙' 참조).

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 데이터 쓰기(`io.Writer` 구현); 쓰기 전 크기를 검사해 로테이션 트리거, 이미 종료된 경우 `os.ErrClosed` 반환 |
| `SetOnRotateCallback` | `(fn func(path string))` | 파일 로테이션 성공 후 콜백 설정 |
| `Close` | `() error` | 정리 goroutine 중지 및 기본 파일 닫기; 여러 번 호출해도 안전(CAS 가드) |

### 로테이션 콜백

```go
func (fw *FileWriter) SetOnRotateCallback(fn func(path string))
```

파일 로테이션 **성공 후** 호출되는 콜백 함수를 설정합니다. 콜백 매개변수 `path`는 현재 로그 파일의 기준 경로입니다(`NewFileWriter` 생성 시 경로 정규화 후 저장된 경로 - 절대 경로 입력의 경우 대개 입력과 동일하며, 상대 경로는 절대 경로로 해석됨). 이때 이전 로그는 이미 백업 파일로 보관 처리되었으며, 새 파일이 해당 경로에서 다시 열립니다. 설정 시 내부 뮤텍스 락을 획득하여 진행 중인 로테이션과 경쟁하지 않습니다.

:::info 정보 내부 용도
이 메서드는 주로 `Logger` 내부에서 사용됩니다 - `FileWriter`가 Logger의 출력 대상일 때 Logger는 이를 통해 `HookOnRotate` 훅 이벤트를 트리거합니다([훅 시스템](../security-audit/hooks) 참조). 일반 사용자는 직접 호출할 필요가 없으며, 로테이션 후 동작을 커스터마이징하려면 직접 설정해도 됩니다.
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 로테이션 콜백 설정: 매 로테이션 후 현재 파일 경로 출력
fw.SetOnRotateCallback(func(path string) {
    fmt.Println("로그가 로테이션됨, 현재 파일:", path)
})

// 파일이 MaxSizeMB 초과로 로테이션 트리거 후 콜백 호출
fw.Write([]byte("로그 내용\n"))
```

### 파일 로테이션과 정리

FileWriter의 로테이션과 정리는 두 개의 독립된 경로로 실행됩니다.

- **로테이션(rotation)**: `Write` 호출 시 현재 파일 크기를 검사하여 `MaxSizeMB`(기본 100MB) 초과 시 트리거 - 이전 파일은 백업으로 이름 변경, 새 파일은 `O_EXCL`로 다시 열림(심볼릭 링크 TOCTOU 방지), 이어서 `internal.RotateBackups`가 `MaxBackups`에 따라 백업 체인을 잘라내고, `Compress=true`일 때 독립 goroutine이 백업을 gzip 압축.
- **정리(cleanup)**: `MaxAge > 0`이고 `MaxBackups > 0`일 때만 백그라운드 goroutine 시작, 매시간 스캔, `internal.CleanupOldFiles` 호출로 `MaxAge`(기본 30일) 초과한 이전 백업 삭제.

:::tip 팁 기본값 적용 규칙
제로값 또는 음수 `MaxSizeMB`는 모두 100MB로 폴백합니다. `MaxAge`/`MaxBackups`의 조합 규칙: ① 둘 다 0 → 완전 기본값 활성화(30일 + 10개, 정리 goroutine 시작); ② `MaxBackups`만 설정 → 수량으로만 백업 체인 잘라냄, `MaxAge=0`은 정리 goroutine 시작 안 함; ③ `MaxAge`만 설정 → `MaxBackups`는 기본값 10으로 폴백.
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 쓰기 시 MaxSizeMB 초과하면 자동으로 로테이션 트리거
fw.Write([]byte("로그 내용\n"))

// 로테이션 후 생성되는 파일:
// logs/app.log       (현재 파일)
// logs/app_log_1.log (가장 최근 백업)
// logs/app_log_2.log (더 이전 백업)
// Compress 활성화 시 이전 백업은 logs/app_log_1.log.gz로 비동기 압축
```

:::tip 팁 보안 기능
FileWriter는 경로 순회, null 바이트, 심볼릭 링크, 하드링크, overlong UTF-8 보호를 내장합니다. 새 파일은 TOCTOU 공격 방지를 위해 `O_EXCL`로 열립니다.
:::

## BufferedWriter

버퍼가 있는 writer로 시스템 콜 횟수를 줄입니다.

### 생성

```go
func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)
```

생성 시 먼저 `nil` 기반 writer 거부(`ErrNilWriter`), 다음으로 `cfg.Validate()` 호출, 마지막으로 `BufferSize`가 기본값(1KB) 미만인 값을 기본값으로 클램프하고 `FlushTime <= 0`을 100ms로 클램프합니다. 오류를 반환하는 경우:

- `ErrNilWriter`: `w == nil`
- `ErrBufferSizeTooLarge`: `BufferSize > 10MB`(`Validate`가 반환)
- 구성 무효: `BufferSize < 0` 또는 `FlushTime < 0`(`Validate`가 반환)

<!-- check-code: skip -->
```go
// 기본 구성 사용
bw, _ := dd.NewBufferedWriter(os.Stdout, dd.DefaultBufferedWriterConfig())

// 커스텀 구성
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 4096
bw, _ = dd.NewBufferedWriter(os.Stdout, cfg)
```

### BufferedWriterConfig

버퍼 writer 구성.

```go
type BufferedWriterConfig struct {
    BufferSize int            // 버퍼 크기(바이트, 기본 1024 = 1KB, 상한 10MB)
    FlushTime  time.Duration  // 정기 flush 간격(기본 100ms)
}
```

### 기본 구성

```go
func DefaultBufferedWriterConfig() BufferedWriterConfig
```

기본값: 1KB 버퍼, 100ms flush 간격.

### Validate

```go
func (c BufferedWriterConfig) Validate() error
```

버퍼 writer 구성의 유효성을 검증합니다. 오류를 반환하는 경우:

- `BufferSize`가 음수
- `BufferSize`가 10MB 초과(`ErrBufferSizeTooLarge` 반환)
- `FlushTime`이 음수

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 버퍼에 쓰기; 이미 버퍼링된 바이트 ≥ `BufferSize/2`일 때 자동 flush |
| `Flush` | `() error` | 버퍼를 기반 Writer에 명시적으로 flush |
| `Close` | `() error` | 버퍼를 먼저 flush하고 백그라운드 goroutine을 중지한 후 기반 Writer 닫기(`io.Closer` 구현 시) |

백그라운드 goroutine은 `FlushTime` 주기로 검사: 버퍼가 비어 있지 않고 마지막 flush로부터 `FlushTime` 이상 경과했을 때만 자동 flush를 트리거합니다. `Close`는 여러 번 호출해도 안전(CAS 가드); 이미 종료된 경우 `Write`는 `os.ErrClosed`를 반환합니다.

<!-- check-code: skip -->
```go
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(file, cfg)
bw.Write([]byte("로그 라인\n"))
_ = bw.Flush()      // 기반 Writer에 명시적 flush
defer bw.Close()    // Close가 먼저 Flush한 후 기반 Writer 닫기
```

## MultiWriter

다중 writer 관리, 여러 대상에 동시에 쓰기.

### 생성

```go
func NewMultiWriter(writers ...io.Writer) *MultiWriter
```

`nil` writer는 생성 시 조용히 무시됩니다. 반환값은 절대 `nil`이 아닙니다(생성 시 오류가 발생하지 않음).

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(os.Stdout, fileWriter)
```

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 모든 대상에 쓰기(아래 오류 정책 참조) |
| `AddWriter` | `(w io.Writer) error` | 동적으로 대상 추가(중복 writer는 조용히 수락) |
| `RemoveWriter` | `(w io.Writer) error` | 동적으로 대상 제거 |
| `Close` | `() error` | 모든 기반 `io.Closer` 닫기(표준 스트림 제외) |

`AddWriter`가 오류를 반환하는 경우: `ErrNilMultiWriter`(리시버가 `nil`) / `ErrNilWriter`(매개변수가 `nil`) / `ErrMaxWritersExceeded`(이미 100개 이상 등록).
`RemoveWriter`가 오류를 반환하는 경우: `ErrNilMultiWriter` / `ErrWriterNotFound`.

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(console, file)

// 동적 관리
_ = mw.AddWriter(anotherFile)
_ = mw.RemoveWriter(console)

// 모든 기반 writer 닫기(os.Stdout 등 표준 스트림은 닫히지 않음)
_ = mw.Close()
```

### 오류 타입

`Write` 실패 시 반환되는 오류는 두 개의 공개 타입으로 표현됩니다(`errors.go`에 정의).

```go
// 단일 writer의 오류
type WriterError struct {
    Index  int       // MultiWriter에서 해당 writer의 인덱스
    Writer io.Writer // 오류가 발생한 writer
    Err    error     // 기반 오류
}

// 다중 writer 오류 집계(Write는 *MultiWriterError 반환)
type MultiWriterError struct {
    Errors []WriterError
}
```

두 타입의 메서드:

| 타입 | 메서드 | 설명 |
|------|------|------|
| `*WriterError` | `Error() string` | `writer[i]: <err>` 형식; `Err`이 nil이면 unknown error 표시 |
| `*WriterError` | `Unwrap() error` | `Err` 반환, `errors.Is` 체인 매칭에 사용 |
| `*MultiWriterError` | `Error() string` | 단일 오류는 직접 반환; 여러 오류는 `multiple writer errors: [...]`로 결합 |
| `*MultiWriterError` | `Unwrap() []error` | 모든 `WriterError.Err` 반환, `errors.As` / `errors.Is`에 사용 |
| `*MultiWriterError` | `HasErrors() bool` | 오류 수집 여부 |
| `*MultiWriterError` | `ErrorCount() int` | 오류 수 |
| `*MultiWriterError` | `FirstError() error` | 첫 번째 오류(`*WriterError`), 없으면 `nil` |

### 오류 정책

`Write`는 '최선 쓰기'를 채택: 단일 writer 실패가 다른 writer에 영향을 주지 않습니다. 기반 writer의 오류는 `MultiWriterError`로 수집되며, `Unwrap() []error`를 구현해 `errors.As`/`errors.Is`로 사용할 수 있습니다. 전체 실패 시 `(0, *MultiWriterError)` 반환; 부분 실패 시 `(pLen, *MultiWriterError)` 반환; 쓰기 바이트 수 부족은 short write 오류로 기록됩니다.

:::warning 경고 단일 writer 최적화
기반 writer가 하나뿐일 때 `Write`는 빠른 경로로 직접 전달하며, 오류는 원형 그대로 반환되고 `MultiWriterError`로 래핑되지 않습니다.
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
defer logger.Close()  // 버퍼를 자동으로 flush하고 파일 닫기
```

## 다음 단계

- [설정](../core/config) -- Config 출력 대상 구성(OutputTarget)
- [Logger](../core/logger) -- AddWriter / RemoveWriter
- [보안 필터](../security-audit/security) -- 경로 보안 보호
