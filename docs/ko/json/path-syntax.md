---
title: "경로 표현식 문법 - CyberGo JSON | JSONPath 가이드"
description: "CyberGo JSON 경로 표현식 문법 가이드: 속성 접근 user.name, 배열 인덱스 items[0], 슬라이스, 와일드카드, 다중 필드 추출로 JSON 노드를 정확히 지정합니다."
---

# 경로 표현식 문법

json 라이브러리는 JSON 데이터의 모든 노드를 찾고 조작하기 위한 풍부한 경로 표현식 문법을 지원합니다.

## 기본 문법

### 속성 접근

점 `.`을 사용하여 객체 속성에 접근합니다:

```go
data := `{"user": {"name": "Alice", "age": 30}}`

name := json.GetString(data, "user.name")    // "Alice"
age := json.GetInt(data, "user.age")         // 30
```

### 중첩 경로

점을 연속으로 사용하여 깊이 중첩된 속성에 접근합니다:

```go
data := `{
    "company": {
        "department": {
            "team": {
                "lead": "Bob"
            }
        }
    }
}`

lead := json.GetString(data, "company.department.team.lead")  // "Bob"
```

### 배열 인덱스

두 가지 문법으로 배열 요소에 접근합니다:

```go
data := `{"items": ["a", "b", "c", "d", "e"]}`

// 문법 1: 점 + 인덱스
first := json.GetString(data, "items.0")   // "a"

// 문법 2: 대괄호 + 인덱스
first2 := json.GetString(data, "items[0]")   // "a"
```

#### 음수 인덱스

음수 인덱스는 배열 끝에서부터 카운트하며, `-1`은 마지막 요소를 나타냅니다:

```go
data := `{"items": ["a", "b", "c", "d", "e"]}`

val := json.GetString(data, "items[-1]")  // "e"  (마지막)
val = json.GetString(data, "items[-2]")   // "d"  (뒤에서 두 번째)
val = json.GetString(data, "items[-5]")   // "a"  ([0]과 동일)
```

| 인덱스 | 의미 | 해당 양수 인덱스 |
|------|------|-----------|
| `[0]` | 첫 번째 요소 | — |
| `[1]` | 두 번째 요소 | — |
| `[-1]` | 마지막 요소 | `[len-1]` |
| `[-2]` | 뒤에서 두 번째 | `[len-2]` |
| `[-N]` | 뒤에서 N번째 | `[len-N]` |

#### 다차원 배열

인덱스를 연속으로 사용하여 중첩 배열에 접근합니다:

```go
data := `{"matrix": [[1, 2, 3], [4, 5, 6], [7, 8, 9]]}`

val := json.GetInt(data, "matrix[0][0]")   // 1
val = json.GetInt(data, "matrix[1][2]")    // 6
val = json.GetInt(data, "matrix[-1][-1]")  // 9
```

#### 경계 동작

범위를 벗어난 인덱스는 panic을 발생시키지 않습니다. 타입 안전 가져오기 함수(GetString, GetInt 등)는 zero 값을 반환하고, Get 함수는 오류를 반환합니다:

```go
data := `{"items": ["a", "b", "c"]}`

// 양수 인덱스 범위 초과 → zero 값 반환, 오류 없음
json.GetString(data, "items[10]")   // ""   (빈 문자열)
json.GetInt(data, "items[10]")      // 0
json.Get(data, "items[10]")         // nil, ErrPathNotFound

// 음수 인덱스 범위 초과 → 마찬가지로 zero 값 반환
json.GetString(data, "items[-10]")  // ""   (빈 문자열)
json.GetInt(data, "items[-10]")     // 0
```

| 함수 | 범위 초과 시 반환값 |
|------|-----------|
| `Get` | `(nil, ErrPathNotFound)` |
| `GetString` | `""` |
| `GetInt` | `0` |
| `GetFloat` | `0.0` |
| `GetBool` | `false` |
| `GetArray` | `nil` |

:::tip 인덱스 경계
- 양수 인덱스는 `[0, len)` 범위 내에 있어야 하며, 음수 인덱스도 변환 후(`len + index`) 동일합니다
- 범위 초과 접근은 해당 타입의 zero 값을 반환하며, panic이나 오류를 발생시키지 않습니다
- 경로 존재 여부를 확인하려면 `Get`을 사용하고 error가 `json.ErrPathNotFound`인지 확인하세요
:::

---

## 고급 문법

### 배열 슬라이스 `[start:end:step]`

배열에서 하위 배열을 추출합니다. Python 스타일의 슬라이스 문법 `[start:end:step]`을 사용하며, 세 매개변수 모두 생략 가능합니다:

| 매개변수 | 설명 | 생략 시 기본값 |
|------|------|-------------|
| `start` | 시작 인덱스 (포함) | `0` (양수 step) 또는 `len-1` (음수 step) |
| `end` | 끝 인덱스 (미포함) | `len` (양수 step) 또는 `-1` (음수 step) |
| `step` | 간격 | `1` |

#### 슬라이스 문법 속성표

| 문법 | 의미 | 예제 (`[0,1,2,3,4]`) | 결과 |
|------|------|----------------------|------|
| `[:]` | 전체 복사 | `[0,1,2,3,4][:]` | `[0,1,2,3,4]` |
| `[N:]` | N부터 끝까지 | `[0,1,2,3,4][2:]` | `[2,3,4]` |
| `[:N]` | 처음부터 N까지 | `[0,1,2,3,4][:3]` | `[0,1,2]` |
| `[N:M]` | N부터 M-1까지 | `[0,1,2,3,4][1:4]` | `[1,2,3]` |
| `[::S]` | S 간격으로 하나씩 | `[0,1,2,3,4][::2]` | `[0,2,4]` |
| `[N::S]` | N부터, 간격 S | `[0,1,2,3,4][1::2]` | `[1,3]` |
| `[:M:S]` | 처음부터 M까지, 간격 S | `[0,1,2,3,4][:4:2]` | `[0,2]` |
| `[N:M:S]` | 완전한 3매개변수 | `[0,1,2,3,4][0:5:2]` | `[0,2,4]` |
| `[::-1]` | 배열 뒤집기 | `[0,1,2,3,4][::-1]` | `[4,3,2,1,0]` |
| `[::-S]` | 역방향 간격 | `[0,1,2,3,4][::-2]` | `[4,2,0]` |

#### 정방향 슬라이스

```go
data := `{"numbers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}`

// 기본 슬라이스
slice := json.GetArray(data, "numbers[2:5]")    // [2, 3, 4]

// start 생략 (처음부터)
slice2 := json.GetArray(data, "numbers[:3]")      // [0, 1, 2]

// end 생략 (끝까지)
slice3 := json.GetArray(data, "numbers[7:]")      // [7, 8, 9]

// 간격 2 (짝수 인덱스 요소)
slice4 := json.GetArray(data, "numbers[::2]")     // [0, 2, 4, 6, 8]

// 완전한 매개변수
slice5 := json.GetArray(data, "numbers[1:8:3]")   // [1, 4, 7]

// 전체 복사
slice6 := json.GetArray(data, "numbers[:]")       // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
```

#### 음수 인덱스 슬라이스

슬라이스의 `start`와 `end` 모두 음수 인덱스를 지원합니다:

```go
data := `{"numbers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}`

// 마지막 3개 요소 가져오기
json.GetArray(data, "numbers[-3:]")    // [7, 8, 9]

// 마지막 2개 요소 제거
json.GetArray(data, "numbers[:-2]")    // [0, 1, 2, 3, 4, 5, 6, 7]

// 뒤에서 5번째부터 뒤에서 2번째까지
json.GetArray(data, "numbers[-5:-2]")  // [5, 6, 7]

// 인덱스 2부터 마지막 1개 전까지 (마지막 제외)
json.GetArray(data, "numbers[2:-1]")   // [2, 3, 4, 5, 6, 7, 8]
```

#### 역방향 슬라이스

음수 step으로 역방향 순회를 구현합니다:

```go
data := `{"letters": ["a", "b", "c", "d", "e"]}`

// 배열 뒤집기
json.GetArray(data, "letters[::-1]")    // ["e", "d", "c", "b", "a"]

// 역방향 간격 2
json.GetArray(data, "letters[::-2]")    // ["e", "c", "a"]

// 인덱스 3에서 1까지 (역방향)
json.GetArray(data, "letters[3:1:-1]")  // ["d", "c"]

// 끝에서 역방향으로 앞의 3개 가져오기
json.GetArray(data, "letters[2::-1]")   // ["c", "b", "a"]
```

#### 경계 동작

슬라이스는 범위를 벗어난 인덱스를 자동으로 잘라내며(clamp), 오류를 반환하지 않습니다:

```go
data := `{"items": [0, 1, 2]}`

// 범위 초과 start/end는 유효 범위로 자동 조정
json.GetArray(data, "items[0:100]")   // [0, 1, 2]  (end가 len=3으로 조정)
json.GetArray(data, "items[10:20]")   // []         (start >= end, 빈 결과)

// start >= end인 경우 빈 배열 반환
json.GetArray(data, "items[2:2]")     // []
json.GetArray(data, "items[3:1]")     // []
```

:::warning 슬라이스 vs 인덱스의 경계 처리 차이
- **인덱스 범위 초과** (예: `items[10]`)는 해당 타입의 zero 값을 반환하며, 오류를 발생시키지 않습니다
- **슬라이스 범위 초과** (예: `items[10:20]`)는 자동으로 잘라내어 빈 배열을 반환하며, 오류를 발생시키지 않습니다
:::

### 필드 추출 `{field1,field2}`

객체에서 특정 필드만 추출합니다:

```go
data := `{
    "user": {
        "id": 1001,
        "name": "Alice",
        "email": "alice@example.com",
        "password": "secret",
        "age": 25
    }
}`

// id와 name만 추출
extracted, _ := json.Get(data, "user{id,name}")
// 결과: {"id": 1001, "name": "Alice"}
```

### 평탄화 추출 `{flat:field}`

배열 객체의 필드에서 값을 추출할 때, 필드 자체도 배열인 경우 일반 추출은 중첩 배열을 생성합니다. `{flat:}` 접두사를 사용하면 모든 중첩 배열을 재귀적으로 펼쳐 하나의 평평한 결과 배열을 얻을 수 있습니다.

#### 일반 추출 vs 평탄화 추출

```go
data := `{
    "groups": [
        {"tags": ["go", "json"]},
        {"tags": ["python", "yaml"]}
    ]
}`

// 일반 추출 → 중첩 배열
json.GetArray(data, "groups{tags}")
// [["go", "json"], ["python", "yaml"]]

// 평탄화 추출 → 1차원 배열로 펼치기
json.GetArray(data, "groups{flat:tags}")
// ["go", "json", "python", "yaml"]
```

#### 체인 평탄화 추출

다중 레벨 중첩 배열은 `{flat:}`을 연속으로 사용하여 레이어별로 펼칠 수 있습니다:

```go
data := `{
    "departments": [
        {
            "teams": [
                {"members": [{"name": "Alice"}, {"name": "Bob"}]}
            ]
        },
        {
            "teams": [
                {"members": [{"name": "Carol"}]}
            ]
        }
    ]
}`

// 3단계 평탄화: departments → teams → members → name
json.GetArray(data, "departments{flat:teams}{flat:members}{name}")
// ["Alice", "Bob", "Carol"]
```

#### 평탄화 추출 후 다른 작업 연결

평탄화 추출 결과는 슬라이스, 인덱스 등의 작업을 계속해서 사용할 수 있습니다:

```go
data := `{
    "orders": [
        {"items": ["book", "pen"]},
        {"items": ["laptop", "mouse", "keyboard"]},
        {"items": ["cup"]}
    ]
}`

// 평탄화 후 슬라이스
json.GetArray(data, "orders{flat:items}[0:3]")
// ["book", "pen", "laptop"]
```

:::info 제한 사항
- `{flat:field1,field2}` 다중 필드 추출 시 `flat` 플래그는 적용되지 않습니다. 다중 필드 추출은 배열이 아닌 객체를 생성하기 때문입니다
- 평탄화는 첫 번째 레이어뿐만 아니라 모든 레벨의 중첩 배열을 재귀적으로 펼칩니다
:::

### 추가 작업 `[+]`

배열 끝에 요소를 추가합니다:

```go
data := `{"items": [1, 2, 3]}`

updated, _ := json.Set(data, "items[+]", 4)
// 결과: {"items": [1, 2, 3, 4]}

updated, _ = json.Set(updated, "items[+]", 5)
// 결과: {"items": [1, 2, 3, 4, 5]}
```

### 와일드카드 `[*]`

```go
data := `{"items": [1, 2, 3]}`

updated, _ := json.Set(data, "items[*]", 0)
// 결과: {"items": [0, 0, 0]}
```

---

## 경로 검증

### Processor를 통한 경로 검증

`Processor.CompilePath`를 사용하여 경로 형식이 올바른지 검증합니다:

```go
p, err := json.New()
if err != nil {
    panic(err)
}

// 경로 컴파일 (자동으로 형식 검증)
cp, err := p.CompilePath("user.profile.name")
if err != nil {
    fmt.Println("잘못된 경로:", err)
}

cp, err = p.CompilePath("items[0:10:2]")
if err != nil {
    fmt.Println("잘못된 경로:", err)
}
```

---

## 특수 경로

### 루트 경로

빈 문자열 `""` 또는 `"."`은 루트를 나타냅니다:

```go
data := `{"name": "test"}`

// 전체 객체 가져오기
root, _ := json.Get(data, "")     // {"name": "test"}
root, _ = json.Get(data, ".")     // 동일
```

### 경로 이스케이프

키 이름에 특수 문자가 포함된 경우 이스케이프를 사용합니다:

```go
data := `{"user.name": "Alice"}`

// 점이 포함된 키 이름
name := json.GetString(data, "user\\.name")  // "Alice"
```

---

## 경로 세그먼트 타입

라이브러리는 내부적으로 경로를 다양한 타입의 세그먼트로 파싱합니다 (내부 구현 세부사항으로, 공개 API로 내보내지 않음):

| 타입 | 문법 예제 | 설명 |
|------|----------|------|
| 속성 접근 | `user.name` | 객체 속성에 접근 |
| 배열 인덱스 | `items[0]` | 배열 요소에 접근 |
| 배열 슬라이스 | `items[1:5]` | 슬라이스 범위 접근 |
| 와일드카드 | `items[*]` | 모든 요소 매칭 |
| 필드 추출 | `{name,email}` | 여러 필드 추출 |
| 평탄화 추출 | `{flat:tags}` | 추출 후 중첩 배열 재귀 펼치기 |
| 추가 작업 | `items[+]` | 배열에 요소 추가 |

---

## 완전한 예제

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "store": {
            "books": [
                {"title": "Go 101", "price": 25, "category": "programming"},
                {"title": "JSON Guide", "price": 35, "category": "programming"},
                {"title": "Clean Code", "price": 45, "category": "programming"}
            ],
            "prices": [10, 20, 30, 40, 50]
        }
    }`

    // 1. 기본 접근
    title := json.GetString(data, "store.books.0.title")
    fmt.Println("첫 번째 책:", title)

    // 2. 배열 슬라이스
    books := json.GetArray(data, "store.books[0:2]")
    fmt.Printf("첫 2권: %d개 항목\n", len(books))

    // 3. 간격 있는 슬라이스
    prices := json.GetArray(data, "store.prices[::2]")
    fmt.Println("\n하나 건너 가격:", prices)

    // 4. 필드 추출
    extracted, _ := json.Get(data, "store.books[0]{title,price}")
    fmt.Println("\n추출된 필드:", extracted)

    // 5. 요소 추가
    updated, _ := json.Set(data, "store.books[+]", map[string]any{
        "title":    "New Book",
        "price":    55,
        "category": "programming",
    })
    fmt.Println("\n추가 후:", json.Valid([]byte(updated)))
}
```

## 다음 단계

- [API 문서](./api-reference/) — 완전한 API 참조 보기
- [사용 예제](./examples) — 더 많은 실전 예제
