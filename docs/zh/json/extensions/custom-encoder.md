---
sidebar_label: "自定义编码器"
title: "CustomEncoder - CyberGo JSON | 自定义编码器"
description: "CyberGo JSON 自定义编码器：CustomEncoder 接口与 TypeEncoder 类型编码器的定义与实现，为 Go 类型注册 JSON 序列化逻辑。"
sidebar_position: 3
---

# CustomEncoder

json 库提供两种自定义编码器接口，允许为自定义类型注册专用的序列化逻辑。

## CustomEncoder 接口

全局自定义编码器接口，替换默认编码行为。

```go
type CustomEncoder interface {
    Encode(value any) (string, error)
}
```

**配置方式**：通过 `Config.CustomEncoder` 字段设置。

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

## TypeEncoder 接口

特定类型的编码器接口，用于类型的编码。

```go
type TypeEncoder interface {
    Encode(v reflect.Value) (string, error)
}
```

**配置方式**：通过 `Config` 的 `CustomTypeEncoders` 字段注册。

```go
type TimeTypeEncoder struct{}

func (e *TimeTypeEncoder) Encode(v reflect.Value) (string, error) {
    if v.Type() == reflect.TypeOf(time.Time{}) {
        t := v.Interface().(time.Time)
        return fmt.Sprintf(`"%s"`, t.Format(time.RFC3339)), nil
    }
    return "", fmt.Errorf("不支持的类型: %v", v.Type())
}

// 注册类型编码器
cfg := json.DefaultConfig()
cfg.CustomTypeEncoders = map[reflect.Type]json.TypeEncoder{
    reflect.TypeOf(time.Time{}): &TimeTypeEncoder{},
}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## 自定义编码器示例

### 完整的 CustomEncoder 实现

```go
import stdjson "encoding/json"

type CompactEncoder struct{}

func (e *CompactEncoder) Encode(value any) (string, error) {
    // 紧凑编码，使用标准库避免无限递归
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

### TypeEncoder 用于类型映射

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

## CustomEncoder 与 TypeEncoder 对比

| 特性 | CustomEncoder | TypeEncoder |
|------|---------------|-------------|
| 作用范围 | 全局，替换默认编码 | 类型特定编码 |
| 配置字段 | `Config.CustomEncoder` | `Config.CustomTypeEncoders` |
| 函数签名 | `Encode(any) (string, error)` | `Encode(reflect.Value) (string, error)` |
| 返回值 | `string`（JSON 字符串） | `string`（JSON 字符串） |
| 适用场景 | 统一编码行为 | 自定义类型的序列化映射 |

## Config 中的编码相关字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `CustomEncoder` | `CustomEncoder` | 自定义编码器接口 |
| `CustomTypeEncoders` | `map[reflect.Type]TypeEncoder` | 按类型注册的编码器 |

## 相关

- [接口定义](../api-reference/interfaces) - CustomEncoder 和 TypeEncoder 接口
- [配置选项](../api-reference/config) - Config 编码相关字段
