---
title: "인터페이스 정의 - HTML"
description: "CyberGo HTML 라이브러리 핵심 인터페이스 정의 API 레퍼런스, Extractor(전체 추출 인터페이스), StatsProvider(통계 및 캐시 관리), ContentNode(HTML 노드 추상화), Scorer(커스텀 평가 전략) 및 AuditSink(감사 출력)를 포함합니다."
---

# 인터페이스 정의

HTML 라이브러리는 다음 핵심 인터페이스를 정의합니다:

## Extractor

HTML 콘텐츠 추출의 주요 인터페이스로, `Processor`가 이 인터페이스를 구현합니다.

```go
type Extractor interface {
    // 핵심 추출
    Extract(htmlBytes []byte) (*Result, error)
    ExtractWithContext(ctx context.Context, htmlBytes []byte) (*Result, error)
    ExtractFromFile(filePath string) (*Result, error)
    ExtractFromFileWithContext(ctx context.Context, filePath string) (*Result, error)

    // 텍스트 추출
    ExtractText(htmlBytes []byte) (string, error)
    ExtractTextFromFile(filePath string) (string, error)
    ExtractTextWithContext(ctx context.Context, htmlBytes []byte) (string, error)
    ExtractTextFromFileWithContext(ctx context.Context, filePath string) (string, error)

    // 형식화 출력
    ExtractToMarkdown(htmlBytes []byte) (string, error)
    ExtractToMarkdownFromFile(filePath string) (string, error)
    ExtractToJSON(htmlBytes []byte) ([]byte, error)
    ExtractToJSONFromFile(filePath string) ([]byte, error)
    ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
    ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
    ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
    ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)

    // 배치 처리
    ExtractBatch(htmlContents [][]byte) *BatchResult
    ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
    ExtractBatchFiles(filePaths []string) *BatchResult
    ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult

    // 링크 추출
    ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
    ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
    ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
    ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)

    // 라이프사이클
    Close() error
}
```

## StatsProvider

통계 정보와 캐시 관리 인터페이스입니다.

```go
type StatsProvider interface {
    GetStatistics() Statistics
    ClearCache()
    ResetStatistics()
}
```

## ContentNode

HTML 노드의 추상 인터페이스로, 콘텐츠 평가 알고리즘에 사용됩니다.

```go
type ContentNode interface {
    Type() string                    // 노드 유형 ("element", "text", "comment" 등)
    Data() string                    // 태그명 또는 텍스트 콘텐츠
    AttrValue(key string) string     // 속성 값
    Attrs() []NodeAttr               // 모든 속성
    FirstChild() ContentNode         // 첫 번째 자식 노드
    NextSibling() ContentNode        // 다음 형제 노드
    Parent() ContentNode             // 부모 노드
}
```

## Scorer

콘텐츠 평가 알고리즘 인터페이스로, 커스텀 문서 인식 전략에 사용됩니다.

```go
type Scorer interface {
    Score(node ContentNode) int          // 노드 관련성 점수 계산
    ShouldRemove(node ContentNode) bool  // 노드 제거 여부 판단
}
```

`Config.Scorer` 필드를 통해 커스텀 스코어러를 주입합니다:

```go
type MyScorer struct{}

func (s *MyScorer) Score(node html.ContentNode) int {
    // 커스텀 평가 로직
    return 0
}

func (s *MyScorer) ShouldRemove(node html.ContentNode) bool {
    // 커스텀 제거 로직
    return false
}

cfg := html.DefaultConfig()
cfg.Scorer = &MyScorer{}
```

## AuditSink

감사 로그 출력 인터페이스입니다.

```go
type AuditSink interface {
    Write(entry AuditEntry)
    Close() error
}
```

내장 Sink 구현은 [감사 시스템](./audit)을 참조하세요.
