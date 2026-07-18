---
sidebar_label: "출력 함수"
title: "출력 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 출력과 포맷: Encode, EncodePretty, Prettify와 fmt 패키지로 들여쓰기 JSON 출력을 구현하고 제거된 Print 계열을 대체합니다."
sidebar_position: 11
---

# 출력 함수

:::warning API 변경 안내
Print, PrintPretty, PrintE, PrintPrettyE는 라이브러리에서 제거되어 더 이상 제공되지 않습니다. 다음 대안을 사용하십시오.
:::

## 대안

### 압축 JSON 출력

`fmt.Println` + `EncodeWithConfig` (권장) 또는 `Marshal` 사용:

```go
data := map[string]any{"name": "Alice", "age": 30}

s, err := json.EncodeWithConfig(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// 출력: {"age":30,"name":"Alice"}

// 또는 Marshal 사용 ([]byte 출력)
b, err := json.Marshal(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(b))
```

:::warning Encode는 더 이상 사용되지 않음
`json.Encode`는 더 이상 사용되지 않는 것으로 표시되었습니다 (`EncodeWithConfig`와 기능적으로 동일), 향후 메이저 버전에서 제거될 예정입니다. 새 코드에서는 `EncodeWithConfig` 또는 `Marshal`을 사용하세요.
:::

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

// 인코딩 후 출력 (EncodeWithConfig 권장; Encode는 더 이상 사용되지 않음)
s, err := p.EncodeWithConfig(data)
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

    // 압축 출력 (Encode는 더 이상 사용되지 않음, EncodeWithConfig 권장)
    compact, err := json.EncodeWithConfig(data)
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

- [인코딩 출력 함수](./functions/output) - Encode, EncodePretty, Prettify
- [패키지 함수](./functions/) - 패키지 레벨 함수 개요
