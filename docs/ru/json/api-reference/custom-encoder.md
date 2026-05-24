---
title: "CustomEncoder - CyberGo JSON | Пользовательский кодировщик"
description: "Полное руководство по пользовательскому кодировщику CyberGo JSON: подробное описание интерфейсов CustomEncoder и TypeEncoder, способы настройки и примеры реализации для пользовательских типов Go."
---

# CustomEncoder

Библиотека json предоставляет два интерфейса пользовательских кодировщиков, позволяющих регистрировать специализированную логику сериализации для пользовательских типов.

## Интерфейс CustomEncoder

Глобальный интерфейс пользовательского кодировщика, заменяющий поведение кодирования по умолчанию.

```go
type CustomEncoder interface {
    Encode(value any) (string, error)
}
```

**Способ настройки**: через поле `Config.CustomEncoder`.

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

## Интерфейс TypeEncoder

Интерфейс кодировщика для определённого типа, используемый для кодирования конкретных типов.

```go
type TypeEncoder interface {
    Encode(v reflect.Value) (string, error)
}
```

**Способ настройки**: регистрируется через поле `Config.CustomTypeEncoders`.

```go
type TimeTypeEncoder struct{}

func (e *TimeTypeEncoder) Encode(v reflect.Value) (string, error) {
    if v.Type() == reflect.TypeOf(time.Time{}) {
        t := v.Interface().(time.Time)
        return fmt.Sprintf(`"%s"`, t.Format(time.RFC3339)), nil
    }
    return "", fmt.Errorf("неподдерживаемый тип: %v", v.Type())
}

// Регистрация кодировщика типа
cfg := json.DefaultConfig()
cfg.CustomTypeEncoders = map[reflect.Type]json.TypeEncoder{
    reflect.TypeOf(time.Time{}): &TimeTypeEncoder{},
}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## Примеры пользовательских кодировщиков

### Полная реализация CustomEncoder

```go
import stdjson "encoding/json"

type CompactEncoder struct{}

func (e *CompactEncoder) Encode(value any) (string, error) {
    // Компактное кодирование, использование стандартной библиотеки для избежания бесконечной рекурсии
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

### TypeEncoder для отображения типов

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

## Сравнение CustomEncoder и TypeEncoder

| Свойство | CustomEncoder | TypeEncoder |
|----------|---------------|-------------|
| Область действия | Глобальная, замена кодирования по умолчанию | Кодирование конкретного типа |
| Поле конфигурации | `Config.CustomEncoder` | `Config.CustomTypeEncoders` |
| Сигнатура функции | `Encode(any) (string, error)` | `Encode(reflect.Value) (string, error)` |
| Возвращаемое значение | `string` (строка JSON) | `string` (строка JSON) |
| Сценарий использования | Унификация кодирования | Маппинг сериализации пользовательских типов |

## Поля Config, связанные с кодированием

| Поле | Тип | Описание |
|------|-----|----------|
| `CustomEncoder` | `CustomEncoder` | Интерфейс пользовательского кодировщика |
| `CustomTypeEncoders` | `map[reflect.Type]TypeEncoder` | Кодировщики, зарегистрированные по типу |

## Связанные разделы

- [Определения интерфейсов](./interfaces) - Интерфейсы CustomEncoder и TypeEncoder
- [Параметры конфигурации](./config) - Поля Config, связанные с кодированием
