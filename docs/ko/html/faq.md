---
title: "자주 묻는 질문 - HTML"
description: "CyberGo HTML 라이브러리 자주 묻는 질문 모음, 패키지 함수와 Processor의 차이점 및 선택 방법, 인코딩 자동 감지와 수동 지정, 입력 크기 제한 설정, Markdown 출력 방법, 배치 처리 상한, 빈 텍스트 원인 파악 단계, 통계 모니터링 사용법, 감사 설정 방식 및 커스텀 스코어러 구현 등 고빈도 질문에 대한 상세 답변을 제공합니다."
---

# 자주 묻는 질문

## 패키지 함수와 Processor의 차이는 무엇인가요?

**패키지 함수**(예: `html.Extract`)는 내부적으로 `sync.Pool`을 사용하여 Processor를 재사용하며, 저빈도, 일회성 호출에 적합합니다. 호출 완료 후 Processor는 풀로 반환됩니다.

**Processor**(예: `p := html.New()`)는 고빈도 호출에 적합하며, 캐시와 내부 리소스를 재사용합니다. 통계 수집과 감사 로그도 지원합니다.

```go
// 저빈도: 패키지 함수
result, _ := html.Extract(data)

// 고빈도: Processor
p, _ := html.New(html.DefaultConfig())
defer p.Close()
for _, page := range pages {
    p.Extract(page)
}
```

## 인코딩 문제를 어떻게 처리하나요?

HTML 라이브러리는 15+ 인코딩(UTF-8, GBK, Shift_JIS, Windows-1252 등)을 자동으로 감지하므로 일반적으로 수동 지정이 필요 없습니다.

인코딩을 강제로 지정해야 하는 경우:

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

## 입력 크기 제한은 얼마인가요?

기본 최대 50MB(`DefaultMaxInputSize = 52428800`). 설정으로 조정 가능:

```go
cfg.MaxInputSize = 100 * 1024 * 1024 // 100MB
```

## Markdown 형식의 출력을 얻으려면 어떻게 하나요?

```go
md, err := html.ExtractToMarkdown(data)
```

또는 Processor 사용:

```go
p, _ := html.New()
md, _ := p.ExtractToMarkdown(data)
```

## 배치 처리는 최대 몇 개까지 지원하나요?

단일 배치당 최대 10000개 항목. 더 큰 데이터셋은 나누어 처리하세요.

## 추출된 텍스트가 비어 있는 이유는 무엇인가요?

가능한 원인:

1. **HTML 구조 문제** - 콘텐츠가 `<script>` 또는 `<style>` 태그 안에 있음
2. **깊이 초과** - DOM 중첩이 `MaxDepth` 제한을 초과함
3. **빈 입력** - 입력 바이트 배열이 비어 있는지 확인
4. **문서 인식** - `ExtractArticle`을 꺼서 추출이 되는지 확인

```go
cfg := html.DefaultConfig()
cfg.ExtractArticle = false // 문서 인식 비활성화
```

## 처리 통계를 모니터링하려면 어떻게 하나요?

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

// 일부 콘텐츠 처리 후
stats := p.GetStatistics()
fmt.Printf("처리됨: %d\n", stats.TotalProcessed)
fmt.Printf("캐시 적중: %d\n", stats.CacheHits)
fmt.Printf("평균 소요 시간: %v\n", stats.AverageProcessTime)
fmt.Printf("오류 수: %d\n", stats.ErrorCount)
```

## 감사를 활성화하려면 어떻게 하나요?

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = html.NewLoggerAuditSink()
```

자세한 내용은 [감사 시스템](./api-reference/audit)을 참조하세요.

## 파일 경로가 안전한가요?

`FileError`는 전체 경로를 자동으로 잘라서 오류 메시지에서 서버 경로가 노출되지 않도록 합니다:

```go
var fileErr *html.FileError
if errors.As(err, &fileErr) {
    fmt.Println(fileErr.SafePath()) // 파일명만, 전체 경로가 아님
}
```

## 커스텀 콘텐츠 스코어링을 구현하려면 어떻게 하나요?

`Scorer` 인터페이스를 구현:

```go
type MyScorer struct{}

func (s *MyScorer) Score(node html.ContentNode) int {
    // 커스텀 스코어링 로직
    return 0
}

func (s *MyScorer) ShouldRemove(node html.ContentNode) bool {
    // 커스텀 제거 로직
    return false
}

cfg := html.DefaultConfig()
cfg.Scorer = &MyScorer{}
```

자세한 내용은 [인터페이스 정의](./api-reference/interfaces)를 참조하세요.
