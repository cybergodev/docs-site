---
title: "構造化フィールド - CyberGo DD | Field コンストラクタ"
description: "CyberGo DD 構造化フィールドコンストラクタ完全 API ドキュメント。20+ 種類の型安全なフィールド作成をサポート。String/Int/Float/Bool などの基本フィールド、Time/Duration 時間フィールド、Error エラーフィールド、Any オブジェクトフィールド、カスタムフィールドを含み、便利なチェーン呼び出し組み合わせ方法を提供。"
---

# 構造化フィールド

DD は 20+ の型安全なフィールドコンストラクタを提供し、構造化ログ出力に使用します。

## 基本フィールド

| コンストラクタ | シグネチャ | 説明 |
|--------|------|------|
| `Any` | `(key string, value any) Field` | 任意の型 |
| `String` | `(key, value string) Field` | 文字列 |
| `Bool` | `(key string, value bool) Field` | 真偽値 |
| `Err` | `(err error) Field` | エラー（key は "error"） |
| `ErrWithKey` | `(key string, err error) Field` | カスタム key のエラー |
| `ErrWithStack` | `(err error) Field` | スタック情報付きエラー |

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
| `Time` | `(key string, value time.Time) Field` | タイムスタンプ |
| `Duration` | `(key string, value time.Duration) Field` | 所要時間 |

## エラーフィールド

```go
// 標準エラーフィールド（key は "error"）
dd.Err(err)

// カスタム key
dd.ErrWithKey("db_error", err)

// スタックトレース付き
dd.ErrWithStack(err)
```

## 使用方法

### InfoWith との組み合わせ

```go
dd.InfoWith("ユーザーログイン",
    dd.String("username", "admin"),
    dd.Time("login_at", time.Now()),
    dd.Bool("mfa", true),
    dd.String("ip", "192.168.1.1"),
)
```

### WithFields チェーン呼び出し

```go
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("pid", os.Getpid()),
)
entry.Info("サービス起動")
```

### Entry への追加

```go
base := logger.WithFields(dd.String("req_id", id))
base.InfoWith("レスポンス",
    dd.Int("status", 200),
    dd.Duration("elapsed", took),
    dd.Err(err),
)
```

## 型定義

`Field` は構造化ログフィールド型で、`Key`（文字列）と `Value`（任意の値）の 2 つのフィールドを含み、コンストラクタ関数で作成します。

## 次のステップ

- [Logger](./logger) -- WithFields / InfoWith メソッド
- [LoggerEntry](./entry) -- プリセットフィールド チェーン呼び出し
- [コンテキスト統合](./context) -- ContextExtractor フィールド抽出
