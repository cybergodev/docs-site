---
title: "Processor 배치 작업 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON Processor 배치 작업: ProcessBatch, BatchOperation, BatchResult, ContinueOnError 설정과 성능 최적화로 배치 데이터 처리에 적합합니다."
---

# 배치 작업 메서드

Processor는 배치 작업 능력을 제공하여, 한 번에 여러 JSON 작업을 처리합니다.

## ProcessBatch

시그니처: `func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

여러 JSON 작업을 배치로 처리합니다.

```go
operations := []json.BatchOperation{
    {Type: "get", JSONStr: data, Path: "user.name", ID: "1"},
    {Type: "set", JSONStr: data, Path: "user.age", Value: 30, ID: "2"},
    {Type: "delete", JSONStr: data, Path: "user.temporary", ID: "3"},
}

results, err := processor.ProcessBatch(operations)
if err != nil {
    panic(err)
}

for _, result := range results {
    fmt.Printf("ID: %s, 결과: %v\n", result.ID, result.Result)
}
```

## BatchOperation 구조체

```go
type BatchOperation struct {
    Type    string `json:"type"`     // 작업 타입: "get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // JSON 문자열
    Path    string `json:"path"`     // 대상 경로
    Value   any    `json:"value"`    // Set 작업의 값
    ID      string `json:"id"`       // 작업 식별자
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `Type` | `string` | 작업 타입: `get`, `set`, `delete`, `validate` |
| `JSONStr` | `string` | 작업할 JSON 문자열 |
| `Path` | `string` | 대상 경로 |
| `Value` | `any` | Set 작업 시 설정할 값 |
| `ID` | `string` | 작업 식별자, 결과 매칭에 사용 |

## BatchResult 구조체

```go
type BatchResult struct {
    ID     string `json:"id"`     // 해당 작업의 ID
    Result any    `json:"result"` // 작업 결과
    Error  error  `json:"error"`  // 오류 (있는 경우)
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `ID` | `string` | 해당 BatchOperation의 ID |
| `Result` | `any` | 작업 결과 (Get은 반환값, Set/Delete는 새 JSON 반환) |
| `Error` | `error` | 개별 작업의 오류 (다른 작업에 영향 없음) |

## 사용 예제

### 배치 읽기

```go
operations := []json.BatchOperation{
    {Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
    {Type: "get", JSONStr: data, Path: "user.email", ID: "email"},
    {Type: "get", JSONStr: data, Path: "user.age", ID: "age"},
}

results, _ := processor.ProcessBatch(operations)
for _, r := range results {
    fmt.Printf("%s: %v\n", r.ID, r.Result)
}
```

### 배치 수정

```go
operations := []json.BatchOperation{
    {Type: "set", JSONStr: data, Path: "status", Value: "active", ID: "1"},
    {Type: "set", JSONStr: data, Path: "updated_at", Value: time.Now().Unix(), ID: "2"},
    {Type: "delete", JSONStr: data, Path: "temp_field", ID: "3"},
}

results, _ := processor.ProcessBatch(operations)
```

### 혼합 작업

```go
operations := []json.BatchOperation{
    {Type: "validate", JSONStr: data, ID: "check"},
    {Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
    {Type: "set", JSONStr: data, Path: "processed", Value: true, ID: "mark"},
}

results, _ := processor.ProcessBatch(operations)

// 검증 결과 확인
for _, r := range results {
    if r.ID == "check" {
        if m, ok := r.Result.(map[string]any); ok {
            fmt.Printf("검증 결과: %v\n", m["valid"])
        }
    }
}
```

## 주의 사항

1. 각 작업은 독립적으로 실행되며, 하나의 실패가 다른 작업에 영향을 주지 않습니다
2. 결과 순서는 작업 순서와 일치합니다
3. ID로 작업과 결과를 매칭합니다

## 관련 문서

- [경로 쿼리](./query) - Get 시리즈 메서드
- [데이터 수정](./modify) - Set/Delete 메서드
