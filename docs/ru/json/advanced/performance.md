---
title: "Оптимизация производительности - CyberGo JSON | Руководство"
description: "Руководство по оптимизации производительности CyberGo JSON: повторное использование Processor, управление памятью, обработка файлов, параллелизм, настройка кэша и бенчмарки."
---

# Оптимизация производительности

Стратегии и приёмы оптимизации производительности обработки JSON.

## Повторное использование процессора

### Повторное использование экземпляра Processor

```go
// Функции уровня пакета автоматически повторно используют глобальный Processor
for _, item := range dataList {
    val := json.GetString(item, "name")
}

// Или явное повторное использование экземпляра (подходит для пользовательской конфигурации)
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()
for _, item := range dataList {
    val := processor.GetString(item, "name")
}
```

## Оптимизация памяти

### Сокращение выделений

```go
// Использование Marshal, возвращающего байтовый срез
bytes, _ := json.Marshal(data)

// Использование Encode, возвращающего строку
s, _ := json.Encode(data)
```

### Предварительное выделение буфера

```go
// Предварительное выделение при обработке больших объёмов данных
buf := make([]byte, 0, 1024*1024)
```

## Обработка файлов

### Использование структурной итерации для больших файлов

```go
// Однократная загрузка (не рекомендуется для больших файлов)
data, _ := os.ReadFile("large.json")
parsed, _ := json.ParseAny(string(data))

// Структурная итерация (примечание: полный файл всё равно загружается в память)
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()
processor.ForeachFile("large.json", func(key any, item *json.IterableValue) error {
    processItem(item)
    return nil
})
```

### Обработка NDJSON

```go
// Использование StreamLinesInto для потоковой обработки
file, _ := os.Open("data.jsonl")
defer file.Close()
entries, err := json.StreamLinesInto[LogEntry](file, func(lineNum int, entry LogEntry) error {
    // Обработка каждой строки JSON
    return nil
})
```

## Параллельная обработка

### Параллельная обработка массива

```go
items := json.GetArray(data, "items")

var wg sync.WaitGroup
sem := make(chan struct{}, runtime.NumCPU())

for _, item := range items {
    wg.Add(1)
    go func(item any) {
        defer wg.Done()
        sem <- struct{}{}
        defer func() { <-sem }()

        processItem(item)
    }(item)
}
wg.Wait()
```

### Использование пула воркеров

```go
pool := workerpool.New(10)

items := json.GetArray(data, "items")
for _, item := range items {
    item := item
    pool.Submit(func() {
        processItem(item)
    })
}

pool.StopWait()
```

## Оптимизация конфигурации

### Настройка конфигурации по сценарию

```go
// Малые объёмы данных: свободная конфигурация
smallCfg := json.DefaultConfig()
smallCfg.MaxNestingDepthSecurity = 200 // Максимальное допустимое значение (диапазон проверки 10-200)

// Недоверенный ввод: безопасная конфигурация
safeCfg := json.SecurityConfig()
safeCfg.MaxJSONSize = 1024 * 1024
```

### Отключение ненужных функций

```go
// Если хуки не нужны, не настраивайте их
cfg := json.DefaultConfig() // Минимальная конфигурация
```

## Стратегии кэширования

### Кэширование результатов парсинга

```go
var cache sync.Map

func getOrParse(key string, data []byte) (any, error) {
    if val, ok := cache.Load(key); ok {
        return val, nil
    }

    result, err := json.ParseAny(string(data))
    if err != nil {
        return nil, err
    }

    cache.Store(key, result)
    return result, nil
}
```

### Кэширование запросов по пути

```go
// Предварительная компиляция часто используемых путей (используя Processor)
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
path1, _ := p.CompilePath("user.name")
path2, _ := p.CompilePath("user.email")
path3, _ := p.CompilePath("items[*].id")
```

## Бенчмарки

### Примеры тестов производительности

```go
func BenchmarkParse(b *testing.B) {
    data := []byte(`{"name": "test", "items": [1, 2, 3]}`)

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = json.ParseAny(string(data))
    }
}

func BenchmarkGetString(b *testing.B) {
    data := `{"user": {"name": "CyberGo", "email": "test@example.com"}}`

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        json.GetString(data, "user.name")
    }
}
```

### Анализ памяти

```go
func TestMemoryUsage(t *testing.T) {
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    before := m.Alloc

    // Выполнение операции
    data := generateLargeJSON()
    _, _ = json.ParseAny(data)

    runtime.ReadMemStats(&m)
    after := m.Alloc

    fmt.Printf("Использование памяти: %d байт\n", after-before)
}
```

## Сравнение производительности

| Операция | Малые данные (<1KB) | Средние данные (1MB) | Большие данные (>10MB) |
|----------|--------------------|--------------------|-----------------------|
| `Parse` | Рекомендуется | Рекомендуется | Не рекомендуется |
| `ForeachFile` | Необязательно | Опционально | Рекомендуется |

## Связанные разделы

- [API обработки больших файлов](../api-reference/large-file)
- [Обработка ошибок](./error-handling)
- [Обработка больших файлов](../large-files)
