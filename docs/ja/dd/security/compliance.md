---
title: "業界コンプライアンス設定 - CyberGo DD | HIPAA PCI-DSS 政府基準"
description: "CyberGo DD 業界コンプライアンスログ設定ガイド。HIPAA 医療業界コンプライアンス、PCI-DSS 金融決済コンプライアンス、政府セキュリティ基準の機密データフィルタリングルール設定、監査ログ要件、ログ保持とローテーション戦略、完全なコンプライアンス設定例を詳細に説明し、厳格なコンプライアンス要件の下で安全で信頼性の高いログシステムを構築できます。"
---

# 業界コンプライアンス設定

DD は 3 種類の業界コンプライアンスプリセット設定を提供し、医療、金融、政府分野の機密データ保護要件をカバーします。

## HIPAA 医療コンプライアンス

### 適用シナリオ

- 電子健康記録（EHR）システム
- 病院情報管理システム
- 遠隔医療プラットフォーム
- 医療データ研究プラットフォーム

### フィルタリングルール

`HealthcareConfig()` はデフォルトのセキュリティルールに加え、以下を追加フィルタリング：

| データタイプ | パターン | 例 |
|----------|------|------|
| ICD-10 コード | ログメッセージ内の診断コードフォーマット | `diagnosis=J18.9` |
| 病历番号 (MRN) | ログメッセージ内の医療記録番号 | `mrn=MRN-123456` |
| 健康保険請求番号 (HICN) | ログメッセージ内の HICN 番号 | `hicn=123456789A` |
| 患者識別番号 | ログメッセージ内の患者識別子 | `patient_id=PAT-123456` |

### 設定例

```go
func NewHIPAACompliantLogger() (*dd.Logger, error) {
    return dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.HealthcareConfig(),
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/hipaa-audit.json"),
        },
    })
}
```

### 監査要件

```go
// HIPAA 要件：セキュリティイベント監査 + 整合性保護
integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(integrityCfg)

auditFile, _ := os.OpenFile("logs/hipaa-audit.json", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    IncludeTimestamp: true,
    BufferSize:       2000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer,
})
```

## PCI-DSS 金融コンプライアンス

### 適用シナリオ

- オンライン決済システム
- クレジットカード処理サービス
- 銀行コアシステム
- EC 取引プラットフォーム

### フィルタリングルール

`FinancialConfig()` はデフォルトのセキュリティルールに加え、以下を追加フィルタリング：

| データタイプ | パターン | 例 |
|----------|------|------|
| SWIFT コード | ログメッセージ内の国際銀行コード | `swift=BOFAUS3N` |
| IBAN 口座番号 | ログメッセージ内の国際銀行口座番号 | `iban=DE89370400440532013000` |
| CVV/CVC | ログメッセージ内のカード検証番号 | `cvv=123` |
| 銀行ルーティング番号 | ログメッセージ内の ABA ルーティング番号 | `routing_number=021000021` |
| 銀行口座番号 | ログメッセージ内の銀行口座番号 | `account_number=12345678` |

### 設定例

```go
func NewPCICompliantLogger() (*dd.Logger, error) {
    return dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.FinancialConfig(),
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/pci-audit.json"),
        },
    })
}
```

### ログ保持ポリシー

```go
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxSizeMB = 100    // 単一ファイル 100MB
fwCfg.MaxAge = 365 * 24 * time.Hour // 1 年間保持（PCI-DSS 要件）
fwCfg.MaxBackups = 50    // 十分なバックアップを保持
fwCfg.Compress = true    // 古いファイルを圧縮してスペース節約

fw, _ := dd.NewFileWriter("logs/pci-audit.json", fwCfg)
logger, _ := dd.New(dd.Config{
    Level:    dd.LevelInfo,
    Format:   dd.FormatJSON,
    Security: dd.FinancialConfig(),
    Targets:  []dd.OutputTarget{dd.CustomOutput(fw)},
})
```

## 政府基準

### 適用シナリオ

- 政務情報システム
- 公共サービスプラットフォーム
- 社会保障管理システム
- 税務処理システム

### フィルタリングルール

`GovernmentConfig()` はデフォルトのセキュリティルールに加え、以下を追加フィルタリング：

| データタイプ | パターン | 例 |
|----------|------|------|
| パスポート番号 | ログメッセージ内のパスポート番号 | `passport_number=E12345678` |
| 運転免許番号 | ログメッセージ内の運転免許番号 | `dl_number=D123456789` |
| 米国連邦税番号 (EIN) | ログメッセージ内の EIN フォーマット | `12-3456789` |
| 英国国民保険番号 | ログメッセージ内の NINo フォーマット | `AB123456C` |
| カナダ社会保険番号 | ログメッセージ内の SIN フォーマット | `123 456 789` |
| 案件番号 | ログメッセージ内の案件番号 | `case_number=CR-2024-00123` |

### 設定例

```go
func NewGovernmentLogger() (*dd.Logger, error) {
    return dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.GovernmentConfig(),
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/gov-audit.json"),
        },
    })
}
```

## コンプライアンス比較

| 次元 | HIPAA | PCI-DSS | Government |
|------|-------|---------|------------|
| 追加フィルタリングパターン数 | +4 | +5 | +6 |
| ログ保持 | 6 年 | 1 年 | 規定による |
| 整合性署名 | 推奨 | 必須 | 必須 |
| 監査ログ | 必須 | 必須 | 必須 |
| 暗号化転送 | 必須 | 必須 | 推奨 |

## カスタムコンプライアンス設定

プリセット設定が要件を完全に満たさない場合、カスタム組み合わせが可能：

```go
// カスタムパターンを追加
filter, _ := dd.NewCustomSensitiveDataFilter(
    // 医療システム固有のカスタムパターン
    `(?i)insurance_id\s*[:=]\s*\S+`,
    `(?i)prescription\s*[:=]\s*\S+`,
)

logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Security: &dd.SecurityConfig{
        SensitiveFilter: filter,
    },
    Targets: []dd.OutputTarget{dd.FileOutput("logs/custom.json")},
})
```

## 次のステップ

- [機密データフィルタリング](../guides/sensitive-filtering) -- フィルタリング機能詳解
- [監査ログ](../guides/audit-logging) -- セキュリティ監査統合
- [本番チェックリスト](./production-checklist) -- リリース前チェック
- [API リファレンス - Security](../api-reference/security) -- セキュリティ API ドキュメント
