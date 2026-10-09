---
sidebar_label: "設定"
title: "設定 - CyberGo DD | Config 構造体とプリセット"
description: "CyberGo DD 設定ガイド：DefaultConfig、DevelopmentConfig、JSONConfig、ProductionConfig の 4 つのプリセット、完全な Config 構造体フィールドリファレンス、マルチ出力ターゲット設定、JSON フォーマットカスタマイズ、Clone ディープコピー使用方法。"
sidebar_position: 2
---

# 設定

DD は構造体ベースの設定（`Config`）を使用し、IDE の自動補完をサポートしています。ビルダーチェーンやオプション関数は不要です。このガイドでは、すべての設定フィールドと一般的な組み合わせについて説明します。

> **API リファレンス**: 完全なフィールドリストは [Config](../../api-reference/core/config) を参照してください。

## 4 つのプリセット

| プリセット | レベル | フォーマット | セキュリティフィルター | 典型的な用途 |
|--------|-------|--------|:---------------:|-------------|
| `DefaultConfig()` | Info | Text | ✅ 基本 | 本番環境のデフォルト |
| `DevelopmentConfig()` | Debug | Text（短い時刻） | ✅ 基本 | ローカル開発 |
| `JSONConfig()` | Debug | JSON（RFC3339） | ✅ 基本 | ログ集約システム |
| `ProductionConfig()` | Info | JSON（RFC3339） | ✅ 基本 | 本番環境（JSON 出力） |

:::warning 警告 セキュリティフィルターはデフォルトで有効
4 つのプリセットはすべて、基本となる機密データフィルタリング（パスワード、API キー、クレジットカードなど）を**有効**にします。開発モードでも、意図しない機密データの漏洩を早期に発見するため、フィルタリングは有効のままです。無効にするには、明示的に `Security: &dd.SecurityConfig{}` を設定するか、`SecurityLevelDevelopment` を使用してください。
:::

## Config フィールド概要

```go
type Config struct {
    // ─── 基本 ───
    Level         LogLevel     // ログレベル（LevelDebug ～ LevelFatal）
    Format        LogFormat    // 出力フォーマット（FormatText / FormatJSON）
    TimeFormat    string       // 時刻フォーマット（デフォルト ISO 8601）
    IncludeTime   bool         // タイムスタンプを含める
    IncludeLevel  bool         // ログレベルを含める

    // ─── 呼び出し元情報 ───
    DynamicCaller bool         // 呼び出し元の動的検出（file:line）
    FullPath      bool         // フルファイルパスを使用（デフォルト：ファイル名のみ）

    // ─── 出力ターゲット ───
    Targets       []OutputTarget // 出力先（ConsoleOutput/FileOutput/CustomOutput）

    // ─── フォーマットカスタマイズ ───
    JSON          *JSONOptions // JSON フォーマットオプション（フィールド名、インデントなど）

    // ─── セキュリティ ───
    Security      *SecurityConfig       // セキュリティ設定（フィルタリング、レート制限）
    FieldValidation *FieldValidationConfig // Field キー命名検証

    // ─── ライフサイクル ───
    FatalHandler      FatalHandler      // カスタム Fatal ハンドラー
    WriteErrorHandler WriteErrorHandler // 書き込みエラーコールバック
    LevelResolver     LevelResolver     // 動的レベル解決（エントリごとに参照、nil で無効）

    // ─── 拡張 ───
    ContextExtractors []ContextExtractor // コンテキスト Field エグストラクター
    Hooks             *HookRegistry      // ライフサイクル Hook
    Sampling          *SamplingConfig    // ログサンプリング

    // ─── 監査 ───
    Audit             *AuditConfig       // セキュリティ監査ログ
}
```

## 出力ターゲット設定

`ConsoleOutput()`、`FileOutput()`、`CustomOutput()` を使用して出力ターゲットを構築します：

```go
package main

import (
    "log"
    "os"
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    cfg := dd.DefaultConfig()
    cfg.Targets = []dd.OutputTarget{
        dd.ConsoleOutput(),                          // コンソール
        dd.FileOutput("logs/app.log"),               // ファイル（デフォルト 100MB/10バックアップ/30日）
        dd.CustomOutput(os.Stderr),                  // カスタム Writer
    }

    // カスタムファイルローテーションパラメータ
    fileTarget := dd.FileOutput("logs/app.log")
    fileTarget.MaxSizeMB = 50              // 50MB でローテーション
    fileTarget.MaxBackups = 5              // 5 個のバックアップを保持
    fileTarget.MaxAge = 7 * 24 * time.Hour // 7 日間保持（MaxAge は time.Duration、単位必須）

    logger, err := dd.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()
}
```

:::tip ヒント ゼロ値 Config の落とし穴
`dd.Config{Targets: ...}` を直接使用すると、タイムスタンプ、レベル、呼び出し元情報が欠落します。常に `dd.DefaultConfig()` から開始してフィールドを変更してください。
:::

## JSON フォーマットのカスタマイズ

```go
cfg := dd.JSONConfig()

// カスタム JSON フィールド名
cfg.JSON = &dd.JSONOptions{
    PrettyPrint: true,
    Indent:      "  ",
    FieldNames: &dd.JSONFieldNames{
        Timestamp: "@timestamp",
        Level:     "severity",
        Message:   "msg",
        Caller:    "source",
        Fields:    "ctx",
    },
}
```

## セキュリティ設定

```go
cfg := dd.DefaultConfig()

// オプション A：セキュリティレベルで指定（推奨）
cfg.Security = dd.SecurityConfigForLevel(dd.SecurityLevelStandard)

// オプション B：業界プリセット
cfg.Security = dd.HealthcareConfig()   // HIPAA
cfg.Security = dd.FinancialConfig()    // PCI-DSS
cfg.Security = dd.GovernmentConfig()   // 政府

// オプション C：カスタム
cfg.Security = &dd.SecurityConfig{
    MaxMessageSize: 1024 * 1024, // 1MB
    SensitiveFilter: dd.NewSensitiveDataFilter(),
}
```

[機密データフィルタリング](../security/sensitive-filtering) および [セキュリティ概要](../security/) を参照してください。

## Field 検証

```go
cfg := dd.DefaultConfig()
cfg.FieldValidation = dd.StrictSnakeCaseConfig()
// すべての Field キーが snake_case である必要があります。それ以外は stderr に診断が出力されます（フィールドは通常どおり記録され、ログメソッドはエラーを返しません）
```

[Field 検証](../security/field-validation) を参照してください。

## ログサンプリング

```go
cfg := dd.DefaultConfig()
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,            // 最初の100エントリは常にログ出力
    Thereafter: 10,             // その後、10回に1回ログ出力
    Tick:       time.Second,    // 毎秒カウンターをリセット
}
```

[ログサンプリング](../operations/sampling) を参照してください。

## Hook と監査

```go
// Hook
registry := dd.NewHooksFromConfig(dd.HooksConfig{
    AfterLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        // メトリクスシステムに送信
        return nil
    }},
})
cfg.Hooks = registry

// 監査
cfg.Audit = &dd.AuditConfig{
    Enabled:     true,
    Output:      auditFile,
    JSONFormat:  true,
    MinimumSeverity: dd.AuditSeverityWarning,
}
```

[Hook システム](../operations/hooks) および [監査ログ](../security/audit-logging) を参照してください。

## Clone: 設定のディープコピー

`Clone()` は設定のコピーを作成します。同じベースから異なる設定を派生させるのに便利です：

```go
base := dd.DefaultConfig()
base.Format = dd.FormatJSON

// 派生1：本番環境設定
prodCfg := base.Clone()
prodCfg.Level = dd.LevelInfo
prodCfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/prod.log")}

// 派生2：デバッグ設定
debugCfg := base.Clone()
debugCfg.Level = dd.LevelDebug
debugCfg.Targets = []dd.OutputTarget{dd.ConsoleOutput()}

// base は影響を受けません
```

:::tip ヒント Clone のコピー深度
ディープコピー：JSON、Security、Hooks、Sampling、Audit、Targets スライス。シャローコピー：FatalHandler、WriteErrorHandler、FieldValidation（関数/ポインタは共有）。ContextExtractors スライスはコピーされますが、エグストラクターインスタンスは共有されます。
:::

## 次のステップ

- [コアコンセプト](./core-concepts) -- Logger 階層と処理パイプライン
- [構造化ログ](./structured-logging) -- Field コンストラクターとチェーン
- [API リファレンス - Config](../../api-reference/core/config) -- 完全なフィールドドキュメント
