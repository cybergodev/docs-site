---
title: "배치 처리 - CyberGo HTML | 동시 배치 API"
description: "CyberGo HTML 동시 배치 API: ExtractBatch, ExtractBatchFiles 계열과 컨텍스트 버전. WorkerPoolSize 동시성, 배치당 최대 10000개, BatchResult 카운트를 제공합니다."
---

# 배치 처리

배치 추출은 여러 HTML 문서를 동시에 처리하는 것을 지원하며, 각 배치당 최대 10000개 항목까지 가능합니다.

## 패키지 함수

```go
func ExtractBatch(htmlContents [][]byte, cfg ...Config) *BatchResult
func ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult
func ExtractBatchFiles(filePaths []string, cfg ...Config) *BatchResult
func ExtractBatchFilesWithContext(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult
```

## Processor 메서드

```go
func (p *Processor) ExtractBatch(htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchFiles(filePaths []string) *BatchResult
func (p *Processor) ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult
```

## BatchResult

```go
type BatchResult struct {
    Results   []*Result  // 각 입력 항목의 결과, 입력 순서대로 인덱싱됨; 실패 또는 취소 시 nil
    Errors    []error    // 각 입력 항목의 오류, 인덱스가 Results와 일대일 대응
    Success   int        // 성공 수량
    Failed    int        // 실패 수량
    Cancelled int        // 컨텍스트 취소로 인해 처리되지 않은 항목 수
}
```

## 예시

```go
pages := [][]byte{page1, page2, page3}
batch := html.ExtractBatch(pages)

fmt.Printf("성공: %d, 실패: %d\n", batch.Success, batch.Failed)

for i, result := range batch.Results {
    fmt.Printf("페이지 %d: %s\n", i, result.Title)
}

for i, err := range batch.Errors {
    if err != nil {
        fmt.Printf("페이지 %d 오류: %v\n", i, err)
    }
}
```

:::warning 배치 제한
단일 배치당 최대 10000개 항목이며, 초과 시 오류가 발생합니다.
:::
