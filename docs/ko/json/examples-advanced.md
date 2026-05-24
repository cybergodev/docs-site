---
title: "고급 기능 예제 - CyberGo JSON | 심화 사용법"
description: "CyberGo JSON 고급 기능 실전 예제 모음으로, 배치 인코딩 EncodeBatch, 필드 선택 EncodeFields, 사전 파싱 PreParse, 안전 가져오기 SafeGet, 캐시 웜업 WarmupCache 및 메모리 풀 최적화 등의 기법을 다루며, 라이브러리의 고급 사용법과 프로덕션급 성능 최적화 전략과 모범 사례를 보여줍니다."
---

# 고급 기능 예제

이 문서는 배치 인코딩, 사전 파싱, 훅, 고급 설정 등 고급 기능의 완전한 예제를 제공합니다.

## 배치 인코딩

### EncodeBatch

여러 키-값 쌍을 JSON 객체로 빠르게 인코딩합니다:

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 분산된 데이터에서 JSON 구성
    pairs := map[string]any{
        "id":      1001,
        "name":    "Alice",
        "email":   "alice@example.com",
        "active":  true,
        "tags":    []string{"admin", "user"},
        "balance": 1250.50,
    }

    // EncodeBatch로 JSON 객체에 배치 인코딩
    result, err := json.EncodeBatch(pairs)
    if err != nil {
        panic(err)
    }
    fmt.Println(result)

    // EncodeBatch와 PrettyConfig를 조합하여 포맷팅 출력
    pretty, err := json.EncodeBatch(pairs, json.PrettyConfig())
    if err != nil {
        panic(err)
    }
    fmt.Println(pretty)
}
```

## 선택 필드 인코딩

### EncodeFields

구조체의 지정된 필드만 인코딩합니다. API 응답에서 민감한 정보를 필터링하는 데 적합합니다:

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type User struct {
    ID       int    `json:"id"`
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
    Salt     string `json:"salt"`
}

func main() {
    user := User{
        ID:       1,
        Name:     "Alice",
        Email:    "alice@example.com",
        Password: "secret123",
        Salt:     "randomsalt",
    }

    // 공개 필드만 인코딩 (민감한 정보 제외)
    publicFields := []string{"id", "name", "email"}
    result, err := json.EncodeFields(user, publicFields)
    if err != nil {
        panic(err)
    }
    fmt.Println(result)
    // {"id":1,"name":"Alice","email":"alice@example.com"}
}
```

## 사전 파싱 최적화
### PreParse
JSON을 미리 파싱하여 반복 파싱을 피하고 여러 쿼리의 성능을 향상시킵니다:
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 대용량 JSON 데이터
    largeJSON := `{
        "users": [
            {"id": 1, "name": "Alice", "email": "alice@example.com"},
            {"id": 2, "name": "Bob", "email": "bob@example.com"},
            {"id": 3, "name": "Charlie", "email": "charlie@example.com"}
        ],
        "metadata": {
            "total": 3,
            "page": 1,
            "perPage": 10
        }
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 사전 파싱 (한 번만 파싱)
    parsed, err := p.PreParse(largeJSON)
    if err != nil {
        panic(err)
    }

    // 여러 쿼리에서 사전 파싱 결과 재사용
    total, _ := p.GetFromParsed(parsed, "metadata.total")
    page, _ := p.GetFromParsed(parsed, "metadata.page")

    // 사용자 순회
    for i := 0; i < 3; i++ {
        path := fmt.Sprintf("users.%d.name", i)
        name, _ := p.GetFromParsed(parsed, path)
        fmt.Printf("사용자 %d: %v\n", i, name)
    }

    fmt.Printf("총: %v, 페이지: %v\n", total, page)
}
```

## 안전한 가져오기
### SafeGet
구조화된 결과를 반환하며, 체인 호출과 타입 변환을 지원합니다:
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "user": {
            "id": 1001,
            "name": "Alice",
            "age": 28,
            "active": true,
            "balance": 1250.50
        }
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 단일 필드 안전하게 가져오기
    nameResult := p.SafeGet(data, "user.name")
    if nameResult.Ok() {
        name, _ := nameResult.AsString()
        fmt.Println("이름:", name)
    }

    // 안전하게 가져오고 타입 변환
    ageResult := p.SafeGet(data, "user.age")
    if ageResult.Ok() {
        age, _ := ageResult.AsInt()
        fmt.Println("나이:", age)
    }

    // 불리언 값 안전하게 가져오기
    activeResult := p.SafeGet(data, "user.active")
    if activeResult.Ok() {
        active, _ := activeResult.AsBool()
        fmt.Println("활성:", active)
    }

    // 존재하지 않는 경로는 panic을 발생시키지 않음
    emailResult := p.SafeGet(data, "user.email")
    fmt.Println("이메일 존재:", emailResult.Ok()) // false

    // 기본값 사용
    email := emailResult.UnwrapOr("N/A")
    fmt.Println("이메일:", email)
}
```

## 캐시 웜업
### WarmupCache
자주 사용하는 경로의 캐시를 미리 준비하여 후속 쿼리 성능을 향상시킵니다:
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 대용량 JSON 데이터 (시뮬레이션)
    largeJSON := `{
        "products": [
            {"id": 1, "name": "Product A", "price": 100},
            {"id": 2, "name": "Product B", "price": 200},
            {"id": 3, "name": "Product C", "price": 300}
        ],
        "categories": ["electronics", "books", "clothing"],
        "settings": {"currency": "USD", "taxRate": 0.1}
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 자주 사용하는 경로 정의
    commonPaths := []string{
        "products",
        "products.0.id",
        "products.0.name",
        "products.1.id",
        "products.1.name",
        "categories",
        "settings.currency",
    }

    // 캐시 웜업
    result, err := p.WarmupCache(largeJSON, commonPaths)
    if err != nil {
        panic(err)
    }

    fmt.Printf("웜업 완료: %d/%d 성공\n", result.Successful, result.TotalPaths)
    if len(result.FailedPaths) > 0 {
        fmt.Println("실패한 경로:", result.FailedPaths)
    }

    // 이후 쿼리는 캐시를 사용
    for i := 0; i < 3; i++ {
        path := fmt.Sprintf("products.%d.name", i)
        name := p.GetString(largeJSON, path)
        fmt.Printf("상품 %d: %s\n", i, name)
    }
}
```

## 배치 작업
### ProcessBatch
여러 작업을 배치로 실행하여 효율성을 높입니다:
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}`

    // 배치 작업 정의
    operations := []json.BatchOperation{
        {Type: "get", Path: "users.0.name", JSONStr: data},
        {Type: "get", Path: "users", JSONStr: data},
        {Type: "set", Path: "users.0.name", Value: "Updated", JSONStr: data},
        {Type: "delete", Path: "users.0.id", JSONStr: data},
    }

    // 배치 작업 실행
    results, err := json.ProcessBatch(operations)
    if err != nil {
        panic(err)
    }

    // 결과 확인
    for _, r := range results {
        fmt.Printf("ID: %s\n", r.ID)
        if r.Error != nil {
            fmt.Printf("  오류: %v\n", r.Error)
        } else if r.Result != nil {
            fmt.Printf("  값: %v\n", r.Result)
        }
    }
}
```

## 키-값 메모리 최적화

라이브러리는 내부적으로 문자열 메모리 풀(string interning)을 사용하여 중복 키-값의 메모리 사용을 자동으로 최적화합니다. 수동 관리가 필요하지 않습니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 라이브러리는 내부적으로 중복 키-값에 메모리 풀을 자동 사용
    // 대량의 데이터를 처리할 때 중복 문자열 키-값이 자동으로 메모리를 재사용
    records := make([]map[string]any, 10000)
    for i := range records {
        records[i] = map[string]any{
            "status": "active",
            "type":   "user",
            "role":   "member",
        }
    }

    // 배치 인코딩 시 라이브러리가 내부적으로 메모리 최적화
    result, _ := json.Marshal(map[string]any{
        "status": "active",
        "type":   "user",
    })

    fmt.Println("샘플:", string(result))
}
```

## 다음 단계
- [경로 표현식 문법](./path-syntax) — 전체 경로 문법 참조하세요
- [대용량 파일 처리](./large-files) — 스트림 처리 안내서
- [API 문서](./api-reference/) — 전체 API 참조하세요
