---
title: Processor - CyberGo JSON | Справочник API
description: "Полный справочник CyberGo JSON Processor: создание экземпляра New, операции с данными GetString/Set/Delete, итерация Foreach, кодирование Encode, управление жизненным циклом Close, статистика Stats и конфигурация кэша. Подходит для высокочастотных JSON-операций и сценариев повторного использования данных."
---

# Processor

Processor обеспечивает высокую производительность, настраиваемость и более гибкие возможности повторного использования, подходит для многократных операций с одним источником данных.

## Особенности

- **Высокая производительность**: внутренний механизм кэширования, повторные операции более эффективны
- **Настраиваемость**: поддержка различных параметров конфигурации
- **Цепочечные вызовы**: методы возвращают изменённый JSON, поддерживая последовательные операции
- **Управление ресурсами**: явный контроль жизненного цикла

## Создание Processor

### New

Сигнатура: `func New(cfg ...Config) (*Processor, error)`

Создаёт экземпляр Processor. Принимает необязательный параметр Config для настройки процессора.

```go
// С конфигурацией по умолчанию
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// С пользовательской конфигурацией
cfg := json.DefaultConfig()
cfg.StrictMode = true
processor, err := json.New(cfg)

// С безопасной конфигурацией
processor, err := json.New(json.SecurityConfig())
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
|------|------|
| [Запросы по пути](./query) | GetString/Int/Float/Bool/Get/SafeGet/GetArray/GetObject |
| [Изменение данных](./modify) | Set/Delete/DeleteClean |
| [Методы вывода](./output) | Encode/EncodePretty/EncodeWithConfig/операции с Buffer |
| [Разбор и загрузка](./parse) | ParseAny/Valid/LoadFromFile/LoadFromReader |
| [Методы итерации](./iterate) | Foreach/ForeachWithPath/ForeachNested |
| [Пакетные операции](./batch) | ProcessBatch |
| [Обработка JSONL](./jsonl) | StreamJSONL/Parallel/Chunked/Map/Reduce/Filter |
| [Жизненный цикл](./lifecycle) | Close/кэш/статистика/проверка здоровья |

---

## Управление глобальным процессором

Функции пакетного уровня используют внутренний глобальный процессор. Им можно управлять с помощью следующих функций:

### SetGlobalProcessor

Сигнатура: `func SetGlobalProcessor(processor *Processor)`

Устанавливает пользовательский глобальный процессор. Все функции пакетного уровня (Get, Set, Marshal и т.д.) будут использовать этот процессор.

**Параметры**

| Имя | Тип | Описание |
|------|------|------|
| `processor` | `*Processor` | Пользовательский экземпляр процессора |

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

    // Теперь все функции пакетного уровня используют безопасную конфигурацию
    data, err := json.Get(`{"name":"Alice"}`, "name")
    // Используются ограничения SecurityConfig
    _ = data
}
```

::: warning Внимание
- Передача `nil` не выполнит никаких действий
- Предыдущий глобальный процессор будет автоматически закрыт
- Эта функция потокобезопасна
:::

### ShutdownGlobalProcessor

Сигнатура: `func ShutdownGlobalProcessor()`

Закрывает и удаляет глобальный процессор. Последующие операции пакетного уровня создадут новый процессор по умолчанию.

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

::: tip Варианты использования
- Очистка ресурсов при завершении долго работающих сервисов
- Когда необходимо сбросить конфигурацию процессора
- Изоляция различных тестовых случаев в тестовой среде
:::

---

## См. также

- [Функции пакета](../functions) - справочник функций верхнего уровня
- [Config](../config) - параметры конфигурации
- [Определения интерфейсов](../interfaces) - интерфейсы Hook
- [Система хуков](../hooks) - подробное руководство по использованию хуков
