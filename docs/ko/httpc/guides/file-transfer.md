---
title: "파일 업로드와 다운로드 - HTTPC"
description: "HTTPC 파일 업로드와 다운로드 가이드: WithFile 간단한 업로드, WithFormData Multipart 다중 파일 업로드, DownloadFile 기본 다운로드, DownloadWithOptions 진행률 콜백, 이어받기 ResumeDownload, SHA-256 체크섬과 UNC 경로 등 보안 보호."
---

# 파일 업로드와 다운로드

## 파일 업로드

### 간단한 파일 업로드

```go
fileContent, err := os.ReadFile("document.pdf")
if err != nil {
    log.Fatal(err)
}

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithFile("file", "document.pdf", fileContent),
)
```

### Multipart 폼

파일과 함께 폼 필드를 업로드합니다:

```go
form := &httpc.FormData{
    Fields: map[string]string{
        "title": "My Document",
        "type":  "pdf",
    },
    Files: map[string]*httpc.FileData{
        "file": {
            Filename: "report.pdf",
            Content:  fileContent,
        },
    },
}

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithFormData(form),
)
```

### 다중 파일 업로드

```go
form := &httpc.FormData{
    Fields: map[string]string{
        "description": "일괄 업로드",
    },
    Files: map[string]*httpc.FileData{
        "file1": {Filename: "doc1.pdf", Content: content1},
        "file2": {Filename: "doc2.pdf", Content: content2},
        "file3": {Filename: "image.png", Content: content3},
    },
}

result, err := httpc.Post(url, httpc.WithFormData(form))
```

### 바이너리 업로드

```go
data, _ := os.ReadFile("data.bin")
result, err := httpc.Post(url,
    httpc.WithBinary(data, "application/octet-stream"),
)
```

## 파일 다운로드

### 기본 다운로드

```go
result, err := httpc.DownloadFile(
    "https://example.com/file.zip",
    "/tmp/file.zip",
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("다운로드 완료: %s\n", httpc.FormatBytes(result.BytesWritten))
fmt.Printf("소요 시간: %v\n", result.Duration)
```

### 진행률 콜백 포함

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r다운로드 중: %.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}

result, err := httpc.DownloadWithOptions("https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\n다운로드 완료: %s, 평균 속도 %s\n",
    httpc.FormatBytes(result.BytesWritten),
    httpc.FormatSpeed(result.AverageSpeed),
)
```

### 이어받기

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.DownloadWithOptions(url, cfg)
if err != nil {
    log.Fatal(err)
}

if result.Resumed {
    fmt.Printf("이어받기 완료: 중단 지점에서 복구\n")
}
```

:::tip 사용 팁
이어받기는 서버가 `Range` 요청 헤더를 지원해야 합니다. 서버가 지원하지 않는 경우(206 대신 200 반환), 이미 다운로드한 부분 파일을 보호하기 위해 오류를 반환합니다.
:::

### 컨텍스트 제어 포함

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
defer cancel()

result, err := httpc.DownloadFileWithContext(ctx, url, "/tmp/file.zip")
if err != nil {
    if errors.Is(err, context.DeadlineExceeded) {
        log.Println("다운로드 시간 초과")
    }
    log.Fatal(err)
}
```

## 보안 방어

파일 다운로드에는 다층 보안 보호가 내장되어 있습니다:

| 보호 계층 | 설명 |
|--------|------|
| 경로 검증 | UNC 경로, 제어 문자, 경로 순회 차단 |
| 시스템 경로 보호 | `/etc/`, `C:\Windows\` 등 시스템 디렉토리 쓰기 금지 |
| 심볼릭 링크 감지 | 심볼릭 링크 공격 방지 |
| 파일 크기 제한 | `MaxResponseBodySize`로 제한 |

## 도메인 클라이언트 다운로드

도메인 클라이언트의 다운로드는 응답 Cookie를 세션에 자동으로 캡처합니다:

```go
dc, _ := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)

// 다운로드 및 자동 세션 관리
result, err := dc.DownloadFile("/files/report.pdf", "/tmp/report.pdf")
```

## 다음 단계

- [파일 다운로드 API](../api-reference/download) - 완전한 다운로드 API 참조
- [도메인 클라이언트와 세션](./domain-session) - 세션 관리
- [요청과 응답](./request-response) - 기본 요청 가이드
