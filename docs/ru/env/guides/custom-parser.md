---
title: Пользовательский парсер - CyberGo env | Расширение форматов файлов
description: CyberGo env библиотека полное руководство по разработке пользовательских парсеров, описание реализации интерфейса EnvParser для создания парсеров пользовательских форматов файлов, регистрация через ComponentFactory и интеграция в процесс загрузки, расширение поддерживаемых библиотекой env форматов конфигурационных файлов.
---

# Пользовательский парсер

В этом руководстве описывается создание и регистрация пользовательских парсеров форматов файлов для расширения поддерживаемых библиотекой env форматов конфигурации.

## Интерфейс парсера

### EnvParser

Все парсеры должны реализовать этот интерфейс:

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

**Параметры:**
- `r` - читатель содержимого файла
- `filename` - имя файла (для сообщений об ошибках)

**Возвращает:**
- `map[string]string` - разобранные пары ключ-значение
- `error` - ошибка парсинга

---

## Создание пользовательского парсера

### Базовая структура

```go
package myparser

import (
    "io"
    "github.com/cybergodev/env"
)

// Пользовательский парсер
type CustomParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

// Реализация интерфейса EnvParser
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // 1. Прочитать содержимое (учитывая ограничения размера)
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize))
    if err != nil {
        return nil, err
    }

    // 2. Разобрать содержимое в пары ключ-значение
    // ... логика парсинга

    // 3. Валидация результатов
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, err
        }
    }

    // 4. Вернуть результат
    return result, nil
}
```

### Пример парсера TOML

```go
package main

import (
    "fmt"
    "io"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// TOMLParser разбирает формат TOML
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()

    // Ограничить размер чтения
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
    if err != nil {
        return nil, err
    }
    if int64(len(content)) > p.cfg.MaxFileSize {
        return nil, fmt.Errorf("file exceeds size limit")
    }

    result := make(map[string]string)
    lines := strings.Split(string(content), "\n")

    var currentSection string

    for lineNum, line := range lines {
        line = strings.TrimSpace(line)

        // Пропустить пустые строки и комментарии
        if line == "" || strings.HasPrefix(line, "#") {
            continue
        }

        // Разобрать section [section]
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            currentSection = strings.Trim(line, "[]")
            continue
        }

        // Разобрать key = value
        parts := strings.SplitN(line, "=", 2)
        if len(parts) != 2 {
            continue // или вернуть ошибку
        }

        key := strings.TrimSpace(parts[0])
        value := strings.TrimSpace(parts[1])

        // Добавить префикс section
        if currentSection != "" {
            key = currentSection + "_" + key
        }

        // Удалить кавычки
        value = strings.Trim(value, "\"'")

        // Преобразовать в верхний регистр
        key = strings.ToUpper(key)

        // Валидация ключа
        if err := p.validator.ValidateKey(key); err != nil {
            _ = p.auditor.LogError(env.ActionParse, key, err.Error())
            return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
        }

        result[key] = value
    }

    // Проверить количество переменных
    if len(result) > p.cfg.MaxVariables {
        return nil, fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    _ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed TOML: "+filename, true, time.Since(start))
    return result, nil
}
```

### Пример парсера INI

```go
package main

import (
    "fmt"
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// INIParser разбирает формат INI
type INIParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *INIParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
    if err != nil {
        return nil, err
    }

    result := make(map[string]string)
    lines := strings.Split(string(content), "\n")

    var currentSection string

    for lineNum, line := range lines {
        line = strings.TrimSpace(line)

        // Пропустить пустые строки и комментарии
        if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
            continue
        }

        // Section
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            currentSection = strings.Trim(line, "[]")
            continue
        }

        // Key=Value
        if idx := strings.Index(line, "="); idx > 0 {
            key := strings.TrimSpace(line[:idx])
            value := strings.TrimSpace(line[idx+1:])

            if currentSection != "" {
                key = currentSection + "_" + key
            }

            // Валидация
            if err := p.validator.ValidateKey(strings.ToUpper(key)); err != nil {
                return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
            }

            result[strings.ToUpper(key)] = value
        }
    }

    return result, nil
}
```

---

## Регистрация парсера

### Тип ParserFactory

```go
type ParserFactory func(cfg Config, factory *ComponentFactory) (EnvParser, error)
```

Фабричная функция получает Config и ComponentFactory, возвращает экземпляр парсера.

**Описание параметров:**
- `cfg` - объект конфигурации, содержащий все ограничения и настройки безопасности
- `factory` - фабрика компонентов, можно получить Validator, Auditor и другие компоненты

### Функция RegisterParser

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

Регистрирует парсер пользовательского формата.

**Параметры:**
- `format` - константа формата файла (рекомендуется использовать значения 100+ для предотвращения конфликтов)
- `factory` - фабричная функция парсера

**Возвращает:**
- `error` - ошибка при неудачной регистрации

**Случаи ошибок:**
- Встроенные форматы (FormatEnv, FormatJSON, FormatYAML) не могут быть переопределены
- Формат уже зарегистрирован

**Примечания:**
- Регистрация должна быть выполнена до вызова `env.New()`
- Рекомендуется регистрировать в функции `init()`

### Использование ComponentFactory

Получение валидатора и аудитора через ComponentFactory:

```go
type SecureParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func NewSecureParser(cfg env.Config, factory *env.ComponentFactory) (env.EnvParser, error) {
    return &SecureParser{
        cfg:       cfg,
        validator: factory.Validator(),
        auditor:   factory.Auditor(),
    }, nil
}

func (p *SecureParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // ... логика парсинга

    // Использовать валидатор для проверки имён ключей
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            _ = p.auditor.Log(env.ActionParse, key, "invalid key", false)
            return nil, err
        }
    }

    _ = p.auditor.Log(env.ActionParse, "", "parse completed", true)
    return result, nil
}
```

### Полный пример регистрации

```go
package main

import (
    "github.com/cybergodev/env"
)

// 1. Определить константы формата (рекомендуется использовать значения 100+)
const (
    FormatTOML env.FileFormat = 100
    FormatINI  env.FileFormat = 101
    FormatXML  env.FileFormat = 102
)

// 2. Зарегистрировать в init
func init() {
    // Зарегистрировать TOML парсер
    err := env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err) // Формат уже зарегистрирован или другая ошибка
    }

    // Зарегистрировать INI парсер
    env.RegisterParser(FormatINI, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &INIParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}

func main() {
    // Регистрация должна быть завершена до New (уже выполнена в init)

    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // Теперь можно загружать .toml файлы
    loader.LoadFiles("config.toml")
}
```

---

## Лучшие практики

### 1. Соблюдение ограничений конфигурации

```go
func (p *CustomParser) checkLimits(result map[string]string) error {
    // Проверить количество переменных
    if len(result) > p.cfg.MaxVariables {
        return fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    // Проверить длину ключей и значений
    for key, value := range result {
        if len(key) > p.cfg.MaxKeyLength {
            return fmt.Errorf("key too long: %s", key)
        }
        if len(value) > p.cfg.MaxValueLength {
            return fmt.Errorf("value too long for: %s", key)
        }
    }

    return nil
}
```

### 2. Использование валидатора

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // ... логика парсинга

    // Валидация всех ключей
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, fmt.Errorf("invalid key %q: %w", key, err)
        }
    }

    // Валидация всех значений (если включено)
    if p.cfg.ValidateValues {
        for key, value := range result {
            if err := p.validator.ValidateValue(value); err != nil {
                return nil, fmt.Errorf("invalid value for %q: %w", key, err)
            }
        }
    }

    return result, nil
}
```

### 3. Информативные ошибки

```go
type CustomParseError struct {
    File    string
    Line    int
    Content string
    Err     error
}

func (e *CustomParseError) Error() string {
    if e.Line > 0 {
        return fmt.Sprintf("%s:%d: %s: %v", e.File, e.Line, e.Content, e.Err)
    }
    return fmt.Sprintf("%s: %s: %v", e.File, e.Content, e.Err)
}

func (e *CustomParseError) Unwrap() error {
    return e.Err
}
```

### 4. Запись в аудитный журнал

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()
    result := make(map[string]string)

    // ... логика парсинга

    // Записать успешный результат
    _ = p.auditor.LogWithDuration(
        env.ActionParse,
        "",
        fmt.Sprintf("parsed %d variables", len(result)),
        true,
        time.Since(start),
    )

    return result, nil
}
```

---

## Полный пример

### Реализация парсера XML

```go
package main

import (
    "encoding/xml"
    "fmt"
    "io"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// Структура XML конфигурации
type XMLConfig struct {
    XMLName xml.Name   `xml:"config"`
    Entries []XMLEntry `xml:"entry"`
}

type XMLEntry struct {
    Key   string `xml:"key,attr"`
    Value string `xml:",chardata"`
}

// XMLParser разбирает формат XML
type XMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *XMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()

    // Ограничить размер чтения
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
    if err != nil {
        return nil, err
    }
    if int64(len(content)) > p.cfg.MaxFileSize {
        _ = p.auditor.LogError(env.ActionParse, "", "file exceeds size limit")
        return nil, fmt.Errorf("file exceeds size limit: %d > %d", len(content), p.cfg.MaxFileSize)
    }

    var xmlConfig XMLConfig
    if err := xml.Unmarshal(content, &xmlConfig); err != nil {
        _ = p.auditor.LogError(env.ActionParse, "", "xml parse error: "+err.Error())
        return nil, fmt.Errorf("xml parse error: %w", err)
    }

    result := make(map[string]string)

    for _, entry := range xmlConfig.Entries {
        key := strings.ToUpper(entry.Key)

        // Валидация длины ключа
        if len(key) > p.cfg.MaxKeyLength {
            return nil, fmt.Errorf("key too long: %s", key)
        }

        // Валидация формата ключа
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, fmt.Errorf("invalid key %q: %w", key, err)
        }

        // Валидация длины значения
        if len(entry.Value) > p.cfg.MaxValueLength {
            return nil, fmt.Errorf("value too long for key: %s", key)
        }

        result[key] = entry.Value
    }

    // Проверить количество переменных
    if len(result) > p.cfg.MaxVariables {
        return nil, fmt.Errorf("too many variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    _ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed XML: "+filename, true, time.Since(start))
    return result, nil
}

// Определить константу формата XML
const FormatXML env.FileFormat = 102

func init() {
    // Зарегистрировать XML парсер
    env.RegisterParser(FormatXML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &XMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}

func main() {
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // Загрузить XML конфигурацию
    /*
    <?xml version="1.0"?>
    <config>
        <entry key="DATABASE_HOST">localhost</entry>
        <entry key="DATABASE_PORT">5432</entry>
    </config>
    */
    loader.LoadFiles("config.xml")

    fmt.Println(loader.GetString("DATABASE_HOST"))  // localhost
    fmt.Println(loader.GetInt("DATABASE_PORT"))     // 5432
}
```

---

## Связанная документация

- [ComponentFactory API](/ru/env/api-reference/factory) - ComponentFactory и RegisterParser
- [Определения интерфейсов](/ru/env/api-reference/interfaces) - Определение интерфейса EnvParser
- [Config API](/ru/env/api-reference/config) - Подробное описание параметров конфигурации
- [Многоформатная конфигурация](/ru/env/guides/multi-format) - Подробно о форматах JSON/YAML
