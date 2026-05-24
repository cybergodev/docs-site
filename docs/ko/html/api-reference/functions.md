---
title: "패키지 함수 - HTML"
description: "CyberGo HTML 라이브러리 패키지 수준 편의 함수 전체 API 레퍼런스, Extract, ExtractFromFile, ExtractText, ExtractFromFileWithContext 등 콘텐츠 추출 함수와 컨텍스트 버전을 포함하며, 내부적으로 sync.Pool로 Processor 인스턴스를 재사용하여 효율적인 일회성 호출을 구현합니다."
---

# 패키지 함수

패키지 수준 함수는 일회성 호출 시나리오에 적합하며, 내부적으로 `sync.Pool`을 사용하여 Processor를 재사용하므로 라이프사이클을 수동으로 관리할 필요가 없습니다.

## 콘텐츠 추출

### Extract

HTML 바이트에서 콘텐츠를 추출하여 완전한 `Result`를 반환합니다.

```go
func Extract(htmlBytes []byte, cfg ...Config) (*Result, error)
```

**매개변수**:

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `htmlBytes` | `[]byte` | HTML 콘텐츠 |
| `cfg` | `...Config` | 선택적 설정, 최대 1개 |

**예시**:

```go
result, err := html.Extract(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.Title, result.Text)
```

### ExtractFromFile

HTML 파일에서 콘텐츠를 추출합니다.

```go
func ExtractFromFile(filePath string, cfg ...Config) (*Result, error)
```

## 텍스트 추출

### ExtractText

순수 텍스트 콘텐츠만 추출합니다.

```go
func ExtractText(htmlBytes []byte, cfg ...Config) (string, error)
```

### ExtractTextFromFile

파일에서 순수 텍스트를 추출합니다.

```go
func ExtractTextFromFile(filePath string, cfg ...Config) (string, error)
```

## 컨텍스트 버전

모든 함수는 `context.Context`가 포함된 버전을 지원하여 취소 및 타임아웃 제어에 사용합니다:

| 함수 | 시그니처 |
|------|------|
| `ExtractWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (*Result, error)` |
| `ExtractFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (*Result, error)` |
| `ExtractTextWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` |
| `ExtractTextFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` |

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

## 출력 형식

| 함수 | 시그니처 | 설명 |
|------|------|------|
| `ExtractToMarkdown` | `(htmlBytes []byte, cfg ...Config) (string, error)` | HTML → Markdown |
| `ExtractToMarkdownFromFile` | `(filePath string, cfg ...Config) (string, error)` | 파일 → Markdown |
| `ExtractToMarkdownWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` | 컨텍스트 포함 |
| `ExtractToMarkdownFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` | 파일+컨텍스트 |
| `ExtractToJSON` | `(htmlBytes []byte, cfg ...Config) ([]byte, error)` | HTML → JSON |
| `ExtractToJSONFromFile` | `(filePath string, cfg ...Config) ([]byte, error)` | 파일 → JSON |
| `ExtractToJSONWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]byte, error)` | 컨텍스트 포함 |
| `ExtractToJSONFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]byte, error)` | 파일+컨텍스트 |

자세한 사용법과 예시는 [출력 형식](./output)을 참조하세요.

## 링크 추출

| 함수 | 시그니처 | 설명 |
|------|------|------|
| `ExtractAllLinks` | `(htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | 모든 링크 추출 |
| `ExtractAllLinksFromFile` | `(filePath string, cfg ...Config) ([]LinkResource, error)` | 파일에서 링크 추출 |
| `ExtractAllLinksWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | 컨텍스트 포함 |
| `ExtractAllLinksFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]LinkResource, error)` | 파일+컨텍스트 |

자세한 사용법과 예시는 [링크 추출](./links)을 참조하세요.

## 배치 처리

| 함수 | 시그니처 | 설명 |
|------|------|------|
| `ExtractBatch` | `(htmlContents [][]byte, cfg ...Config) *BatchResult` | 배치 추출 |
| `ExtractBatchWithContext` | `(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult` | 컨텍스트 포함 |
| `ExtractBatchFiles` | `(filePaths []string, cfg ...Config) *BatchResult` | 배치 파일 추출 |
| `ExtractBatchFilesWithContext` | `(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult` | 파일+컨텍스트 |

자세한 사용법과 예시는 [배치 처리](./batch)를 참조하세요.
