---
sidebar_label: "데이터 타입"
title: "타입 정의 - CyberGo html | 데이터 타입 참조"
description: "CyberGo html 데이터 타입: Result, ImageInfo, LinkInfo, LinkResource, Statistics, BatchResult 등 핵심 타입의 필드를 설명합니다."
sidebar_position: 2
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

:::warning 경고
`Result`는 `UnmarshalJSON`을 **구현하지 않습니다**. `MarshalJSON()`의 출력을 다시 `Result`로 역직렬화하면 `ProcessingTime`, `ReadingTime` 같은 duration 필드가 **손실됩니다** — JSON 출력의 키 이름(`processing_time_ms`, `reading_time_ms`)이 struct 필드 이름과 일치하지 않아 복원할 수 없습니다.

이는 **의도된 설계**입니다. 이 JSON 형식은 외부 소비(API 응답, 로그, 프론트엔드 표시 등)를 위한 것이며, 양방향 직렬화를 위해 설계되지 않았습니다.
:::

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
    IsExternal bool   `json:"is_external"` // 외부 링크 여부(URL 자체가 절대 외부 URL인지로 판정하며, BaseURL과 비교하지 않음)
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
