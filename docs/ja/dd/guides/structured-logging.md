---
title: "構造化ログ - CyberGo DD | フィールドとチェーン呼び出し"
description: "CyberGo DD 構造化ログ使用ガイド。20+ の型安全なフィールドコンストラクタ、Field チェーン渡しパターン、LoggerEntry 不変設計の原理、フィールド命名規則と検証ルール、構造化ログのベストプラクティスと一般的な使用パターンを詳細に紹介し、プロジェクトで高性能な構造化ログ記録ソリューションを効果的に活用できます。"
---

# 構造化ログ

構造化ログはキーと値のペアフィールドでコンテキスト情報を記録し、ログをプログラムで解析・検索・分析可能にします。DD は型安全なフィールドコンストラクタと柔軟なチェーン呼び出しメカニズムを提供します。

## フィールドコンストラクタ

DD は 20+ の型安全なフィールドコンストラクタを提供します：

### 基本型

```go
dd.InfoWith("ユーザー登録",
    dd.String("username", "alice"),
    dd.Int("age", 25),
    dd.Float64("score", 98.5),
    dd.Bool("verified", true),
)
```

### 時間関連

```go
dd.InfoWith("定期タスク実行",
    dd.Time("scheduled_at", time.Now()),
    dd.Duration("elapsed", 150*time.Millisecond),
)
```

### 整数型ファミリー

```go
dd.InfoWith("パケット処理",
    dd.Int8("flags", 0x0F),
    dd.Int32("seq", 1001),
    dd.Int64("total_bytes", 1<<20),
    dd.Uint16("port", 8080),
    dd.Uint32("src_ip", 0xC0A80101),
)
```

### エラー処理

```go
// デフォルトの key は "error"
dd.ErrorWith("クエリ失敗", dd.Err(err))

// カスタム key
dd.ErrorWith("データベースエラー", dd.ErrWithKey("db_error", dbErr))

// スタックトレース付き
dd.ErrorWith("重大なエラー", dd.ErrWithStack(err))
```

### 任意の型

```go
// 任意の型、fmt.Sprintf でフォーマット
dd.InfoWith("リクエストペイロード", dd.Any("body", requestBody))
```

:::warning パフォーマンスに関する注意
`Any` はリフレクションを使用するため、型が明確なコンストラクタよりパフォーマンスが低くなります。高頻度パスでは具体的な型の使用を優先してください。
:::

## チェーン呼び出し

### Logger → Entry

```go
// プリセットフィールド付き Entry を作成
reqLog := logger.WithFields(
    dd.String("service", "api"),
    dd.String("version", "1.0"),
)

// Entry はプリセットフィールドを自動付与
reqLog.Info("サービス起動")
reqLog.Warn("メモリ使用量が高い")
reqLog.ErrorWith("リクエスト失敗",
    dd.String("path", "/api/users"),
    dd.Err(err),
)
```

### Entry → Entry（多層ネスト）

```go
// サービスレベル
svcLog := logger.WithFields(dd.String("service", "order"))

// モジュールレベル（サービスレベルフィールドを継承）
dbLog := svcLog.WithFields(dd.String("module", "database"))

// オペレーションレベル（全上位フィールドを継承）
queryLog := dbLog.WithFields(dd.String("operation", "query"))

queryLog.InfoWith("クエリ完了",
    dd.Int("rows", 42),
    dd.Duration("elapsed", 10*time.Millisecond),
)
// フィールド: service=order module=database operation=query rows=42 elapsed=10ms
```

### パッケージレベル関数のチェーン呼び出し

```go
dd.WithFields(
    dd.String("app", "myapp"),
    dd.String("env", "production"),
).Info("アプリケーション起動")
```

## フィールド命名規則

DD はフィールド命名規則の設定をサポートし、開発段階で自動チェックを行います：

### 組み込み規則

```go
// snake_case（推奨、最も汎用的）
cfg := dd.StrictSnakeCaseConfig()

// camelCase
cfg := dd.StrictCamelCaseConfig()

// 制限なし（デフォルト）
cfg := dd.DefaultFieldValidationConfig()
```

### 設定で有効化

```go
logger, _ := dd.New(dd.Config{
    FieldValidation: dd.StrictSnakeCaseConfig(),
})
```

有効にすると、非準拠のフィールド名はログに警告が出力されます：

```go
logger.InfoWith("テスト",
    dd.String("UserName", "alice"),   // PascalCase → 警告
    dd.String("user_name", "alice"),  // snake_case → 正常
)
```

## 一般的なパターン

### HTTP リクエストログ

```go
func loggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()

            reqLog := logger.WithFields(
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
                dd.String("remote_addr", r.RemoteAddr),
                dd.String("user_agent", r.UserAgent()),
            )

            next.ServeHTTP(w, r)

            reqLog.InfoWith("リクエスト完了",
                dd.Duration("elapsed", time.Since(start)),
            )
        })
    }
}
```

### サービス階層ログ

```go
type UserService struct {
    log *dd.LoggerEntry
}

func NewUserService(logger *dd.Logger) *UserService {
    return &UserService{
        log: logger.WithFields(dd.String("component", "user_service")),
    }
}

func (s *UserService) CreateUser(ctx context.Context, name string) error {
    s.log.InfoWith("ユーザー作成",
        dd.String("name", name),
    )

    if err := s.validate(name); err != nil {
        s.log.ErrorWith("ユーザー作成失敗",
            dd.String("name", name),
            dd.Err(err),
        )
        return err
    }

    return nil
}
```

### 条件付きログ（不要な計算を回避）

```go
// 方法 1：先にレベルをチェック
if logger.IsDebugEnabled() {
    data := computeExpensiveDebugInfo()
    logger.DebugWith("デバッグデータ", dd.Any("data", data))
}

// 方法 2：WithFields の遅延計算特性を利用
reqLog := logger.WithFields(dd.String("request_id", reqID))
// WithFields はフィールドを構築するだけで I/O オーバーヘッドなし
// 実際に Info/Error などのメソッドを呼び出したときのみログが書き込まれる
```

## 出力フォーマット

### テキストフォーマット（デフォルト）

```text
[2026-04-16T21:16:48+08:00   INFO] main.go:13 リクエスト完了 method=GET status=200 elapsed=150ms
```

### JSON フォーマット

```go
logger, _ := dd.New(dd.JSONConfig())
logger.InfoWith("リクエスト完了",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)
```

```json
{"timestamp":"2026-04-16T21:16:48+08:00","level":"info","caller":"main.go:13","message":"リクエスト完了","fields":{"method":"GET","status":200}}
```

## 次のステップ

- [ファイル出力とローテーション](./file-output) -- ログをファイルに書き込む
- [機密データフィルタリング](./sensitive-filtering) -- 機密情報の自動マスキング
- [API リファレンス - フィールド](../api-reference/fields) -- 全フィールドコンストラクタ
- [API リファレンス - LoggerEntry](../api-reference/entry) -- Entry の全メソッド
