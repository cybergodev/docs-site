---
title: "치트시트 - CyberGo JSON | API 빠른 참조하세요"
description: "CyberGo JSON API 치트시트: 경로 쿼리 GetString/GetInt, 수정 작업 Set/Delete, 직렬화 Marshal/Unmarshal, 설정 옵션, 반복자 및 보안 함수 등 자주 사용하는 API의 빠른 참조 매뉴얼로, 개발자가 필요한 함수 시그니처와 사용법을 효율적으로 찾을 수 있습니다."
---

# 치트시트

자주 사용하는 API와 코드 조각을 빠르게 찾아보세요.

## 경로 쿼리

| 작업 | 함수 | 예제 |
|------|------|------|
| 문자열 가져오기 | `GetString` | `json.GetString(data, "user.name")` |
| 정수 가져오기 | `GetInt` | `json.GetInt(data, "count")` |
| 실수 가져오기 | `GetFloat` | `json.GetFloat(data, "price")` |
| 불리언 가져오기 | `GetBool` | `json.GetBool(data, "enabled")` |
| 배열 가져오기 | `GetArray` | `json.GetArray(data, "items")` |
| 객체 가져오기 | `GetObject` | `json.GetObject(data, "user")` |
| 임의 값 가져오기 | `Get` | `json.Get(data, "items[0].id")` |
| 제네릭 가져오기 | `GetTyped[T]` | `json.GetTyped[User](data, "user")` |

### 기본값 포함

`GetString`, `GetInt`, `GetFloat`, `GetBool` 등의 함수는 선택적 기본값 매개변수를 지원합니다:

| 작업 | 함수 | 예제 |
|------|------|------|
| 문자열 | `GetString` | `json.GetString(data, "name", "unknown")` |
| 정수 | `GetInt` | `json.GetInt(data, "count", 0)` |
| 실수 | `GetFloat` | `json.GetFloat(data, "rate", 0.5)` |
| 불리언 | `GetBool` | `json.GetBool(data, "debug", false)` |

## 수정 작업

| 작업 | 함수 | 예제 |
|------|------|------|
| 값 설정 | `Set` | `json.Set(data, "user.name", "Alice")` |
| 배치 설정 | `SetMultiple` | `json.SetMultiple(data, map[string]any{"a": 1, "b": 2})` |
| 경로 생성 설정 | `SetCreate` | `json.SetCreate(data, "a.b.c", 1)` |
| 배치 경로 생성 설정 | `SetMultipleCreate` | `json.SetMultipleCreate(data, updates)` |
| 값 삭제 | `Delete` | `json.Delete(data, "user.temporary")` |
| 정리하며 삭제 | `DeleteClean` | `json.DeleteClean(data, "user.temporary")` |

```go
// 값 설정
result, err := json.Set(`{"user":{}}`, "user.name", "Alice")
// {"user":{"name":"Alice"}}

// 여러 필드를 개별적으로 설정
result, err = json.Set(data, "user.name", "Bob")
result, err = json.Set(result, "user.age", 25)

// 삭제
result, err := json.Delete(data, "user.temporary")
```

## 직렬화

| 작업 | 함수 | 예제 |
|------|------|------|
| 인코딩 | `Marshal` | `json.Marshal(data)` |
| 포맷팅 인코딩 | `MarshalIndent` | `json.MarshalIndent(data, "", "  ")` |
| 디코딩 | `Unmarshal` | `json.Unmarshal(bytes, &v)` |
| 파싱 | `Parse` | `var v T; json.Parse(jsonStr, &v)` |
| any로 파싱 | `ParseAny` | `json.ParseAny(jsonStr)` |
| 포맷팅 | `Prettify` | `json.Prettify(jsonStr)` |
| 압축 | `Compact` | `json.Compact(&buf, []byte(data))` |

```go
// 인코딩
b, err := json.Marshal(map[string]any{"name": "test"})

// 포맷팅 출력
pretty, err := json.MarshalIndent(data, "", "  ")

// 구조체로 파싱
var result map[string]any
err = json.Parse(`{"name": "test"}`, &result)

// any로 파싱
parsed, err := json.ParseAny(`{"name": "test"}`)

// JSON 문자열 포맷팅
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
```

## 유효성 검사

| 작업 | 함수 | 예제 |
|------|------|------|
| 빠른 검사 | `Valid` | `json.Valid([]byte(data))` |

```go
// 빠른 검사
if json.Valid([]byte(data)) {
    // 유효한 JSON
}

// Schema 검증
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name"},
    Properties: map[string]*json.Schema{
        "name": {Type: "string"},
        "age":  {Type: "number"},
    },
}
p, err := json.New()
if err != nil {
    panic(err)
}
errors, _ := p.ValidateSchema(data, schema)
```

## 유틸리티 함수

| 작업 | 함수 | 예제 |
|------|------|------|
| 비교 | `CompareJSON` | `json.CompareJSON(a, b)` |
| 병합 | `MergeJSON` | `json.MergeJSON(a, b)` |
| 다중 병합 | `MergeMany` | `json.MergeMany([]string{s1, s2, s3})` |

```go
// 비교 (키 순서와 숫자 정밀도 무시)
equal, _ := json.CompareJSON(`{"a":1.0,"b":2}`, `{"b":2,"a":1}`)
fmt.Println("Equal:", equal) // true (순서와 정밀도 무시)

// JSON 병합
base := `{"database":{"host":"localhost","port":5432},"debug":false}`
override := `{"database":{"host":"prod-server","ssl":true},"monitoring":true}`

// 병합
merged, _ := json.MergeJSON(base, override)
// 결과: {"database":{"host":"prod-server","port":5432,"ssl":true},"debug":false,"monitoring":true}

// 다중 병합
result, _ := json.MergeMany([]string{
    `{"a":1}`,
    `{"b":2}`,
    `{"c":3}`,
})
```

## Processor 메서드

```go
// 프로세서 생성
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// 값 가져오기
result := processor.GetString(data, "user.profile.name")

// 안전한 가져오기 (AccessResult 반환)
accessResult := processor.SafeGet(data, "user.age")
age, err := accessResult.AsInt()
```

### 설정과 함께 생성

```go
// 기본 설정
processor, err := json.New(json.DefaultConfig())

// 보안 설정 (신뢰할 수 없는 입력 처리)
processor, err := json.New(json.SecurityConfig())

// 커스텀 설정
cfg := json.DefaultConfig()
cfg.CreatePaths = true
processor, err := json.New(cfg)
```

## 스트림 처리

### Processor.ForeachFile (대용량 파일)

```go
// 대용량 파일 처리
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

err = processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    // 데이터 항목 처리
    id := item.GetInt("id")
    name := item.GetString("name")
    return nil // item.Break() 반환으로 중단 가능
})
```

### NDJSON/JSONL

```go
// JSONL 파싱
results, err := json.ParseJSONL(jsonlBytes)

// 제네릭 파싱 (StreamLinesInto 사용)
file, _ := os.Open("data.jsonl")
defer file.Close()
users, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    return nil
})

// 스트림 쓰기
outputFile, _ := os.Create("output.jsonl")
defer outputFile.Close()
writer := json.NewJSONLWriter(outputFile)
_ = writer.Write(map[string]any{"name": "Alice"})
_ = writer.Write(map[string]any{"name": "Bob"})
```

## 설정 옵션

```go
// 권장 방식: 기본 설정을 기반으로 수정
cfg := json.DefaultConfig()
cfg.MaxJSONSize = 200 * 1024 * 1024 // 커스텀 크기 제한
cfg.FullSecurityScan = true          // 전체 보안 스캔 활성화
```

### 설정 프리셋

```go
// 기본 설정
cfg := json.DefaultConfig()

// 보안 설정 (신뢰할 수 없는 입력 처리)
cfg := json.SecurityConfig()

// 포맷팅 설정
cfg := json.PrettyConfig()
```

## 경로 문법

| 문법 | 설명 | 예제 |
|------|------|------|
| `.property` | 속성 접근 | `user.name` |
| `[n]` | 배열 인덱스 | `items[0]` |
| `[*]` | 와일드카드 | `items[*].id` |
| `[start:end]` | 슬라이스 | `items[0:5]` |
| `[start:end:step]` | 스텝 슬라이스 | `items[0:10:2]` |
| `{field1,field2}` | 필드 추출 | `user{name,email}` |
| `[+]` | 추가 | `items[+]` |
| `[-1]` | 음수 인덱스 (마지막) | `items[-1]` |

## 일반적인 패턴

### 안전하게 중첩 값 가져오기

```go
// 기본값이 있는 가져오기 함수 사용
name := json.GetString(data, "user.profile.name", "unknown")

// 오류 유형을 구분해야 할 때 Get 사용
val, err := json.Get(data, "user.profile.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // 경로가 존재하지 않음
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // 타입 불일치
    }
}
```

### 기본값으로 가져오기

```go
// GetString/GetInt 등의 함수는 선택적 기본값 매개변수를 지원
timeout := json.GetInt(data, "timeout", 30)
debug := json.GetBool(data, "debug", false)
name := json.GetString(data, "user.nickname", "unknown")
```

### 타입 단언

```go
val, _ := json.Get(data, "value")
switch v := val.(type) {
case string:
    fmt.Println("문자열:", v)
case float64:
    fmt.Println("숫자:", v)
case bool:
    fmt.Println("불리언:", v)
case []any:
    fmt.Println("배열:", len(v), "개 요소")
case map[string]any:
    fmt.Println("객체:", len(v), "개 키")
}
```

### 설정 병합

```go
// 기본 설정 + 사용자 설정
defaults := `{"timeout": 30, "retries": 3}`
userConfig := `{"timeout": 60, "debug": true}`

merged, _ := json.MergeJSON(defaults, userConfig)
// {"timeout": 60, "retries": 3, "debug": true}
```

### 오류 처리

```go
val, err := json.Get(data, path)
if err != nil {
    // 오류 유형 확인
    if errors.Is(err, json.ErrPathNotFound) {
        // 경로가 존재하지 않음
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // JSON 형식 오류
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // 타입 불일치
    }
}
```

## 캐시 관리

```go
// 캐시 웜업
paths := []string{"user.name", "user.email", "items[*].id"}
result, _ := json.WarmupCache(data, paths)
fmt.Printf("웜업 성공: %d/%d\n", result.Successful, result.TotalPaths)

// 캐시 삭제
json.ClearCache()

// 통계 가져오기
stats := json.GetStats()
fmt.Printf("캐시 적중률: %.2f%%\n", stats.HitRatio * 100)
```

## 전역 프로세서

```go
// 커스텀 전역 프로세서 설정
cfg := json.SecurityConfig()
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
json.SetGlobalProcessor(p)

// 이후 모든 패키지 레벨 함수가 이 프로세서를 사용
name := json.GetString(data, "user.name")

// 애플리케이션 종료 시 정리
defer json.ShutdownGlobalProcessor()
```

## 관련 문서

- [패키지 함수](./api-reference/functions) - 전체 API 참조하세요
- [보조 함수](./api-reference/helpers) - 타입 변환 도구
- [Processor](./api-reference/processor/) - 프로세서 메서드
- [설정](./api-reference/config) - 설정 옵션
- [타입 정의](./api-reference/types) - AccessResult, Schema 등
