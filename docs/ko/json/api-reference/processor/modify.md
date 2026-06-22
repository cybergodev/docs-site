---
title: "Processor 데이터 수정 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON Processor 수정 메서드: Set, SetMultiple, SetCreate 자동 경로 생성, Delete, DeleteClean으로 메서드 체이닝을 지원합니다."
---

# 데이터 수정 메서드

Processor는 데이터 수정 메서드를 제공하며, 모든 메서드는 수정된 JSON 문자열을 반환합니다.

## Set

시그니처: `func (p *Processor) Set(jsonStr, path string, value any, cfg ...Config) (string, error)`

지정된 경로에 값을 설정하고, 수정된 JSON 문자열을 반환합니다.

```go
result, err := p.Set(data, "user.name", "NewName")
```

다양한 타입의 값 설정을 지원합니다:

```go
// 문자열
result, _ := p.Set(data, "user.name", "CyberGo")

// 숫자
result, _ = p.Set(data, "user.age", 25)

// 불리언
result, _ = p.Set(data, "user.active", true)

// 객체
result, _ = p.Set(data, "user.profile", map[string]any{
    "bio": "Developer",
    "location": "China",
})

// 배열
result, _ = p.Set(data, "items", []any{"a", "b", "c"})
```

## Delete

시그니처: `func (p *Processor) Delete(jsonStr, path string, cfg ...Config) (string, error)`

지정된 경로의 값을 삭제하고, 수정된 JSON 문자열을 반환합니다.

```go
result, err := p.Delete(data, "user.temporary")
```

## DeleteClean

시그니처: `func (p *Processor) DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

지정된 경로를 삭제하고 빈 값과 빈 배열을 자동으로 정리합니다.

```go
result, err := p.DeleteClean(data, "user.temporary")
// 삭제 후 생성된 null과 빈 배열을 정리
```

**Delete와 DeleteClean의 차이**:

```go
// 원본 데이터: {"user": {"temp": "value", "name": "test"}}

// Delete 후: {"user": {"name": "test"}}
result, _ := p.Delete(data, "user.temp")

// 삭제 후 부모 객체가 비어있으면 DeleteClean은 계속 정리
// {"user": {}} -> {}
result, _ = p.DeleteClean(data, "user.temp")
```

## SetMultiple

시그니처: `func (p *Processor) SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

여러 경로의 값을 배치로 설정하고, 수정된 JSON 문자열을 반환합니다.

```go
result, err := p.SetMultiple(data, map[string]any{
    "user.name": "CyberGo",
    "user.age":  25,
    "user.active": true,
})
```

## SetCreate

시그니처: `func (p *Processor) SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

값을 설정하고 존재하지 않는 중간 경로를 자동으로 생성합니다. `Config.CreatePaths = true`의 `Set`과 동일합니다.

```go
// 중간 경로 user.profile이 존재하지 않으면 자동으로 생성
result, err := p.SetCreate(data, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

## SetMultipleCreate

시그니처: `func (p *Processor) SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

여러 값을 배치로 설정하고 중간 경로를 자동으로 생성합니다.

```go
result, err := p.SetMultipleCreate(data, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

## 체인 수정

수정 메서드는 체인 호출을 지원합니다:

```go
processor, _ := json.New()

result1, _ := processor.Set(data, "user.name", "CyberGo")
result2, _ := processor.Set(result1, "user.version", "1.0.0")
finalResult, _ := processor.Delete(result2, "user.temporary")
```

## 관련 문서

- [경로 쿼리](./query) - Get 시리즈 메서드
- [배치 작업](./batch) - ProcessBatch 배치 처리
