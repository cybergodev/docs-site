---
sidebar_label: "LoggerEntry"
title: "LoggerEntry - CyberGo DD | プリセットフィールドログ"
description: "CyberGo DD LoggerEntry タイプ完全 API ドキュメント。プリセットフィールド付きチェーンロガーを作成。フィールドを渡した場合は新しい不変 Entry を返し（未渡しの場合は元の Entry を返す）、フィールド蓄積・組み合わせ、コンテキストバインディング伝播、レベル継承をサポートし、リクエストレベルのログトレーシングに適する。"
sidebar_position: 3
---

# LoggerEntry

`LoggerEntry` はプリセットフィールド付きのロガーで、少なくとも 1 つのフィールドを渡した場合に新しい不変 Entry を返します。

## 作成

```go
// Logger から作成
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.String("env", "prod"),
)

// グローバル Logger から作成
entry := dd.Default().WithFields(
    dd.String("service", "api"),
)

// 単一フィールドのショートカット
entry := logger.WithField("request_id", "req-123")
```

## チェーン呼び出し

```go
// フィールドを追加（新しい Entry を返す、元の Entry は変更されない）
base := logger.WithFields(dd.String("svc", "api"))
enhanced := base.WithFields(dd.String("env", "prod"))

// 新しいフィールドが同名の古いフィールドを上書き
entry := base.WithField("svc", "gateway")  // svc が "gateway" になる
```

:::tip 不変性
少なくとも 1 つのフィールドを渡した場合、`WithFields` / `WithField` は新しい `LoggerEntry` を返し、元の Entry は影響を受けないため、安全に並行使用できます。`WithFields()` でフィールドを渡さなかった場合は無操作（no-op）最適化として元の Entry を直接返します。
:::

## ログメソッド

Logger の全ログメソッドが Entry でも使用可能で、出力されるログにプリセットフィールドが自動付与されます：

### 基本ログ

| メソッド | 説明 |
|------|------|
| `Debug(args ...any)` | Debug レベル |
| `Info(args ...any)` | Info レベル |
| `Warn(args ...any)` | Warn レベル |
| `Error(args ...any)` | Error レベル |
| `Fatal(args ...any)` | Fatal レベル（デフォルトで os.Exit(1) を呼び出し、**defer は実行されません**；FatalHandler でカスタマイズ可能） |
| `Log(level LogLevel, args ...any)` | レベル指定 |

### フォーマットログ

| メソッド | 説明 |
|------|------|
| `Debugf(format string, args ...any)` | フォーマット Debug |
| `Infof(format string, args ...any)` | フォーマット Info |
| `Warnf(format string, args ...any)` | フォーマット Warn |
| `Errorf(format string, args ...any)` | フォーマット Error |
| `Fatalf(format string, args ...any)` | フォーマット Fatal（デフォルトで os.Exit(1) を呼び出し、**defer は実行されません**；FatalHandler でカスタマイズ可能） |
| `Logf(level LogLevel, format string, args ...any)` | フォーマット レベル指定 |

### 構造化ログ

| メソッド | 説明 |
|------|------|
| `DebugWith(msg string, fields ...Field)` | 構造化 Debug（プリセットフィールドと結合） |
| `InfoWith(msg string, fields ...Field)` | 構造化 Info |
| `WarnWith(msg string, fields ...Field)` | 構造化 Warn |
| `ErrorWith(msg string, fields ...Field)` | 構造化 Error |
| `FatalWith(msg string, fields ...Field)` | 構造化 Fatal（デフォルトで os.Exit(1) を呼び出し、**defer は実行されません**；FatalHandler でカスタマイズ可能） |
| `LogWith(level LogLevel, msg string, fields ...Field)` | 構造化 レベル指定 |

### Print メソッド

| メソッド | 説明 |
|------|------|
| `Print(args ...any)` | Writer に出力（LevelInfo、セキュリティフィルタリング対象） |
| `Println(args ...any)` | Print と同じ動作 |
| `Printf(format string, args ...any)` | フォーマット出力（LevelInfo、セキュリティフィルタリング対象） |

### フィールドチェーン

| メソッド | 説明 |
|------|------|
| `WithFields(fields ...Field) *LoggerEntry` | フィールドを追加、新しい Entry を返す |
| `WithField(key string, value any) *LoggerEntry` | 単一フィールドを追加、新しい Entry を返す |

## 使用例

### HTTP リクエストログ

```go
func handleRequest(w http.ResponseWriter, r *http.Request) {
    reqLog := logger.WithFields(
        dd.String("method", r.Method),
        dd.String("path", r.URL.Path),
        dd.String("remote", r.RemoteAddr),
    )

    reqLog.Info("リクエスト開始")

    // 処理ロジック...

    reqLog.WithField("status", 200).Info("リクエスト完了")
}
```

### サービスコンポーネントログ

```go
serviceLog := logger.WithFields(
    dd.String("service", "user-service"),
    dd.String("version", "2.1.0"),
)

serviceLog.Info("サービス起動")

dbLog := serviceLog.WithField("component", "database")
dbLog.Info("接続成功")
dbLog.ErrorWith("クエリ失敗", dd.Err(err))
```

## 次のステップ

- [Logger](./logger) -- Logger インスタンスメソッド
- [構造化フィールド](../output-integration/fields) -- Field コンストラクタ
- [パッケージ関数](./functions) -- グローバルログ関数
