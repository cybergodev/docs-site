---
sidebar_label: "测试场景"
title: "测试场景 - CyberGo env | 单元测试最佳实践"
description: "CyberGo env 测试最佳实践指南，含 TestingConfig 配置与 OverwriteExisting 测试隔离、FileSystem 接口模拟内存文件系统、每个测试独立加载器、表驱动与基准测试、ResetDefaultLoader 状态清理策略，保障测试稳定可复现。"
sidebar_position: 6
---

# 测试场景

本指南介绍如何在测试中使用 env 库，包括隔离测试环境、模拟文件系统和清理状态。

## 测试配置

### 使用 TestingConfig

TestingConfig 会覆盖已存在的环境变量，适合测试隔离：

```go
func TestWithTestingConfig(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = []string{".env.test"}

    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    // 使用测试配置
    host := loader.GetString("DB_HOST")
}
```

::: tip 注意
TestingConfig 设置 `OverwriteExisting: true`，确保测试隔离。如果需要保留已存在变量，可手动设置 `cfg.OverwriteExisting = false`。
:::

### 每个测试独立加载器

```go
func TestDatabase(t *testing.T) {
    loader, err := env.New(env.TestingConfig())
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
    // 运行测试前重置
    env.ResetDefaultLoader()

    os.Exit(m.Run())
}

func TestExample(t *testing.T) {
    // 每个测试也可以重置
    env.ResetDefaultLoader()

    // 使用包级函数
    env.Load(".env.test")
}
```

### 清理环境变量

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
            loader, _ := env.New(env.TestingConfig())
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

## 并发测试

```go
func TestConcurrentAccess(t *testing.T) {
    loader, _ := env.New(env.TestingConfig())
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
    loader, _ := env.New(env.TestingConfig())
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

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        loader, _ := env.New(env.TestingConfig())
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

- [Config API - TestingConfig](/zh/env/api-reference/config#testingconfig) - 测试配置参考
- [Loader API](/zh/env/api-reference/loader) - Loader 完整方法
- [接口定义 - FileSystem](/zh/env/api-reference/interfaces) - 自定义文件系统接口
- [性能优化](/zh/env/advanced/performance) - 基准测试数据
