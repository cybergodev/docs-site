---
title: "Цели вывода - CyberGo DD | FileWriter, BufferedWriter, MultiWriter"
description: "Полная документация API целей вывода CyberGo DD, включая FileWriter с автоматической ротацией файлов (поддержка ротации по размеру и времени), BufferedWriter высокопроизводительной буферизованной записи (настраиваемый размер буфера и интервал сброса) и MultiWriter параллельного вывода в несколько целей, удовлетворяющая все сценарии вывода логов от отладки разработки до развёртывания в продакшене."
---

# Цели вывода

DD предоставляет 3 типа writer'ов вывода, поддерживающих ротацию файлов, буферизованную запись и многоцелевой вывод.

## FileWriter

Файловый writer с автоматической ротацией.

### Создание

```go
func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)
```

```go
// С конфигурацией по умолчанию
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// С пользовательской конфигурацией
cfg := dd.DefaultFileWriterConfig()
cfg.MaxSizeMB = 50
fw, _ := dd.NewFileWriter("logs/app.log", cfg)
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

Проверяет корректность конфигурации файлового writer'а.

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Write` | `(p []byte) (int, error)` | Запись данных (реализует io.Writer) |
| `Close` | `() error` | Закрытие файлового writer'а |

### Ротация файлов

FileWriter поддерживает автоматическую ротацию по следующим условиям:

- Размер файла превышает лимит (по умолчанию 100МБ)
- Возраст файла превышает максимальное время хранения (по умолчанию 30 дней)
- Количество резервных копий превышает лимит (по умолчанию 10)

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// Автоматическая ротация при записи
fw.Write([]byte("Содержимое лога\n"))

// Файлы после ротации:
// logs/app.log      (текущий)
// logs/app.log.1    (предыдущая резервная копия)
// logs/app.log.2    (более ранняя резервная копия)
```

:::tip Функции безопасности
FileWriter имеет встроенную защиту от обхода пути, отклоняет `..`, символические ссылки и другие небезопасные пути.
:::

## BufferedWriter

Буферизованный writer, уменьшающий количество системных вызовов.

### Создание

```go
func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)
```

```go
// С конфигурацией по умолчанию
bw, _ := dd.NewBufferedWriter(os.Stdout, dd.DefaultBufferedWriterConfig())

// С пользовательской конфигурацией
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 4096
bw, _ := dd.NewBufferedWriter(os.Stdout, cfg)
```

### BufferedWriterConfig

Конфигурация буферизованного writer'а.

```go
type BufferedWriterConfig struct {
    BufferSize int            // Размер буфера (байт, по умолчанию 1024 = 1КБ)
    FlushTime  time.Duration  // Интервал автоматического сброса (по умолчанию 100мс)
}
```

### Конфигурация по умолчанию

```go
func DefaultBufferedWriterConfig() BufferedWriterConfig
```

### Validate

```go
func (c BufferedWriterConfig) Validate() error
```

Проверяет корректность конфигурации буферизованного writer'а.

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Write` | `(p []byte) (int, error)` | Запись в буфер |
| `Flush` | `() error` | Сброс буфера в базовый Writer |
| `Close` | `() error` | Сброс и закрытие |

```go
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(file, cfg)
bw.Write([]byte("Строка лога\n"))
bw.Flush()  // Гарантированная запись на диск
defer bw.Close()  // Close автоматически вызывает Flush
```

## MultiWriter

Управление несколькими writer'ами, одновременная запись в несколько целей.

### Создание

```go
func NewMultiWriter(writers ...io.Writer) *MultiWriter
```

```go
mw := dd.NewMultiWriter(os.Stdout, fileWriter)
```

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Write` | `(p []byte) (int, error)` | Запись во все цели |
| `AddWriter` | `(w io.Writer) error` | Динамическое добавление цели записи |
| `RemoveWriter` | `(w io.Writer) error` | Динамическое удаление цели записи |
| `Close` | `() error` | Закрытие всех writer'ов |

```go
mw := dd.NewMultiWriter(console, file)

// Динамическое управление
mw.AddWriter(anotherFile)
mw.RemoveWriter(console)

// Закрытие всех базовых writer'ов
mw.Close()
```

:::warning Обработка ошибок
MultiWriter использует стратегию "максимальных усилий": сбой одного Writer не влияет на другие. Ошибки возвращаются через `MultiWriterError`.
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

- [Конфигурация](./config) -- конфигурация OutputTarget в Config
- [Logger](./logger) -- AddWriter / RemoveWriter
- [Фильтрация безопасности](./security) -- защита путей
