---
title: "使用例 - CyberGo JSON | 実践コード例"
description: "CyberGo JSON の実践例：パスクエリ、構造体 Marshal/Unmarshal、JSONL ストリーミング、Hook、Schema 検証、エラー処理を完全な実行可能な Go コード例で紹介します。"
---

# 使用例

このドキュメントでは、`github.com/cybergodev/json` ライブラリの実践的なコード例を提供します。

## 基本操作

### パスクエリ

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "user": {
            "id": 1001,
            "name": "Alice",
            "email": "alice@example.com",
            "active": true,
            "profile": {
                "age": 28,
                "city": "Beijing"
            }
        },
        "tags": ["go", "json", "dev"],
        "scores": [95, 88, 92]
    }`

    // シンプルなパス
    name := json.GetString(data, "user.name")
    fmt.Println("Name:", name)

    // ネストされたパス
    city := json.GetString(data, "user.profile.city")
    age := json.GetInt(data, "user.profile.age")
    fmt.Printf("City: %s, Age: %d\n", city, age)

    // 配列インデックス
    firstTag := json.GetString(data, "tags.0")
    firstScore := json.GetInt(data, "scores.0")
    fmt.Printf("First tag: %s, First score: %d\n", firstTag, firstScore)

    // 配列の取得
    tags := json.GetArray(data, "tags")
    fmt.Println("Tags:", tags)

    // オブジェクトの取得
    profile := json.GetObject(data, "user.profile")
    fmt.Println("Profile:", profile)

    // デフォルト値付きで取得
    country := json.GetString(data, "user.profile.country", "Unknown")
    phone := json.GetString(data, "user.phone", "N/A")
    fmt.Printf("Country: %s, Phone: %s\n", country, phone)
}
```

### JSON の変更

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"name": "old", "version": 1}`

    // 単一の値を変更
    updated, _ := json.Set(data, "name", "new")
    fmt.Println("After set:", updated)

    // 新しいフィールドの追加
    updated, _ = json.Set(updated, "active", true)
    fmt.Println("After add:", updated)

    // 複数のフィールドを個別に設定
    updated, _ = json.Set(updated, "version", 2)
    updated, _ = json.Set(updated, "author", "CyberGo")
    updated, _ = json.Set(updated, "tags", []string{"json", "go"})
    fmt.Println("After batch:", updated)

    // フィールドの削除
    updated, _ = json.Delete(updated, "author")
    fmt.Println("After delete:", updated)

    // ネストされた変更
    nested := `{"config": {"database": {"host": "localhost"}}}`
    nested, _ = json.Set(nested, "config.database.host", "192.168.1.1")
    nested, _ = json.Set(nested, "config.database.port", 3306)
    fmt.Println("Nested:", nested)
}
```

## 構造体のエンコード・デコード

### 基本的なエンコード・デコード

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type User struct {
    ID       int      `json:"id"`
    Name     string   `json:"name"`
    Email    string   `json:"email"`
    Active   bool     `json:"active"`
    Tags     []string `json:"tags"`
    Metadata map[string]any `json:"metadata,omitempty"`
}

func main() {
    user := User{
        ID:     1001,
        Name:   "Alice",
        Email:  "alice@example.com",
        Active: true,
        Tags:   []string{"go", "json"},
        Metadata: map[string]any{
            "role":  "admin",
            "level": 5,
        },
    }

    // エンコード
    data, err := json.Marshal(user)
    if err != nil {
        panic(err)
    }
    fmt.Println("Encoded:", string(data))

    // フォーマット付きエンコード
    pretty, _ := json.MarshalIndent(user, "", "  ")
    fmt.Println("Pretty:\n", string(pretty))

    // デコード
    var decoded User
    err = json.Unmarshal(data, &decoded)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Decoded: %+v\n", decoded)
}
```

### ネストされた構造体

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type Address struct {
    City    string `json:"city"`
    Country string `json:"country"`
}

type Profile struct {
    Age     int     `json:"age"`
    Address Address `json:"address"`
}

type UserWithProfile struct {
    ID      int     `json:"id"`
    Name    string  `json:"name"`
    Profile Profile `json:"profile"`
}

func main() {
    user := UserWithProfile{
        ID:   1,
        Name: "Bob",
        Profile: Profile{
            Age: 30,
            Address: Address{
                City:    "Shanghai",
                Country: "China",
            },
        },
    }

    data, _ := json.MarshalIndent(user, "", "  ")
    fmt.Println(string(data))

    // JSON 文字列から直接ネストされた値を取得
    city := json.GetString(string(data), "profile.address.city")
    fmt.Println("City:", city)
}
```

## ジェネリック API

### GetTyped

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type Config struct {
    Host string `json:"host"`
    Port int    `json:"port"`
    TLS  struct {
        Enabled  bool   `json:"enabled"`
        CertPath string `json:"cert_path"`
    } `json:"tls"`
}

func main() {
    data := `{
        "host": "localhost",
        "port": 8080,
        "tls": {
            "enabled": true,
            "cert_path": "/etc/certs/server.crt"
        }
    }`

    // ジェネリックデコード
    config := json.GetTyped[Config](data, ".")
    fmt.Printf("Config: %+v\n", config)

    // デフォルト値付き
    defaultConfig := Config{Host: "127.0.0.1", Port: 3000}
    cfg := json.GetTyped[Config](data, ".", defaultConfig)
    fmt.Printf("Config: %+v\n", cfg)
}
```

## Processor の使用

### 基本的な使用方法

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // プロセッサの作成
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    data := `{"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}`

    // プロセッサを使用して操作
    users := p.GetArray(data, "users")
    fmt.Println("Users:", users)

    // 事前パースで複数回のクエリを高速化
    parsed, _ := p.PreParse(data)
    for i := 0; i < 2; i++ {
        name, _ := p.GetFromParsed(parsed, fmt.Sprintf("users.%d.name", i))
        fmt.Printf("User %d: %v\n", i, name)
    }
}
```

### カスタム設定

```go
package main

import (
    "fmt"
    "time"
    "github.com/cybergodev/json"
)

func main() {
    // カスタム設定
    cfg := json.DefaultConfig()
    cfg.EnableCache = true
    cfg.CacheTTL = 10 * time.Minute
    cfg.MaxJSONSize = 50 * 1024 * 1024 // 50MB
    cfg.CreatePaths = true

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // セキュリティ設定で信頼できない入力を処理
    secureCfg := json.SecurityConfig()
    secureP, err := json.New(secureCfg)
    if err != nil {
        panic(err)
    }
    defer secureP.Close()

    untrusted := `{"input": "<script>alert('xss')</script>"}`
    result := secureP.GetString(untrusted, "input")
    fmt.Println("Sanitized:", result)
}
```

### キャッシュのウォームアップ

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 大きな JSON データ
    largeJSON := `{"users": [...], "products": [...], "orders": [...]}`

    // よく使うパスをウォームアップ
    commonPaths := []string{
        "users",
        "users.0.id",
        "products",
        "orders",
    }

    result, err := p.WarmupCache(largeJSON, commonPaths)
    if err != nil {
        panic(err)
    }

    fmt.Printf("Warmup complete: %d/%d paths cached\n",
        result.Successful, result.TotalPaths)
    if len(result.FailedPaths) > 0 {
        fmt.Println("Failed paths:", result.FailedPaths)
    }
}
```

## イテレーション

### 配列の反復処理

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "users": [
            {"id": 1, "name": "Alice", "score": 95},
            {"id": 2, "name": "Bob", "score": 88},
            {"id": 3, "name": "Charlie", "score": 92}
        ]
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 配列の反復処理
    p.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
        id := item.GetInt("id")
        name := item.GetString("name")
        score := item.GetFloat64("score")
        fmt.Printf("User %d: %s (score: %.1f)\n", id, name, score)
    })
}
```

### 制御フロー付きイテレーション

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"numbers": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    sum := 0
    p.ForeachWithPathAndControl(data, "numbers", func(key any, value any) json.IteratorControl {
        // 5 より大きい値が見つかったら停止
        if num, ok := value.(float64); ok {
            if num > 5 {
                return json.IteratorBreak
            }
            sum += int(num)
        }
        return json.IteratorNormal
    })
    fmt.Println("Sum of numbers <= 5:", sum) // 1+2+3+4+5 = 15
}
```

### フィールドの存在確認

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "users": [
            {"name": "Alice", "email": "alice@example.com"},
            {"name": "Bob"},
            {"name": "Charlie", "email": "charlie@example.com", "phone": "123-456"}
        ]
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    p.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
        name := item.GetString("name")
        email := item.GetString("email")
        phone := item.GetString("phone")

        fmt.Printf("User: %s\n", name)
        if item.Exists("email") {
            fmt.Printf("  Email: %s\n", email)
        }
        if item.Exists("phone") {
            fmt.Printf("  Phone: %s\n", phone)
        }
        if item.IsNull("nickname") {
            fmt.Println("  No nickname")
        }
    })
}
```

## JSONL 処理

### JSONL ファイルの読み込み

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    err = p.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
        fmt.Printf("Line %d: %v\n", lineNum, item.GetData())
        return nil
    })

    if err != nil {
        fmt.Println("Error:", err)
    }
}
```

### ジェネリック JSONL 処理

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

type LogEntry struct {
    Timestamp string `json:"timestamp"`
    Level     string `json:"level"`
    Message   string `json:"message"`
}

func main() {
    jsonlData := `{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":"Started"}
{"timestamp":"2024-01-01T10:00:01Z","level":"DEBUG","message":"Processing"}
{"timestamp":"2024-01-01T10:00:02Z","level":"ERROR","message":"Failed"}`

    reader := strings.NewReader(jsonlData)

    entries, err := json.StreamLinesInto[LogEntry](reader, func(lineNum int, entry LogEntry) error {
        fmt.Printf("[%s] %s: %s\n", entry.Level, entry.Timestamp, entry.Message)
        return nil
    })

    if err != nil {
        panic(err)
    }
    fmt.Printf("Processed %d entries\n", len(entries))
}
```

### JSONL の書き込み

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, err := os.Create("output.jsonl")
    if err != nil {
        panic(err)
    }
    defer file.Close()

    writer := json.NewJSONLWriter(file)

    data := []any{
        map[string]any{"id": 1, "name": "Alice"},
        map[string]any{"id": 2, "name": "Bob"},
        map[string]any{"id": 3, "name": "Charlie"},
    }

    err = writer.WriteAll(data)
    if err != nil {
        panic(err)
    }

    fmt.Println("JSONL file written successfully")
}
```

## ストリーム処理

### 大規模 JSON のストリーム処理

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // プロセッサの作成
    processor, err := json.New()
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // ForeachFile を使用して大ファイルをストリーム処理
    count := 0
    err = processor.ForeachFile("large-array.json", func(key any, item *json.IterableValue) error {
        count++
        if count%1000 == 0 {
            fmt.Printf("Processed %d items...\n", count)
        }
        return nil // item.Break() を返すと中断可能
    })

    if err != nil {
        panic(err)
    }
    fmt.Printf("Total items: %d\n", count)
}
```

### オブジェクトのストリーム処理

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    processor, err := json.New()
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // JSON オブジェクトファイルの処理（キー・バリュー構造）
    // ファイル形式: {"user1": {...}, "user2": {...}, ...}
    err = processor.ForeachFile("config-map.json", func(key any, item *json.IterableValue) error {
        name := item.GetString("name")
        fmt.Printf("Key: %s, Name: %s\n", key, name)
        return nil
    })

    if err != nil {
        panic(err)
    }
}
```

## フックシステム

### ログフック

```go
package main

import (
    "fmt"
    "log/slog"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

    cfg := json.DefaultConfig()
    cfg.AddHook(json.LoggingHook(logger))

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    data := `{"name": "test"}`
    name := p.GetString(data, "name")
    fmt.Println("Name:", name)
}
```

### タイミングフック

```go
package main

import (
    "fmt"
    "time"
    "github.com/cybergodev/json"
)

type TimingRecorder struct {
    records map[string]time.Duration
}

func (r *TimingRecorder) Record(op string, duration time.Duration) {
    r.records[op] = duration
}

func main() {
    recorder := &TimingRecorder{records: make(map[string]time.Duration)}

    cfg := json.DefaultConfig()
    cfg.AddHook(json.TimingHook(recorder))

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 操作を実行
    data := `{"users": [{"id": 1}, {"id": 2}]}`
    for i := 0; i < 100; i++ {
        p.Get(data, "users")
    }

    fmt.Println("Timing records:", recorder.records)
}
```

### カスタムバリデーションフック

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    cfg.AddHook(json.ValidationHook(func(jsonStr, path string) error {
        // カスタムバリデーションロジック
        if len(jsonStr) > 10000 {
            return fmt.Errorf("JSON too large")
        }
        return nil
    }))

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    data := `{"name": "test"}`
    val, err := p.Get(data, "name")
    if err != nil {
        fmt.Println("Validation error:", err)
    } else {
        fmt.Println("Value:", val)
    }
}
```

## スキーマバリデーション

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // スキーマの定義
    schema := &json.Schema{
        Type:     "object",
        Required: []string{"name", "email"},
        Properties: map[string]*json.Schema{
            "name": {
                Type:      "string",
                MinLength: 1,
                MaxLength: 100,
            },
            "email": {
                Type:   "string",
                Format: "email",
            },
            "age": {
                Type:    "number",
                Minimum: 0,
                Maximum: 150,
            },
            "tags": {
                Type:     "array",
                MinItems: 1,
                Items: &json.Schema{
                    Type: "string",
                },
            },
        },
    }

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    validJSON := `{"name": "Alice", "email": "alice@example.com", "age": 25}`
    invalidJSON := `{"name": "", "email": "invalid"}`

    errors, _ := p.ValidateSchema(validJSON, schema)
    if len(errors) == 0 {
        fmt.Println("Valid JSON")
    } else {
        for _, e := range errors {
            fmt.Printf("Error at %s: %s\n", e.Path, e.Message)
        }
    }

    errors, _ = p.ValidateSchema(invalidJSON, schema)
    for _, e := range errors {
        fmt.Printf("Error at %s: %s\n", e.Path, e.Message)
    }
}
```

## エラー処理

### エラータイプの判定

```go
package main

import (
    "errors"
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"name": "test"}`
    _, err := json.Get(data, "nonexistent.path")

    if err != nil {
        // エラータイプの確認
        if errors.Is(err, json.ErrPathNotFound) {
            fmt.Println("Path not found")
        } else if errors.Is(err, json.ErrInvalidJSON) {
            fmt.Println("Invalid JSON")
        } else if errors.Is(err, json.ErrTypeMismatch) {
            fmt.Println("Type mismatch")
        }

        // 詳細なエラー情報の取得
        var jsonErr *json.JsonsError
        if errors.As(err, &jsonErr) {
            fmt.Printf("Op: %s, Path: %s\n", jsonErr.Op, jsonErr.Path)
        }
    }
}
```

### 信頼できない入力の安全な処理

```go
package main

import (
    "errors"
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // セキュリティ設定の使用
    cfg := json.SecurityConfig()
    // SecurityConfig はデフォルトで 10MB に制限されていますが、ここではさらに 1MB に制限
    cfg.MaxJSONSize = 1024 * 1024 // 1MB 制限
    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 信頼できない入力のシミュレーション
    // 注意：実際の攻撃はより大きなペイロード（100MB+ など）を試みる可能性があります
    // セキュリティ設定は MaxJSONSize を超える入力をブロックします
    untrustedInputs := []string{
        `{"data": "normal"}`,
        `{"huge": "` + string(make([]byte, 2*1024*1024)) + `"}`, // 2MB 入力（1MB 制限を超える）
        `{"nested": {{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}`, // 深すぎるネスト
    }

    for i, input := range untrustedInputs {
        _, err := p.Get(input, "data")
        if err != nil {
            if errors.Is(err, json.ErrSecurityViolation) {
                fmt.Printf("Input %d blocked: security violation\n", i)
            } else {
                fmt.Printf("Input %d error: %v\n", i, err)
            }
        } else {
            fmt.Printf("Input %d processed successfully\n", i)
        }
    }
}
```

## ヘルパー関数

### JSON の比較

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    json1 := `{"a": 1, "b": 2}`
    json2 := `{"b": 2, "a": 1}` // キーの順序が異なる

    equal, err := json.CompareJSON(json1, json2)
    if err != nil {
        panic(err)
    }
    fmt.Println("Equal:", equal) // true（意味的に等価）
}
```

### JSON のマージ

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    json1 := `{"a": 1, "b": {"x": 10}}`
    json2 := `{"b": {"y": 20}, "c": 3}`

    // マージ
    merged, _ := json.MergeJSON(json1, json2)
    fmt.Println("Merged:", merged)
    // {"a":1,"b":{"x":10,"y":20},"c":3}

    // 複数マージ
    result, _ := json.MergeMany([]string{
        `{"a":1}`,
        `{"b":2}`,
        `{"d": 4}`,
    })
    fmt.Println("Merged many:", result)
}
```

### ディープコピー（エンコードしてからデコード）

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := map[string]any{
        "name": "Alice",
        "tags": []string{"go", "json"},
        "meta": map[string]any{
            "level": 5,
        },
    }

    copied, err := json.Marshal(data)
    if err != nil {
        panic(err)
    }

    // ディープコピー：エンコード後に再デコード
    var deepCopy map[string]any
    json.Unmarshal(copied, &deepCopy)

    // コピーの変更は元のデータに影響しない
    deepCopy["name"] = "Bob"
    fmt.Println("Original:", data["name"]) // Alice
    fmt.Println("Copy:", deepCopy["name"]) // Bob
}
```

## その他の例

- [高度な機能の例](./examples-advanced) — バッチエンコード、事前パース、フックシステムなどの高度な機能
