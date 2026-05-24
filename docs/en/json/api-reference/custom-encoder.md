---
title: "CustomEncoder - CyberGo JSON | Custom Encoder"
description: "CyberGo JSON custom encoder guide: detailed explanation of CustomEncoder interface and TypeEncoder type encoder definitions, configuration methods and implementation examples, supporting registration of custom JSON serialization and deserialization logic for custom Go structs and non-standard types."
---

# CustomEncoder

The json library provides two custom encoder interfaces, allowing you to register dedicated serialization logic for custom types.

## CustomEncoder Interface

Global custom encoder interface that replaces the default encoding behavior.

```go
type CustomEncoder interface {
    Encode(value any) (string, error)
}
```

**Configuration**: Set via the `Config.CustomEncoder` field.

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

## TypeEncoder Interface

Type-specific encoder interface for encoding specific types.

```go
type TypeEncoder interface {
    Encode(v reflect.Value) (string, error)
}
```

**Configuration**: Register via the `Config`'s `CustomTypeEncoders` field.

```go
type TimeTypeEncoder struct{}

func (e *TimeTypeEncoder) Encode(v reflect.Value) (string, error) {
    if v.Type() == reflect.TypeOf(time.Time{}) {
        t := v.Interface().(time.Time)
        return fmt.Sprintf(`"%s"`, t.Format(time.RFC3339)), nil
    }
    return "", fmt.Errorf("unsupported type: %v", v.Type())
}

// Register type encoder
cfg := json.DefaultConfig()
cfg.CustomTypeEncoders = map[reflect.Type]json.TypeEncoder{
    reflect.TypeOf(time.Time{}): &TimeTypeEncoder{},
}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## Custom Encoder Examples

### Complete CustomEncoder Implementation

```go
import stdjson "encoding/json"

type CompactEncoder struct{}

func (e *CompactEncoder) Encode(value any) (string, error) {
    // Compact encoding using standard library to avoid infinite recursion
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

### TypeEncoder for Type Mapping

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

## CustomEncoder vs TypeEncoder Comparison

| Feature | CustomEncoder | TypeEncoder |
|---------|---------------|-------------|
| Scope | Global, replaces default encoding | Type-specific encoding |
| Configuration field | `Config.CustomEncoder` | `Config.CustomTypeEncoders` |
| Function signature | `Encode(any) (string, error)` | `Encode(reflect.Value) (string, error)` |
| Return value | `string` (JSON string) | `string` (JSON string) |
| Use case | Unified encoding behavior | Custom type serialization mapping |

## Encoding-Related Fields in Config

| Field | Type | Description |
|-------|------|-------------|
| `CustomEncoder` | `CustomEncoder` | Custom encoder interface |
| `CustomTypeEncoders` | `map[reflect.Type]TypeEncoder` | Per-type registered encoders |

## See Also

- [Interfaces](./interfaces) - CustomEncoder and TypeEncoder interfaces
- [Configuration](./config) - Config encoding-related fields
