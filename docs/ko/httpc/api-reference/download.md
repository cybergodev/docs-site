---
title: 파일 다운로드 - HTTPC
description: HTTPC 파일 다운로드 API 참조. 네 가지 다운로드 함수 시그니처, DownloadConfig 설정, 진행 콜백, 체크섬 열거형 및 경로 순회 방어 메커니즘을 다룹니다.
---

# 파일 다운로드

## 패키지 수준 다운로드 함수

### DownloadFile

```go
func DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

기본 클라이언트를 사용하여 파일을 지정된 경로에 다운로드합니다.

```go
result, err := httpc.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")
```

### DownloadWithOptions

```go
func DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

설정이 포함된 다운로드로, 이어온 다운로드와 진행 콜백을 지원합니다.

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true

result, err := httpc.DownloadWithOptions(url, cfg)
```

### DownloadFileWithContext

```go
func DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

컨텍스트 제어가 포함된 파일 다운로드입니다.

### DownloadWithOptionsWithContext

```go
func DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

설정과 컨텍스트 제어가 포함된 파일 다운로드입니다.

## DownloadConfig

```go
type DownloadConfig struct {
    FilePath          string
    ProgressCallback  DownloadProgressCallback
    Overwrite         bool
    ResumeDownload    bool
    Checksum          string
    ChecksumAlgorithm ChecksumAlgorithm
}

func DefaultDownloadConfig() *DownloadConfig
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `FilePath` | `string` | - | 저장 경로 (필수) |
| `ProgressCallback` | `DownloadProgressCallback` | `nil` | 진행 콜백 함수 |
| `Overwrite` | `bool` | `false` | 기존 파일 덮어쓰기 |
| `ResumeDownload` | `bool` | `false` | 이어온 다운로드 활성화 |
| `Checksum` | `string` | `""` | 예상 체크섬 값 |
| `ChecksumAlgorithm` | `ChecksumAlgorithm` | `"sha256"` | 체크섬 알고리즘 |

### DownloadProgressCallback

```go
type DownloadProgressCallback func(downloaded, total int64, speed float64)
```

| 매개변수 | 타입 | 설명 |
|----------|------|------|
| `downloaded` | `int64` | 다운로드된 바이트 수 |
| `total` | `int64` | 전체 바이트 수 (-1은 알 수 없음을 의미) |
| `speed` | `float64` | 현재 속도 (바이트/초) |

```go
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r%.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}
```

## DownloadResult

```go
type DownloadResult struct {
    FilePath        string
    BytesWritten    int64
    Duration        time.Duration
    AverageSpeed    float64
    StatusCode      int
    ContentLength   int64
    Resumed         bool
    ResponseCookies []*http.Cookie
    ActualChecksum  string
    Proto           string
    ResponseHeaders http.Header
    RequestURL      string
    RequestMethod   string
    RequestHeaders  http.Header
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `FilePath` | `string` | 파일 저장 경로 |
| `BytesWritten` | `int64` | 기록된 바이트 수 |
| `Duration` | `time.Duration` | 다운로드 소요 시간 |
| `AverageSpeed` | `float64` | 평균 속도 (바이트/초) |
| `StatusCode` | `int` | HTTP 상태 코드 |
| `ContentLength` | `int64` | Content-Length 헤더 값 |
| `Resumed` | `bool` | 이어온 다운로드로 완료되었는지 여부 |
| `ResponseCookies` | `[]*http.Cookie` | 응답 Cookie |
| `ActualChecksum` | `string` | 실제 계산된 체크섬 |
| `Proto` | `string` | HTTP 프로토콜 버전 (예: `"HTTP/1.1"`, `"HTTP/2.0"`) |
| `ResponseHeaders` | `http.Header` | 응답 헤더 |
| `RequestURL` | `string` | 실제 요청 URL |
| `RequestMethod` | `string` | 요청 HTTP 메서드 |
| `RequestHeaders` | `http.Header` | 요청 헤더 |

```go
fmt.Printf("다운로드 완료: %s, 소요 시간 %v, 평균 속도 %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

## 체크섬 검증

### ChecksumAlgorithm

```go
type ChecksumAlgorithm string
```

다운로드 파일 무결성 검증 알고리즘입니다.

| 상수 | 값 | 설명 |
|------|-----|------|
| `ChecksumSHA256` | `"sha256"` | SHA-256 해시 알고리즘 |

### 사용 예시

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/package.tar.gz"
cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
cfg.ChecksumAlgorithm = httpc.ChecksumSHA256

result, err := httpc.DownloadWithOptions(url, cfg)
if err != nil {
    // 체크섬 불일치 시 자동으로 오류를 반환하고 다운로드된 파일을 삭제합니다
    log.Fatal(err)
}
fmt.Println("체크섬:", result.ActualChecksum)
```

:::tip 팁
`Checksum`을 설정하면 다운로드 완료 시 자동으로 파일 무결성을 검증합니다. 검증 실패 시 파일이 자동으로 삭제되고 오류가 반환되므로 수동 비교가 필요하지 않습니다.
:::

## 보안 보호

파일 다운로드에는 다중 계층의 보안 보호가 내장되어 있습니다:

| 보호 | 설명 |
|------|------|
| UNC 경로 차단 | `\\server\share` 형식 경로 금지 |
| 제어 문자 필터링 | 경로 내 제어 문자 금지 |
| 시스템 경로 보호 | 시스템 디렉토리 쓰기 금지 |
| 경로 순회 감지 | `../` 경로 순회 감지 |
| 심볼릭 링크 감지 | 심볼릭 링크 공격 방지 |
| 상위 디렉토리 감지 | 상위 디렉토리 심볼릭 링크 재귀 검사 |

## 이어온 다운로드

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.DownloadWithOptions(url, cfg)
if result.Resumed {
    fmt.Println("이어온 다운로드 완료")
}
```

이어온 다운로드 메커니즘:
1. 로컬 파일 크기 확인 → `Range` 요청 오프셋으로 사용
2. 서버가 206 (Partial Content) 반환 → 이어서 기록
3. 서버가 416 (Range Not Satisfiable) 반환 → 오류 반환
4. 서버가 200 반환 (Range 미지원) → 오류 반환 (로컬 부분 파일 덮어쓰기 방지)

## 함께 보기

- [파일 업로드와 다운로드](../guides/file-transfer) - 사용 가이드
- [패키지 함수](./functions) - 보조 함수 참조
- [도메인 클라이언트](./domain-client) - 도메인 클라이언트 다운로드 메서드
