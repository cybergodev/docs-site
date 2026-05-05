---
title: シリアライズ - CyberGo env | マルチフォーマット変換
description: CyberGo env ライブラリのシリアライズとデシリアライズ完全使用ガイド。.env、JSON、YAML 形式間の Map マッピングと Go 構造体の相互変換をサポートし、カスタムシリアライズ形式オプション、env タグサポート、機密フィールドのマスキング処理、一括エクスポート/インポート操作例とマルチフォーマット相互変換の Go 実践シーンを含みます。
---

# シリアライズ

Marshal と Unmarshal 機能を使用して環境変数をシリアライズ/デシリアライズし、`.env`、JSON、YAML 形式の変換をサポートします。

## 基本的なシリアライズ

### Map のシリアライズ

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

    // .env 形式にシリアライズ
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

## 構造体のシリアライズ

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

    // 構造体を .env 形式にシリアライズ
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

    // ファイルへのエクスポートに利用可能
    content, _ := env.Marshal(data, env.FormatEnv)
    fmt.Println(content)
}
```

## デシリアライズ

### Map のデシリアライズ

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // .env 形式の文字列
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

### JSON のデシリアライズ

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

### YAML のデシリアライズ

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

## 構造体のデシリアライズ

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
    // フォーマットの自動検出
    format := env.DetectFormat("config.json")
    fmt.Println(format.String()) // json

    format = env.DetectFormat("settings.yaml")
    fmt.Println(format.String()) // yaml

    format = env.DetectFormat(".env")
    fmt.Println(format.String()) // dotenv

    // FormatAuto による自動検出
    data := `{"KEY": "value"}`
    result, _ := env.UnmarshalMap(data, env.FormatAuto)
    fmt.Println(result)
}
```

## 実用的なシーン

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

### 設定の移行

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

    // JSON をパース
    data, err := env.UnmarshalMap(string(jsonContent), env.FormatJSON)
    if err != nil {
        panic(err)
    }

    // .env 形式に変換
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

- [パッケージ関数](/ja/env/api-reference/functions) - Marshal、UnmarshalMap 等の関数リファレンス
- [マルチフォーマット設定](/ja/env/guides/multi-format) - マルチフォーマット読み込みガイド
- [構造体マッピング](/ja/env/guides/struct-mapping) - 構造体マッピングガイド
