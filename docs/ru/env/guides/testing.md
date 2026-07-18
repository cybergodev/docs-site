---
sidebar_label: "Сценарии тестирования"
title: "Тестирование - CyberGo env | Практики unit-тестов"
description: "Тесты CyberGo env: TestingConfig с OverwriteExisting, мокинг FileSystem, независимый загрузчик на тест, табличные/базовые тесты и ResetDefaultLoader."
sidebar_position: 6
---

# Сценарии тестирования

В этом руководстве описано использование библиотеки env в тестах, включая изоляцию тестовой среды, имитацию файловой системы и очистку состояния.

## Тестовая конфигурация

### Использование TestingConfig

TestingConfig перекрывает существующие переменные окружения, что подходит для изоляции тестов:

```go
func TestWithTestingConfig(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = []string{".env.test"}

    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    // Использование тестовой конфигурации
    host := loader.GetString("DB_HOST")
}
```

::: tip Примечание
TestingConfig устанавливает `OverwriteExisting: true`, обеспечивая изоляцию тестов. Если нужно сохранить существующие переменные, можно вручную установить `cfg.OverwriteExisting = false`.
:::

### Независимый загрузчик для каждого теста

```go
func TestDatabase(t *testing.T) {
    loader, err := env.New(env.TestingConfig())
    require.NoError(t, err)
    defer loader.Close()

    // Установка тестовых значений
    loader.Set("DB_HOST", "localhost")
    loader.Set("DB_PORT", "5432")

    // Выполнение тестов...
}
```

## Имитация файловой системы

### Пользовательский FileSystem

Использование интерфейса `FileSystem` для имитации файлов:

```go
type MockFileSystem struct {
    files map[string]string
    env   map[string]string
}

func (m *MockFileSystem) Open(name string) (env.File, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MockFile{content: content}, nil
}

func (m *MockFileSystem) OpenFile(name string, flag int, perm os.FileMode) (env.File, error) {
    return m.Open(name)
}

func (m *MockFileSystem) Stat(name string) (os.FileInfo, error) {
    if _, ok := m.files[name]; !ok {
        return nil, os.ErrNotExist
    }
    return nil, nil
}

func (m *MockFileSystem) MkdirAll(path string, perm os.FileMode) error { return nil }
func (m *MockFileSystem) Remove(name string) error                     { delete(m.files, name); return nil }
func (m *MockFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

func (m *MockFileSystem) Getenv(key string) string            { return m.env[key] }
func (m *MockFileSystem) Setenv(key, value string) error      { m.env[key] = value; return nil }
func (m *MockFileSystem) Unsetenv(key string) error           { delete(m.env, key); return nil }
func (m *MockFileSystem) LookupEnv(key string) (string, bool) { val, ok := m.env[key]; return val, ok }
```

### Использование в тестах

```go
func TestWithMockFS(t *testing.T) {
    mockFS := &MockFileSystem{
        files: map[string]string{
            ".env": "HOST=localhost\nPORT=8080\n",
        },
        env: make(map[string]string),
    }

    cfg := env.TestingConfig()
    cfg.FileSystem = mockFS

    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    err = loader.LoadFiles(".env")
    require.NoError(t, err)

    assert.Equal(t, "localhost", loader.GetString("HOST"))
    assert.Equal(t, int64(8080), loader.GetInt("PORT"))
}
```

## Очистка состояния тестов

### Сброс загрузчика по умолчанию

```go
func TestMain(m *testing.M) {
    // Сброс перед запуском тестов
    env.ResetDefaultLoader()

    os.Exit(m.Run())
}

func TestExample(t *testing.T) {
    // Каждый тест также может выполнять сброс
    env.ResetDefaultLoader()

    // Использование функций уровня пакета
    env.Load(".env.test")
}
```

### Очистка переменных окружения

```go
func TestWithCleanup(t *testing.T) {
    // Сохранение оригинального значения
    originalHost := os.Getenv("TEST_HOST")

    // Установка тестового значения
    os.Setenv("TEST_HOST", "test-value")

    // Восстановление после завершения теста
    t.Cleanup(func() {
        if originalHost == "" {
            os.Unsetenv("TEST_HOST")
        } else {
            os.Setenv("TEST_HOST", originalHost)
        }
    })

    // Выполнение тестов...
}
```

## Табличные тесты

### Тесты конфигурации

```go
func TestTypeConversion(t *testing.T) {
    tests := []struct {
        name     string
        envValue string
        getInt   int64
        getBool  bool
    }{
        {"integer", "42", 42, false},
        {"zero", "0", 0, false},
        {"bool_true", "true", 0, true},
        {"bool_yes", "yes", 0, true},
        {"bool_1", "1", 1, true},
        {"bool_false", "false", 0, false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            loader, _ := env.New(env.TestingConfig())
            defer loader.Close()

            loader.Set("VALUE", tt.envValue)

            assert.Equal(t, tt.getInt, loader.GetInt("VALUE"))
            assert.Equal(t, tt.getBool, loader.GetBool("VALUE"))
        })
    }
}
```

### Тесты валидации

```go
func TestValidation(t *testing.T) {
    tests := []struct {
        name        string
        required    []string
        envValues   map[string]string
        expectError bool
    }{
        {
            name:        "all required present",
            required:    []string{"A", "B"},
            envValues:   map[string]string{"A": "1", "B": "2"},
            expectError: false,
        },
        {
            name:        "missing required",
            required:    []string{"A", "B", "C"},
            envValues:   map[string]string{"A": "1"},
            expectError: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            cfg := env.TestingConfig()
            cfg.RequiredKeys = tt.required

            loader, _ := env.New(cfg)
            defer loader.Close()

            for k, v := range tt.envValues {
                loader.Set(k, v)
            }

            err := loader.Validate()
            if tt.expectError {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

## Интеграционные тесты

### Тестирование загрузки конфигурации

```go
func TestConfigLoading(t *testing.T) {
    // Создание временного .env файла
    tmpDir := t.TempDir()
    envFile := filepath.Join(tmpDir, ".env")

    content := `
APP_NAME=test-app
APP_VERSION=1.0.0
DEBUG=true
`
    err := os.WriteFile(envFile, []byte(content), 0644)
    require.NoError(t, err)

    // Загрузка конфигурации
    cfg := env.TestingConfig()
    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    err = loader.LoadFiles(envFile)
    require.NoError(t, err)

    // Проверка
    assert.Equal(t, "test-app", loader.GetString("APP_NAME"))
    assert.Equal(t, "1.0.0", loader.GetString("APP_VERSION"))
    assert.True(t, loader.GetBool("DEBUG"))
}
```

### Тестирование маппинга структур

```go
func TestStructMapping(t *testing.T) {
    type Config struct {
        Host string `env:"HOST" envDefault:"localhost"`
        Port int64  `env:"PORT" envDefault:"8080"`
    }

    loader, _ := env.New(env.TestingConfig())
    defer loader.Close()

    loader.Set("HOST", "example.com")
    loader.Set("PORT", "443")

    var cfg Config
    err := loader.ParseInto(&cfg)
    require.NoError(t, err)

    assert.Equal(t, "example.com", cfg.Host)
    assert.Equal(t, int64(443), cfg.Port)
}
```

## Конкурентные тесты

```go
func TestConcurrentAccess(t *testing.T) {
    loader, _ := env.New(env.TestingConfig())
    defer loader.Close()

    var wg sync.WaitGroup

    // Параллельная запись
    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func(n int) {
            defer wg.Done()
            key := fmt.Sprintf("KEY_%d", n)
            loader.Set(key, fmt.Sprintf("value_%d", n))
        }(i)
    }

    // Параллельное чтение
    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func(n int) {
            defer wg.Done()
            key := fmt.Sprintf("KEY_%d", n)
            loader.GetString(key)
        }(i)
    }

    wg.Wait()
}
```

## Бенчмарки

### Производительность чтения

```go
func BenchmarkGetString(b *testing.B) {
    loader, _ := env.New(env.TestingConfig())
    defer loader.Close()

    loader.Set("KEY", "value")

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        loader.GetString("KEY")
    }
}
```

### Производительность загрузки

```go
func BenchmarkLoadFile(b *testing.B) {
    // Создание временного файла
    tmpDir := b.TempDir()
    envFile := filepath.Join(tmpDir, ".env")

    var content strings.Builder
    for i := 0; i < 100; i++ {
        content.WriteString(fmt.Sprintf("KEY_%d=value_%d\n", i, i))
    }
    os.WriteFile(envFile, []byte(content.String()), 0644)

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        loader, _ := env.New(env.TestingConfig())
        loader.LoadFiles(envFile)
        loader.Close()
    }
}
```

## Вспомогательные функции тестирования

Создание вспомогательных функций для тестов:

```go
// testutil/env.go
package testutil

import (
    "os"
    "testing"

    "github.com/cybergodev/env"
)

func NewTestLoader(t *testing.T, values map[string]string) *env.Loader {
    t.Helper()

    loader, err := env.New(env.TestingConfig())
    if err != nil {
        t.Fatalf("failed to create loader: %v", err)
    }

    t.Cleanup(func() {
        loader.Close()
    })

    for k, v := range values {
        if err := loader.Set(k, v); err != nil {
            t.Fatalf("failed to set %s: %v", k, err)
        }
    }

    return loader
}

func SetTestEnv(t *testing.T, key, value string) {
    t.Helper()

    original := os.Getenv(key)
    os.Setenv(key, value)

    t.Cleanup(func() {
        if original == "" {
            os.Unsetenv(key)
        } else {
            os.Setenv(key, original)
        }
    })
}
```

Пример использования:

```go
func TestWithHelper(t *testing.T) {
    loader := testutil.NewTestLoader(t, map[string]string{
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
    })

    // Загрузчик будет автоматически закрыт после завершения теста
    assert.Equal(t, "localhost", loader.GetString("DB_HOST"))
}
```

## Связанная документация

- [Config API - TestingConfig](/ru/env/api-reference/config#testingconfig) - Справка по тестовой конфигурации
- [Loader API](/ru/env/api-reference/loader) - Полный список методов Loader
- [Определение интерфейсов - FileSystem](/ru/env/api-reference/interfaces) - Интерфейс пользовательской файловой системы
- [Оптимизация производительности](/ru/env/advanced/performance) - Данные бенчмарков
