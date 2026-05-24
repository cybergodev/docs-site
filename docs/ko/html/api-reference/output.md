---
title: "출력 형식 - HTML"
description: "CyberGo HTML 라이브러리 출력 형식 API 레퍼런스, ExtractToMarkdown 및 ExtractToJSON의 패키지 함수와 Processor 메서드를 포함하며, 바이트 또는 파일에서 Markdown이나 JSON 형식으로 추출 및 변환을 지원하고 컨텍스트 버전과 Result 커스텀 MarshalJSON 직렬화를 포함합니다."
---

# 출력 형식

HTML 라이브러리는 추출 결과를 Markdown 또는 JSON 형식으로 출력하는 것을 지원합니다.

## Markdown 출력

HTML 콘텐츠를 추출하여 Markdown 형식으로 변환합니다.

### 패키지 함수

```go
func ExtractToMarkdown(htmlBytes []byte, cfg ...Config) (string, error)
func ExtractToMarkdownFromFile(filePath string, cfg ...Config) (string, error)
func ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)
func ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) (string, error)
```

### Processor 메서드

```go
func (p *Processor) ExtractToMarkdown(htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFile(filePath string) (string, error)
func (p *Processor) ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
```

### 예시

```go
cfg := html.MarkdownConfig()
md, err := html.ExtractToMarkdown(data, cfg)
if err != nil {
    log.Fatal(err)
}
fmt.Println(md)
```

## JSON 출력

추출 결과를 JSON 바이트로 직렬화합니다.

### 패키지 함수

```go
func ExtractToJSON(htmlBytes []byte, cfg ...Config) ([]byte, error)
func ExtractToJSONFromFile(filePath string, cfg ...Config) ([]byte, error)
func ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]byte, error)
func ExtractToJSONFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) ([]byte, error)
```

### Processor 메서드

```go
func (p *Processor) ExtractToJSON(htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFile(filePath string) ([]byte, error)
func (p *Processor) ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)
```

### 예시

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```

:::tip Result.MarshalJSON
`Result`는 `json.Marshaler` 인터페이스를 구현합니다. `ProcessingTime`과 `ReadingTime` 필드에는 `json:"-"` 태그가 있어 표준 직렬화에서는 건너뛰지만, 커스텀 `MarshalJSON()` 메서드를 통해 밀리초 단위로 출력에 포함됩니다.
:::
