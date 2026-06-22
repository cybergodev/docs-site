---
title: "패키지 함수 - CyberGo HTTPC | 패키지 함수"
description: "HTTPC 패키지 레벨 함수 API 레퍼런스: Get/Post 등 일곱 가지 HTTP 메서드, New 클라이언트 생성, Download 진입점, FormatBytes 포맷 도구와 NewDomain 도메인 클라이언트 생성의 완전한 사용법을 제공합니다."
---

# 패키지 함수

## 패키지 레벨 HTTP 메서드

클라이언트를 생성할 필요 없이 직접 요청을 전송합니다. 내부적으로 지연 초기화된 기본 클라이언트를 사용합니다.

### Get

```go
func Get(url string, options ...RequestOption) (*Result, error)
```

GET 요청을 전송합니다.

```go
result, err := httpc.Get("https://api.example.com/data",
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

### Post

```go
func Post(url string, options ...RequestOption) (*Result, error)
```

POST 요청을 전송합니다.

```go
result, err := httpc.Post("https://api.example.com/users",
    httpc.WithJSON(map[string]any{"name": "test"}),
)
```

### Put / Patch / Delete / Head / Options

```go
func Put(url string, options ...RequestOption) (*Result, error)
func Patch(url string, options ...RequestOption) (*Result, error)
func Delete(url string, options ...RequestOption) (*Result, error)
func Head(url string, options ...RequestOption) (*Result, error)
func Options(url string, options ...RequestOption) (*Result, error)
```

### Request

```go
func Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
```

컨텍스트가 포함된 범용 요청 메서드로, 타임아웃과 취소 제어를 지원합니다.

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

## 클라이언트 메서드

Client 인터페이스는 패키지 레벨 함수와 동일한 HTTP 메서드와 컨텍스트가 포함된 `Request` 메서드를 제공합니다.

### New

```go
func New(config ...*Config) (Client, error)
```

새 HTTP 클라이언트를 생성합니다. 설정을 전달하지 않거나 `nil`을 전달하면 `DefaultConfig()`를 사용합니다.

```go
client, err := httpc.New()
client, err := httpc.New(nil)
client, err := httpc.New(httpc.SecureConfig())

cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
client, err := httpc.New(cfg)
```

### 클라이언트 HTTP 메서드

```go
result, err := client.Get(url, options...)
result, err := client.Post(url, options...)
result, err := client.Put(url, options...)
result, err := client.Patch(url, options...)
result, err := client.Delete(url, options...)
result, err := client.Head(url, options...)
result, err := client.Options(url, options...)
result, err := client.Request(ctx, "GET", url, options...)
```

### Close

Client 인터페이스 메서드로, 클라이언트가 보유한 리소스(연결 풀, Transport)를 해제합니다. 호출 후에는 더 이상 사용할 수 없습니다.

```go
// Client 인터페이스 메서드
Close() error
```

```go
client, _ := httpc.New()
defer client.Close()
```

## 기본 클라이언트 관리

### SetDefaultClient

```go
func SetDefaultClient(client Client) error
```

커스텀 클라이언트를 기본 클라이언트로 설정하여 패키지 함수에서 사용합니다. 이전 기본 클라이언트는 자동으로 닫힙니다.

:::warning 제한
`httpc.New()`로 생성된 클라이언트만 허용되며, 이미 닫힌 클라이언트는 설정할 수 없습니다.
:::

```go
client, _ := httpc.New(httpc.PerformanceConfig())
httpc.SetDefaultClient(client)

// 이후 패키지 함수는 PerformanceConfig 사용
result, _ := httpc.Get(url)
```

### CloseDefaultClient

```go
func CloseDefaultClient() error
```

기본 클라이언트를 닫고 초기화합니다. 다음 패키지 함수 호출 시 새 클라이언트가 생성됩니다.

## 다운로드 함수

패키지 다운로드 함수는 기본 클라이언트를 사용하며, Client 인터페이스와 DomainClient도 동일한 이름의 메서드를 제공하고 세 곳 모두 시그니처가 동일합니다.

### Download

```go
func Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

`Download`는 패키지 수준 함수, `Client` 인터페이스, `DomainClient`에 걸친 **유일한 정규 다운로드 진입점**입니다 — 이전의 `{config}` × `{context}` 변형 매트릭스를 단일 시그니처로 대체합니다.

`cfg`는 nil일 수 없으며, `cfg.FilePath`를 반드시 설정해야 합니다(그렇지 않으면 `ErrEmptyFilePath` 반환). 취소나 타임아웃 제어가 필요 없을 때는 `context.Background()`를 전달하고, 요청 옵션은 요청 헤더, 인증, 쿼리 매개변수 등을 설정하는 데 사용합니다.

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%%", float64(downloaded)/float64(total)*100)
}

// 패키지 함수 (기본 클라이언트 사용)
result, err := httpc.Download(context.Background(), url, cfg)

// Client 인터페이스 메서드
result, err = client.Download(ctx, url, cfg)

// DomainClient 메서드 (path는 baseURL에 상대적, 응답 Cookie 자동 캡처)
result, err = dc.Download(ctx, "/files/report.pdf", cfg)
```

:::tip 마이그레이션 안내
기존의 `DownloadFile`, `DownloadWithOptions`, `DownloadFileWithContext`, `DownloadWithOptionsWithContext`는 v1.5.2에서 제거되었습니다. `Download(ctx, url, cfg, options...)`로 통일하여 사용하고, 경로, 덮어쓰기, 이어받기, 검증은 `DownloadConfig`로 설정하세요.
:::

## 보조 함수

### SetSecurityWarnOutput

```go
func SetSecurityWarnOutput(w io.Writer)
```

보안 경고 출력을 리다이렉트합니다(`TestingConfig`, `InsecureSkipVerify` 경고 등). `io.Discard`를 전달하면 모든 경고를 음소거할 수 있습니다.

```go
// 모든 보안 경고 음소거
httpc.SetSecurityWarnOutput(io.Discard)

// 커스텀 로그로 리다이렉트
httpc.SetSecurityWarnOutput(log.Writer())
```

:::warning
이 함수는 주로 테스트용입니다. 프로덕션 환경에서는 경고를 억제하기보다 `SecureConfig()` 또는 `DefaultConfig()`를 사용하세요.
:::

## 포맷 도구

### FormatBytes

```go
func FormatBytes(bytes int64) string
```

바이트 수를 사람이 읽을 수 있는 문자열로 포맷합니다(예: `"1.50 KB"`, `"500 B"`). 다운로드 결과 표시와 로그 출력에 자주 사용됩니다.

```go
result, _ := httpc.Download(context.Background(), url, cfg)
fmt.Printf("다운로드 완료 %s\n", httpc.FormatBytes(result.BytesWritten))
// 다운로드 완료 12.34 MB
```

| 입력 | 출력 |
|------|------|
| `500` | `500 B` |
| `1536` | `1.50 KB` |
| `1048576` | `1.00 MB` |
| `1073741824` | `1.00 GB` |

### FormatSpeed

```go
func FormatSpeed(bytesPerSecond float64) string
```

바이트/초 속도를 사람이 읽을 수 있는 문자열로 포맷합니다(예: `"1.50 MB/s"`). `DownloadResult.AverageSpeed`나 `DownloadProgressCallback`의 `speed` 매개변수와 함께 자주 사용됩니다.

```go
result, _ := httpc.Download(context.Background(), url, cfg)
fmt.Printf("평균 속도 %s\n", httpc.FormatSpeed(result.AverageSpeed))
// 평균 속도 5.67 MB/s

// 진행률 콜백에서 사용
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%s / %s (%s)",
        httpc.FormatBytes(downloaded),
        httpc.FormatBytes(total),
        httpc.FormatSpeed(speed),
    )
}
```

| 입력 (바이트/초) | 출력 |
|----------------|------|
| `500` | `500 B/s` |
| `1536` | `1.50 KB/s` |
| `1048576` | `1.00 MB/s` |

:::tip
두 함수 모두 이진 단위(1024 진수)를 사용하며, 단위 순서는 `B → KB → MB → GB → TB → PB → EB`입니다.
:::

## 도메인 클라이언트

### NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

도메인 범위 클라이언트를 생성하여 Cookie와 요청 헤더를 자동으로 관리합니다.

```go
dc, err := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, err := dc.Get("/users")
```

## 관련 항목

- [Result](./result) - 응답 결과 타입과 메서드
- [요청 옵션](./options) - 요청 설정 옵션
- [도메인 클라이언트](./domain-client) - 도메인 범위 클라이언트
- [파일 다운로드](./download) - 다운로드 함수와 타입
