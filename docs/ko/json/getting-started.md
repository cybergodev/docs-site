---
title: "빠른 시작 - CyberGo JSON | 5분 시작 가이드"
description: "CyberGo JSON 빠른 시작 가이드: 설치 설정, 경로 쿼리 GetString/GetInt, 인코딩/디코딩 Marshal/Unmarshal, 파일 읽기/쓰기 작업, 5분 안에 Go JSON 처리 모범 사례를 익히세요. JSONPath 쿼리와 타입 안전 가져오기를 지원하며 encoding/json 표준 라이브러리와 100% 호환됩니다."
---

# 빠른 시작

이 가이드는 `github.com/cybergodev/json` 라이브러리를 빠르게 시작할 수 있도록 도와줍니다.

## 설치

```bash
go get github.com/cybergodev/json
```

## 기본 사용법

### 패키지 레벨 함수

라이브러리는 프로세서를 생성하지 않고도 사용할 수 있는 편리한 패키지 레벨 함수를 제공합니다:

#### 값 가져오기

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "name": "CyberGo",
        "version": 1,
        "active": true,
        "price": 99.99,
        "tags": ["json", "go", "fast"],
        "meta": {"author": "dev"}
    }`

    // 일반 가져오기
    val, err := json.Get(data, "name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // CyberGo

    // 타입 안전 가져오기
    name := json.GetString(data, "name")
    version := json.GetInt(data, "version")
    active := json.GetBool(data, "active")
    price := json.GetFloat(data, "price")
    tags := json.GetArray(data, "tags")
    meta := json.GetObject(data, "meta")

    fmt.Println(name, version, active, price)
    fmt.Println(tags)  // [json go fast]
    fmt.Println(meta)  // map[author:dev]

    // 기본값으로 가져오기
    desc := json.GetString(data, "description", "N/A")
    count := json.GetInt(data, "count", 0)
    fmt.Println(desc, count) // N/A 0
}
```

#### 중첩 경로

점으로 구분된 중첩 경로를 지원합니다:

```go
data := `{"user": {"profile": {"name": "Alice"}}}`

name := json.GetString(data, "user.profile.name")
fmt.Println(name) // Alice
```

#### 배열 인덱스

배열 인덱스 접근을 지원합니다:

```go
data := `{"items": ["a", "b", "c"]}`

// 두 가지 문법 모두 지원
item0 := json.GetString(data, "items.0")   // "a"
item1 := json.GetString(data, "items.1")   // "b"
last := json.GetString(data, "items.-1")   // "c"

// 대괄호 문법
first := json.GetString(data, "items[0]")  // "a"
last2 := json.GetString(data, "items[-1]") // "c"

// 범위 가져오기 (배열 반환)
arr := json.GetArray(data, "items[0:2]")   // ["a", "b"]
```

:::tip 더 많은 경로 문법
기본 속성과 배열 인덱스 외에도 **배열 슬라이스** `[1:5]`, **와일드카드** `[*]`, **필드 추출** `{name,email}` 등의 고급 문법을 지원합니다. 자세한 내용은 [경로 표현식 문법](./path-syntax)을 참조하세요.
:::

#### 값 설정

```go
data := `{"name": "old"}`

// 새 값 설정
updated, _ := json.Set(data, "name", "new")
fmt.Println(updated) // {"name":"new"}

// 새 필드 추가
updated, _ = json.Set(data, "version", 1)
fmt.Println(updated) // {"name":"old","version":1}

// 여러 필드를 개별적으로 설정
updated, _ = json.Set(data, "name", "updated")
updated, _ = json.Set(updated, "version", 2)
updated, _ = json.Set(updated, "active", true)
```

#### 값 삭제

```go
data := `{"name": "test", "temp": "remove"}`

// 필드 삭제
updated, _ := json.Delete(data, "temp")
fmt.Println(updated) // {"name":"test"}
```

### 인코딩과 디코딩

표준 라이브러리와 완전히 호환됩니다:

```go
type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

// 인코딩
user := User{Name: "Alice", Age: 30}
bytes, _ := json.Marshal(user)
fmt.Println(string(bytes)) // {"name":"Alice","age":30}

// 포맷팅 인코딩
pretty, _ := json.MarshalIndent(user, "", "  ")
fmt.Println(string(pretty))
// {
//   "name": "Alice",
//   "age": 30
// }

// 디코딩
var u User
json.Unmarshal(bytes, &u)
fmt.Println(u.Name, u.Age) // Alice 30
```

### 검증

```go
valid := `{"key": "value"}`
invalid := `{key: value}`

fmt.Println(json.Valid([]byte(valid)))   // true
fmt.Println(json.Valid([]byte(invalid))) // false
```

### 포맷팅

```go
compact := `{"name":"test","nested":{"key":"value"}}`

// 이쁘게 출력
pretty, _ := json.Prettify(compact)
fmt.Println(pretty)
// {
//   "name": "test",
//   "nested": {
//     "key": "value"
//   }
// }

// 압축 출력
jsonStr := `{
  "name": "test"
}`
var buf bytes.Buffer
err := json.Compact(&buf, []byte(jsonStr))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

## Processor 사용

빈번한 작업에는 더 나은 성능과 캐시 효과를 위해 `Processor`를 사용하는 것이 좋습니다:

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 기본 설정으로 프로세서 생성
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close() // 리소스 해제를 위해 반드시 닫기

    data := `{"name": "test", "value": 42}`

    // 프로세서로 작업
    name := p.GetString(data, "name")
    value := p.GetInt(data, "value")

    fmt.Println(name, value)
}
```

## 설정 옵션

```go
// 기본 설정
cfg := json.DefaultConfig()

// 보안 강화 설정 (신뢰할 수 없는 입력 처리)
cfg = json.SecurityConfig()

// 포맷팅 출력 설정
cfg = json.PrettyConfig()

// 커스텀 설정
cfg := json.DefaultConfig()
cfg.MaxJSONSize = 50 * 1024 * 1024 // 50MB
cfg.EnableCache = true
cfg.CacheTTL = 5 * time.Minute

// 커스텀 설정으로 프로세서 생성
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## 반복 순회

```go
data := `{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}`

err := json.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("사용자 %v: %s (나이 %d)\n", key, name, age)
})
// 사용자 0: Alice (나이 30)
// 사용자 1: Bob (나이 25)
```

## 다음 단계

- [경로 표현식 문법](./path-syntax) — 완전한 경로 쿼리 문법 배우기
- [대용량 파일 처리](./large-files) — 대형 JSON 파일 처리하기
- [API 문서](./api-reference/) — 완전한 API 참조 확인하기
- [사용 예제](./examples) — 더 많은 실전 예제 살펴보기
