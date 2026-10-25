---
sidebar_label: "Testing"
title: "Testing - CyberGo env | Unit Test Best Practices"
description: "CyberGo env testing guide: TestingConfig and OverwriteExisting isolation, FileSystem mocking, table-driven tests, benchmarks, and ResetDefaultLoader cleanup."
sidebar_position: 7
---

# Testing

`TestingConfig()` returns a configuration preset for unit tests: it overwrites existing variables, applies compact limits, and skips auditing. Test isolation, filesystem mocking, and cleanup are covered below.

## Test Configuration

### Using TestingConfig

`TestingConfig` overwrites existing environment variables, which makes tests independent of each other:

```go
func TestWithTestingConfig(t *testing.T) {
    // TestingConfig inherits Filenames ([".env"]) from DefaultConfig;
    // point it at a test-specific file to avoid implicitly reading
    // the real .env in the cwd
    cfg := env.TestingConfig()
    cfg.Filenames = []string{".env.test"}

    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    // Use test configuration (FailOnMissingFile=false: a missing
    // .env.test is silently skipped, no error)
    host := loader.GetString("DB_HOST")
}
```

:::tip
`TestingConfig` sets `OverwriteExisting: true` for test isolation. To preserve existing variables, set `cfg.OverwriteExisting = false` explicitly.
:::

:::warning Implicit loading and testify dependency
- `TestingConfig` inherits `Filenames: [".env"]` from `DefaultConfig`, and `New(cfg)` **auto-loads** those files whenever `Filenames` is non-empty. If you don't clear it, the real `.env` in the current directory is loaded and pollutes the test. Set `cfg.Filenames = nil` when no file should be loaded.
- The `require` and `assert` calls on this page come from the third-party library `github.com/stretchr/testify`.
:::

### Per-test Independent Loader

```go
func TestDatabase(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = nil // clear, avoid implicitly loading the cwd .env

    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    // Set test values
    loader.Set("DB_HOST", "localhost")
    loader.Set("DB_PORT", "5432")

    // Run tests...
}
```

## Mocking Filesystem

### Custom FileSystem

Mock files through the `FileSystem` interface:

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
    // Pass the real size: the loader uses Stat().Size() for the MaxFileSize pre-check
    return &MockFile{name: name, size: int64(len(content)), reader: strings.NewReader(content)}, nil
}

func (m *MockFileSystem) OpenFile(name string, flag int, perm os.FileMode) (env.File, error) {
    return m.Open(name)
}

// The library never calls MockFileSystem.Stat, but the return value must still
// be safe to use — never return a nil FileInfo with a nil error
func (m *MockFileSystem) Stat(name string) (os.FileInfo, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &mockFileInfo{name: name, size: int64(len(content))}, nil
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

// MockFile is an in-memory implementation of env.File
// (Read/Write/Close/Sync/Stat). The loader calls MockFile.Stat() right after
// opening for a size pre-check; returning an error there fails the load.
type MockFile struct {
    name   string
    size   int64
    reader *strings.Reader // strings.Reader tracks the read offset for chunked reads
}

func (f *MockFile) Read(p []byte) (int, error) { return f.reader.Read(p) }

// Read-only mock: the load path never writes
func (f *MockFile) Write(p []byte) (int, error) { return 0, errors.ErrUnsupported }

func (f *MockFile) Close() error { return nil }
func (f *MockFile) Sync() error  { return nil }

// Stat must return the real size (Open passes size == len(content));
// otherwise loadFileLocked's MaxFileSize pre-check misjudges the file size
func (f *MockFile) Stat() (os.FileInfo, error) {
    return &mockFileInfo{name: f.name, size: f.size}, nil
}

// mockFileInfo minimally implements os.FileInfo; only Size carries meaning
type mockFileInfo struct {
    name string
    size int64
}

func (i *mockFileInfo) Name() string       { return i.name }
func (i *mockFileInfo) Size() int64        { return i.size }
func (i *mockFileInfo) Mode() os.FileMode  { return 0444 }
func (i *mockFileInfo) ModTime() time.Time { return time.Time{} }
func (i *mockFileInfo) IsDir() bool        { return false }
func (i *mockFileInfo) Sys() any           { return nil }
```

The mock file returned by `Open` must implement all five methods of `env.File`: Read, Write, Close, Sync, and Stat (the interface itself declares only `Sync` and `Stat`; the other three come from the embedded `io.Reader`, `io.Writer`, and `io.Closer`). `Stat` is required: before reading a file, the loader calls `file.Stat()` for a size pre-check and returns `ErrFileTooLarge` when `Size()` exceeds `MaxFileSize`. `Open` must therefore pass the real length as `MockFile.size`, which `mockFileInfo.Size()` returns.

The [Interfaces](../api-reference/interfaces) and [Factory](../api-reference/factory) pages in api-reference use the same mock — read them side by side.

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
    // Reset before running tests (returns the error from closing
    // the old default loader)
    if err := env.ResetDefaultLoader(); err != nil {
        log.Printf("reset default loader: %v", err)
    }

    os.Exit(m.Run())
}

func TestExample(t *testing.T) {
    // Each test can also reset
    if err := env.ResetDefaultLoader(); err != nil {
        t.Logf("reset default loader: %v", err)
    }

    // Use package-level functions
    env.Load(".env.test")
}
```

`ResetDefaultLoader` returns an `error`. It clears and closes the default loader, and the return value is the old loader's `Close()` error (non-nil when cleanup during close fails). It returns nil when no default loader has been initialized. Ignoring the error only means the old loader's cleanup failed: the global state is still cleared, so `env.Load()` can be called again afterwards.

### Cleaning Up Environment Variables

```go
func TestWithCleanup(t *testing.T) {
    // Save original value
    originalHost := os.Getenv("TEST_HOST")

    // Set test value
    os.Setenv("TEST_HOST", "test-value")

    // Restore after test
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

## Table-driven Tests

### Configuration Testing

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
            cfg := env.TestingConfig()
            cfg.Filenames = nil

            loader, _ := env.New(cfg)
            defer loader.Close()

            loader.Set("VALUE", tt.envValue)

            assert.Equal(t, tt.getInt, loader.GetInt("VALUE"))
            assert.Equal(t, tt.getBool, loader.GetBool("VALUE"))
        })
    }
}
```

### Validation Testing

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
            cfg.Filenames = nil

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
    cfg.Filenames = nil // clear; the temp file is loaded explicitly below
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

    loaderCfg := env.TestingConfig()
    loaderCfg.Filenames = nil // clear, avoid implicitly loading the cwd .env

    loader, _ := env.New(loaderCfg)
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

## Concurrency Testing

```go
func TestConcurrentAccess(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = nil // clear, avoid implicitly loading the cwd .env

    loader, _ := env.New(cfg)
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

## Benchmarks

### Read Performance

```go
func BenchmarkGetString(b *testing.B) {
    cfg := env.TestingConfig()
    cfg.Filenames = nil // clear, avoid implicitly loading the cwd .env

    loader, _ := env.New(cfg)
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

    cfg := env.TestingConfig()
    cfg.Filenames = nil // clear; the temp file is loaded explicitly, keeping implicit .env reads out of the timing

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        loader, _ := env.New(cfg)
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

	cfg := env.TestingConfig()
	cfg.Filenames = nil // clear, avoid implicitly loading the cwd .env

	loader, err := env.New(cfg)
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

    // NewTestLoader registers a t.Cleanup that closes the loader
    assert.Equal(t, "localhost", loader.GetString("DB_HOST"))
}
```

## Related Documentation

- [Config API - TestingConfig](../api-reference/config#testingconfig) - test configuration reference
- [Loader API](../api-reference/loader) - complete Loader methods
- [Interfaces - FileSystem](../api-reference/interfaces) - custom filesystem interface
- [Performance](../advanced/performance) - benchmark data
