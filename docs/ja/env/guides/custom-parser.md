---
sidebar_label: "カスタムパーサー"
title: "カスタムパーサー - CyberGo env | ファイルフォーマットの拡張"
description: "CyberGo env カスタムパーサーガイド。EnvParser インターフェースの Parse メソッドを実装して RegisterParser で登録し、ComponentFactory から Validator と Auditor を取得し、TOML・INI 例とベストプラクティスを提供します。"
sidebar_position: 7
---

# カスタムパーサー

このガイドでは、カスタムファイルフォーマットパーサーの作成と登録方法を説明し、env ライブラリがサポートする設定フォーマットを拡張します。

## パーサーインターフェース

### EnvParser

すべてのパーサーはこのインターフェースを実装する必要があります：

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

**パラメータ：**
- `r` - ファイルコンテンツリーダー
- `filename` - ファイル名（エラー情報用）

**戻り値：**
- `map[string]string` - 解析されたキーと値のペア
- `error` - 解析エラー

---

## カスタムパーサーの作成

### 基本構造

```go
package myparser

import (
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// カスタムパーサー
type CustomParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

// EnvParser インターフェースの実装
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // 1. 内容を読み取り（サイズ制限に注意）
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize))
    if err != nil {
        return nil, err
    }

    // 2. 内容をキー・バリューペアに解析
    for _, line := range strings.Split(string(content), "\n") {
        line = strings.TrimSpace(line)
        if line == "" || strings.HasPrefix(line, "#") {
            continue
        }
        idx := strings.Index(line, "=")
        if idx <= 0 {
            continue
        }
        result[strings.TrimSpace(line[:idx])] = strings.TrimSpace(line[idx+1:])
    }

    // 3. 結果を検証
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, err
        }
    }

    // 4. 結果を返す
    return result, nil
}
```

### TOML パーサーの例

```go
package tomlparser

import (
    "fmt"
    "io"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// TOMLParser TOML フォーマットを解析
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()

    // 読み取りサイズを制限
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

        // 空行とコメントをスキップ
        if line == "" || strings.HasPrefix(line, "#") {
            continue
        }

        // section を解析 [section]
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            currentSection = strings.Trim(line, "[]")
            continue
        }

        // キーと値を解析 key = value
        parts := strings.SplitN(line, "=", 2)
        if len(parts) != 2 {
            continue // またはエラーを返す
        }

        key := strings.TrimSpace(parts[0])
        value := strings.TrimSpace(parts[1])

        // section プレフィックスを追加
        if currentSection != "" {
            key = currentSection + "_" + key
        }

        // 引用符を除去
        value = strings.Trim(value, "\"'")

        // 大文字に変換
        key = strings.ToUpper(key)

        // キーを検証
        if err := p.validator.ValidateKey(key); err != nil {
            _ = p.auditor.LogError(env.ActionParse, key, err.Error())
            return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
        }

        result[key] = value
    }

    // 変数の数を確認
    if len(result) > p.cfg.MaxVariables {
        return nil, fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    _ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed TOML: "+filename, true, time.Since(start))
    return result, nil
}
```

### INI パーサーの例

```go
package iniparser

import (
    "fmt"
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// INIParser INI フォーマットを解析
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

        // 空行とコメントをスキップ
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

            // 検証（バリデーション）
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

## パーサーの登録

### ParserFactory 型

```go
type ParserFactory func(cfg Config, factory *ComponentFactory) (EnvParser, error)
```

ファクトリー関数は Config と ComponentFactory を受け取り、パーサーインスタンスを返します。

**パラメータの説明：**
- `cfg` - 設定オブジェクト。すべての制限とセキュリティ設定を含む
- `factory` - コンポーネントファクトリー。Validator、Auditor などのコンポーネントを取得可能

### RegisterParser 関数

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

カスタムフォーマットパーサーを登録します。

**パラメータ：**
- `format` - ファイルフォーマット定数（衝突を避けるため 100 以上の値の使用を推奨）
- `factory` - パーサーファクトリー関数

**戻り値：**
- `error` - 登録失敗時にエラーを返す

**エラーケース：**
- 組み込みフォーマット（FormatEnv、FormatJSON、FormatYAML）は上書き不可
- フォーマットが既に登録済み

**注意事項：**
- `env.New()` を呼び出す前に登録する必要がある
- `init()` 関数内での登録を推奨

### ComponentFactory の使用

ComponentFactory を通じてバリデーターとオーディターを取得します：

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

    // ... 解析ロジック

    // バリデーターを使用してキー名を検証
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

### 完全な登録例

<!-- check-code: skip -->
```go
package main

import (
    "github.com/cybergodev/env"
)

// 1. フォーマット定数の定義（衝突を避けるため 100 以上の値を推奨）
const (
    FormatTOML env.FileFormat = 100
    FormatINI  env.FileFormat = 101
    FormatXML  env.FileFormat = 102
)

// 2. init で登録
func init() {
    // TOML パーサーを登録
    err := env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err) // フォーマットが既に登録済みまたはその他のエラー
    }

    // INI パーサーを登録
    env.RegisterParser(FormatINI, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &INIParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}

func main() {
    // 登録は New の前に完了する必要がある（init で完了済み）。
    //
    // 重要な制限：LoadFiles は .toml 拡張子を見ても上記の TOMLParser に
    // 自動的にルーティングしません——DetectFormat は .env/.json/.yaml/.yml
    // しか認識せず、それ以外の拡張子は組み込みの dotenv パーサーに
    // フォールバックします（format.go の DetectFormat を参照）。
    // LoadFiles で実際に TOMLParser を呼び出すには、ForceRegisterParser で
    // FormatEnv を上書きし、ファイル名を *.env にします：
    err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err)
    }

    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // ファイル拡張子を .env にする（内容は TOML フォーマット）ことで、上書き後のパーサーにルーティングされる
    if err := loader.LoadFiles("config.env"); err != nil {
        panic(err)
    }
}
```

::: warning LoadFiles のルーティング制限
`RegisterParser` で登録したカスタムフォーマット番号（例：`FormatTOML = 100`）は、`LoadFiles` がファイル拡張子から自動的には認識し**ません**。`LoadFiles` は内部で `DetectFormat(filename)` を呼び出してパーサーを選択しますが、`DetectFormat` は `.env` / `.json` / `.yaml` / `.yml` の 4 種類の拡張子しか認識せず、それ以外は `FormatAuto` を返し、最終的に組み込みの dotenv パーサーにフォールバックします——カスタムパーサーは呼び出されません。

カスタムフォーマットファイルを読み込む 2 つの方法：

1. **`.env` 拡張子 + `ForceRegisterParser`**（推奨）：カスタムフォーマットファイルに `*.env` という名前を付け、`env.ForceRegisterParser(env.FormatEnv, ...)` で組み込みの dotenv パーサーを上書きします。キー名/値/サイズなどのセキュリティ検証を必ず保持してください。保持しないとセキュリティホールが生じます。
2. **パーサーを手動で呼び出す**：ファイルを読み込んで `io.Reader` を取得し、自分でパーサーインスタンスを構築して `parser.Parse(reader, filename)` を呼び出して `map[string]string` を取得し、`loader.Set` で 1 件ずつ書き込みます。パーサー内部の `validator`/`auditor` は通常 `*ComponentFactory` に依存するため、ファクトリー登録時に併せて取得して渡す必要がある点に注意してください。
:::

---

## ベストプラクティス

### 1. 設定制限を遵守

```go
func (p *CustomParser) checkLimits(result map[string]string) error {
    // 変数の数を確認
    if len(result) > p.cfg.MaxVariables {
        return fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    // キーと値の長さを確認
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

### 2. バリデーターを使用

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // ... 解析ロジック

    // すべてのキーを検証
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, fmt.Errorf("invalid key %q: %w", key, err)
        }
    }

    // すべての値を検証（有効な場合）
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

### 3. 有意義なエラーを提供

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

### 4. 監査ログを記録する

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()
    result := make(map[string]string)

    // ... 解析ロジック

    // 成功を記録
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

## 完全な例

### XML パーサーの実装

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

// XML 設定構造体
type XMLConfig struct {
    XMLName xml.Name   `xml:"config"`
    Entries []XMLEntry `xml:"entry"`
}

type XMLEntry struct {
    Key   string `xml:"key,attr"`
    Value string `xml:",chardata"`
}

// XMLParser は XML フォーマットを解析
type XMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *XMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()

    // 読み取りサイズを制限
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
    if err != nil {
        return nil, err
    }
    if int64(len(content)) > p.cfg.MaxFileSize {
        _ = p.auditor.LogError(env.ActionParse, "", "file size limit exceeded")
        return nil, fmt.Errorf("file exceeds size limit: %d > %d", len(content), p.cfg.MaxFileSize)
    }

    var xmlConfig XMLConfig
    if err := xml.Unmarshal(content, &xmlConfig); err != nil {
        _ = p.auditor.LogError(env.ActionParse, "", "XML parse error: "+err.Error())
        return nil, fmt.Errorf("xml parse error: %w", err)
    }

    result := make(map[string]string)

    for _, entry := range xmlConfig.Entries {
        key := strings.ToUpper(entry.Key)

        // キー長を検証
        if len(key) > p.cfg.MaxKeyLength {
            return nil, fmt.Errorf("key too long: %s", key)
        }

        // キー形式を検証
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, fmt.Errorf("invalid key %q: %w", key, err)
        }

        // 値の長さを検証
        if len(entry.Value) > p.cfg.MaxValueLength {
            return nil, fmt.Errorf("value too long for key: %s", key)
        }

        result[key] = entry.Value
    }

    // 変数の数を確認
    if len(result) > p.cfg.MaxVariables {
        return nil, fmt.Errorf("too many variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    _ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed XML: "+filename, true, time.Since(start))
    return result, nil
}

// XML フォーマット定数を定義
const FormatXML env.FileFormat = 102

func init() {
    // XML パーサーを登録
    env.RegisterParser(FormatXML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &XMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}

func main() {
    // LoadFiles は .xml 拡張子を見ても XML パーサーに自動ルーティング
    // しません——DetectFormat は .env/.json/.yaml/.yml しか認識しません。
    // ここでは ForceRegisterParser で FormatEnv を上書きし、.env 拡張子で
    // 読み込みます（内容は XML フォーマット）：
    err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &XMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err)
    }

    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    /*
    config.env ファイル内容（XML フォーマット）：
    <?xml version="1.0"?>
    <config>
        <entry key="DATABASE_HOST">localhost</entry>
        <entry key="DATABASE_PORT">5432</entry>
    </config>
    */
    if err := loader.LoadFiles("config.env"); err != nil {
        panic(err)
    }

    fmt.Println(loader.GetString("DATABASE_HOST"))  // localhost
    fmt.Println(loader.GetInt("DATABASE_PORT"))     // 5432
}
```

---

## 関連ドキュメント

- [ComponentFactory API](/ja/env/api-reference/factory) - ComponentFactory と RegisterParser
- [インターフェース定義](/ja/env/api-reference/interfaces) - EnvParser インターフェース定義
- [Config API](/ja/env/api-reference/config) - 設定オプション詳解
- [多フォーマット設定](/ja/env/guides/multi-format) - JSON/YAML フォーマットの詳細
