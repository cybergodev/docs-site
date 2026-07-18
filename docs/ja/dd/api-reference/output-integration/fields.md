---
sidebar_label: "構造化フィールド"
title: "構造化フィールド - CyberGo DD | Field コンストラクタと検証"
description: "CyberGo DD 構造化フィールド API：20 種の型安全フィールドコンストラクタ（String/Int/Float/Bool/Time/Duration/Err など）、Field 型とフィールドキー検証（命名規則と Log4Shell セキュリティ検出）、カスタム検証モードとプリセット設定をサポート。"
sidebar_position: 3
---

# 構造化フィールド

DD は 20 種の型安全なフィールドコンストラクタ、統一された `Field` 型、およびオプションのフィールドキー検証メカニズムを提供し、構造化ログ出力に使用します。

## Field 型

`Field` は構造化ログフィールド型で、`internal.Field` の**型エイリアス**として外部に公開されます：

```go
type Field = internal.Field

// 実際の構造（internal/fields.go）
type Field struct {
    Key   string  // フィールドキー
    Value any     // フィールド値（任意の型）
}
```

すべてのフィールドコンストラクタは `Field` 値を返します。フォーマッタ（`internal.FormatFields`）は `Key=Value` 形式で出力します。基本型（string / 数値 / bool / `time.Duration` / `time.Time`）は高速パスを通り、複雑な型は JSON シリアライズにフォールバックします。

## 基本フィールド

| コンストラクタ | シグネチャ | 説明 |
|--------|------|------|
| `Any` | `(key string, value any) Field` | 任意の型 |
| `String` | `(key, value string) Field` | 文字列 |
| `Bool` | `(key string, value bool) Field` | 真偽値 |
| `Err` | `(err error) Field` | エラー（key は `"error"` 固定；`err == nil` の場合 Value は `nil`、それ以外は `err.Error()`） |
| `ErrWithKey` | `(key string, err error) Field` | カスタム key のエラー |
| `ErrWithStack` | `(err error) Field` | コールスタック付きエラー（key は `"error"`、キャプチャにわずかなオーバーヘッドあり） |

## 数値フィールド

| コンストラクタ | 型 | 例 |
|--------|------|------|
| `Int` | `int` | `dd.Int("count", 42)` |
| `Int8` | `int8` | `dd.Int8("flags", 1)` |
| `Int16` | `int16` | `dd.Int16("port", 8080)` |
| `Int32` | `int32` | `dd.Int32("code", 200)` |
| `Int64` | `int64` | `dd.Int64("id", 123456789)` |
| `Uint` | `uint` | `dd.Uint("size", 1024)` |
| `Uint8` | `uint8` | `dd.Uint8("level", 3)` |
| `Uint16` | `uint16` | `dd.Uint16("year", 2026)` |
| `Uint32` | `uint32` | `dd.Uint32("seq", 1000)` |
| `Uint64` | `uint64` | `dd.Uint64("hash", 0xABCD)` |
| `Float32` | `float32` | `dd.Float32("rate", 0.95)` |
| `Float64` | `float64` | `dd.Float64("elapsed", 1.234)` |

## 時間フィールド

| コンストラクタ | シグネチャ | 説明 |
|--------|------|------|
| `Time` | `(key string, value time.Time) Field` | タイムスタンプ（RFC3339 フォーマット） |
| `Duration` | `(key string, value time.Duration) Field` | 所要時間（`Duration.String()` を呼び出し） |

## エラーフィールド

<!-- check-code: skip -->
```go
// 標準エラーフィールド（key は "error" 固定、nil error → Value は nil）
dd.Err(err)

// カスタム key
dd.ErrWithKey("db_error", err)

// スタック情報付き（スタックフレームは runtime/ と dd 自身のフレームを除外）
dd.ErrWithStack(err)
```

## 使用方法

### InfoWith との組み合わせ

<!-- check-code: skip -->
```go
dd.InfoWith("ユーザーログイン",
    dd.String("username", "admin"),
    dd.Time("login_at", time.Now()),
    dd.Bool("mfa", true),
    dd.String("ip", "192.168.1.1"),
)
```

### WithFields チェーン呼び出し

<!-- check-code: skip -->
```go
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("pid", os.Getpid()),
)
entry.Info("サービス起動")
```

### Entry への追加

<!-- check-code: skip -->
```go
base := logger.WithFields(dd.String("req_id", id))
base.InfoWith("レスポンス",
    dd.Int("status", 200),
    dd.Duration("elapsed", took),
    dd.Err(err),
)
```

## フィールド検証

DD はフィールドキー検証メカニズムを提供し、命名規則チェックとセキュリティ検証（Log4Shell インジェクション、ホモグラフ攻撃、overlong UTF-8）をサポートします。検証設定 `FieldValidationConfig` は [`Config.FieldValidation`](../core/config) に設定して構築時に有効化するか、実行時に [`Logger.SetFieldValidation`](../core/logger) で動的に置き換えできます。`*With` の呼び出しごとに各フィールドの Key に対して `ValidateFieldKey` を呼び出し、Strict モードでは失敗時にログ形式でエラーを報告します（ログメソッド自体は error を返しません）。

### FieldValidationMode

検証モード。検証失敗時の処理方法を決定します。

```go
type FieldValidationMode int

const (
    FieldValidationNone   FieldValidationMode = iota // 検証を無効化（デフォルト、すべてのチェックをショートサーキット）
    FieldValidationWarn                              // 命名不一致時に warning ログを 1 件記録
    FieldValidationStrict                            // 命名不一致時に error ログを 1 件記録
)
```

`FieldValidationMode` の `String()` メソッドは `"none"` / `"warn"` / `"strict"` を返します（未知の値は `"unknown"` を返します）。

### FieldNamingConvention

命名規則。

```go
type FieldNamingConvention int

const (
    NamingConventionAny         FieldNamingConvention = iota // 任意の有効なキーを受け付け（デフォルト）
    NamingConventionSnakeCase                                // snake_case：user_id
    NamingConventionCamelCase                                // camelCase：userId
    NamingConventionPascalCase                               // PascalCase：UserId
    NamingConventionKebabCase                                // kebab-case：user-id
)
```

`FieldNamingConvention` の `String()` メソッドは `"any"` / `"snake_case"` / `"camelCase"` / `"PascalCase"` / `"kebab-case"` を返します（未知の値は `"unknown"` を返します）。

### FieldValidationConfig

フィールド検証設定。

```go
type FieldValidationConfig struct {
    Mode                     FieldValidationMode    // 検証モード
    Convention               FieldNamingConvention  // 命名規則
    AllowCommonAbbreviations bool                   // 一般的な略語を許可（ID、URL、HTTP、JSON など）
    EnableSecurityValidation bool                   // セキュリティ検証を有効化（Log4Shell / ホモグラフ / overlong UTF-8）
}
```

:::warning ゼロ値の落とし穴
リテラル `FieldValidationConfig{}` は `EnableSecurityValidation=false` となり、**セキュリティ検証を暗黙に無効化**します——[`DefaultFieldValidationConfig`](#プリセット設定) コンストラクタの使用を優先してください（同コンストラクタはこの項目を `true` に設定します）。また、`Mode == FieldValidationNone` の場合はセキュリティ検証の前にショートサーキットするため、`EnableSecurityValidation` を有効化していても実行されません。
:::

### プリセット設定

```go
// デフォルト設定：命名検証を無効化、セキュリティ検証を有効化
func DefaultFieldValidationConfig() *FieldValidationConfig

// 厳格 snake_case
func StrictSnakeCaseConfig() *FieldValidationConfig

// 厳格 camelCase
func StrictCamelCaseConfig() *FieldValidationConfig
```

3 つのプリセットはいずれも `AllowCommonAbbreviations=true` かつ `EnableSecurityValidation=true` とし、後者 2 つは `Mode=FieldValidationStrict` です。

### ValidateFieldKey

```go
func (c *FieldValidationConfig) ValidateFieldKey(key string) error
```

フィールドキーが設定に一致するか検証します。失敗時に原因を記述する error を返し、検証通過時は `nil` を返します。レシーバが `nil` または `Mode == FieldValidationNone` の場合は `nil` を直接返します。検証順序：

1. 空キー → `"field key cannot be empty"` を返す
2. `EnableSecurityValidation` 有効時に `internal.ValidateFieldKeyStrict` を実行（Log4Shell / ホモグラフ / overlong UTF-8）
3. `Convention == NamingConventionAny` → 命名チェックをスキップ
4. `AllowCommonAbbreviations` 有効かつキーが一般略語表にヒット（`id`/`url`/`http`/`json`/`jwt` など、または `_id`/`_url`/`_uri`/`_ip`/`_api` で終わる）→ 通過
5. 規則に従って項目ごとに検証：snake_case / camelCase / PascalCase / kebab-case

```go
package main

import (
    "fmt"

    "github.com/cybergodev/dd"
)

func main() {
    // 厳格 snake_case プリセット
    cfg := dd.StrictSnakeCaseConfig()

    if err := cfg.ValidateFieldKey("user_id"); err != nil {
        fmt.Println("user_id:", err)
    } else {
        fmt.Println("user_id OK")
        // 出力: user_id OK
    }

    if err := cfg.ValidateFieldKey("userId"); err != nil {
        fmt.Println("userId:", err)
        // 出力: userId: field key "userId" does not match snake_case convention
    }

    // 一般略語の除外：URL は snake_case に適合しないが、略語表にヒットするため通過
    if err := cfg.ValidateFieldKey("URL"); err != nil {
        fmt.Println("URL:", err)
    } else {
        fmt.Println("URL OK (略語除外)")
        // 出力: URL OK (略語除外)
    }

    // デフォルト設定 Mode=None、命名を検証しない
    defaultCfg := dd.DefaultFieldValidationConfig()
    if err := defaultCfg.ValidateFieldKey("anyKey"); err != nil {
        fmt.Println("anyKey:", err)
    } else {
        fmt.Println("anyKey OK (Mode=None)")
        // 出力: anyKey OK (Mode=None)
    }
}
```

## 次のステップ

- [Logger](../core/logger) -- `WithFields` / `InfoWith` / `SetFieldValidation`
- [LoggerEntry](../core/entry) -- プリセットフィールド チェーン呼び出し
- [コンテキスト統合](./context) -- `ContextExtractor` フィールド抽出
- [設定](../core/config) -- `Config.FieldValidation`
