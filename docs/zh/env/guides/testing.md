---
sidebar_label: "测试场景"
title: "测试场景 - CyberGo env | 单元测试最佳实践"
description: "CyberGo env 测试最佳实践指南：TestingConfig 与 OverwriteExisting 的隔离语义、自定义 FileSystem 模拟内存文件、每个用例独立加载器、表驱动与基准测试写法、ResetDefaultLoader 与进程变量清理，保证测试结果稳定可复现。"
sidebar_position: 7
---

# 测试场景

env 的测试要处理三件事：隔离测试配置、用内存文件系统替代真实文件、清理全局单例与进程环境。

## 测试配置

### 使用 TestingConfig

`TestingConfig()` 继承 `DefaultConfig()`，但把 `OverwriteExisting` 置为 `true`、`FailOnMissingFile` 置为 `false`，并把 `MaxFileSize` 收紧到 64 KB、`MaxVariables` 收紧到 50。覆盖写入使同一测试进程内的重复 `Set` 生效：

```go
func TestWithTestingConfig(t *testing.T) {
    // TestingConfig 继承 DefaultConfig 的 Filenames（[".env"]），
    // 这里显式指向测试专用文件，避免隐式读入 cwd 下的真实 .env
    cfg := env.TestingConfig()
    cfg.Filenames = []string{".env.test"}

    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    // 使用测试配置（FailOnMissingFile=false：.env.test 不存在时静默跳过，不报错）
    host := loader.GetString("DB_HOST")
}
```

::: tip 注意
`TestingConfig()` 设置 `OverwriteExisting: true` 以保证测试内的重复写入生效。需要保留已存在的进程变量时，手动设置 `cfg.OverwriteExisting = false`。
:::

::: warning 隐式加载与 testify 依赖
- `TestingConfig` 继承 `DefaultConfig` 的 `Filenames: [".env"]`，而 `New(cfg)` 在 Filenames 非空时**自动加载**这些文件。不清空就会隐式读入 cwd 下的真实 `.env`，污染测试。不希望加载任何文件时，先执行 `cfg.Filenames = nil`。
- 示例中的 `require` / `assert` 来自第三方库 `github.com/stretchr/testify`。
:::

### 每个测试独立加载器

每个用例各自 `New()` 一个 loader，互不共享内存与 `appliedKeys` 追踪：

```go
func TestDatabase(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = nil // 清空，避免隐式加载 cwd 的 .env

    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    // 设置测试值
    loader.Set("DB_HOST", "localhost")
    loader.Set("DB_PORT", "5432")

    // 运行测试...
}
```

## 模拟文件系统

### 自定义 FileSystem

使用 `FileSystem` 接口模拟文件：

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
    // 传入真实 size：加载器用 Stat().Size() 做 MaxFileSize 预检
    return &MockFile{name: name, size: int64(len(content)), reader: strings.NewReader(content)}, nil
}

func (m *MockFileSystem) OpenFile(name string, flag int, perm os.FileMode) (env.File, error) {
    return m.Open(name)
}

// MockFileSystem.Stat 库内不调用，但返回值必须可安全使用，
// 避免调用方（或未来实现）拿到 nil 后 panic
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

// MockFile 是 env.File 的内存实现（Read/Write/Close/Sync/Stat）。
// 加载器打开文件后会立即调用 MockFile.Stat() 做大小预检，返回错误会让加载失败。
type MockFile struct {
    name   string
    size   int64
    reader *strings.Reader // 读偏移由 strings.Reader 自带，支持分块读取
}

func (f *MockFile) Read(p []byte) (int, error)  { return f.reader.Read(p) }

// 只读模拟：加载路径不会写入
func (f *MockFile) Write(p []byte) (int, error) { return 0, errors.ErrUnsupported }

func (f *MockFile) Close() error { return nil }
func (f *MockFile) Sync() error  { return nil }

// Stat 必须返回真实大小（Open 传入的 size == len(content)），
// 否则 loadFileLocked 的 MaxFileSize 预检会误判文件大小
func (f *MockFile) Stat() (os.FileInfo, error) {
    return &mockFileInfo{name: f.name, size: f.size}, nil
}

// mockFileInfo 极简实现 os.FileInfo，仅 Size 参与实际逻辑
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

`Open` 返回的 mock 文件值必须完整实现 `env.File` 接口的五个方法：Read、Write、Close、Sync、Stat（其中 `File` 接口本身声明的只有 `Sync` 与 `Stat`，另外三个来自内嵌的 `io.Reader`、`io.Writer`、`io.Closer`）。`Stat` 不可省略：加载器在读取文件前先调用 `file.Stat()` 做大小预检，`Size()` 超过 `MaxFileSize` 时返回 `ErrFileTooLarge`。因此 `MockFile` 的 `size` 必须由 `Open` 传入真实长度，`mockFileInfo.Size()` 才能返回该值。

api-reference 的[接口页](../api-reference/interfaces)与[工厂页](../api-reference/factory)用的是同一套 mock，可对照阅读。

### 在测试中使用

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

## 清理测试状态

### 重置默认加载器

```go
func TestMain(m *testing.M) {
    // 运行测试前重置（返回关闭旧默认加载器的错误）
    if err := env.ResetDefaultLoader(); err != nil {
        log.Printf("reset default loader: %v", err)
    }

    os.Exit(m.Run())
}

func TestExample(t *testing.T) {
    // 每个测试也可以重置
    if err := env.ResetDefaultLoader(); err != nil {
        t.Logf("reset default loader: %v", err)
    }

    // 使用包级函数
    env.Load(".env.test")
}
```

`ResetDefaultLoader` 返回 `error`：它清空并关闭默认加载器，返回值是旧加载器 `Close()` 的错误（关闭期清理失败时非 nil）；默认加载器从未初始化时返回 nil。忽略该错误只影响旧加载器的清理结果，全局状态仍会被清空，之后可以重新 `env.Load()`。它不会撤销该 loader 已经写入进程环境的变量。

### 清理环境变量

`ResetDefaultLoader` 不碰 `os.Environ`，因此直接写进程变量的测试还要自己恢复：

```go
func TestWithCleanup(t *testing.T) {
    // 保存原始值
    originalHost := os.Getenv("TEST_HOST")

    // 设置测试值
    os.Setenv("TEST_HOST", "test-value")

    // 测试结束后恢复
    t.Cleanup(func() {
        if originalHost == "" {
            os.Unsetenv("TEST_HOST")
        } else {
            os.Setenv("TEST_HOST", originalHost)
        }
    })

    // 运行测试...
}
```

## 表驱动测试

### 配置测试

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

### 验证测试

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

## 集成测试

### 测试配置加载

```go
func TestConfigLoading(t *testing.T) {
    // 创建临时 .env 文件
    tmpDir := t.TempDir()
    envFile := filepath.Join(tmpDir, ".env")

    content := `
APP_NAME=test-app
APP_VERSION=1.0.0
DEBUG=true
`
    err := os.WriteFile(envFile, []byte(content), 0644)
    require.NoError(t, err)

    // 加载配置
    cfg := env.TestingConfig()
    cfg.Filenames = nil // 清空，临时文件由下方 LoadFiles 显式加载
    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    err = loader.LoadFiles(envFile)
    require.NoError(t, err)

    // 验证
    assert.Equal(t, "test-app", loader.GetString("APP_NAME"))
    assert.Equal(t, "1.0.0", loader.GetString("APP_VERSION"))
    assert.True(t, loader.GetBool("DEBUG"))
}
```

### 测试结构体映射

```go
func TestStructMapping(t *testing.T) {
    type Config struct {
        Host string `env:"HOST" envDefault:"localhost"`
        Port int64  `env:"PORT" envDefault:"8080"`
    }

    loaderCfg := env.TestingConfig()
    loaderCfg.Filenames = nil // 清空，避免隐式加载 cwd 的 .env

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

## 并发测试

配合 `go test -race` 运行，可让竞态检测器覆盖并发读写路径：

```go
func TestConcurrentAccess(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = nil // 清空，避免隐式加载 cwd 的 .env

    loader, _ := env.New(cfg)
    defer loader.Close()

    var wg sync.WaitGroup

    // 并发写入
    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func(n int) {
            defer wg.Done()
            key := fmt.Sprintf("KEY_%d", n)
            loader.Set(key, fmt.Sprintf("value_%d", n))
        }(i)
    }

    // 并发读取
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

## 基准测试

### 读取性能

```go
func BenchmarkGetString(b *testing.B) {
    cfg := env.TestingConfig()
    cfg.Filenames = nil // 清空，避免隐式加载 cwd 的 .env

    loader, _ := env.New(cfg)
    defer loader.Close()

    loader.Set("KEY", "value")

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        loader.GetString("KEY")
    }
}
```

### 加载性能

```go
func BenchmarkLoadFile(b *testing.B) {
    // 创建临时文件
    tmpDir := b.TempDir()
    envFile := filepath.Join(tmpDir, ".env")

    var content strings.Builder
    for i := 0; i < 100; i++ {
        content.WriteString(fmt.Sprintf("KEY_%d=value_%d\n", i, i))
    }
    os.WriteFile(envFile, []byte(content.String()), 0644)

    cfg := env.TestingConfig()
    cfg.Filenames = nil // 清空，临时文件由 LoadFiles 显式加载，避免计时混入隐式 .env 读取

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        loader, _ := env.New(cfg)
        loader.LoadFiles(envFile)
        loader.Close()
    }
}
```

## 测试工具函数

创建测试辅助函数：

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
	cfg.Filenames = nil // 清空，避免隐式加载 cwd 的 .env

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

使用示例：

```go
func TestWithHelper(t *testing.T) {
    loader := testutil.NewTestLoader(t, map[string]string{
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
    })

    // loader 会在测试结束后自动关闭
    assert.Equal(t, "localhost", loader.GetString("DB_HOST"))
}
```

## 相关文档

- [Config API - TestingConfig](../api-reference/config#testingconfig) - 测试配置参考
- [Loader API](../api-reference/loader) - Loader 完整方法
- [接口定义 - FileSystem](../api-reference/interfaces) - 自定义文件系统接口
- [性能优化](../advanced/performance) - 基准测试数据
