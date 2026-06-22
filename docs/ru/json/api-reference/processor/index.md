---
title: "Processor - CyberGo JSON | Справочник API"
description: "Processor CyberGo JSON: создание New, GetString/Set/Delete, итерация Foreach, Encode, жизненный цикл Close, Stats и кэш для частого повторного использования."
---

# Processor

Processor обеспечивает высокую производительность, настраиваемость и более гибкие возможности повторного использования, подходя для многократных операций с одним источником данных.

## Возможности

- **Высокая производительность**: внутренний механизм кэширования, повторные операции более эффективны
- **Настраиваемость**: поддержка множества параметров конфигурации
- **Цепочечные вызовы**: методы возвращают изменённый JSON, поддерживая последовательные операции
- **Управление ресурсами**: явный контроль жизненного цикла

## Создание Processor

### New

Сигнатура: `func New(cfg ...Config) (*Processor, error)`

Создаёт экземпляр Processor. Использует необязательный параметр Config для настройки процессора.

```go
// Использование конфигурации по умолчанию
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// Использование пользовательской конфигурации
cfg := json.DefaultConfig()
cfg.StrictMode = true
processor, err = json.New(cfg)

// Использование безопасной конфигурации
processor, err = json.New(json.SecurityConfig())
```

## Цепочечные вызовы

Методы Processor возвращают изменённую строку JSON, поддерживая последовательные операции:

```go
processor, _ := json.New()

// Установка нескольких значений
result1, _ := processor.Set(data, "user.name", "CyberGo")
result2, _ := processor.Set(result1, "user.version", "1.0.0")
finalResult, _ := processor.Delete(result2, "user.temporary")
```

## Каталог API

| Категория | Описание |
|-----------|----------|
| [Запросы по пути](./query) | GetString/Int/Float/Bool/Get/GetWithContext/SafeGet/GetArray/GetObject/GetMultiple/CompilePath/GetCompiled |
| [Модификация данных](./modify) | Set/SetMultiple/SetCreate/SetMultipleCreate/Delete/DeleteClean |
| [Методы вывода](./output) | Encode/EncodePretty/EncodeWithConfig/Compact/Indent/HTMLEscape/EncodeBatch/EncodeFields/EncodeStream |
| [Парсинг и загрузка](./parse) | Parse/ParseAny/Valid/ValidBytes/Marshal/Unmarshal/LoadFromFile/LoadFromReader/SaveToFile/MarshalToFile/SaveToWriter/UnmarshalFromFile |
| [Методы итерации](./iterate) | Foreach/ForeachWithPath/ForeachNested/ForeachReturn/ForeachWithError/ForeachNestedWithError/ForeachWithPathAndIterator/ForeachWithPathAndControl/ForeachFile/ForeachFileWithPath/ForeachFileChunked/ForeachFileNested |
| [Массовые операции](./batch) | ProcessBatch/WarmupCache |
| [Обработка JSONL](./jsonl) | StreamJSONL/StreamJSONLParallel/StreamJSONLParallelWithContext/StreamJSONLChunked/StreamJSONLFile/ForeachJSONL/MapJSONL/ReduceJSONL/FilterJSONL/CollectJSONL/FirstJSONL |
| [Жизненный цикл](./lifecycle) | Close/IsClosed/GetConfig/AddHook/ClearCache/GetStats/GetHealthStatus |

---

## Управление глобальным процессором

Функции уровня пакета используют внутренний глобальный процессор. Им можно управлять с помощью следующих функций:

### SetGlobalProcessor

Сигнатура: `func SetGlobalProcessor(processor *Processor)`

Устанавливает пользовательский глобальный процессор. Все функции уровня пакета (Get, Set, Marshal и др.) будут использовать этот процессор.

**Параметры**

| Имя | Тип | Описание |
|-----|-----|----------|
| `processor` | `*Processor` | Экземпляр пользовательского процессора |

```go
package main

import (
    "github.com/cybergodev/json"
)

func main() {
    // Создание процессора с пользовательской конфигурацией
    cfg := json.SecurityConfig()
    processor, err := json.New(cfg)
    if err != nil {
        panic(err)
    }

    // Установка в качестве глобального процессора
    json.SetGlobalProcessor(processor)

    // Теперь все функции уровня пакета используют безопасную конфигурацию
    data, err := json.Get(`{"name":"Alice"}`, "name")
    // Используются ограничения SecurityConfig
    _ = data
}
```

::: warning Примечание
- Передача `nil` не выполнит никаких действий
- Предыдущий глобальный процессор будет автоматически закрыт
- Эта функция потокобезопасна
:::

### ShutdownGlobalProcessor

Сигнатура: `func ShutdownGlobalProcessor()`

Закрывает и удаляет глобальный процессор. Последующие операции уровня пакета создадут новый процессор по умолчанию.

```go
package main

import (
    "github.com/cybergodev/json"
)

func main() {
    // Использование глобального процессора
    data, _ := json.Get(`{"key":"value"}`, "key")
    _ = data

    // Очистка при завершении приложения
    json.ShutdownGlobalProcessor()

    // Последующие операции создадут новый процессор по умолчанию
    data2, _ := json.Get(`{"key":"value2"}`, "key")
    _ = data2
}
```

::: tip Сценарии использования
- Очистка ресурсов при завершении длительно работающего сервиса
- Когда необходимо сбросить конфигурацию процессора
- Изоляция различных тестовых случаев в тестовой среде
:::

---

## Связанные разделы

- [Функции пакета](../functions) - Справочник функций верхнего уровня
- [Config](../config) - Параметры конфигурации
- [Определения интерфейсов](../interfaces) - Интерфейсы Hook
- [Система хуков](../hooks) - Подробное руководство по использованию хуков
