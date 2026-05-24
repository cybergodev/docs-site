---
title: "출력 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 출력과 포맷 출력 참조: Encode, EncodePretty, Prettify 함수와 표준 fmt 패키지를 사용하여 JSON 포맷 출력을 구현합니다. 비공개로 전환된 Print/PrintPretty 계열 함수를 대체하며, 커스텀 들여쓰기와 접두사를 지원합니다."
---

# 출력 함수

:::warning API 변경 안내
`Print`, `PrintPretty`, `PrintE`, `PrintPrettyE`는 내부 함수(소문자 명명)로 전환되어 공개 API로 내보내지지 않습니다. 다음 대안을 사용하십시오.
:::

## 대안

### 압축 JSON 출력

`fmt.Println` + `Encode` 사용:

```go
data := map[string]any{"name": "Alice", "age": 30}

s, err := json.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// 출력: {"age":30,"name":"Alice"}
```

### 포맷 JSON 출력

`fmt.Println` + `EncodePretty` 사용:

```go
s, err := json.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// 출력:
// {
//   "age": 30,
//   "name": "Alice"
// }
```

### JSON 문자열 출력 (기존 JSON 포맷)

`Prettify` 사용:

```go
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```

### Processor를 사용한 출력

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 인코딩 후 출력
s, err := p.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// 포맷 출력
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```

## 전체 예제

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    data := map[string]any{
        "users": []any{
            map[string]any{"id": 1, "name": "Alice"},
            map[string]any{"id": 2, "name": "Bob"},
        },
        "total": 2,
    }

    // 압축 출력
    compact, err := json.Encode(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(compact)

    // 포맷 출력
    pretty, err := json.EncodePretty(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(pretty)
}
```

## 관련 문서

- [인코딩 디코딩 함수](./functions/encode-decode) - Encode, EncodePretty, Prettify
- [패키지 함수](./functions) - 패키지 레벨 함수 개요
