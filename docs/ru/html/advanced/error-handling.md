---
title: "Обработка ошибок - HTML"
description: "Полное руководство по обработке ошибок библиотеки CyberGo HTML, включая пять категорий ошибок (ошибки ввода, ошибки конфигурации, ошибки файлов, ошибки обработки, системные ошибки), паттерн определения сигнатурных ошибок через errors.Is, извлечение структурированной информации об ошибках через errors.As, обработку отмены контекста context и паттерны обработки частичных неудач при пакетной обработке, помогает построить надёжную логику обработки ошибок."
---

# Обработка ошибок

## Классификация ошибок

Ошибки библиотеки HTML делятся на следующие категории:

| Категория | Сигнатурные ошибки | Описание |
|------|----------|------|
| Ошибки ввода | `ErrInputTooLarge`, `ErrInvalidHTML` | Проблемы с содержимым ввода |
| Ошибки конфигурации | `ErrInvalidConfig`, `ErrMultipleConfigs` | Проблемы конфигурации |
| Файловые ошибки | `ErrFileNotFound`, `ErrInvalidFilePath` | Проблемы файловых операций |
| Ошибки обработки | `ErrProcessingTimeout`, `ErrMaxDepthExceeded` | Проблемы в процессе обработки |
| Системные ошибки | `ErrProcessorClosed`, `ErrInternalPanic` | Проблемы внутреннего состояния |

## Паттерн errors.Is

Использование `errors.Is` для определения типа ошибки:

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        slog.Warn("Ввод слишком большой, уменьшите размер документа")
    case errors.Is(err, html.ErrInvalidHTML):
        slog.Warn("Некорректный HTML, проверьте ввод")
    case errors.Is(err, html.ErrProcessingTimeout):
        slog.Warn("Тайм-аут обработки, документ может быть слишком сложным")
    case errors.Is(err, html.ErrFileNotFound):
        slog.Warn("Файл не существует")
    case errors.Is(err, html.ErrMaxDepthExceeded):
        slog.Warn("Глубина DOM слишком велика, возможно злонамеренная конструкция")
    case errors.Is(err, html.ErrInternalPanic):
        slog.Error("Восстановление после внутренней паники, пожалуйста, сообщите об этой проблеме")
    default:
        slog.Error("Неизвестная ошибка", "err", err)
    }
}
```

## Паттерн errors.As

Извлечение структурированной информации об ошибках:

```go
var inputErr *html.InputError
var configErr *html.ConfigError
var fileErr *html.FileError

if errors.As(err, &inputErr) {
    fmt.Printf("Размер %d превышает лимит %d\n", inputErr.Size, inputErr.MaxSize)
}

if errors.As(err, &configErr) {
    fmt.Printf("Поле %s значение %v некорректно: %s\n", configErr.Field, configErr.Value, configErr.Message)
}

if errors.As(err, &fileErr) {
    fmt.Printf("Файловая операция: %s\n", fileErr.SafePath())
}
```

## Отмена через контекст

Использование версий `WithContext` для поддержки отмены:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if err != nil {
    if ctx.Err() == context.DeadlineExceeded {
        // Тайм-аут
    } else if ctx.Err() == context.Canceled {
        // Ручная отмена
    }
}
```

## Ошибки пакетной обработки

Результаты пакетной обработки содержат как успешные, так и неудачные операции:

```go
batch := p.ExtractBatch(pages)

for i, err := range batch.Errors {
    if err != nil {
        fmt.Printf("Элемент %d не удался: %v\n", i, err)
    }
}

fmt.Printf("Успешно: %d, Неудачно: %d, Отменено: %d\n",
    batch.Success, batch.Failed, batch.Cancelled)
```
