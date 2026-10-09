---
sidebar_label: "Field 検証"
title: "Field 検証 - CyberGo DD | キー命名規則とセキュリティチェック"
description: "CyberGo DD Field 検証ガイド：snake_case、camelCase、PascalCase、kebab-case 命名規則チェック、3つの検証モード（オフ/警告/厳格）、組み込みの Log4Shell インジェクション保護とホモグラフ検出。"
sidebar_position: 3
---

# Field 検証

DD の Field 検証サブシステムは、ログ書き込み前に構造化 Field の**キー名**を検証し、命名規則を強制するとともにセキュリティ保護を提供します。これにより、キーの不整合によるログ解析の困難さを防ぎ、Field キーを経由した悪意あるコンテンツの混入を阻止します。

## 検証モード

| モード | 定数 | 動作 |
|------|----------|----------|
| オフ（デフォルト） | `FieldValidationNone` | 検証なし。すべてのキーを許可 |
| 警告 | `FieldValidationWarn` | 規則に準拠しないキーは stderr に警告を出力。ログは書き込まれます |
| 厳格 | `FieldValidationStrict` | 規則に準拠しないキーは stderr にエラーを出力。ログは書き込まれます |

:::warning 警告 ログメソッドはエラーを返しません
ログメソッド（`InfoWith` など）はエラーを返さないため、検証失敗は stderr 経由でのみ報告されます。厳格モードは**ログの書き込みを妨げません**が、stderr にエラーを明確に報告します。
:::

## 命名規則

| 規則 | 定数 | 例 |
|------------|----------|----------|
| 任意（デフォルト） | `NamingConventionAny` | スタイルチェックなし |
| snake_case | `NamingConventionSnakeCase` | `user_id`, `created_at` |
| camelCase | `NamingConventionCamelCase` | `userId`, `createdAt` |
| PascalCase | `NamingConventionPascalCase` | `UserId`, `CreatedAt` |
| kebab-case | `NamingConventionKebabCase` | `user-id`, `created-at` |

## クイックスタート

### オプション A：プリセット設定

```go
package main

import (
    "log"

    "github.com/cybergodev/dd"
)

func main() {
    cfg := dd.DefaultConfig()
    cfg.FieldValidation = dd.StrictSnakeCaseConfig()
    // 以下と同等です：
    // &dd.FieldValidationConfig{
    //     Mode:                     dd.FieldValidationStrict,
    //     Convention:               dd.NamingConventionSnakeCase,
    //     AllowCommonAbbreviations: true,
    //     EnableSecurityValidation: true,
    // }

    logger, err := dd.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    logger.InfoWith("user action",
        dd.String("user_id", "123"),    // ✅ 有効な snake_case
        dd.String("userName", "alice"), // ⚠️ 無効、stderr にエラー出力
    )
}
```

### オプション B：カスタム設定

```go
cfg := dd.DefaultConfig()
cfg.FieldValidation = &dd.FieldValidationConfig{
    Mode:                     dd.FieldValidationWarn,
    Convention:               dd.NamingConventionCamelCase,
    AllowCommonAbbreviations: true,
    EnableSecurityValidation: true,
}
```

### オプション C：ランタイム切り替え

```go
// 厳格な snake_case を有効化
logger.SetFieldValidation(dd.StrictSnakeCaseConfig())

// 検証を無効化
logger.SetFieldValidation(nil)

// 現在の設定を照会
fv := logger.GetFieldValidation()
```

## 一般的な略語の除外

`AllowCommonAbbreviations: true`（プリセットのデフォルト）を設定すると、命名規則に厳密に一致しなくても、以下の略語が許可されます：

| 略語 | 説明 |
|--------------|-------------|
| `id`, `url`, `uri`, `ip` | 基本識別子 |
| `http`, `https`, `api` | プロトコル & インターフェース |
| `json`, `xml`, `html`, `sql` | データフォーマット |
| `tcp`, `udp`, `ssl`, `tls` | ネットワークプロトコル |
| `jwt`, `oauth` | 認証 |
| `*_id`, `*_url`, `*_api` など | 接尾辞の組み合わせ（例：`user_id`） |

## セキュリティ検証

`EnableSecurityValidation: true`（プリセットのデフォルト）を設定すると、命名規則の検証前に以下のセキュリティチェックが実行されます：

| チェック | 除去対象 | 説明 |
|-------|---------------------|-------------|
| Log4Shell 検出 | `${jndi:ldap://...}` | ログキーを経由した JNDI インジェクションを防止 |
| ホモグラフ検出 | ラテン文字 `a` の代わりにキリル文字 `а` | 視覚的偽装攻撃を防止 |
| 過長 UTF-8 エンコーディング | 最短形式以外のエンコーディング | セキュリティフィルターのバイパスを防止 |

:::danger 危険 ゼロ値の落とし穴
`&dd.FieldValidationConfig{Mode: dd.FieldValidationStrict}` を `EnableSecurityValidation` の設定なしで使用すると、ゼロ値の `false` のままになり、セキュリティチェックが**黙ってスキップ**されます。常に `DefaultFieldValidationConfig()` またはプリセット関数（`StrictSnakeCaseConfig()` など）を使用してください。これらはこのフィールドを `true` に設定します。
:::

## 複数規則のプロジェクト

プロジェクトで Go バックエンド（snake_case）と JavaScript フロントエンド（camelCase）の両方のログがある場合、異なる規則を持つ異なる Logger を使用してください：

```go
// バックエンド Logger：snake_case
backendCfg := dd.DefaultConfig()
backendCfg.FieldValidation = dd.StrictSnakeCaseConfig()
backendLogger, _ := dd.New(backendCfg)

// フロントエンドログ集約 Logger：camelCase
frontendCfg := dd.DefaultConfig()
frontendCfg.FieldValidation = dd.StrictCamelCaseConfig()
frontendLogger, _ := dd.New(frontendCfg)
```

## 検証ルール

各命名規則の具体的なルール：

| 規則 | ルール |
|------------|-------|
| snake_case | 小文字 + 数字 + アンダースコア。**先頭は小文字の英字である必要があります**（数字や `_` は不可）。末尾に `_` なし。連続する `__` なし |
| camelCase | 文字 + 数字。最初の文字は小文字 |
| PascalCase | 文字 + 数字。最初の文字は大文字 |
| kebab-case | 小文字 + 数字 + ハイフン。**先頭は小文字の英字である必要があります**（数字や `-` は不可）。末尾に `-` なし。連続する `--` なし |

## 次のステップ

- [構造化ログ](../basics/structured-logging) -- Field コンストラクターとチェーン
- [設定](../basics/configuration) -- 完全な Config Field リファレンス
- [セキュリティ概要](../security/) -- セキュリティ機能の完全な概要
