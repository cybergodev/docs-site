---
title: カスタムパーサー - CyberGo env | ファイルフォーマット拡張
description: CyberGo env ライブラリのカスタムパーサー開発完全ガイド。EnvParser インターフェースを実装してカスタムファイルフォーマットパーサーを作成し、ComponentFactory に登録して読み込みフローに統合する方法を紹介。env ライブラリがサポートする設定ファイルフォーマットを拡張し、TOML パーサーの完全な Go サンプルとベストプラクティスを含みます。
---

# カスタムパーサー

このガイドでは、カスタムファイルフォーマットパーサーを作成・登録し、env ライブラリがサポートする設定フォーマットを拡張する方法を紹介します。

## パーサーインターフェース

### EnvParser

すべてのパーサーはこのインターフェースを実装する必要があります：

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

**パラメータ：**
- `r` - ファイル内容のリーダー
- `filename` - ファイル名（エラーメッセージに使用）

**戻り値：**
- `map[string]string` - パース後のキーと値のペア
- `error` - パースエラー

---

## カスタムパーサーの作成

### 基本構造

```go
package myparser

import (
    "io"
    "github.com/cybergodev/env"
)

// カスタムパーサー
type CustomParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

// EnvParser インターフェースを実装
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // 1. 内容を読み取り（サイズ制限に注意）
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize))
    if err != nil {
        return nil, err
    }

    // 2. 内容をキーと値のペアにパース
    // ... パースロジック

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
package main

import (
    "fmt"
    "io"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// TOMLParser は TOML フォーマットをパースします
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

        // セクション [section] をパース
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            currentSection = strings.Trim(line, "[]")
            continue
        }

        // key = value をパース
        parts := strings.SplitN(line, "=", 2)
        if len(parts) != 2 {
            continue // またはエラーを返す
        }

        key := strings.TrimSpace(parts[0])
        value := strings.TrimSpace(parts[1])

        // セクションプレフィックスを追加
        if currentSection != "" {
            key = currentSection + "_" + key
        }

        // クォートを除去
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

    // 変数の数をチェック
    if len(result) > p.cfg.MaxVariables {
        return nil, fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    _ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed TOML: "+filename, true, time.Since(start))
    return result, nil
}
```

### INI パーサーの例

```go
package main

import (
    "fmt"
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// INIParser は INI フォーマットをパースします
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

        // セクション
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

            // 検証
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

ファクトリ関数は Config と ComponentFactory を受け取り、パーサーインスタンスを返します。

**パラメータの説明：**
- `cfg` - 設定オブジェクト。すべての制限とセキュリティ設定を含む
- `factory` - コンポーネントファクトリー。Validator、Auditor などのコンポーネントを取得可能

### RegisterParser 関数

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

カスタムフォーマットパーサーを登録します。

**パラメータ：**
- `format` - ファイルフォーマット定数（100 以上の値の使用を推奨し、競合を回避）
- `factory` - パーサーファクトリ関数

**戻り値：**
- `error` - 登録に失敗した場合にエラーを返す

**エラーが発生するケース：**
- 組み込みフォーマット（FormatEnv、FormatJSON、FormatYAML）はオーバーライドできません
- フォーマットが既に登録済みの場合

**注意事項：**
- `env.New()` の呼び出し前に登録する必要があります
- `init()` 関数での登録を推奨します

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

    // ... パースロジック

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

```go
package main

import (
    "github.com/cybergodev/env"
)

// 1. フォーマット定数を定義（100 以上の値を推奨）
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
        panic(err) // フォーマット登録済みまたはその他のエラー
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
    // 登録は New の前に完了している必要がある（init で完了済み）

    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // .toml ファイルを読み込み可能
    loader.LoadFiles("config.toml")
}
```

---

## ベストプラクティス

### 1. 設定制限を遵守する

```go
func (p *CustomParser) checkLimits(result map[string]string) error {
    // 変数の数をチェック
    if len(result) > p.cfg.MaxVariables {
        return fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    // キーと値の長さをチェック
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

### 2. バリデーターを使用する

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // ... パースロジック

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

### 3. 意味のあるエラーを提供する

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

    // ... パースロジック

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

## 完全なサンプル

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

// XMLParser は XML フォーマットをパースします
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
        _ = p.auditor.LogError(env.ActionParse, "", "file exceeds size limit")
        return nil, fmt.Errorf("file exceeds size limit: %d > %d", len(content), p.cfg.MaxFileSize)
    }

    var xmlConfig XMLConfig
    if err := xml.Unmarshal(content, &xmlConfig); err != nil {
        _ = p.auditor.LogError(env.ActionParse, "", "xml parse error: "+err.Error())
        return nil, fmt.Errorf("xml parse error: %w", err)
    }

    result := make(map[string]string)

    for _, entry := range xmlConfig.Entries {
        key := strings.ToUpper(entry.Key)

        // キーの長さを検証
        if len(key) > p.cfg.MaxKeyLength {
            return nil, fmt.Errorf("key too long: %s", key)
        }

        // キーのフォーマットを検証
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, fmt.Errorf("invalid key %q: %w", key, err)
        }

        // 値の長さを検証
        if len(entry.Value) > p.cfg.MaxValueLength {
            return nil, fmt.Errorf("value too long for key: %s", key)
        }

        result[key] = entry.Value
    }

    // 変数の数をチェック
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
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // XML 設定を読み込み
    /*
    <?xml version="1.0"?>
    <config>
        <entry key="DATABASE_HOST">localhost</entry>
        <entry key="DATABASE_PORT">5432</entry>
    </config>
    */
    loader.LoadFiles("config.xml")

    fmt.Println(loader.GetString("DATABASE_HOST"))  // localhost
    fmt.Println(loader.GetInt("DATABASE_PORT"))     // 5432
}
```

---

## 関連ドキュメント

- [ComponentFactory API](/ja/env/api-reference/factory) - ComponentFactory と RegisterParser
- [インターフェース定義](/ja/env/api-reference/interfaces) - EnvParser インターフェース定義
- [Config API](/ja/env/api-reference/config) - 設定オプションの詳細
- [マルチフォーマット設定](/ja/env/guides/multi-format) - JSON/YAML フォーマットの詳細
