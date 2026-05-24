---
title: "Processor 프로세서 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON Processor 프로세서 완전 레퍼런스: New 인스턴스 생성, GetString/Set/Delete 데이터 작업, Foreach 반복, Encode 인코딩, Close 수명 주기 관리, Stats 통계 및 캐시 설정을 포함하며, 고빈도 JSON 작업 및 데이터 처리 재사용 시나리오에 적합합니다."
---

# Processor

Processor는 고성능, 커스텀 가능성, 유연한 재사용 능력을 제공하여 동일한 데이터 소스에 대한 여러 작업에 적합합니다.

## 특징

- **고성능**: 내부 캐시 메커니즘으로 반복 작업이 더 효율적
- **설정 가능**: 다양한 설정 옵션 지원
- **체인 호출**: 메서드가 수정된 JSON을 반환하여 연속 작업 지원
- **리소스 관리**: 명시적인 수명 주기 제어

## Processor 생성

### New

시그니처: `func New(cfg ...Config) (*Processor, error)`

Processor 인스턴스를 생성합니다. 선택적 Config 매개변수로 프로세서를 설정합니다.

```go
// 기본 설정 사용
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// 커스텀 설정 사용
cfg := json.DefaultConfig()
cfg.StrictMode = true
processor, err := json.New(cfg)

// 보안 설정 사용
processor, err := json.New(json.SecurityConfig())
```

## 체인 호출

Processor 메서드는 수정된 JSON 문자열을 반환하여 연속 작업을 지원합니다:

```go
processor, _ := json.New()

// 여러 값 설정
result1, _ := processor.Set(data, "user.name", "CyberGo")
result2, _ := processor.Set(result1, "user.version", "1.0.0")
finalResult, _ := processor.Delete(result2, "user.temporary")
```

## API 목록

| 카테고리 | 설명 |
|------|------|
| [경로 쿼리](./query) | GetString/Int/Float/Bool/Get/GetWithContext/SafeGet/GetArray/GetObject/GetMultiple/CompilePath/GetCompiled |
| [데이터 수정](./modify) | Set/SetMultiple/SetCreate/SetMultipleCreate/Delete/DeleteClean |
| [출력 메서드](./output) | Encode/EncodePretty/EncodeWithConfig/Compact/Indent/HTMLEscape/EncodeBatch/EncodeFields/EncodeStream |
| [파싱 및 로드](./parse) | Parse/ParseAny/Valid/ValidBytes/Marshal/Unmarshal/LoadFromFile/LoadFromReader/SaveToFile/MarshalToFile/SaveToWriter/UnmarshalFromFile |
| [반복 메서드](./iterate) | Foreach/ForeachWithPath/ForeachNested/ForeachWithError/ForeachNestedWithError/ForeachWithPathAndIterator/ForeachFile/ForeachFileWithPath/ForeachFileChunked/ForeachFileNested |
| [배치 작업](./batch) | ProcessBatch/WarmupCache |
| [JSONL 처리](./jsonl) | StreamJSONL/Parallel/Chunked/Map/Reduce/Filter |
| [수명 주기](./lifecycle) | Close/IsClosed/GetConfig/AddHook/ClearCache/GetStats/GetHealthStatus |

---

## 전역 프로세서 관리

패키지 레벨 함수는 내부 전역 프로세서를 사용합니다. 다음 함수로 관리할 수 있습니다:

### SetGlobalProcessor

시그니처: `func SetGlobalProcessor(processor *Processor)`

커스텀 전역 프로세서를 설정합니다. 모든 패키지 레벨 함수(Get, Set, Marshal 등)가 해당 프로세서를 사용합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `processor` | `*Processor` | 커스텀 프로세서 인스턴스 |

```go
package main

import (
    "github.com/cybergodev/json"
)

func main() {
    // 커스텀 설정의 프로세서 생성
    cfg := json.SecurityConfig()
    processor, err := json.New(cfg)
    if err != nil {
        panic(err)
    }

    // 전역 프로세서로 설정
    json.SetGlobalProcessor(processor)

    // 이제 모든 패키지 레벨 함수가 보안 설정을 사용
    data, err := json.Get(`{"name":"Alice"}`, "name")
    // SecurityConfig의 제한이 적용됨
    _ = data
}
```

:::warning 주의
- `nil`을 전달하면 아무 작업도 수행하지 않습니다
- 이전 전역 프로세서는 자동으로 닫힙니다
- 이 함수는 스레드 안전합니다
:::

### ShutdownGlobalProcessor

시그니처: `func ShutdownGlobalProcessor()`

전역 프로세서를 닫고 제거합니다. 이후 패키지 레벨 작업은 새로운 기본 프로세서를 생성합니다.

```go
package main

import (
    "github.com/cybergodev/json"
)

func main() {
    // 전역 프로세서 사용
    data, _ := json.Get(`{"key":"value"}`, "key")
    _ = data

    // 애플리케이션 종료 시 정리
    json.ShutdownGlobalProcessor()

    // 이후 작업은 새로운 기본 프로세서를 생성
    data2, _ := json.Get(`{"key":"value2"}`, "key")
    _ = data2
}
```

:::tip 사용 시나리오
- 장시간 실행되는 서비스 종료 시 리소스 정리
- 프로세서 설정을 재설정해야 할 때
- 테스트 환경에서 다른 테스트 케이스 격리
:::

---

## 관련 문서

- [패키지 함수](../functions) - 최상위 함수 레퍼런스
- [Config](../config) - 설정 옵션
- [인터페이스 정의](../interfaces) - Hook 인터페이스
- [Hook 훅 시스템](../hooks) - 훅 자세한 사용 가이드
