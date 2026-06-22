---
title: "타입 정의 - CyberGo HTML | 데이터 타입 참조"
description: "CyberGo HTML 데이터 타입: Result(사용자 정의 JSON 직렬화), ImageInfo, LinkInfo, LinkResource, Statistics, BatchResult 등 핵심 타입 필드를 설명합니다."
---

# 타입 정의

## Result

추출 결과로, 텍스트, 메타데이터 및 미디어 정보를 포함합니다.

```go
type Result struct {
    Text           string        `json:"text"`
    Title          string        `json:"title"`
    Images         []ImageInfo   `json:"images,omitempty"`
    Links          []LinkInfo    `json:"links,omitempty"`
    Videos         []VideoInfo   `json:"videos,omitempty"`
    Audios         []AudioInfo   `json:"audios,omitempty"`
    ProcessingTime time.Duration `json:"-"`       // 처리 소요 시간(표준 직렬화에서 제외)
    WordCount      int           `json:"word_count"`
    ReadingTime    time.Duration `json:"-"`       // 예상 읽기 시간(표준 직렬화에서 제외)
}
```

### MarshalJSON

커스텀 JSON 직렬화. `ProcessingTime`과 `ReadingTime`은 `json:"-"` 태그가 있어 표준 직렬화에서는 건너뛰지만, 커스텀 `MarshalJSON()` 메서드를 통해 밀리초 단위로 출력에 포함됩니다.

```go
func (r *Result) MarshalJSON() ([]byte, error)
```

## ImageInfo

이미지 정보입니다.

```go
type ImageInfo struct {
    URL          string `json:"url"`           // 이미지 주소
    Alt          string `json:"alt"`           // 대체 텍스트
    Title        string `json:"title"`         // 제목
    Width        string `json:"width"`         // 너비
    Height       string `json:"height"`        // 높이
    IsDecorative bool   `json:"is_decorative"` // 장식용 이미지 여부
    Position     int    `json:"position"`      // 문서 내 위치
}
```

## LinkInfo

링크 정보입니다.

```go
type LinkInfo struct {
    URL        string `json:"url"`         // 링크 주소
    Text       string `json:"text"`        // 링크 텍스트
    Title      string `json:"title"`       // 링크 제목
    IsExternal bool   `json:"is_external"` // 외부 링크 여부
    IsNoFollow bool   `json:"is_nofollow"` // nofollow 여부
    Position   int    `json:"position"`    // 문서 내 위치
}
```

## VideoInfo

비디오 정보입니다.

```go
type VideoInfo struct {
    URL      string `json:"url"`      // 비디오 주소
    Type     string `json:"type"`     // 비디오 유형
    Poster   string `json:"poster"`   // 썸네일 주소
    Width    string `json:"width"`    // 너비
    Height   string `json:"height"`   // 높이
    Duration string `json:"duration"` // 재생 시간
}
```

## AudioInfo

오디오 정보입니다.

```go
type AudioInfo struct {
    URL      string `json:"url"`      // 오디오 주소
    Type     string `json:"type"`     // 오디오 유형
    Duration string `json:"duration"` // 재생 시간
}
```

## LinkResource

링크 리소스(링크 추출 API에 사용).

```go
type LinkResource struct {
    URL   string // 링크 주소
    Title string // 링크 제목
    Type  string // 링크 유형
}
```

## Statistics

처리 통계 정보입니다.

```go
type Statistics struct {
    TotalProcessed    int64         // 총 처리 수
    CacheHits         int64         // 캐시 적중 수
    CacheMisses       int64         // 캐시 미스 수
    ErrorCount        int64         // 오류 수
    AverageProcessTime time.Duration // 평균 처리 시간
}
```

## BatchResult

배치 처리 결과입니다.

```go
type BatchResult struct {
    Results   []*Result // 추출 결과, 실패 또는 취소 시 nil
    Errors    []error   // 실패한 오류
    Success   int       // 성공 수량
    Failed    int       // 실패 수량
    Cancelled int       // 취소 수량
}
```

## NodeAttr

HTML 노드 속성입니다.

```go
type NodeAttr struct {
    Key   string // 속성명
    Value string // 속성값
}
```
