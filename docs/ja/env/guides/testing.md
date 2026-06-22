---
title: "テストシナリオ - CyberGo env | ユニットテストベストプラクティス"
description: "CyberGo env テストベストプラクティスガイド。TestingConfig、メモリファイルシステムモック、テーブル駆動テスト、ベンチマーク、ResetDefaultLoader クリーンアップで安定した結果を保証します。"
---

# テストシナリオ

このガイドでは、テストで env ライブラリを使用する方法について説明します。テスト環境の分離、ファイルシステムのモック、状態のクリーンアップなどを含みます。

## テスト設定

### TestingConfig の使用

`TestingConfig` は既存の環境変数を上書きし、テストの分離に適しています：

```go
func TestWithTestingConfig(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = []string{".env.test"}

    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    // テスト設定を使用
    host := loader.GetString("DB_HOST")
}
```

::: tip 注意
`TestingConfig` は `OverwriteExisting: true` を設定し、テストの分離を保証します。既存の変数を保持する必要がある場合は、手動で `cfg.OverwriteExisting = false` に設定できます。
:::

### テストごとに独立したローダー

```go
func TestDatabase(t *testing.T) {
    loader, err := env.New(env.TestingConfig())
    require.NoError(t, err)
    defer loader.Close()

    // テスト値を設定
    loader.Set("DB_HOST", "localhost")
    loader.Set("DB_PORT", "5432")

    // テストを実行...
}
```

## ファイルシステムのモック

### カスタム FileSystem

`FileSystem` インターフェースを使用してファイルをモックします：

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

### テストでの使用

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

## テスト状態のクリーンアップ

### デフォルトローダーのリセット

```go
func TestMain(m *testing.M) {
    // テスト実行前にリセット
    env.ResetDefaultLoader()

    os.Exit(m.Run())
}

func TestExample(t *testing.T) {
    // 各テストでもリセット可能
    env.ResetDefaultLoader()

    // パッケージレベル関数を使用
    env.Load(".env.test")
}
```

### 環境変数のクリーンアップ

```go
func TestWithCleanup(t *testing.T) {
    // 元の値を保存
    originalHost := os.Getenv("TEST_HOST")

    // テスト値を設定
    os.Setenv("TEST_HOST", "test-value")

    // テスト終了後に復元
    t.Cleanup(func() {
        if originalHost == "" {
            os.Unsetenv("TEST_HOST")
        } else {
            os.Setenv("TEST_HOST", originalHost)
        }
    })

    // テストを実行...
}
```

## テーブル駆動テスト

### 設定テスト

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

### 検証テスト

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

## 統合テスト

### 設定読み込みのテスト

```go
func TestConfigLoading(t *testing.T) {
    // 一時 .env ファイルを作成
    tmpDir := t.TempDir()
    envFile := filepath.Join(tmpDir, ".env")

    content := `
APP_NAME=test-app
APP_VERSION=1.0.0
DEBUG=true
`
    err := os.WriteFile(envFile, []byte(content), 0644)
    require.NoError(t, err)

    // 設定を読み込み
    cfg := env.TestingConfig()
    loader, err := env.New(cfg)
    require.NoError(t, err)
    defer loader.Close()

    err = loader.LoadFiles(envFile)
    require.NoError(t, err)

    // 検証
    assert.Equal(t, "test-app", loader.GetString("APP_NAME"))
    assert.Equal(t, "1.0.0", loader.GetString("APP_VERSION"))
    assert.True(t, loader.GetBool("DEBUG"))
}
```

### 構造体マッピングのテスト

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

## 並行テスト

```go
func TestConcurrentAccess(t *testing.T) {
    loader, _ := env.New(env.TestingConfig())
    defer loader.Close()

    var wg sync.WaitGroup

    // 並行書き込み
    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func(n int) {
            defer wg.Done()
            key := fmt.Sprintf("KEY_%d", n)
            loader.Set(key, fmt.Sprintf("value_%d", n))
        }(i)
    }

    // 並行読み取り
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

## ベンチマーク

### 読み取りパフォーマンス

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

### 読み込みパフォーマンス

```go
func BenchmarkLoadFile(b *testing.B) {
    // 一時ファイルを作成
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

## テストユーティリティ関数

テストヘルパー関数を作成します：

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

使用例：

```go
func TestWithHelper(t *testing.T) {
    loader := testutil.NewTestLoader(t, map[string]string{
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
    })

    // loader はテスト終了後に自動的にクローズされる
    assert.Equal(t, "localhost", loader.GetString("DB_HOST"))
}
```

## 関連ドキュメント

- [Config API - TestingConfig](/ja/env/api-reference/config#testingconfig) - テスト設定リファレンス
- [Loader API](/ja/env/api-reference/loader) - Loader の完全なメソッド
- [インターフェース定義 - FileSystem](/ja/env/api-reference/interfaces) - カスタムファイルシステムインターフェース
- [パフォーマンス最適化](/ja/env/advanced/performance) - ベンチマークデータ
