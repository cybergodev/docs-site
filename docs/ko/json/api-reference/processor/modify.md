---
sidebar_label: "수정"
title: "Processor 데이터 수정 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON Processor 수정 메서드: Set 설정, SetMultiple 배치, SetCreate 자동 경로 생성, SetMultipleCreate 배치 생성, 모든 메서드가 체인 호출 지원."
sidebar_position: 3
---

# 데이터 수정 메서드

Processor는 데이터 수정 메서드를 제공하며, 모든 메서드는 수정된 JSON 문자열을 반환합니다. 삭제 메서드는 [삭제 작업](./delete)을 참고하세요.

## Set

시그니처: `func (p *Processor) Set(jsonStr, path string, value any, cfg ...Config) (result string, err error)`

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

## Processor 병합 메서드

Processor는 패키지 레벨 [MergeJSON](../functions/modify#mergejson), [MergeMany](../functions/modify#mergemany), [CompareJSON](../helpers#comparejson)에 대응하는 인스턴스 메서드를 제공합니다.

### Processor.MergeJSON

시그니처: `func (p *Processor) MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

cfg에서 옵션을 파싱하여(**cfg 생략 시 프로세서 자체 설정이 아닌 DefaultConfig 사용** — 프로세서를 커스텀 MergeMode로 생성한 경우, 해당 모드를 적용하려면 cfg를 명시적으로 전달해야 함), `Config.MergeMode`에 따라 두 객체를 깊이 병합한 뒤 이 프로세서로 결과를 다시 인코딩합니다.

패키지 레벨 함수와 마찬가지로 `Processor.MergeJSON`은 보안 검증을 수행하지 않습니다 — 디코딩, 깊은 병합, 재인코딩만 하는 구조적 도구입니다. 보안 검증이 필요하면 `CompareJSON`을 사용하세요 (항상 보안 검증 수행; cfg 전달 시 cfg에 따라, 그렇지 않으면 프로세서 자체 설정에 따라).

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 통합 병합 (기본값)
result, err := p.MergeJSON(base, override)

// 교집합 병합
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err = p.MergeJSON(base, override, cfg)
```

### Processor.MergeMany

시그니처: `func (p *Processor) MergeMany(jsons []string, cfg ...Config) (string, error)`

`MergeJSON`으로 슬라이스를 왼쪽에서 오른쪽으로 접으며, 병합 전략은 `Config.MergeMode`가 결정합니다 (기본값 `MergeUnion`). JSON 문자열이 2개 미만이면 오류를 반환하고, 어느 병합 단계가 실패하면 실패한 인덱스를 담은 오류를 반환합니다.

```go
result, err := p.MergeMany([]string{config1, config2, config3})
```

### Processor.CompareJSON

시그니처: `func (p *Processor) CompareJSON(json1, json2 string, cfg ...Config) (bool, error)`

두 JSON 문자열이 같은지 비교합니다 (숫자 정규화, 키 순서 무관).

::: warning 패키지 레벨 CompareJSON과의 차이
패키지 레벨 `CompareJSON`은 cfg가 없을 때 보안 검증을 수행하지 않고 양쪽을 `encoding/json`으로 마샬링합니다; Processor 메서드는 **항상** 보안 검증을 수행 (cfg 전달 시 cfg에 따라, 그렇지 않으면 프로세서 자체 설정에 따라)하며, 라이브러리 인코더로 양쪽을 대칭 마샬링하여 설정된 인코딩(예: `EscapeHTML`)이 대칭적으로 적용되게 합니다.
:::

```go
equal, err := p.CompareJSON(a, b)
equal, err = p.CompareJSON(a, b, json.SecurityConfig())
```

## 관련 문서

- [경로 쿼리](./query) - Get 시리즈 메서드
- [삭제 작업](./delete) - Delete/DeleteClean 메서드
- [배치 작업](./batch) - ProcessBatch 배치 처리
