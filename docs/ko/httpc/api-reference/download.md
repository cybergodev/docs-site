---
title: "파일 다운로드 - CyberGo HTTPC | Download과 검증"
description: "HTTPC 파일 다운로드 API 레퍼런스: Download 통합 진입점, DownloadConfig 설정, 진행률 콜백, DownloadResult 타입, SHA-256 체크섬 검증과 UNC 경로 방어 등 6계층 보안을 제공합니다."
---

# 파일 다운로드

## 패키지 다운로드 함수

### Download

```go
func Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

기본 클라이언트를 사용하여 파일을 다운로드합니다. `Download`는 패키지 수준 함수, `Client` 인터페이스, `DomainClient`에 걸친 **유일한 정규 다운로드 진입점**으로, 이전의 변형 매트릭스를 단일 시그니처로 대체합니다. `cfg`는 nil일 수 없으며, `cfg.FilePath`를 반드시 설정해야 합니다(그렇지 않으면 `ErrEmptyFilePath` 반환).

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
```

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
| `ProgressCallback` | `DownloadProgressCallback` | `nil` | 진행률 콜백 함수 |
| `Overwrite` | `bool` | `false` | 기존 파일 덮어쓰기 |
| `ResumeDownload` | `bool` | `false` | 이어받기 활성화 |
| `Checksum` | `string` | `""` | 예상 체크섬 값 |
| `ChecksumAlgorithm` | `ChecksumAlgorithm` | `"sha256"` | 체크섬 알고리즘 |

### DownloadProgressCallback

```go
type DownloadProgressCallback func(downloaded, total int64, speed float64)
```

| 매개변수 | 타입 | 설명 |
|-----------|------|------|
| `downloaded` | `int64` | 다운로드된 바이트 수 |
| `total` | `int64` | 전체 바이트 수 (-1은 알 수 없음) |
| `speed` | `float64` | 현재 속도 (바이트/초) |

```go
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r%.1f%% (%s)", pct, httpc.FormatSpeed(speed))
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
| `BytesWritten` | `int64` | 쓰기 바이트 수 |
| `Duration` | `time.Duration` | 다운로드 소요 시간 |
| `AverageSpeed` | `float64` | 평균 속도 (바이트/초) |
| `StatusCode` | `int` | HTTP 상태 코드 |
| `ContentLength` | `int64` | Content-Length 헤더 값 |
| `Resumed` | `bool` | 이어받기 완료 여부 |
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

:::tip
[FormatBytes](./functions#formatbytes)와 [FormatSpeed](./functions#formatspeed)를 사용하면 사람이 읽을 수 있는 바이트와 속도 문자열을 얻을 수 있어 `1024` 단위 환산을 수동으로 할 필요가 없습니다.
:::

## 체크섬 검증

### ChecksumAlgorithm

```go
type ChecksumAlgorithm string
```

다운로드 파일 무결성 검증 알고리즘.

| 상수 | 값 | 설명 |
|------|-----|------|
| `ChecksumSHA256` | `"sha256"` | SHA-256 해시 알고리즘 |

### 사용 예제

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/package.tar.gz"
cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
cfg.ChecksumAlgorithm = httpc.ChecksumSHA256

result, err := httpc.Download(context.Background(), url, cfg)
if err != nil {
    // 체크섬 불일치 시 자동으로 오류 반환 및 다운로드된 파일 삭제
    log.Fatal(err)
}
fmt.Println("체크섬:", result.ActualChecksum)
```

:::tip
`Checksum`을 설정하면 다운로드 완료 시 파일 무결성이 자동 검증됩니다. 검증 실패 시 파일이 자동 삭제되고 오류가 반환되므로 수동 비교가 필요 없습니다.
:::

## 보안 보호

파일 다운로드에 내장된 다층 보안 보호:

| 보호 | 설명 |
|------|------|
| UNC 경로 차단 | `\\server\share` 형식 경로 금지 |
| 제어 문자 필터링 | 경로 내 제어 문자 금지 |
| 시스템 경로 보호 | 시스템 디렉토리 쓰기 금지 |
| 경로 순회 감지 | `../` 경로 순회 감지 |
| 심볼릭 링크 감지 | 심볼릭 링크 공격 방지 |
| 상위 디렉토리 검사 | 상위 디렉토리 심볼릭 링크 재귀 검사 |

## 이어받기

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
if result.Resumed {
    fmt.Println("이어받기 완료")
}
```

이어받기 메커니즘:
1. 로컬 파일 크기 확인 → `Range` 요청 오프셋으로 사용
2. 서버가 206 (Partial Content) 반환 → 이어쓰기
3. 서버가 416 (Range Not Satisfiable) 반환 → 오류 반환
4. 서버가 200 반환 (Range 미지원) → 오류 반환 (로컬 부분 파일 덮어쓰기 방지)

## 관련 항목

- [파일 업로드와 다운로드](../guides/file-transfer) - 사용 가이드
- [패키지 함수](./functions) - 보조 함수 참조
- [도메인 클라이언트](./domain-client) - 도메인 클라이언트 다운로드 메서드
