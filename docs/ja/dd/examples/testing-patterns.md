---
title: "テストパターン - CyberGo DD | LoggerRecorder テストサンプル"
description: "CyberGo DD テストパターンサンプル。LoggerRecorder の単体テストと統合テストでの完全な使用方法を詳細に紹介。ログメッセージアサーション、レベルフィルタリングテスト、フィールド値検査、マルチテストケースの分離、並行安全性テスト、テストカバレッジ向上の完全なヒントとベストプラクティス。各種 Go プロジェクトのログテストに適用可能。"
---

# テストパターン

DD はテスト補助ツールとして `LoggerRecorder` を提供し、単体テストでログをキャプチャしてアサーションに使用できます。実際にファイルやコンソールに書き込む必要はありません。

## 基本的な使い方

```go
package myapp_test

import (
    "testing"

    "github.com/cybergodev/dd"
)

func TestUserService_Create(t *testing.T) {
    // テスト用ログレコーダーを作成
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    service := NewUserService(logger)

    err := service.Create("alice")
    if err != nil {
        t.Fatalf("Create failed: %v", err)
    }

    // ログ内容をアサート
    if !rec.ContainsMessage("ユーザー作成") {
        t.Error("Expected log message 'ユーザー作成'")
    }

    if rec.GetFieldValue("name") != "alice" {
        t.Error("Expected field name=alice")
    }
}
```

## LoggerRecorder メソッド

### メッセージ確認

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.Info("操作成功")
logger.Error("操作失敗")

// 特定のメッセージが含まれるか確認
rec.ContainsMessage("操作成功")  // true
rec.ContainsMessage("操作失敗")  // true

// 全ログエントリを取得
entries := rec.Entries()
for _, entry := range entries {
    fmt.Printf("[%s] %s\n", entry.Level, entry.Message)
}
```

### レベルフィルタリング

```go
// 特定レベルのログのみ確認
infoEntries := rec.EntriesAtLevel(dd.LevelInfo)
errorEntries := rec.EntriesAtLevel(dd.LevelError)

if len(errorEntries) > 0 {
    t.Error("Unexpected error logs")
}

// DevelopmentConfig で全レベルをキャプチャ
rec2 := dd.NewLoggerRecorder()
logger2, _ := rec2.NewLogger(dd.DevelopmentConfig())
logger2.Debug("デバッグ情報")
debugs := rec2.EntriesAtLevel(dd.LevelDebug)
```

### フィールド確認

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.InfoWith("リクエスト完了",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 50*time.Millisecond),
)

// フィールド値を確認
if rec.GetFieldValue("method") != "GET" {
    t.Error("Expected method=GET")
}

// 注意：テキストフォーマットではフィールド値は string 型
if rec.GetFieldValue("status") != "200" {
    t.Error("Expected status=200")
}
```

## テストパターン

### サービス層のテスト

```go
func TestOrderService_PlaceOrder(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    svc := &OrderService{log: logger}

    // 正常パス
    order, err := svc.PlaceOrder(ctx, "user-1", []string{"item-1"})
    require.NoError(t, err)
    require.True(t, rec.ContainsMessage("注文作成"))
    require.True(t, rec.ContainsField("user_id"))
    require.Equal(t, "user-1", rec.GetFieldValue("user_id"))

    // エラーログがないことを確認
    errors := rec.EntriesAtLevel(dd.LevelError)
    require.Empty(t, errors)
}
```

### エラー処理のテスト

```go
func TestService_DatabaseError(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    svc := &Service{
        log: logger,
        db:  &failingDB{}, // データベースエラーをシミュレート
    }

    err := svc.Process(ctx)
    require.Error(t, err)

    // エラーが記録されたことを確認
    require.True(t, rec.ContainsMessage("処理失敗"))
    require.True(t, rec.ContainsField("error"))
    require.Contains(t, rec.GetFieldValue("error"), "database connection refused")

    // レベルが Error であることを確認
    errorEntries := rec.EntriesAtLevel(dd.LevelError)
    require.NotEmpty(t, errorEntries)
}
```

### 構造化ログのテスト

```go
func TestMiddleware_LogsRequestFields(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    handler := LoggingMiddleware(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(200)
    }))

    req := httptest.NewRequest("GET", "/api/users", nil)
    rr := httptest.NewRecorder()
    handler.ServeHTTP(rr, req)

    // 全ての期待されるフィールドを確認
    entries := rec.EntriesAtLevel(dd.LevelInfo)
    require.Len(t, entries, 1)

    entry := entries[0]
    require.Equal(t, "リクエスト完了", entry.Message)
    // フィールド値を確認（注意：テキストフォーマットではフィールド値は string 型）
    require.Equal(t, "GET", rec.GetFieldValue("method"))
    require.Equal(t, "/api/users", rec.GetFieldValue("path"))
    require.Equal(t, "200", rec.GetFieldValue("status"))
}
```

### テストの分離

```go
func TestSuite(t *testing.T) {
    t.Run("シナリオA", func(t *testing.T) {
        rec := dd.NewLoggerRecorder() // 各テストで独立した recorder
        logger, _ := rec.NewLogger()
        // テストロジック...
    })

    t.Run("シナリオB", func(t *testing.T) {
        rec := dd.NewLoggerRecorder() // 独立した recorder
        logger, _ := rec.NewLogger()
        // テストロジック...
    })
}
```

## テーブル駆動テスト

```go
func TestLogLevel_Behavior(t *testing.T) {
    tests := []struct {
        name     string
        level    dd.LogLevel
        logFunc  func(*dd.Logger)
        expected string
    }{
        {
            name:     "Debugレベル",
            level:    dd.LevelDebug,
            logFunc:  func(l *dd.Logger) { l.Debug("デバッグ情報") },
            expected: "デバッグ情報",
        },
        {
            name:     "Infoレベル",
            level:    dd.LevelInfo,
            logFunc:  func(l *dd.Logger) { l.Info("一般情報") },
            expected: "一般情報",
        },
        {
            name:     "Errorレベル",
            level:    dd.LevelError,
            logFunc:  func(l *dd.Logger) { l.Error("エラー情報") },
            expected: "エラー情報",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            rec := dd.NewLoggerRecorder()
            cfg := dd.DefaultConfig()
            cfg.Level = tt.level
            logger, _ := rec.NewLogger(cfg)

            tt.logFunc(logger)

            if !rec.ContainsMessage(tt.expected) {
                t.Errorf("Expected message %q", tt.expected)
            }
        })
    }
}
```

## 次のステップ

- [Web サービス統合](./web-service) -- HTTP サービスログ統合
- [API リファレンス - Recorder](../api-reference/recorder) -- LoggerRecorder 完全 API
- [フックシステム](../guides/hooks) -- ライフサイクルフック
