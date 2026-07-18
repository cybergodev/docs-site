---
sidebar_label: "Testing Scenarios"
title: "Testing - CyberGo env | Unit Test Practices"
description: "CyberGo env testing: TestingConfig, OverwriteExisting isolation, in-memory FileSystem mock, per-test loaders, table-driven tests, benchmarks, ResetDefaultLoader."
sidebar_position: 6
---

# Testing Scenarios

This guide covers how to use the env library in tests, including isolated test environments, mock file systems, and state cleanup.

## Test Configuration

### Using TestingConfig

TestingConfig overrides existing environment variables, suitable for test isolation:

```go
func TestWithTestingConfig(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = []string{".env.test"}

    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    // Use test configuration
    host := loader.GetString("DB_HOST")
}
```

::: tip Note
TestingConfig sets `OverwriteExisting: true` to ensure test isolation. If you need to preserve existing variables, manually set `cfg.OverwriteExisting = false`.
:::

### Independent Loader per Test

```go
func TestDatabase(t *testing.T) {
    loader, err := env.New(env.TestingConfig())
    require.NoError(t, err)
    defer loader.Close()

    // Set test values
    loader.Set("DB_HOST", "localhost")
    loader.Set("DB_PORT", "5432")

    // Run tests...
}
```

## Mock File System

### Custom FileSystem

Use the `FileSystem` interface to mock files:

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

### Using in Tests

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

## Cleaning Up Test State

### Resetting the Default Loader

```go
func TestMain(m *testing.M) {
    // Reset before running tests
    env.ResetDefaultLoader()

    os.Exit(m.Run())
}

func TestExample(t *testing.T) {
    // Each test can also reset
    env.ResetDefaultLoader()

    // Use package-level functions
    env.Load(".env.test")
}
```

### Cleaning Up Environment Variables

```go
func TestWithCleanup(t *testing.T) {
    // Save original value
    originalHost := os.Getenv("TEST_HOST")

    // Set test value
    os.Setenv("TEST_HOST", "test-value")

    // Restore after test completes
    t.Cleanup(func() {
        if originalHost == "" {
            os.Unsetenv("TEST_HOST")
        } else {
            os.Setenv("TEST_HOST", originalHost)
        }
    })

    // Run tests...
}
```

## Table-Driven Tests

### Configuration Tests

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

### Validation Tests

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

## Integration Tests

### Testing Configuration Loading

```go
func TestConfigLoading(t *testing.T) {
    // Create temporary .env file
    tmpDir := t.TempDir()
    envFile := filepath.Join(tmpDir, ".env")

    content := `
APP_NAME=test-app
APP_VERSION=1.0.0
DEBUG=true
`
    err := os.WriteFile(envFile, []byte(content), 0644)
    require.NoError(t, err)

    // Load configuration
    cfg := env.TestingConfig()
    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    err = loader.LoadFiles(envFile)
    require.NoError(t, err)

    // Verify
    assert.Equal(t, "test-app", loader.GetString("APP_NAME"))
    assert.Equal(t, "1.0.0", loader.GetString("APP_VERSION"))
    assert.True(t, loader.GetBool("DEBUG"))
}
```

### Testing Struct Mapping

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

## Concurrent Testing

```go
func TestConcurrentAccess(t *testing.T) {
    loader, _ := env.New(env.TestingConfig())
    defer loader.Close()

    var wg sync.WaitGroup

    // Concurrent writes
    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func(n int) {
            defer wg.Done()
            key := fmt.Sprintf("KEY_%d", n)
            loader.Set(key, fmt.Sprintf("value_%d", n))
        }(i)
    }

    // Concurrent reads
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

## Benchmark Tests

### Read Performance

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

### Load Performance

```go
func BenchmarkLoadFile(b *testing.B) {
    // Create temporary file
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

## Test Utility Functions

Create test helper functions:

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

Usage example:

```go
func TestWithHelper(t *testing.T) {
    loader := testutil.NewTestLoader(t, map[string]string{
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
    })

    // loader is automatically closed after the test
    assert.Equal(t, "localhost", loader.GetString("DB_HOST"))
}
```

## Related Documentation

- [Config API - TestingConfig](/en/env/api-reference/config#testingconfig) - Test configuration reference
- [Loader API](/en/env/api-reference/loader) - Complete Loader methods
- [Interfaces - FileSystem](/en/env/api-reference/interfaces) - Custom file system interface
- [Performance Optimization](/en/env/advanced/performance) - Benchmark data
