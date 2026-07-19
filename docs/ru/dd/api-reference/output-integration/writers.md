---
sidebar_label: "Цели вывода"
title: "Цели вывода - CyberGo DD | FileWriter, BufferedWriter, MultiWriter"
description: "API целей вывода CyberGo DD: FileWriter с автоматической ротацией по размеру файла и очисткой старых резервных копий по времени, BufferedWriter для высокопроизводительной буферизованной записи (настраиваемый буфер и интервал сброса) и MultiWriter для параллельного вывода в несколько целей, охватывая любые сценарии вывода логов от разработки до продакшена и помогая создавать надёжные системы логирования."
sidebar_position: 1
---

# Цели вывода

DD предоставляет 3 типа writer'ов вывода, поддерживающих ротацию файлов, буферизованную запись и многоцелевой вывод.

## FileWriter

Файловый writer с автоматической ротацией.

### Создание

```go
func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)
```

Путь проходит внутреннюю проверку безопасности (обход пути, null-байты, overlong UTF-8), затем `cfg.Validate()` проверяет верхние пределы количеств, после чего нулевые/отрицательные значения откатываются к конфигурации по умолчанию. Случаи возврата ошибки:

- Путь: `ErrEmptyFilePath` / `ErrNullByte` / `ErrPathTooLong` (>4096 байт) / `ErrPathTraversal` / `ErrInvalidPath` / `ErrOverlongEncoding`
- Конфигурация: `ErrMaxSizeExceeded` (`MaxSizeMB > 10240`) / `ErrMaxBackupsExceeded` (`MaxBackups > 1000`)
- I/O: сбой создания каталога (оборачивается как `failed to create directory: …`) или сбой открытия файла (оборачивается как `failed to open file …: %w`, включает `ErrSymlinkNotAllowed` / `ErrHardlinkNotAllowed`)

<!-- check-code: skip -->
```go
// С конфигурацией по умолчанию
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// С пользовательской конфигурацией
cfg := dd.DefaultFileWriterConfig()
cfg.MaxSizeMB = 50
fw, _ = dd.NewFileWriter("logs/app.log", cfg)
```

### FileWriterConfig

Конфигурация файлового writer'а.

```go
type FileWriterConfig struct {
    MaxSizeMB  int            // Макс. размер файла МБ (по умолчанию 100)
    MaxAge     time.Duration  // Время хранения старых файлов (по умолчанию 30 дней)
    MaxBackups int            // Количество резервных копий (по умолчанию 10)
    Compress   bool           // gzip сжатие (по умолчанию false)
}
```

### Конфигурация по умолчанию

```go
func DefaultFileWriterConfig() FileWriterConfig
```

Значения по умолчанию: ограничение размера 100МБ, хранение 30 дней, 10 файлов резервных копий.

### Validate

```go
func (c FileWriterConfig) Validate() error
```

Проверяет корректность конфигурации файлового writer'а. Случаи возврата ошибки:

- `MaxSizeMB` превышает 10240 (возвращает `ErrMaxSizeExceeded`)
- `MaxBackups` превышает 1000 (возвращает `ErrMaxBackupsExceeded`)

Отрицательные значения не вызывают ошибку `Validate`; при этом нулевые или отрицательные значения `MaxSizeMB` откатываются к 100МБ при применении значений по умолчанию, тогда как отрицательные значения `MaxBackups` / `MaxAge` сохраняются как есть (подробнее см. ниже «Правило применения значений по умолчанию»).

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Write` | `(p []byte) (int, error)` | Запись данных (реализует `io.Writer`); перед записью проверяет размер и инициирует ротацию, для закрытого writer возвращает `os.ErrClosed` |
| `SetOnRotateCallback` | `(fn func(path string))` | Установка callback, вызываемого после успешной ротации файла |
| `Close` | `() error` | Останавливает goroutine очистки и закрывает базовый файл; безопасен для многократного вызова (защита CAS) |

### Коллбэк ротации

```go
func (fw *FileWriter) SetOnRotateCallback(fn func(path string))
```

Устанавливает функцию callback, вызываемую **после успешной ротации файла**. Callback получает `path` — базовый путь текущего лог-файла (путь, сохранённый после нормализации пути при конструировании `NewFileWriter` — для абсолютных путей на входе обычно равен аргументу, для относительных путей разрешается в абсолютный): к этому моменту старый лог архивирован как резервная копия, а новый файл вновь открыт по этому пути. При установке берётся внутренний мьютекс, чтобы избежать гонки с выполняющейся ротацией.

:::info Внутреннее использование
Этот метод в основном используется внутри `Logger` — когда `FileWriter` является целью вывода Logger, Logger через него инициирует событие хука `HookOnRotate` (подробнее см. [система хуков](../security-audit/hooks)). Обычным пользователям обычно не требуется вызывать его вручную; при необходимости пользовательского поведения после ротации его можно задать напрямую.
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// Установка callback ротации: вывод пути текущего файла после каждой ротации
fw.SetOnRotateCallback(func(path string) {
    fmt.Println("лог ротирован, текущий файл:", path)
})

// Callback вызывается после того, как файл превысил MaxSizeMB и ротирован
fw.Write([]byte("Содержимое лога\n"))
```

### Ротация и очистка файлов

Ротация и очистка FileWriter выполняются по двум независимым путям:

- **Ротация (rotation)**: в вызове `Write` проверяется размер текущего файла, при превышении `MaxSizeMB` (по умолчанию 100МБ) инициируется ротация — старый файл переименовывается в резервную копию, новый файл открывается повторно с `O_EXCL` (защита от TOCTOU через символические ссылки), затем `internal.RotateBackups` усекает цепочку резервных копий по `MaxBackups`, а при `Compress=true` отдельная goroutine выполняет gzip-сжатие резервных копий.
- **Очистка (cleanup)**: только при `MaxAge > 0` и `MaxBackups > 0` запускается фоновая goroutine, раз в час сканирующая файлы и вызывающая `internal.CleanupOldFiles` для удаления резервных копий старше `MaxAge` (по умолчанию 30 дней).

:::tip Правило применения значений по умолчанию
Нулевые или отрицательные `MaxSizeMB` всегда откатываются к 100МБ. Правила комбинации `MaxAge`/`MaxBackups`: ① оба равны 0 → включается полная конфигурация по умолчанию (30 дней + 10 копий, запускается goroutine очистки); ② задан только `MaxBackups` → усечение цепочки копий только по количеству, при `MaxAge=0` goroutine очистки не запускается; ③ задан только `MaxAge` → `MaxBackups` откатывается к 10.
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// При записи сверх MaxSizeMB автоматически инициируется ротация
fw.Write([]byte("Содержимое лога\n"))

// Файлы после ротации:
// logs/app.log      (текущий)
// logs/app_log_1.log (новейшая резервная копия)
// logs/app_log_2.log (более ранняя резервная копия)
// При включении Compress старые резервные копии асинхронно сжимаются в logs/app_log_1.log.gz
```

:::tip Функции безопасности
FileWriter имеет встроенную защиту от обхода пути, null-байтов, символических и жёстких ссылок, а также overlong UTF-8; новый файл открывается с `O_EXCL` для защиты от атак TOCTOU.
:::

## BufferedWriter

Буферизованный writer, уменьшающий количество системных вызовов.

### Создание

```go
func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)
```

При конструировании сначала отклоняется `nil` базовый writer (`ErrNilWriter`), затем вызывается `cfg.Validate()`, после чего `BufferSize` меньше значения по умолчанию (1КБ) зажимается к значению по умолчанию, а `FlushTime <= 0` зажимается к 100мс. Случаи возврата ошибки:

- `ErrNilWriter`: `w == nil`
- `ErrBufferSizeTooLarge`: `BufferSize > 10МБ` (возвращается `Validate`)
- Некорректная конфигурация: `BufferSize < 0` или `FlushTime < 0` (возвращается `Validate`)

<!-- check-code: skip -->
```go
// С конфигурацией по умолчанию
bw, _ := dd.NewBufferedWriter(os.Stdout, dd.DefaultBufferedWriterConfig())

// С пользовательской конфигурацией
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 4096
bw, _ = dd.NewBufferedWriter(os.Stdout, cfg)
```

### BufferedWriterConfig

Конфигурация буферизованного writer'а.

```go
type BufferedWriterConfig struct {
    BufferSize int            // Размер буфера (байт, по умолчанию 1024 = 1КБ, верхний предел 10МБ)
    FlushTime  time.Duration  // Интервал периодического сброса (по умолчанию 100мс)
}
```

### Конфигурация по умолчанию

```go
func DefaultBufferedWriterConfig() BufferedWriterConfig
```

Значения по умолчанию: буфер 1КБ, интервал сброса 100мс.

### Validate

```go
func (c BufferedWriterConfig) Validate() error
```

Проверяет корректность конфигурации буферизованного writer'а. Случаи возврата ошибки:

- `BufferSize` отрицательное число
- `BufferSize` превышает 10МБ (возвращает `ErrBufferSizeTooLarge`)
- `FlushTime` отрицательное число

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Write` | `(p []byte) (int, error)` | Запись в буфер; при достижении размера буферизованных данных ≥ `BufferSize/2` автоматически выполняется flush |
| `Flush` | `() error` | Явный сброс буфера в базовый Writer |
| `Close` | `() error` | Сначала flush буфера и остановка фоновой goroutine, затем закрытие базового Writer (если он реализует `io.Closer`) |

Фоновая goroutine проверяет с периодом `FlushTime`: автоматический flush срабатывает только когда буфер не пуст и с момента последнего flush прошло ≥ `FlushTime`. Многократный вызов `Close` безопасен (защита CAS); при закрытии `Write` возвращает `os.ErrClosed`.

<!-- check-code: skip -->
```go
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(file, cfg)
bw.Write([]byte("Строка лога\n"))
_ = bw.Flush()      // Явный сброс в базовый Writer
defer bw.Close()    // Close сначала выполнит Flush, затем закроет базовый Writer
```

## MultiWriter

Управление несколькими writer'ами, одновременная запись в несколько целей.

### Создание

```go
func NewMultiWriter(writers ...io.Writer) *MultiWriter
```

`nil` writer'ы при конструировании молча игнорируются. Возвращаемое значение никогда не равно `nil` (конструктор не возвращает ошибку).

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(os.Stdout, fileWriter)
```

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Write` | `(p []byte) (int, error)` | Запись во все цели (см. политику ошибок ниже) |
| `AddWriter` | `(w io.Writer) error` | Динамическое добавление цели (дубликаты writer'ов молча принимаются) |
| `RemoveWriter` | `(w io.Writer) error` | Динамическое удаление цели |
| `Close` | `() error` | Закрытие всех базовых `io.Closer` (кроме стандартных потоков) |

Случаи возврата ошибки `AddWriter`: `ErrNilMultiWriter` (получатель `nil`) / `ErrNilWriter` (аргумент `nil`) / `ErrMaxWritersExceeded` (уже зарегистрировано ≥ 100).
Случаи возврата ошибки `RemoveWriter`: `ErrNilMultiWriter` / `ErrWriterNotFound`.

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(console, file)

// Динамическое управление
_ = mw.AddWriter(anotherFile)
_ = mw.RemoveWriter(console)

// Закрытие всех базовых writer'ов (стандартные потоки вроде os.Stdout не закрываются)
_ = mw.Close()
```

### Типы ошибок

Ошибки, возвращаемые при неудаче `Write`, обёрнуты в два открытых типа (определены в `errors.go`):

```go
// Ошибка одного writer'а
type WriterError struct {
    Index  int       // Индекс этого writer'а в MultiWriter
    Writer io.Writer // writer, в котором произошла ошибка
    Err    error     // Базовая ошибка
}

// Агрегация ошибок нескольких writer'ов (Write возвращает *MultiWriterError)
type MultiWriterError struct {
    Errors []WriterError
}
```

Методы обоих типов:

| Тип | Метод | Описание |
|------|-------|----------|
| `*WriterError` | `Error() string` | Имеет вид `writer[i]: <err>`; при `Err == nil` показывает unknown error |
| `*WriterError` | `Unwrap() error` | Возвращает `Err`, для цепочного сопоставления через `errors.Is` |
| `*MultiWriterError` | `Error() string` | При одной ошибке возвращает её напрямую; при нескольких — `multiple writer errors: [...]` |
| `*MultiWriterError` | `Unwrap() []error` | Возвращает все `WriterError.Err`, для `errors.As` / `errors.Is` |
| `*MultiWriterError` | `HasErrors() bool` | Есть ли собранные ошибки |
| `*MultiWriterError` | `ErrorCount() int` | Количество ошибок |
| `*MultiWriterError` | `FirstError() error` | Первая ошибка (`*WriterError`), если её нет — `nil` |

### Политика ошибок

`Write` использует стратегию «максимальных усилий»: неудача одного writer'а не влияет на другие. Ошибки базовых writer'ов собираются в `MultiWriterError`, реализующий `Unwrap() []error` для использования с `errors.As`/`errors.Is`. При полной неудаче возвращается `(0, *MultiWriterError)`; при частичной — `(pLen, *MultiWriterError)`; недостаточное число записанных байт фиксируется как ошибка short write.

:::warning Оптимизация для одного writer'а
Когда базовый writer всего один, `Write` проходит быстрый путь и напрямую перенаправляет вызов — ошибка возвращается как есть, без оборачивания в `MultiWriterError`.
:::

## Комбинированное использование

```go
// Файл + буфер + многоцелевой вывод
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
bw, _ := dd.NewBufferedWriter(fw, dd.DefaultBufferedWriterConfig())
mw := dd.NewMultiWriter(os.Stdout, bw)

logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
defer logger.Close()  // Автоматический сброс буфера и закрытие файла
```

## Следующие шаги

- [Конфигурация](../core/config) -- конфигурация OutputTarget в Config
- [Logger](../core/logger) -- AddWriter / RemoveWriter
- [Фильтрация безопасности](../security-audit/security) -- защита путей
