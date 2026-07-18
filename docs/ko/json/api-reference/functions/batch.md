---
sidebar_label: "배치 작업"
title: "배치 작업 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 배치 작업 함수: ProcessBatch로 여러 작업을 한 번에 처리하고 BatchOperation, BatchResult 구조체로 배치 처리를 제공합니다."
sidebar_position: 7
---

# 배치 작업 함수

json 패키지가 제공하는 배치 작업 함수로, 여러 JSON 작업(get/set/delete/validate)을 한 번에 처리하며 배치 데이터 처리 시나리오에 적합합니다.

## 배치 작업

### ProcessBatch

시그니처: `func ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

여러 JSON 작업을 배치로 처리합니다 (패키지 레벨 함수, Processor 생성 불필요).

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

    operations := []json.BatchOperation{
        {Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
        {Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
    }

    results, err := json.ProcessBatch(operations)
    if err != nil {
        panic(err)
    }
    for _, r := range results {
        if r.Error != nil {
            fmt.Printf("작업 %s 실패: %v\n", r.ID, r.Error)
        } else {
            fmt.Printf("작업 %s 결과: %v\n", r.ID, r.Result)
        }
    }
}
```

### BatchOperation

배치 작업 설명 구조체입니다.

```go
type BatchOperation struct {
    Type    string `json:"type"`     // 작업 유형: "get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // 대상 JSON 문자열
    Path    string `json:"path"`     // 경로 표현식
    Value   any    `json:"value"`    // 작업 값 (set 작업에서 사용)
    ID      string `json:"id"`       // 작업 식별자
}
```

### BatchResult

배치 작업 결과 구조체입니다.

```go
type BatchResult struct {
    ID     string `json:"id"`     // 작업 식별자
    Result any    `json:"result"` // 작업 결과
    Error  error  `json:"error"`  // 오류 정보
}
```

:::tip Processor 배치 메서드
Processor 인스턴스는 패키지 레벨 함수와 동일한 시그니처의 배치 메서드 `p.ProcessBatch(operations)`를 제공하여, Processor를 재사용하는 시나리오에 적합합니다. 자세한 내용은 [Processor 배치 작업](../processor/batch)을 참조하세요.
:::

## 관련 문서

- [수정 함수](./modify) - Set, MergeJSON 등 수정 작업
- [Processor 배치 작업](../processor/batch) - Processor 수준 배치 작업 메서드 자세히
