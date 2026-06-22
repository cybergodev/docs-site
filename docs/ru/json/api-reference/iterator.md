---
title: "Итераторы - CyberGo JSON | Справочник API"
description: "API итераторов CyberGo JSON: Foreach, ForeachWithPath, рекурсивный ForeachNested, IterableValue и ParallelForeach для различных сценариев обхода JSON."
---

# Итераторы

Пакет json предоставляет богатый функционал итераторов, поддерживающий различные способы обхода: функции уровня пакета, методы Processor, потоковую итерацию, пакетную обработку и параллельную обработку.

## Функции итерации уровня пакета

Функции итерации, которые можно вызывать напрямую без создания экземпляра Processor.

### Foreach

Сигнатура: `func Foreach(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

Обходит массив или объект JSON.

```go
json.Foreach(`{"name": "Alice", "age": 30}`, func(key any, item *json.IterableValue) {
    fmt.Printf("Ключ: %v, Значение: %v\n", key, item.GetData())
})
// Вывод:
// Ключ: name, Значение: Alice
// Ключ: age, Значение: 30
```

### ForeachWithPath

Сигнатура: `func ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue), cfg ...Config) error`

Обход по указанному пути, возвращает ошибку.

```go
err := json.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
if err != nil {
    panic(err)
}
```

### ForeachReturn

Сигнатура: `func ForeachReturn(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config) (string, error)`

Обходит и возвращает исходную строку JSON (операция только для чтения).

```go
result, err := json.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // Обработка только для чтения
    fmt.Printf("Обработка: %v\n", item.GetData())
})
```

### ForeachNested

Сигнатура: `func ForeachNested(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

Рекурсивно обходит все вложенные уровни.

```go
json.ForeachNested(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Тип: %T, Значение: %v\n", item.GetData(), item.GetData())
})
```

### ForeachWithPathAndControl

Сигнатура: `func ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl, cfg ...Config) error`

Обход с управлением потоком выполнения, позволяет контролировать процесс итерации через возвращаемое значение.

```go
err := json.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    if value == nil {
        return json.IteratorBreak // Остановить итерацию
    }
    // Обработка...
    return json.IteratorNormal // Продолжить итерацию
})
```

**Константы IteratorControl**

| Константа | Описание |
|------|------|
| `IteratorNormal` | Нормальное продолжение итерации |
| `IteratorContinue` | Пропустить текущий элемент, продолжить итерацию |
| `IteratorBreak` | Остановить итерацию |

**Варианты использования**

| Сценарий | Рекомендуемое значение | Описание |
|------|------------|------|
| Обычная обработка элемента | `IteratorNormal` | Продолжить обработку следующего элемента |
| Фильтрация некорректных данных | `IteratorContinue` | Пропустить текущий элемент без прерывания итерации |
| Выход после нахождения цели | `IteratorBreak` | Немедленная остановка после нахождения нужных данных |
| Прерывание при ошибке | `IteratorBreak` | Остановка итерации при критической ошибке |

```go
// Сценарий 1: Фильтрация некорректных данных
err := json.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    if value == nil {
        return json.IteratorContinue // Пропустить значения null
    }
    process(value)
    return json.IteratorNormal
})

// Сценарий 2: Выход после нахождения первого подходящего элемента
var found any
err = json.ForeachWithPathAndControl(data, "users", func(key any, value any) json.IteratorControl {
    if obj, ok := value.(map[string]any); ok {
        if obj["admin"] == true {
            found = obj
            return json.IteratorBreak // Остановить после нахождения администратора
        }
    }
    return json.IteratorNormal
})

// Сценарий 3: Проверка целостности данных
var hasError bool
err = json.ForeachWithPathAndControl(data, "records", func(key any, value any) json.IteratorControl {
    if !validateRecord(value) {
        hasError = true
        return json.IteratorBreak // Данные неполные, остановить проверку
    }
    return json.IteratorNormal
})
```

### ForeachWithError

Сигнатура: `func ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error) error`

Обход по пути с обработкой ошибок. Когда функция обратного вызова возвращает error, итерация прерывается и возвращается эта ошибка.

```go
err := json.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    val := item.GetData()
    if val == nil {
        return fmt.Errorf("значение элемента %v равно null", key)
    }
    return processItem(val)
})
if err != nil {
    log.Fatal(err)
}
```

### ForeachNestedWithError

Сигнатура: `func ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error) error`

Рекурсивный обход всех вложенных уровней с обработкой ошибок. Когда функция обратного вызова возвращает error, итерация прерывается.

```go
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("Ключ: %v, Значение: %v\n", key, item.GetData())
    return nil
})
```

### ForeachWithPathAndIterator

Сигнатура: `func ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl) error`

Итерация с информацией о пути, функция обратного вызова получает текущий полный путь. Подходит для обработки глубоко вложенных структур, где необходимо отслеживать позицию обхода.

```go
err := json.ForeachWithPathAndIterator(data, "users", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("Путь: %s, Ключ: %v\n", currentPath, key)
    return json.IteratorNormal
})
```

---

## Тип Iterator

Iterator — низкоуровневый итератор для обхода массивов или объектов JSON.

### NewIterator

Сигнатура: `func NewIterator(data any, cfg ...Config) *Iterator`

Создаёт экземпляр итератора.

```go
data := []any{"apple", "banana", "cherry"}
it := json.NewIterator(data)
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

### Методы

| Метод | Сигнатура | Описание |
|------|------|------|
| `HasNext` | `func (it *Iterator) HasNext() bool` | Проверяет, есть ли ещё элементы |
| `Next` | `func (it *Iterator) Next() (any, bool)` | Получает следующий элемент |
| `Reset` | `func (it *Iterator) Reset()` | Очищает состояние и кэш итератора, подготавливает к повторному использованию |
| `ResetWith` | `func (it *Iterator) ResetWith(data any)` | Очищает состояние и инициализирует новыми данными |

### Reset

Очищает состояние итератора, освобождает кэшированные ключи. После вызова можно повторно инициализировать с помощью `ResetWith`.

```go
it := json.NewIterator(data1)
for it.HasNext() {
    it.Next()
}

it.Reset() // Очистить кэш
```

### ResetWith

Очищает состояние итератора и инициализирует новыми данными, обеспечивая повторное использование итератора.

```go
it := json.NewIterator(data1)
// ... обход data1 ...

it.ResetWith(data2) // Повторное использование итератора для новых данных
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

---

## Тип IterableValue

IterableValue инкапсулирует текущий элемент в процессе итерации, предоставляя удобные методы доступа к значениям.

### Методы

#### GetData

Сигнатура: `func (iv *IterableValue) GetData() any`

Возвращает базовые данные.

#### Get

Сигнатура: `func (iv *IterableValue) Get(path string) any`

Получает значение по пути (поддерживает точечную нотацию и индексы массивов).

```go
val := iv.Get("user.address.city")
val = iv.Get("users[0].name")
```

#### GetString

Сигнатура: `func (iv *IterableValue) GetString(key string) string`

Получает строковое значение.

```go
name := item.GetString("name")
```

#### GetInt

Сигнатура: `func (iv *IterableValue) GetInt(key string) int`

Получает целочисленное значение.

```go
age := item.GetInt("age")
```

#### GetFloat64

Сигнатура: `func (iv *IterableValue) GetFloat64(key string) float64`

Получает значение с плавающей точкой.

```go
price := item.GetFloat64("price")
```

#### GetBool

Сигнатура: `func (iv *IterableValue) GetBool(key string) bool`

Получает логическое значение.

```go
enabled := item.GetBool("enabled")
```

#### GetArray

Сигнатура: `func (iv *IterableValue) GetArray(key string) []any`

Получает значение массива.

```go
items := item.GetArray("items")
```

#### GetObject

Сигнатура: `func (iv *IterableValue) GetObject(key string) map[string]any`

Получает значение объекта.

```go
profile := item.GetObject("profile")
```

#### GetWithDefault

Сигнатура: `func (iv *IterableValue) GetWithDefault(key string, defaultValue any) any`

Получает значение, если ключ не существует — возвращает значение по умолчанию.

```go
// Получить необязательное поле с использованием значения по умолчанию при отсутствии
timeout := item.GetWithDefault("timeout", 30)
mode := item.GetWithDefault("mode", "default")
```

#### GetStringWithDefault

Сигнатура: `func (iv *IterableValue) GetStringWithDefault(key string, defaultValue string) string`

Получает строковое значение, если ключ не существует — возвращает значение по умолчанию.

```go
name := item.GetStringWithDefault("name", "Неизвестно")
```

#### GetIntWithDefault

Сигнатура: `func (iv *IterableValue) GetIntWithDefault(key string, defaultValue int) int`

Получает целочисленное значение, если ключ не существует — возвращает значение по умолчанию.

```go
age := item.GetIntWithDefault("age", 0)
port := item.GetIntWithDefault("port", 8080)
```

#### GetFloat64WithDefault

Сигнатура: `func (iv *IterableValue) GetFloat64WithDefault(key string, defaultValue float64) float64`

Получает значение с плавающей точкой, если ключ не существует — возвращает значение по умолчанию.

```go
price := item.GetFloat64WithDefault("price", 0.0)
rate := item.GetFloat64WithDefault("rate", 1.0)
```

#### GetBoolWithDefault

Сигнатура: `func (iv *IterableValue) GetBoolWithDefault(key string, defaultValue bool) bool`

Получает логическое значение, если ключ не существует — возвращает значение по умолчанию.

```go
enabled := item.GetBoolWithDefault("enabled", false)
debug := item.GetBoolWithDefault("debug", true)
```

#### Exists

Сигнатура: `func (iv *IterableValue) Exists(key string) bool`

Проверяет, существует ли указанный ключ.

```go
if item.Exists("email") {
    email := item.GetString("email")
    fmt.Printf("Email: %s\n", email)
}
```

#### ForeachNested

Сигнатура: `func (iv *IterableValue) ForeachNested(path string, fn func(key any, item *IterableValue))`

Рекурсивно обходит вложенные структуры по указанному пути.

#### IsNullData

Сигнатура: `func (iv *IterableValue) IsNullData() bool`

Проверяет, равно ли всё значение null.

```go
if item.IsNullData() {
    fmt.Println("Значение равно null")
}
```

#### IsNull

Сигнатура: `func (iv *IterableValue) IsNull(key string) bool`

Проверяет, равно ли значение указанного ключа null.

```go
if item.IsNull("optional_field") {
    fmt.Println("Необязательное поле равно null")
}
```

#### IsEmptyData

Сигнатура: `func (iv *IterableValue) IsEmptyData() bool`

Проверяет, пусто ли всё значение (nil, пустая строка, пустой массив или пустой объект).

```go
if item.IsEmptyData() {
    fmt.Println("Значение пусто")
}
```

#### IsEmpty

Сигнатура: `func (iv *IterableValue) IsEmpty(key string) bool`

Проверяет, пусто ли значение указанного ключа.

```go
if item.IsEmpty("tags") {
    fmt.Println("Список тегов пуст")
}
```

#### Break

Сигнатура: `func (iv *IterableValue) Break() error`

Возвращает сигнал остановки итерации. Вызов в обратном вызове итерации позволяет досрочно прекратить обход.

```go
// Примечание: Break() действует только в функциях итерации, обратный вызов которых
// возвращает error (например, ForeachWithError, ForeachNestedWithError и т. д.). Обычные
// обратные вызовы Foreach не возвращают error, поэтому item.Break() не останавливает их.
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "stop" {
        // Остановить итерацию после нахождения цели
        return item.Break()
    }
    // Продолжить обработку
    return nil
})
```

#### Release

Сигнатура: `func (iv *IterableValue) Release()`

Возвращает IterableValue в пул объектов, освобождая внутренние ссылки на данные.

```go
json.Foreach(data, func(key any, item *json.IterableValue) {
    // Обработка данных...
    fmt.Println(item.GetData())
    // Освобождение после обработки для снижения нагрузки на GC
    item.Release()
})
```

---

## Тип StreamIterator

StreamIterator обеспечивает эффективную по памяти потоковую итерацию, подходящую для больших массивов JSON. Обработка по одному элементу без загрузки всего массива в память.

### NewStreamIterator

Сигнатура: `func NewStreamIterator(reader io.Reader, cfg ...Config) *StreamIterator`

Создаёт потоковый итератор. Размер буфера настраивается через `Config.BufferSize`.

```go
file, _ := os.Open("large-array.json")
defer file.Close()

// Без конфигурации
it := json.NewStreamIterator(file)
for it.Next() {
    val := it.Value()
    fmt.Printf("Индекс %d: %v\n", it.Index(), val)
}
if err := it.Err(); err != nil {
    panic(err)
}

// С конфигурацией
cfg := json.DefaultConfig()
cfg.BufferSize = 64 * 1024 // Буфер 64KB
it2 := json.NewStreamIterator(file, cfg)
```

### Методы

| Метод | Сигнатура | Описание |
|------|------|------|
| `Next` | `func (si *StreamIterator) Next() bool` | Переходит к следующему элементу |
| `Value` | `func (si *StreamIterator) Value() any` | Возвращает текущий элемент |
| `Index` | `func (si *StreamIterator) Index() int` | Возвращает текущий индекс |
| `Err` | `func (si *StreamIterator) Err() error` | Возвращает ошибку итерации |

---

## Тип StreamObjectIterator

StreamObjectIterator обеспечивает эффективную по памяти потоковую итерацию, подходящую для больших объектов JSON.

### NewStreamObjectIterator

Сигнатура: `func NewStreamObjectIterator(reader io.Reader, cfg ...Config) *StreamObjectIterator`

Создаёт потоковый итератор объектов.

```go
file, _ := os.Open("large-object.json")
defer file.Close()

it := json.NewStreamObjectIterator(file)
for it.Next() {
    fmt.Printf("Ключ: %s, Значение: %v\n", it.Key(), it.Value())
}
if err := it.Err(); err != nil {
    panic(err)
}
```

### Методы

| Метод | Сигнатура | Описание |
|------|------|------|
| `Next` | `func (soi *StreamObjectIterator) Next() bool` | Переходит к следующей паре ключ-значение |
| `Key` | `func (soi *StreamObjectIterator) Key() string` | Возвращает текущий ключ |
| `Value` | `func (soi *StreamObjectIterator) Value() any` | Возвращает текущее значение |
| `Err` | `func (soi *StreamObjectIterator) Err() error` | Возвращает ошибку итерации |

---

## Тип BatchIterator

BatchIterator используется для эффективной пакетной обработки больших массивов, снижая накладные расходы на обработку отдельных элементов.

### NewBatchIterator

Сигнатура: `func NewBatchIterator(data []any, cfg ...Config) *BatchIterator`

Создаёт пакетный итератор. Размер пакета настраивается через `Config.MaxBatchSize`.

```go
data := make([]any, 10000)
// Заполнение данных...

cfg := json.DefaultConfig()
cfg.MaxBatchSize = 100 // По 100 элементов в пакете
it := json.NewBatchIterator(data, cfg)
for it.HasNext() {
    batch := it.NextBatch()
    // Пакетная обработка
    processBatch(batch)
    fmt.Printf("Обработано %d элементов, осталось %d\n", len(batch), it.Remaining())
}
```

### Методы

| Метод | Сигнатура | Описание |
|------|------|------|
| `NextBatch` | `func (it *BatchIterator) NextBatch() []any` | Возвращает следующий пакет элементов |
| `HasNext` | `func (it *BatchIterator) HasNext() bool` | Проверяет, есть ли ещё пакеты |
| `Reset` | `func (it *BatchIterator) Reset()` | Сбрасывает итератор в начальную позицию |
| `TotalBatches` | `func (it *BatchIterator) TotalBatches() int` | Возвращает общее количество пакетов |
| `CurrentIndex` | `func (it *BatchIterator) CurrentIndex() int` | Возвращает текущую позицию |
| `Remaining` | `func (it *BatchIterator) Remaining() int` | Возвращает количество оставшихся элементов |

---

## Тип ParallelIterator

ParallelIterator используется для параллельной обработки массивов, используя многоядерные процессоры для ускорения обработки.

### NewParallelIterator

Сигнатура: `func NewParallelIterator(data []any, cfg ...Config) *ParallelIterator`

Создаёт параллельный итератор. Количество рабочих горутин настраивается через `Config.MaxConcurrency`.

```go
data := make([]any, 10000)
// Заполнение данных...

cfg := json.DefaultConfig()
cfg.MaxConcurrency = 8 // 8 рабочих горутин
it := json.NewParallelIterator(data, cfg)
err := it.ForEach(func(idx int, val any) error {
    // Параллельная обработка каждого элемента
    return processItem(idx, val)
})
if err != nil {
    panic(err)
}
```

### ForEach

Сигнатура: `func (it *ParallelIterator) ForEach(fn func(int, any) error) error`

Параллельно обрабатывает каждый элемент, возвращает первую обнаруженную ошибку.

```go
err := it.ForEach(func(idx int, val any) error {
    // Эта функция выполняется параллельно в нескольких горутинах
    return nil
})
```

### ForEachWithContext

Сигнатура: `func (it *ParallelIterator) ForEachWithContext(ctx context.Context, fn func(int, any) error) error`

Параллельная обработка с контекстом, поддерживает отмену операции.

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err := it.ForEachWithContext(ctx, func(idx int, val any) error {
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
        return processItem(idx, val)
    }
})
```

### ForEachBatch

Сигнатура: `func (it *ParallelIterator) ForEachBatch(batchSize int, fn func(int, []any) error) error`

Параллельная пакетная обработка.

```go
err := it.ForEachBatch(100, func(batchIdx int, batch []any) error {
    // Каждый пакет обрабатывается в отдельной горутине
    return processBatch(batchIdx, batch)
})
```

### ForEachBatchWithContext

Сигнатура: `func (it *ParallelIterator) ForEachBatchWithContext(ctx context.Context, batchSize int, fn func(int, []any) error) error`

Параллельная пакетная обработка с контекстом.

### Map

Сигнатура: `func (it *ParallelIterator) Map(transform func(int, any) (any, error)) ([]any, error)`

Параллельное преобразование каждого элемента, возвращает новый срез.

```go
results, err := it.Map(func(idx int, val any) (any, error) {
    if num, ok := val.(float64); ok {
        return num * 2, nil
    }
    return nil, fmt.Errorf("unexpected type at index %d", idx)
})
```

### Filter

Сигнатура: `func (it *ParallelIterator) Filter(predicate func(int, any) bool) []any`

Параллельная фильтрация элементов, возвращает срез элементов, удовлетворяющих условию.

```go
even := it.Filter(func(idx int, val any) bool {
    if num, ok := val.(float64); ok {
        return int(num)%2 == 0
    }
    return false
})
```

### Close

Сигнатура: `func (it *ParallelIterator) Close()`

Освобождает ресурсы ParallelIterator.

```go
it := json.NewParallelIterator(data, cfg)
defer it.Close()
```

---

## Методы итерации Processor

Processor также предоставляет методы итерации, подходящие для сценариев, где необходимо повторно использовать процессор.

### Foreach

Сигнатура: `func (p *Processor) Foreach(jsonStr string, fn func(key any, item *IterableValue))`

Итерирует массив или объект JSON.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
p.Foreach(`{"name": "Alice", "age": 30}`, func(key any, item *json.IterableValue) {
    fmt.Printf("Ключ: %v, Значение: %v\n", key, item.GetData())
})
```

### ForeachWithPath

Сигнатура: `func (p *Processor) ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue)) error`

Итерация по указанному пути, возвращает ошибку.

### ForeachNested

Сигнатура: `func (p *Processor) ForeachNested(jsonStr string, fn func(key any, item *IterableValue))`

Рекурсивная итерация всех вложенных уровней.

### ForeachReturn

Сигнатура: `func (p *Processor) ForeachReturn(jsonStr string, fn func(key any, item *IterableValue)) (string, error)`

Итерация с возвратом исходного JSON (операция только для чтения).

### ForeachWithPathAndControl

Сигнатура: `func (p *Processor) ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl) error`

Обход по пути с управлением потоком, позволяет контролировать процесс итерации через возвращаемое значение.

### ForeachWithPathAndIterator

Сигнатура: `func (p *Processor) ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl) error`

Итерация с информацией о пути, функция обратного вызова получает текущий полный путь. Подходит для обработки глубоко вложенных структур, где необходимо отслеживать позицию обхода.

```go
p.ForeachWithPathAndIterator(data, "users", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("Путь: %s, Ключ: %v\n", currentPath, key)
    return json.IteratorNormal
})
```

### ForeachWithError

Сигнатура: `func (p *Processor) ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error) error`

Итерация с обработкой ошибок. Когда функция обратного вызова возвращает error, итерация прерывается и возвращается эта ошибка.

```go
err := p.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    val := item.GetData()
    if val == nil {
        return fmt.Errorf("значение элемента %v равно null", key)
    }
    return processItem(val)
})
if err != nil {
    log.Fatal(err)
}
```

### ForeachNestedWithError

Сигнатура: `func (p *Processor) ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error) error`

Рекурсивная итерация всех вложенных уровней с обработкой ошибок. Когда функция обратного вызова возвращает error, итерация прерывается.

```go
err := p.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("Ключ: %v, Значение: %v\n", key, item.GetData())
    return nil
})
```

---

## Полные примеры

### Обход массива

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `[
        {"id": 1, "name": "Alice"},
        {"id": 2, "name": "Bob"},
        {"id": 3, "name": "Charlie"}
    ]`

    json.Foreach(data, func(key any, item *json.IterableValue) {
        id := item.GetInt("id")
        name := item.GetString("name")
        fmt.Printf("[%v] ID: %d, Имя: %s\n", key, id, name)
    })
}
```

### Обход объекта

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "server1": {"host": "192.168.1.1", "port": 8080},
        "server2": {"host": "192.168.1.2", "port": 8081}
    }`

    json.Foreach(data, func(key any, item *json.IterableValue) {
        fmt.Printf("Сервер: %s\n", key)
        host := item.GetString("host")
        port := item.GetInt("port")
        fmt.Printf("  Хост: %s, Порт: %d\n", host, port)
    })
}
```

### Рекурсивный обход вложенных структур

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "users": [
            {"name": "Alice", "profile": {"city": "Beijing"}},
            {"name": "Bob", "profile": {"city": "Shanghai"}}
        ]
    }`

    json.ForeachNested(data, func(key any, item *json.IterableValue) {
        // Обрабатывать только строковые значения
        if str, ok := item.GetData().(string); ok {
            fmt.Printf("Значение: %s\n", str)
        }
    })
}
```

### Потоковая обработка больших файлов

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, err := os.Open("large-array.json")
    if err != nil {
        panic(err)
    }
    defer file.Close()

    it := json.NewStreamIterator(file)
    count := 0
    
    for it.Next() {
        val := it.Value()
        // Поэлементная обработка, эффективно по памяти
        count++
        if count%1000 == 0 {
            fmt.Printf("Обработано %d элементов\n", count)
        }
    }
    
    if err := it.Err(); err != nil {
        panic(err)
    }
    
    fmt.Printf("Всего обработано %d элементов\n", count)
}
```

### Параллельная обработка

```go
package main

import (
    "fmt"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    // Разобрать массив JSON
    data := `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`
    var arr []any
    json.Unmarshal([]byte(data), &arr)

    // Создать параллельный итератор (4 рабочие горутины)
    cfg := json.DefaultConfig()
    cfg.MaxConcurrency = 4
    it := json.NewParallelIterator(arr, cfg)

    var sum int64

    err := it.ForEach(func(idx int, val any) error {
        if num, ok := val.(float64); ok {
            atomic.AddInt64(&sum, int64(num))
        }
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("Сумма: %d\n", sum) // Вывод: Сумма: 55
}
```

### Пакетная обработка

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Создать большой набор данных
    data := make([]any, 1000)
    for i := range data {
        data[i] = map[string]any{"id": i, "value": i * 10}
    }

    // По 100 элементов в пакете
    cfg := json.DefaultConfig()
    cfg.MaxBatchSize = 100
    it := json.NewBatchIterator(data, cfg)
    batchNum := 0

    for it.HasNext() {
        batch := it.NextBatch()
        batchNum++
        
        // Пакетная обработка (например, массовая запись в базу данных)
        fmt.Printf("Пакет %d: обработано %d элементов\n", batchNum, len(batch))
    }

    fmt.Printf("Всего пакетов: %d\n", it.TotalBatches())
}
```

---

## Рекомендации по производительности

1. **Избегайте длительных операций в итерации** - Итерация синхронна, длительные операции блокируют весь процесс итерации
2. **Используйте ForeachWithPath для точного позиционирования** - Избегайте обхода ненужных данных
3. **Используйте потоковую обработку для больших наборов данных** - Используйте ForeachFile или NDJSONProcessor
4. **Пакетная обработка снижает накладные расходы** - Используйте ForeachFileChunked для пакетных операций
5. **Используйте параллельную обработку для ресурсоёмких задач** - Используйте ForeachFileChunked или ParallelIterator для задействования нескольких ядер

---

## Связанные разделы

- [Processor](./processor/) - Методы процессора
- [Обработка больших файлов](./large-file) - Потоковые процессоры
- [Процессор NDJSON](./jsonl) - Обработка JSONL
- [Руководство по обработке больших файлов](../large-files) - Руководство по обработке больших файлов
