---
title: Обработка ошибок - CyberGo env | Сторожевые ошибки и стратегии восстановления
description: CyberGo env библиотека полное руководство по шаблонам обработки ошибок и лучшим практикам, включая проверку сторожевых ошибок errors.Is, извлечение структурированных ошибок errors.As, стратегии восстановления и деградации, пользовательская обёртка ошибок и отслеживание цепочки ошибок.
---

# Обработка ошибок

Библиотека env предоставляет структурированный механизм обработки ошибок с поддержкой шаблонов `errors.Is` и `errors.As`.

## Сторожевые ошибки

### Ошибки файлов

```go
var (
    ErrFileNotFound  = errors.New("file not found")
    ErrFileTooLarge  = errors.New("file exceeds maximum size limit")
)
```

**Пример использования:**

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    log.Println("Файл конфигурации не найден")
}
if errors.Is(err, env.ErrFileTooLarge) {
    log.Println("Файл конфигурации слишком большой")
}
```

### Ошибки парсинга

```go
var (
    ErrLineTooLong  = errors.New("line exceeds maximum length limit")
    ErrInvalidKey   = errors.New("invalid key format")
    ErrDuplicateKey = errors.New("duplicate key encountered")
)
```

### Ошибки безопасности

```go
var (
    ErrForbiddenKey      = errors.New("key is forbidden for security reasons")
    ErrSecurityViolation = errors.New("security policy violation")
    ErrNullByte          = errors.New("null byte detected in input")
    ErrControlChar       = errors.New("control character detected in input")
    ErrInvalidValue      = errors.New("invalid value content")
)
```

**Проверка запрещённых ключей:**

```go
err := loader.Set("PATH", "/malicious")
if errors.Is(err, env.ErrForbiddenKey) {
    log.Println("Попытка установить запрещённый ключ")
}
```

### Ошибки подстановки

```go
var ErrExpansionDepth = errors.New("variable expansion depth exceeded")
```

### Ошибки состояния

```go
var (
    ErrClosed             = errors.New("loader has been closed")
    ErrInvalidConfig      = errors.New("invalid configuration")
    ErrAlreadyInitialized = errors.New("default loader already initialized")
    ErrMissingRequired    = errors.New("required key is missing")
)
```

## Структурированные типы ошибок

### ParseError

Ошибка парсинга с информацией о позиции:

```go
type ParseError struct {
    File    string  // Имя файла
    Line    int     // Номер строки
    Content string  // Содержимое ошибки
    Err     error   // Исходная ошибка
}
```

**Пример использования:**

```go
err := loader.LoadFiles(".env")

var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    log.Printf("Ошибка парсинга %s:%d - %s\n",
        parseErr.File, parseErr.Line, parseErr.Err)
    // Вывод: Ошибка парсинга .env:15 - invalid key format
}
```

### FileError

Ошибка файловой операции:

```go
type FileError struct {
    Path  string  // Путь к файлу
    Op    string  // Операция
    Err   error   // Исходная ошибка
    Size  int64   // Размер файла
    Limit int64   // Ограничение
}
```

**Пример использования:**

```go
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    if fileErr.Size > 0 {
        log.Printf("Файл %s размер %d превышает ограничение %d\n",
            fileErr.Path, fileErr.Size, fileErr.Limit)
    }
}
```

### SecurityError

Ошибка безопасности:

```go
type SecurityError struct {
    Action  string  // Действие
    Reason  string  // Причина
    Key     string  // Имя ключа
    Details string  // Подробности
}
```

**Пример использования:**

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    log.Printf("Ошибка безопасности: %s - %s (ключ: %s)\n",
        secErr.Action, secErr.Reason, secErr.Key)
}
```

### ValidationError

Ошибка валидации:

```go
type ValidationError struct {
    Field   string  // Имя поля
    Value   string  // Значение
    Rule    string  // Правило
    Message string  // Сообщение
}
```

**Пример использования:**

```go
var valErr *env.ValidationError
if errors.As(err, &valErr) {
    log.Printf("Ошибка валидации: поле %s - %s\n", valErr.Field, valErr.Message)
}
```

### ExpansionError

Ошибка подстановки переменных:

```go
type ExpansionError struct {
    Key   string  // Имя ключа
    Depth int     // Текущая глубина
    Limit int     // Ограничение
    Chain string  // Цепочка подстановки
}
```

**Пример использования:**

```go
var expErr *env.ExpansionError
if errors.As(err, &expErr) {
    log.Printf("Превышена глубина подстановки: %s (цепочка: %s)\n", expErr.Key, expErr.Chain)
}
```

### Ошибки форматов

```go
type JSONError struct {
    Path    string
    Message string
    Err     error
}

type YAMLError struct {
    Path    string
    Line    int
    Column  int
    Message string
    Err     error
}

type MarshalError struct {
    Field   string
    Message string
}
```

## Шаблоны обработки ошибок

### Шаблон errors.Is

Проверка сторожевых ошибок:

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // Файл не найден
    log.Println("Файл конфигурации не найден, используются значения по умолчанию")

case errors.Is(err, env.ErrFileTooLarge):
    // Файл слишком большой
    log.Fatal("Файл конфигурации слишком большой")

case errors.Is(err, env.ErrForbiddenKey):
    // Запрещённый ключ
    log.Fatal("Обнаружен запрещённый ключ")

case errors.Is(err, env.ErrInvalidKey):
    // Недопустимый формат ключа
    log.Fatal("Обнаружен недопустимый ключ")

case err != nil:
    // Другая ошибка
    log.Fatalf("Ошибка загрузки: %v", err)
}
```

### Шаблон errors.As

Извлечение подробной информации об ошибке:

```go
err := loader.LoadFiles(".env")
if err == nil {
    return
}

// Попытка извлечь ошибку парсинга
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    log.Fatalf("Ошибка парсинга в %s строка %d: %v",
        parseErr.File, parseErr.Line, parseErr.Err)
}

// Попытка извлечь ошибку файла
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    log.Fatalf("Ошибка файла %s: %v", fileErr.Path, fileErr.Err)
}

// Попытка извлечь ошибку безопасности
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    log.Fatalf("Ошибка безопасности: %s - %s", secErr.Action, secErr.Reason)
}

// Другая ошибка
log.Fatalf("Неизвестная ошибка: %v", err)
```

### Комбинированная обработка

```go
func handleLoadError(err error) {
    if err == nil {
        return
    }

    // Сначала проверить сторожевые ошибки
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        log.Println("Предупреждение: Файл конфигурации не найден")
        return

    case errors.Is(err, env.ErrFileTooLarge):
        var fileErr *env.FileError
        errors.As(err, &fileErr)
        log.Fatalf("Файл %s слишком большой (%d > %d)",
            fileErr.Path, fileErr.Size, fileErr.Limit)
    }

    // Затем проверить структурированные ошибки
    var parseErr *env.ParseError
    if errors.As(err, &parseErr) {
        log.Fatalf("Ошибка парсинга %s:%d - %v",
            parseErr.File, parseErr.Line, parseErr.Err)
    }

    var secErr *env.SecurityError
    if errors.As(err, &secErr) {
        log.Fatalf("Ошибка безопасности: %s", secErr.Reason)
    }

    // Неизвестная ошибка
    log.Fatalf("Ошибка: %v", err)
}
```

## Шаблоны восстановления

### Изящная деградация

```go
func loadConfig() *Config {
    cfg := env.ProductionConfig()
    cfg.Filenames = nil
    loader, err := env.New(cfg)
    if err != nil {
        log.Printf("Ошибка конфигурации: %v, используются значения по умолчанию", err)
        return defaultConfig()
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        if errors.Is(err, env.ErrFileNotFound) {
            log.Println("Файл конфигурации не найден, используются значения по умолчанию")
            return defaultConfig()
        }
        log.Fatalf("Ошибка загрузки: %v", err)
    }

    if err := loader.Validate(); err != nil {
        log.Fatalf("Ошибка валидации: %v", err)
    }

    return parseConfig(loader)
}
```

### Шаблон повторных попыток

```go
func loadWithRetry(filenames []string, maxRetries int) error {
    cfg := env.DefaultConfig()
    cfg.Filenames = nil
    loader, err := env.New(cfg)
    if err != nil {
        return err
    }
    defer loader.Close()

    for i := 0; i < maxRetries; i++ {
        err := loader.LoadFiles(filenames...)
        if err == nil {
            return nil
        }

        if errors.Is(err, env.ErrFileNotFound) {
            time.Sleep(time.Second * time.Duration(i+1))
            continue
        }

        return err
    }

    return errors.New("max retries exceeded")
}
```

## Полный пример

```go
package main

import (
    "errors"
    "fmt"
    "log"

    "github.com/cybergodev/env"
)

func main() {
    cfg := env.ProductionConfig()
    cfg.Filenames = nil
    cfg.FailOnMissingFile = true
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        handleLoadError(err)
    }

    if err := loader.Validate(); err != nil {
        handleValidationError(err)
    }

    log.Println("Конфигурация успешно загружена")
}

func handleLoadError(err error) {
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        log.Fatal("Файл конфигурации не найден")

    case errors.Is(err, env.ErrFileTooLarge):
        var fileErr *env.FileError
        errors.As(err, &fileErr)
        log.Fatalf("Файл слишком большой: %s (%d bytes)", fileErr.Path, fileErr.Size)

    case errors.Is(err, env.ErrForbiddenKey):
        log.Fatal("Обнаружен запрещённый ключ")
    }

    // Структурированные ошибки
    var parseErr *env.ParseError
    if errors.As(err, &parseErr) {
        log.Fatalf("Ошибка парсинга %s:%d - %v",
            parseErr.File, parseErr.Line, parseErr.Err)
    }

    var secErr *env.SecurityError
    if errors.As(err, &secErr) {
        log.Fatalf("Ошибка безопасности: %s - %s", secErr.Action, secErr.Reason)
    }

    log.Fatalf("Ошибка загрузки: %v", err)
}

func handleValidationError(err error) {
    var valErr *env.ValidationError
    if errors.As(err, &valErr) {
        log.Fatalf("Ошибка валидации: %s - %s", valErr.Field, valErr.Message)
    }

    if errors.Is(err, env.ErrMissingRequired) {
        log.Fatal("Отсутствует обязательный ключ")
    }

    log.Fatalf("Ошибка валидации: %v", err)
}
```

## Связанная документация

- [Константы и ошибки](/ru/env/api-reference/constants) - Полный список ошибок
- [Config API](/ru/env/api-reference/config) - Настройка ограничений конфигурации
- [Обзор безопасности](/ru/env/security/) - Обработка ошибок безопасности
