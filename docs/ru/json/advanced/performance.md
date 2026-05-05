---
title: Оптимизация производительности - CyberGo JSON | Руководство по высокой производительности
description: "Руководство по оптимизации производительности CyberGo JSON: стратегии кэширования EnableCache/CacheTTL, параллельная обработка ParallelThreshold/MaxConcurrency, предварительный парсинг PreParse, прогрев кэша WarmupCache, повторное использование пулов объектов и анализ бенчмарков для повышения производительности высокочастотной обработки JSON."
---

# Оптимизация производительности

Стратегии и приёмы оптимизации производительности обработки JSON.

## Повторное использование процессора

### Повторное использование экземпляра Processor

```go
// ✅ Пакетные функции автоматически повторно используют глобальный Processor
for _, item := range dataList {
    val := json.GetString(item, "name")
}

// ✅ Или явное повторное использование экземпляра (подходит для пользовательской конфигурации)
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

### Сокращение аллокаций

```go
// ✅ Используйте Marshal для возврата среза байтов
bytes, _ := json.Marshal(data)

// ✅ Используйте Encode для возврата строки
s, _ := json.Encode(data)
```

### Предварительное выделение буфера

```go
// Предварительное выделение при обработке больших объёмов данных
buf := make([]byte, 0, 1024*1024)
```

## Обработка файлов

### Структурированная итерация для больших файлов

```go
// ❌ Загрузка целиком
data, _ := os.ReadFile("large.json")
parsed, _ := json.ParseAny(string(data))

// ✅ Структурированная итерация (примечание: полный файл всё равно загружается в память)
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

### Параллельная обработка массивов

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

### Использование Worker Pool

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

### Настройка конфигурации в зависимости от сценария

```go
// Небольшие объёмы данных: мягкая конфигурация
smallCfg := json.DefaultConfig()
smallCfg.MaxNestingDepthSecurity = 200 // Максимально допустимое значение (диапазон проверки 10-200)

// Недоверенные входные данные: безопасная конфигурация
safeCfg := json.SecurityConfig()
safeCfg.MaxJSONSize = 1024 * 1024
```

### Отключение ненужных функций

```go
// Если Hook не нужен, не настраивайте его
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

### Кэширование запросов путей

```go
// Предварительная компиляция часто используемых путей (с использованием Processor)
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

| Операция | Малые данные (<1КБ) | Средние данные (1МБ) | Большие данные (>10МБ) |
|----------|---------------------|----------------------|------------------------|
| `Parse` | Рекомендуется | Рекомендуется | Не рекомендуется |
| `ForeachFile` | Не требуется | Опционально | Рекомендуется |

## Смотрите также

- [API для обработки больших файлов](../api-reference/large-file)
- [Обработка ошибок](./error-handling)
- [Обработка больших файлов](../large-files)
