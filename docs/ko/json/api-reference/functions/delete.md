---
title: "삭제 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 삭제 함수: Delete로 노드를 삭제하고 DeleteClean으로 빈 부모 노드를 자동 정리합니다."
sidebar_label: "삭제 작업"
sidebar_position: 4
---

# 삭제 함수

json 패키지가 제공하는 JSON 삭제 함수로, 지정된 경로의 노드를 제거하며 삭제로 인해 발생한 빈 부모 노드를 선택적으로 정리합니다.

## Delete

시그니처: `func Delete(jsonStr, path string, cfg ...Config) (string, error)`

지정된 경로의 값을 삭제합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `jsonStr` | `string` | 예 | JSON 문자열 |
| `path` | `string` | 예 | 경로 표현식 |
| `cfg` | `Config` | 아니오 | 선택적 설정 |

**예제**

```go
result, err := json.Delete(data, "user.temporary")
if err != nil {
    panic(err)
}
```

**객체 속성 삭제**

```go
// 단일 속성 삭제
result, err := json.Delete(`{"user":{"name":"Alice","temp":"value"}}`, "user.temp")
// {"user":{"name":"Alice"}}
```

**배열 요소 삭제**

```go
// 배열의 요소 삭제 (인덱스는 0부터 시작)
result, err := json.Delete(`{"items":["a","b","c"]}`, "items[1]")
// {"items":["a","c"]}
```

**경로가 존재하지 않는 경우**

```go
// 경로가 존재하지 않으면 원래 JSON과 오류 반환
result, err := json.Delete(`{"a":1}`, "nonexistent.path")
if err != nil {
    // err은 ErrPathNotFound를 래핑한 JsonsError를 포함
    fmt.Println("삭제 실패:", err)
}
// result는 여전히 원래 JSON: {"a":1}
```

## DeleteClean

시그니처: `func DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

지정된 경로를 삭제하고 생성된 빈 값과 빈 배열을 자동으로 정리합니다.

```go
// 원래 데이터: {"user": {"temp": "value", "name": "test"}}
result, err := json.DeleteClean(data, "user.temp")
// {"user":{"name":"test"}}

// 삭제 후 부모 객체가 비어 있으면 계속 정리
// {"user": {}} -> {}
```

## 관련 문서

- [수정 작업](./modify) - 설정, 병합 등 수정 함수
- [조회 및 가져오기 함수](./query) - Get, GetString 등 조회 작업
