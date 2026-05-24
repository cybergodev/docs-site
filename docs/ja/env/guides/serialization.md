---
title: "シリアライズ - CyberGo env | 多フォーマット変換"
description: "CyberGo env ライブラリのシリアライズ/デシリアライズ完全ガイド。.env、JSON、YAML フォーマット間の Map マッピングと Go 構造体変換方法を詳しく解説。Marshal と Unmarshal 関数群、カスタム Marshaler/Unmarshaler インターフェース実装、env タグサポート、機密フィールドマスク処理、多フォーマット相互変換の実践例を網羅します。"
---

# シリアライズ

Marshal と Unmarshal 機能を使用して環境変数のシリアライズ/デシリアライズを行い、`.env`、JSON、YAML フォーマットの変換をサポートします。

## 基本的なシリアライズ

### Map シリアライズ

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    data := map[string]string{
        "APP_NAME":    "my-app",
        "APP_VERSION": "1.0.0",
        "DEBUG":       "true",
    }

    // .env フォーマットにシリアライズ
    result, err := env.Marshal(data, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
    // 出力:
    // APP_NAME=my-app
    // APP_VERSION=1.0.0
    // DEBUG=true
}
```

### JSON フォーマット

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    data := map[string]string{
        "HOST": "localhost",
        "PORT": "8080",
    }

    // JSON にシリアライズ
    result, err := env.Marshal(data, env.FormatJSON)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
    // 出力:
    // {
    //   "HOST": "localhost",
    //   "PORT": "8080"
    // }
}
```

### YAML フォーマット

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    data := map[string]string{
        "DATABASE_HOST": "localhost",
        "DATABASE_PORT": "5432",
        "DATABASE_NAME": "myapp",
    }

    // YAML にシリアライズ
    result, err := env.Marshal(data, env.FormatYAML)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
    // 出力:
    // DATABASE_HOST: localhost
    // DATABASE_PORT: "5432"
    // DATABASE_NAME: myapp
}
```

## 構造体シリアライズ

### 基本的なシリアライズ

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type Config struct {
    Host string `env:"HOST"`
    Port int64  `env:"PORT"`
    Debug bool  `env:"DEBUG"`
}

func main() {
    cfg := Config{
        Host:  "localhost",
        Port:  8080,
        Debug: true,
    }

    // 構造体を .env フォーマットにシリアライズ
    result, err := env.Marshal(cfg, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
    // 出力:
    // HOST=localhost
    // PORT=8080
    // DEBUG=true
}
```

### ネストされた構造体

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type DatabaseConfig struct {
    Host string `env:"DB_HOST"`
    Port int64  `env:"DB_PORT"`
}

type AppConfig struct {
    Name     string         `env:"APP_NAME"`
    Database DatabaseConfig
}

func main() {
    cfg := AppConfig{
        Name: "my-app",
        Database: DatabaseConfig{
            Host: "localhost",
            Port: 5432,
        },
    }

    result, err := env.Marshal(cfg, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
}
```

### MarshalStruct 関数

構造体を `map[string]string` に変換します：

```go
func MarshalStruct(v interface{}) (map[string]string, error)
```

**パラメータ：**
- `v` - 構造体ポインタまたは値

**戻り値：**
- `map[string]string` - 環境変数マッピング
- `error` - シリアライズエラー

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type Config struct {
    Host string `env:"HOST"`
    Port int64  `env:"PORT"`
    Debug bool  `env:"DEBUG"`
}

func main() {
    cfg := Config{
        Host:  "localhost",
        Port:  8080,
        Debug: true,
    }

    // map に変換
    data, err := env.MarshalStruct(cfg)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", data)
    // 出力: map[DEBUG:true HOST:localhost PORT:8080]

    // ファイルへのエクスポートに使用可能
    content, _ := env.Marshal(data, env.FormatEnv)
    fmt.Println(content)
}
```

## デシリアライズ

### Map デシリアライズ

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // .env フォーマット文字列
    data := `
HOST=localhost
PORT=8080
DEBUG=true
`

    // map にデシリアライズ
    result, err := env.UnmarshalMap(data, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", result)
    // 出力: map[DEBUG:true HOST:localhost PORT:8080]
}
```

### JSON デシリアライズ

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    jsonData := `{
        "API_KEY": "secret123",
        "API_URL": "https://api.example.com",
        "TIMEOUT": "30"
    }`

    result, err := env.UnmarshalMap(jsonData, env.FormatJSON)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", result)
}
```

### YAML デシリアライズ

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    yamlData := `
DATABASE_HOST: localhost
DATABASE_PORT: "5432"
DATABASE_USER: postgres
`

    result, err := env.UnmarshalMap(yamlData, env.FormatYAML)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", result)
}
```

## 構造体デシリアライズ

### Map からのデシリアライズ

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type Config struct {
    Host string `env:"HOST"`
    Port int64  `env:"PORT"`
}

func main() {
    data := map[string]string{
        "HOST": "example.com",
        "PORT": "443",
    }

    var cfg Config
    err := env.UnmarshalInto(data, &cfg)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", cfg)
    // 出力: {Host:example.com Port:443}
}
```

### 文字列からのデシリアライズ

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type ServerConfig struct {
    Host    string `env:"SERVER_HOST"`
    Port    int64  `env:"SERVER_PORT"`
    Enabled bool   `env:"ENABLED"`
}

func main() {
    envData := `
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
ENABLED=true
`

    var cfg ServerConfig
    err := env.UnmarshalStruct(envData, &cfg, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", cfg)
}
```

## カスタムシリアライズ

### Marshaler インターフェースの実装

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type LogLevel string

type LogConfig struct {
    Level LogLevel `env:"LOG_LEVEL"`
}

func (l LogLevel) MarshalEnv() ([]byte, error) {
    return []byte(string(l)), nil
}

func main() {
    cfg := LogConfig{
        Level: LogLevel("debug"),
    }

    result, err := env.Marshal(cfg, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
}
```

### Unmarshaler インターフェースの実装

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type LogLevel string

type LogConfig struct {
    Level LogLevel `env:"LOG_LEVEL"`
}

func (l *LogLevel) UnmarshalEnv(data map[string]string) error {
    *l = LogLevel(data["LOG_LEVEL"])
    return nil
}

func main() {
    data := map[string]string{
        "LOG_LEVEL": "info",
    }

    var cfg LogConfig
    err := env.UnmarshalInto(data, &cfg)
    if err != nil {
        panic(err)
    }

    fmt.Printf("Level: %s\n", cfg.Level)
}
```

## フォーマット検出

### 自動フォーマット検出

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // 自動フォーマット検出
    format := env.DetectFormat("config.json")
    fmt.Println(format.String()) // json

    format = env.DetectFormat("settings.yaml")
    fmt.Println(format.String()) // yaml

    format = env.DetectFormat(".env")
    fmt.Println(format.String()) // dotenv

    // FormatAuto で自動検出
    data := `{"KEY": "value"}`
    result, _ := env.UnmarshalMap(data, env.FormatAuto)
    fmt.Println(result)
}
```

## 実用シナリオ

### 設定をファイルに保存

```go
package main

import (
    "os"
    "github.com/cybergodev/env"
)

func main() {
    cfg := map[string]string{
        "HOST": "localhost",
        "PORT": "8080",
    }

    // シリアライズ
    content, err := env.Marshal(cfg, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    // ファイルに書き込み
    err = os.WriteFile(".env", []byte(content), 0644)
    if err != nil {
        panic(err)
    }
}
```

### 現在の環境をエクスポート

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    env.Load(".env")

    // すべての環境変数を取得
    all := env.All()

    // JSON としてエクスポート
    content, err := env.Marshal(all, env.FormatJSON)
    if err != nil {
        panic(err)
    }

    fmt.Println(content)

    // またはファイルに書き込み
    os.WriteFile("env-export.json", []byte(content), 0644)
}
```

### 設定移行

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // JSON 設定を読み込み
    jsonContent, _ := os.ReadFile("config.json")

    // JSON を解析
    data, err := env.UnmarshalMap(string(jsonContent), env.FormatJSON)
    if err != nil {
        panic(err)
    }

    // .env フォーマットに変換
    envContent, err := env.Marshal(data, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    // .env ファイルとして保存
    os.WriteFile(".env", []byte(envContent), 0644)

    fmt.Println("Config migrated from JSON to .env")
}
```

## 関連ドキュメント

- [パッケージ関数](/ja/env/api-reference/functions) - Marshal、UnmarshalMap 等関数リファレンス
- [多フォーマット設定](/ja/env/guides/multi-format) - 多フォーマット読み込みガイド
- [構造体マッピング](/ja/env/guides/struct-mapping) - 構造体マッピングガイド
