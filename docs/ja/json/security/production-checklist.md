---
title: "プロダクションチェックリスト - CyberGo JSON | セキュアデプロイ"
description: "CyberGo JSON プロダクション環境のセキュアデプロイチェックリスト：セキュリティ設定、MaxNestingDepthSecurity/MaxMemory リソース制限、入力バリデーション、エラー処理、監視・アラート設定、パフォーマンスとセキュリティのバランスに関するベストプラクティスを網羅し、Go アプリケーションのプロダクションレベルでの JSON 処理の安全性と信頼性を確保します。"
---

# プロダクションチェックリスト

プロダクション環境にデプロイする前に、以下のセキュリティ項目を確認してください。

## 設定の確認

### リソース制限

- [ ] 深すぎるネスト攻撃を防ぐために `MaxNestingDepthSecurity` を設定
- [ ] 単一値のサイズを制限するために `MaxJSONSize` を設定
- [ ] 総メモリ使用量を制限するために `MaxMemory` を設定

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50
cfg.MaxJSONSize = 10 * 1024 * 1024
cfg.MaxMemory = 100 * 1024 * 1024
```

## 入力バリデーション

### 必須フィールド

- [ ] すべての必須フィールドが存在することを確認
- [ ] フィールドの型が正しいことを確認

```go
// カスタムバリデーターの例
type RequiredFieldValidator struct{}

func (v *RequiredFieldValidator) Validate(jsonStr string) error {
    // 必須フィールドの存在確認
    return nil
}

cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&RequiredFieldValidator{}}
```

### フォーマットバリデーション

- [ ] メールアドレスのフォーマットを確認
- [ ] URL のフォーマットを確認
- [ ] カスタムフォーマットを確認

```go
// カスタムフォーマットバリデーター
type EmailValidator struct{}

func (v *EmailValidator) Validate(jsonStr string) error {
    var data map[string]any
    if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
        return nil
    }
    email, _ := data["email"].(string)
    matched, _ := regexp.MatchString(`^\w+@\w+\.\w+$`, email)
    if !matched {
        return errors.New("invalid email format")
    }
    return nil
}

cfg := json.DefaultConfig()
cfg.CustomValidators = append(cfg.CustomValidators, &EmailValidator{})
```

### 範囲バリデーション

- [ ] 数値の範囲を確認
- [ ] 文字列の長さを確認
- [ ] 配列の長さを確認

```go
// スキーマを使用した範囲バリデーション
schema := &json.Schema{
    Type: "object",
    Properties: map[string]*json.Schema{
        "age":  {Type: "number", Minimum: 0, Maximum: 100},
        "name": {Type: "string", MinLength: 1, MaxLength: 255},
    },
}
```

## 機密データの処理

### 機密フィールドのフィルタリング

- [ ] パスワードフィールドをフィルタリング
- [ ] トークンフィールドをフィルタリング
- [ ] その他の機密データをフィルタリング

```go
// フックを使用して機密フィールドをフィルタリング
type SensitiveFilterHook struct {
    fields map[string]bool
}

func (h *SensitiveFilterHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *SensitiveFilterHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if m, ok := result.(map[string]any); ok {
        for field := range h.fields {
            delete(m, field)
        }
    }
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&SensitiveFilterHook{fields: map[string]bool{
    "password": true,
    "token":    true,
    "api_key":  true,
    "secret":   true,
}})
```

### ログのマスキング

- [ ] ログに機密データを記録しない
- [ ] エラーメッセージに機密情報を含めない

## エラー処理

### セキュアなエラーレスポンス

- [ ] 内部エラーの詳細を露出しない
- [ ] 汎用的なエラーメッセージを使用
- [ ] 詳細なエラーはログに記録

```go
if err != nil {
    log.Error("詳細エラー", "error", err)
    return errors.New("操作に失敗しました。後でもう一度お試しください")
}
```

## 監視と監査

### パフォーマンス監視

- [ ] パース時間の監視
- [ ] メモリ使用量の監視
- [ ] アラート閾値の設定

```go
// フックを使用してパフォーマンスを監視
type MetricsHook struct{}

func (h *MetricsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *MetricsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    log.Info("operation", "op", ctx.Operation)
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&MetricsHook{})
```

### 監査ログ

- [ ] 重要な操作の記録
- [ ] 異常な入力の記録
- [ ] 定期的なログレビュー

## テストカバレッジ

### セキュリティテスト

- [ ] 深いネストのテスト
- [ ] 大ファイル処理のテスト
- [ ] 無効な入力のテスト
- [ ] 境界条件のテスト

### パフォーマンステスト

- [ ] 同時処理のテスト
- [ ] 大量データのテスト
- [ ] メモリリークのテスト

## クイックチェックコマンド

```bash
# 機密フィールドの確認
grep -r "password\|token\|secret" --include="*.go"

# ハードコードされた設定の確認
grep -r "MaxNestingDepthSecurity\|MaxMemory" --include="*.go"

# セキュリティテストの実行
go test -run Security ./...
```

## チェックリストテンプレート

```go
// プロダクション設定テンプレート
func ProductionConfig() json.Config {
    cfg := json.SecurityConfig()

    // リソース制限（SecurityConfig は安全なデフォルト値を事前設定済み）
    cfg.MaxMemory = 100 * 1024 * 1024

    // カスタムバリデーター
    cfg.CustomValidators = []json.Validator{&RequiredFieldValidator{}}

    // 監査フック
    cfg.Hooks = []json.Hook{&AuditHook{logger: prodLogger}}

    return cfg
}
```

## 関連

- [セキュリティ概要](./)
- [Config 設定](../api-reference/config)
