---
title: "테스트와 커스텀 확장 - CyberGo HTML | 테스트 가이드"
description: "CyberGo HTML 테스트와 확장: 커스텀 Scorer 구현, ContentNode 순회, 테스트 모드, mock 데이터, Extractor 모킹과 실행 가능 예시를 설명합니다."
---

# 테스트와 커스텀 확장

이 가이드는 콘텐츠 평가 알고리즘을 커스터마이즈하는 방법과 HTML 라이브러리를 사용하는 코드의 테스트 작성 방법을 소개합니다.

## 커스텀 Scorer

`Scorer` 인터페이스는 두 가지 핵심 결정을 제어합니다: 본문 콘텐츠를 식별하는 방법과 제거할 노드를 결정하는 방법입니다.

### 인터페이스 정의

```go
type Scorer interface {
    Score(node ContentNode) int
    ShouldRemove(node ContentNode) bool
}
```

- `Score`: 노드에 점수를 매기며, 점수가 높을수록 본문 컨테이너로 선택될 가능성이 높음
- `ShouldRemove`: `true`를 반환하면 추출 전 해당 노드를 제거

### 기본 동작

`Scorer`를 설정하지 않으면 내장 기본 스코어러가 사용됩니다. 노드 특성(텍스트 밀도, 단락 비율, 태그 의미 등)에 따라 점수를 계산합니다.

### 커스텀 Scorer 구현

```go
package main

import (
    "fmt"
    "log"
    "strings"

    "github.com/cybergodev/html"
)

// blogScorer 블로그 사이트에 최적화된 스코어러
type blogScorer struct{}

func (s blogScorer) Score(node html.ContentNode) int {
    if node == nil {
        return 0
    }

    score := 0
    class := strings.ToLower(node.AttrValue("class"))
    id := strings.ToLower(node.AttrValue("id"))
    tag := node.Data()

    // 긍정적 신호: 글 관련 class/id
    if containsAny(class, "article", "post", "content", "entry") {
        score += 50
    }
    if containsAny(id, "article", "post", "content") {
        score += 60
    }

    // 시맨틱 태그 가산점
    switch tag {
    case "article":
        score += 80
    case "main":
        score += 70
    case "section":
        score += 30
    }

    // 부정적 신호
    if containsAny(class, "sidebar", "comment", "footer", "nav", "menu") {
        score -= 50
    }
    if containsAny(id, "sidebar", "comments", "footer") {
        score -= 60
    }

    return score
}

func (s blogScorer) ShouldRemove(node html.ContentNode) bool {
    if node == nil {
        return false
    }

    // 내비게이션과 푸터 제거
    switch node.Data() {
    case "nav", "footer", "header":
        return true
    }

    // 광고와 댓글 영역 제거
    class := strings.ToLower(node.AttrValue("class"))
    return containsAny(class, "ad", "advertisement", "comment", "social-share")
}

func containsAny(s string, keywords ...string) bool {
    for _, kw := range keywords {
        if strings.Contains(s, kw) {
            return true
        }
    }
    return false
}

func main() {
    cfg := html.DefaultConfig()
    cfg.Scorer = blogScorer{}

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    data := []byte(`<html><body>
        <article class="post"><h1>테스트 글</h1><p>본문 내용</p></article>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(result.Text)
}
```

## ContentNode 인터페이스

`ContentNode`는 `Scorer` 인터페이스에서 사용되는 노드 추상화로, 기본 HTML 파서의 구체적인 타입을 숨깁니다:

```go
type ContentNode interface {
    Type() string                        // "element", "text", "comment" 등
    Data() string                        // 태그명 또는 텍스트 콘텐츠
    AttrValue(key string) string         // 속성 값 가져오기
    Attrs() []NodeAttr                   // 모든 속성 가져오기
    FirstChild() ContentNode             // 첫 번째 자식 노드
    NextSibling() ContentNode            // 다음 형제 노드
    Parent() ContentNode                 // 부모 노드
}
```

### 노드 순회

```go
func (s myScorer) Score(root html.ContentNode) int {
    score := 0
    // 자식 노드 순회
    for child := root.FirstChild(); child != nil; child = child.NextSibling() {
        if child.Type() == "element" {
            // 중첩된 텍스트 밀도 확인
            textLen := countTextLength(child)
            if textLen > 200 {
                score += 10
            }
        }
    }
    return score
}
```

## 테스트 모드

### 캐시 비활성화

테스트에서는 보통 캐시가 필요하지 않으며, 비활성화하면 매번 "깨끗한" 호출이 됩니다:

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 0 // 캐시 비활성화
```

### 정제 비활성화

신뢰할 수 있는 입력에 대해서는 보안 정제를 비활성화하여 테스트 HTML이 수정되지 않도록 할 수 있습니다:

```go
cfg := html.DefaultConfig()
cfg.EnableSanitization = false
```

:::warning 테스트에만 사용
프로덕션 환경에서는 반드시 `EnableSanitization = true`를 유지하세요.
:::

### TextOnlyConfig 사용

순수 텍스트 추출 로직을 테스트할 때 `TextOnlyConfig`를 사용하여 노이즈를 줄입니다:

```go
result, err := html.Extract(data, html.TextOnlyConfig())
```

## 테스트 작성

### 추출 결과 테스트

```go
func TestExtractTitle(t *testing.T) {
    data := []byte(`<html><head><title>테스트 제목</title></head>
        <body><p>본문 내용</p></body></html>`)

    result, err := html.Extract(data)
    require.NoError(t, err)
    assert.Equal(t, "테스트 제목", result.Title)
    assert.Contains(t, result.Text, "본문 내용")
}
```

### 커스텀 Scorer 테스트

```go
func TestBlogScorer(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.Scorer = blogScorer{}
    cfg.MaxCacheEntries = 0 // 캐시 비활성화

    p, err := html.New(cfg)
    require.NoError(t, err)
    defer p.Close()

    data := []byte(`<html><body>
        <nav><a href="/">홈</a></nav>
        <article class="post">
            <h1>블로그 제목</h1>
            <p>블로그 본문 내용</p>
        </article>
        <aside class="sidebar">사이드바</aside>
    </body></html>`)

    result, err := p.Extract(data)
    require.NoError(t, err)
    assert.Contains(t, result.Text, "블로그 본문 내용")
    assert.NotContains(t, result.Text, "사이드바")
    assert.NotContains(t, result.Text, "홈")
}
```

### 오류 처리 테스트

```go
func TestInputTooLarge(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.MaxInputSize = 100 // 매우 작은 제한

    largeData := make([]byte, 200)
    _, err := html.Extract(largeData, cfg)

    assert.ErrorIs(t, err, html.ErrInputTooLarge)
}
```

### 감사 로그 테스트

```go
func TestAuditLog(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.Audit = html.DefaultAuditConfig()
    cfg.Audit.Enabled = true
    cfg.MaxCacheEntries = 0

    p, _ := html.New(cfg)
    defer p.Close()

    data := []byte(`<html><body><script>alert(1)</script><p>본문</p></body></html>`)
    p.Extract(data)

    entries := p.GetAuditLog()
    t.Logf("감사 이벤트: %d건", len(entries))
    for _, e := range entries {
        t.Logf("  [%s] %s", e.EventType, e.Message)
    }
}
```

## 일반적인 확장 시나리오

### 특정 웹사이트 맞춤 추출

```go
func newSiteScorer(site string) html.Scorer {
    switch site {
    case "github.com":
        return githubScorer{}
    case "medium.com":
        return mediumScorer{}
    default:
        return nil // 기본 스코어러 사용
    }
}
```

### 노드 속성 분포 통계

```go
func analyzeStructure(node html.ContentNode) map[string]int {
    counts := make(map[string]int)
    walk(node, counts)
    return counts
}

func walk(node html.ContentNode, counts map[string]int) {
    if node == nil {
        return
    }
    if node.Type() == "element" {
        counts[node.Data()]++
    }
    walk(node.FirstChild(), counts)
    walk(node.NextSibling(), counts)
}
```

## 다음 단계

- [API 레퍼런스: 인터페이스](../api-reference/interfaces) - Scorer와 ContentNode 전체 정의
- [API 레퍼런스: 설정](../api-reference/config) - Scorer 설정 필드
- [FAQ](../faq) - 자주 묻는 질문
