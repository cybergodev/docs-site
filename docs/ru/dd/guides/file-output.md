---
sidebar_label: "Вывод в файл и ротация"
title: "Вывод в файл и ротация - CyberGo DD | Ротация файлов"
description: "Руководство по файловому выводу и ротации логов CyberGo DD, охватывающее стратегии ротации FileWriter по размеру и очистки по времени, оптимизацию буферизованной записи BufferedWriter, многоцелевую доставку MultiWriter, динамическое управление Writer и лучшие практики для производственной среды, помогая разработчикам создавать высоконадёжные системы файлового логирования."
sidebar_position: 3
---

# Вывод в файл и ротация

DD предоставляет гибкие возможности вывода в файл с поддержкой автоматической ротации, буферизованной записи и многоцелевой доставки, подходящие для использования в производственных средах.

## Быстрый старт

### Базовый вывод в файл

```go
package main

import (
    "log"

    "github.com/cybergodev/dd"
)

func main() {
    logger, err := dd.New(dd.Config{
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/app.log"),
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    logger.Info("Лог будет записан в файл") // Вывод: запись в logs/app.log
}
```

### Двойной вывод: консоль + файл

```go
logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

## Конфигурация ротации FileWriter

FileWriter поддерживает автоматическую ротацию по размеру и очистку старых файлов по времени:

### Конфигурация по умолчанию

```go
cfg := dd.DefaultFileWriterConfig()
// MaxSizeMB:   100   — макс. 100МБ на файл
// MaxAge:      30 * 24 * time.Hour  — хранить 30 дней
// MaxBackups:  10    — макс. 10 резервных копий
// Compress:    false — без сжатия
```

### Пользовательская стратегия ротации

```go
// Высоконагруженный сервис: маленькие файлы, быстрая ротация
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxSizeMB = 50                // Ротация при 50МБ
fwCfg.MaxBackups = 20               // Хранить 20 резервных копий
fwCfg.MaxAge = 7 * 24 * time.Hour   // Очистка через 7 дней
fwCfg.Compress = true      // Сжимать старые файлы

fw, err := dd.NewFileWriter("logs/app.log", fwCfg)
if err != nil {
    log.Fatal(err)
}
logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### Лог-файл в формате JSON

```go
logger, err := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

Правила именования файлов после ротации:

```text
logs/app.log           ← Текущий лог
logs/app_log_1.log     ← Первая ротация (новейшая резервная копия)
logs/app_log_2.log     ← Более старая резервная копия
logs/app_log_1.log.gz  ← При включении Compress старые резервные копии сжимаются в .gz
```

:::info Информация
После включения `Compress` сжатие выполняется в отдельной goroutine асинхронно после завершения ротации; когда сжатие завершено, исходный `.log`-бэкап **переименовывается** в `.log.gz` — одновременно оба файла не существуют.
:::

## Буферизованная запись BufferedWriter

В сценариях с высокой пропускной способностью используйте `BufferedWriter` для уменьшения количества операций I/O:

```go
// Создание файлового Writer
fw, err := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
if err != nil {
    log.Fatal(err)
}

// Обёртка в буферизованный Writer
bwCfg := dd.DefaultBufferedWriterConfig()
// BufferSize: 1024  — 1КБ буфер
// FlushTime:  100ms — автоматический сброс каждые 100мс

bw, err := dd.NewBufferedWriter(fw, bwCfg)
if err != nil {
    log.Fatal(err)
}

logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close() // Close автоматически вызывает Flush
```

### Рекомендации по настройке

| Сценарий | BufferSize | FlushTime | Описание |
|----------|-----------|-----------|----------|
| Низкие требования к задержке | 512 | 50мс | Быстрый сброс, уменьшение задержки |
| Общий сценарий | 1024 | 100мс | Значения по умолчанию, баланс задержки и пропускной способности |
| Высокая пропускная способность | 4096 | 500мс | Большой буфер, максимальная пропускная способность |
| Пакетная обработка | 8192 | 1000мс | Максимальный буфер, подходит для офлайн-обработки |

:::warning Безопасность данных
BufferedWriter сбрасывает буфер при его наполовину заполнении (достижение BufferSize/2) или срабатывании таймера. Аномальное завершение программы может привести к потере данных в буфере. Убедитесь, что вызываете `Close()` или `Flush()` для гарантии целостности данных.
:::

## Многоцелевая доставка MultiWriter

```go
// Одновременная запись в файл и удалённый сервис
fw, err := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
if err != nil {
    log.Fatal(err)
}
remote := &RemoteLogWriter{endpoint: "http://log-service/ingest"}

mw := dd.NewMultiWriter(fw, remote)

logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

MultiWriter доставляет логи во все Writer, сбой одного Writer не влияет на другие.

## Динамическое управление Writer

Logger поддерживает добавление и удаление Writer во время выполнения:

```go
// Добавление Writer во время выполнения
fw, err := dd.NewFileWriter("logs/debug.log", dd.DefaultFileWriterConfig())
if err != nil {
    log.Fatal(err)
}
err = logger.AddWriter(fw)

// Удаление Writer во время выполнения
err = logger.RemoveWriter(fw)

// Запрос текущего количества Writer
count := logger.WriterCount()
_ = count
```

:::tip Сценарии использования
Динамический Writer подходит для сценариев, где необходимо переключать цели логирования во время выполнения, например: включение файла детального лога в режиме отладки или переключение на удалённый лог-сервис при нехватке дискового пространства.
:::

## Пользовательский Writer

Реализуйте интерфейс `io.Writer` для создания пользовательской цели вывода:

```go
// Сетевой отправитель логов
type LogstashWriter struct {
    endpoint string
    client   *http.Client
}

func (w *LogstashWriter) Write(p []byte) (n int, err error) {
    resp, err := w.client.Post(w.endpoint, "application/json", bytes.NewReader(p))
    if err != nil {
        return 0, err
    }
    defer resp.Body.Close()
    return len(p), nil
}

// Использование пользовательского Writer
logger, err := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
        dd.CustomOutput(&LogstashWriter{
            endpoint: "http://logstash:5044",
            client:   &http.Client{Timeout: 5 * time.Second},
        }),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

## Рекомендуемая конфигурация для производственной среды

```go
func NewProductionLogger() (*dd.Logger, error) {
    // Файловый Writer: средняя ротация + сжатие
    fwCfg := dd.DefaultFileWriterConfig()
    fwCfg.MaxSizeMB = 100
    fwCfg.MaxAge = 30 * 24 * time.Hour
    fwCfg.MaxBackups = 15
    fwCfg.Compress = true

    fw, err := dd.NewFileWriter("logs/app.json", fwCfg)
    if err != nil {
        return nil, err
    }

    // Буферная обёртка
    bw, err := dd.NewBufferedWriter(fw, dd.DefaultBufferedWriterConfig())
    if err != nil {
        return nil, err
    }

    return dd.New(dd.Config{
        Level:  dd.LevelInfo,
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.CustomOutput(bw),
        },
    })
}
```

## Следующие шаги

- [Структурированное логирование](./structured-logging) -- поля и цепочные вызовы
- [Фильтрация конфиденциальных данных](./sensitive-filtering) -- автоматическое маскирование
- [Справочник API - Writers](../api-reference/output-integration/writers) -- полный API Writer
- [Оптимизация производительности](../advanced/performance) -- рекомендации по настройке производительности
