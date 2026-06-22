---
title: "CustomEncoder - CyberGo JSON | 커스텀 인코더"
description: "CyberGo JSON 커스텀 인코더 가이드: CustomEncoder 인터페이스와 TypeEncoder 정의, 설정, 구현 예제로 커스텀 Go 타입에 전용 JSON 직렬화를 등록합니다."
---

# CustomEncoder

json 라이브러리는 두 가지 커스텀 인코더 인터페이스를 제공하여, 커스텀 타입에 전용 직렬화 로직을 등록할 수 있습니다.

## CustomEncoder 인터페이스

전역 커스텀 인코더 인터페이스로, 기본 인코딩 동작을 교체합니다.

```go
type CustomEncoder interface {
    Encode(value any) (string, error)
}
```

**설정 방식**: `Config.CustomEncoder` 필드를 통해 설정합니다.

```go
import stdjson "encoding/json"

type UpperCaseEncoder struct{}

func (e *UpperCaseEncoder) Encode(value any) (string, error) {
    switch v := value.(type) {
    case string:
        return fmt.Sprintf(`"%s"`, strings.ToUpper(v)), nil
    default:
        data, err := stdjson.Marshal(v)
        return string(data), err
    }
}

cfg := json.DefaultConfig()
cfg.CustomEncoder = &UpperCaseEncoder{}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## TypeEncoder 인터페이스

특정 타입의 인코더 인터페이스로, 타입별 인코딩에 사용됩니다.

```go
type TypeEncoder interface {
    Encode(v reflect.Value) (string, error)
}
```

**설정 방식**: `Config`의 `CustomTypeEncoders` 필드를 통해 등록합니다.

```go
type TimeTypeEncoder struct{}

func (e *TimeTypeEncoder) Encode(v reflect.Value) (string, error) {
    if v.Type() == reflect.TypeOf(time.Time{}) {
        t := v.Interface().(time.Time)
        return fmt.Sprintf(`"%s"`, t.Format(time.RFC3339)), nil
    }
    return "", fmt.Errorf("지원하지 않는 타입: %v", v.Type())
}

// 타입 인코더 등록
cfg := json.DefaultConfig()
cfg.CustomTypeEncoders = map[reflect.Type]json.TypeEncoder{
    reflect.TypeOf(time.Time{}): &TimeTypeEncoder{},
}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## 커스텀 인코더 예제

### 완전한 CustomEncoder 구현

```go
import stdjson "encoding/json"

type CompactEncoder struct{}

func (e *CompactEncoder) Encode(value any) (string, error) {
    // 컴팩트 인코딩, 표준 라이브러리를 사용하여 무한 재귀 방지
    data, err := stdjson.Marshal(value)
    if err != nil {
        return "", err
    }
    return string(data), nil
}

cfg := json.DefaultConfig()
cfg.CustomEncoder = &CompactEncoder{}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### TypeEncoder를 사용한 타입 매핑

```go
type CustomTypeEncoder struct{}

func (e *CustomTypeEncoder) Encode(v reflect.Value) (string, error) {
    switch v.Kind() {
    case reflect.Struct:
        return "struct:" + v.Type().Name(), nil
    case reflect.Slice:
        return "slice", nil
    default:
        return v.Kind().String(), nil
    }
}
```

## CustomEncoder와 TypeEncoder 비교

| 특성 | CustomEncoder | TypeEncoder |
|------|---------------|-------------|
| 적용 범위 | 전역, 기본 인코딩 교체 | 타입별 인코딩 |
| 설정 필드 | `Config.CustomEncoder` | `Config.CustomTypeEncoders` |
| 함수 시그니처 | `Encode(any) (string, error)` | `Encode(reflect.Value) (string, error)` |
| 반환값 | `string` (JSON 문자열) | `string` (JSON 문자열) |
| 적합한 시나리오 | 통합 인코딩 동작 | 커스텀 타입의 직렬화 매핑 |

## Config의 인코딩 관련 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `CustomEncoder` | `CustomEncoder` | 커스텀 인코더 인터페이스 |
| `CustomTypeEncoders` | `map[reflect.Type]TypeEncoder` | 타입별로 등록된 인코더 |

## 관련 문서

- [인터페이스 정의](./interfaces) - CustomEncoder와 TypeEncoder 인터페이스
- [설정 옵션](./config) - Config 인코딩 관련 문서 필드
