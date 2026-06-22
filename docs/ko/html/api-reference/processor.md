---
title: "Processor - CyberGo HTML | 핵심 Processor API"
description: "CyberGo HTML Processor API: New 생성, Extract 메서드 계열과 GetStatistics, GetAuditLog, ClearCache, Close 등 수명 주기 관리로 고빈도 재사용에 적합합니다."
---

# Processor

`Processor`는 HTML 라이브러리의 핵심 처리 엔진입니다. 패키지 함수에 비해 Processor는 내부 리소스(캐시, 인코딩 감지기)를 재사용하여 고빈도 호출 시나리오에 적합합니다.

## 생성

### New

Processor 인스턴스를 생성하며, 선택적으로 설정을 전달할 수 있습니다.

```go
func New(cfg ...Config) (*Processor, error)
```

**매개변수**: 최대 1개의 `Config`, 미제공 시 `DefaultConfig()`를 사용합니다.

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()
```

## 콘텐츠 추출

### Extract

```go
func (p *Processor) Extract(htmlBytes []byte) (*Result, error)
```

HTML 바이트에서 콘텐츠를 추출하고 인코딩을 자동으로 감지합니다.

### ExtractFromFile

```go
func (p *Processor) ExtractFromFile(filePath string) (*Result, error)
```

파일에서 콘텐츠를 추출합니다.

### ExtractText

```go
func (p *Processor) ExtractText(htmlBytes []byte) (string, error)
```

순수 텍스트만 반환합니다.

### ExtractTextFromFile

```go
func (p *Processor) ExtractTextFromFile(filePath string) (string, error)
```

파일에서 순수 텍스트를 추출합니다.

## 컨텍스트 버전

모든 추출 메서드에는 `WithContext` 버전이 있습니다:

```go
func (p *Processor) ExtractWithContext(ctx context.Context, htmlBytes []byte) (*Result, error)
func (p *Processor) ExtractFromFileWithContext(ctx context.Context, filePath string) (*Result, error)
func (p *Processor) ExtractTextWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractTextFromFileWithContext(ctx context.Context, filePath string) (string, error)
```

## 출력 형식

```go
func (p *Processor) ExtractToMarkdown(htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFile(filePath string) (string, error)
func (p *Processor) ExtractToJSON(htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFile(filePath string) ([]byte, error)
```

컨텍스트 버전:

```go
func (p *Processor) ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
func (p *Processor) ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)
```

## 링크 추출

```go
func (p *Processor) ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)
```

## 배치 처리

```go
func (p *Processor) ExtractBatch(htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchFiles(filePaths []string) *BatchResult
func (p *Processor) ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult
```

## 통계와 캐시

### GetStatistics

현재 처리 통계 정보를 반환합니다.

```go
func (p *Processor) GetStatistics() Statistics
```

```go
stats := p.GetStatistics()
fmt.Printf("처리됨: %d, 캐시 적중: %d\n",
    stats.TotalProcessed, stats.CacheHits)
```

### ClearCache

캐시를 비우고 누적 통계는 유지합니다.

```go
func (p *Processor) ClearCache()
```

### ResetStatistics

모든 통계 카운터를 재설정합니다.

```go
func (p *Processor) ResetStatistics()
```

## 감사

### GetAuditLog

감사 로그 항목을 가져옵니다.

```go
func (p *Processor) GetAuditLog() []AuditEntry
```

### ClearAuditLog

감사 로그를 비웁니다.

```go
func (p *Processor) ClearAuditLog()
```

## 라이프사이클

### Close

Processor가 보유한 리소스를 해제합니다. 사용 완료 후 반드시 호출해야 합니다.

```go
func (p *Processor) Close() error
```

```go
p, _ := html.New(cfg)
defer p.Close()
// ... p를 사용하여 추출
```
