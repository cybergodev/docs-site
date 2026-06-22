---
title: "CustomEncoder - CyberGo JSON | カスタムエンコーダ"
description: "CyberGo JSON カスタムエンコーダガイド：CustomEncoder と TypeEncoder の定義、設定、実装例でカスタム Go 型に専用の JSON シリアライズを登録できます。"
---

# CustomEncoder

json ライブラリは 2 種類のカスタムエンコーダインターフェースを提供し、カスタム型に専用のシリアライズロジックを登録できます。

## CustomEncoder インターフェース

グローバルカスタムエンコーダインターフェース。デフォルトのエンコード動作を置き換えます。

```go
type CustomEncoder interface {
    Encode(value any) (string, error)
}
```

**設定方法**：`Config.CustomEncoder` フィールドで設定します。

```go
import stdjson "encoding/json"

type UpperCaseEncoder struct{}

func (e *UpperCaseEncoder) Encode(value any) (string, error) {
    switch v := value.(type) {
    case string:
        return fmt.Sprintf(`"%s"`, strings.ToUpper(v)), nil
    default:
        data, err := stdjson.Marshal(v)
        return string(data), err
    }
}

cfg := json.DefaultConfig()
cfg.CustomEncoder = &UpperCaseEncoder{}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## TypeEncoder インターフェース

特定型用のエンコーダインターフェース。型のエンコードに使用します。

```go
type TypeEncoder interface {
    Encode(v reflect.Value) (string, error)
}
```

**設定方法**：`Config` の `CustomTypeEncoders` フィールドで登録します。

```go
type TimeTypeEncoder struct{}

func (e *TimeTypeEncoder) Encode(v reflect.Value) (string, error) {
    if v.Type() == reflect.TypeOf(time.Time{}) {
        t := v.Interface().(time.Time)
        return fmt.Sprintf(`"%s"`, t.Format(time.RFC3339)), nil
    }
    return "", fmt.Errorf("サポートされていない型: %v", v.Type())
}

// 型エンコーダを登録
cfg := json.DefaultConfig()
cfg.CustomTypeEncoders = map[reflect.Type]json.TypeEncoder{
    reflect.TypeOf(time.Time{}): &TimeTypeEncoder{},
}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## カスタムエンコーダの例

### 完全な CustomEncoder 実装

```go
import stdjson "encoding/json"

type CompactEncoder struct{}

func (e *CompactEncoder) Encode(value any) (string, error) {
    // コンパクトエンコード、標準ライブラリを使用して無限再帰を回避
    data, err := stdjson.Marshal(value)
    if err != nil {
        return "", err
    }
    return string(data), nil
}

cfg := json.DefaultConfig()
cfg.CustomEncoder = &CompactEncoder{}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### TypeEncoder による型マッピング

```go
type CustomTypeEncoder struct{}

func (e *CustomTypeEncoder) Encode(v reflect.Value) (string, error) {
    switch v.Kind() {
    case reflect.Struct:
        return "struct:" + v.Type().Name(), nil
    case reflect.Slice:
        return "slice", nil
    default:
        return v.Kind().String(), nil
    }
}
```

## CustomEncoder と TypeEncoder の比較

| 特徴 | CustomEncoder | TypeEncoder |
|------|---------------|-------------|
| スコープ | グローバル、デフォルトエンコードを置き換え | 型固有のエンコード |
| 設定フィールド | `Config.CustomEncoder` | `Config.CustomTypeEncoders` |
| 関数シグネチャ | `Encode(any) (string, error)` | `Encode(reflect.Value) (string, error)` |
| 戻り値 | `string`（JSON 文字列） | `string`（JSON 文字列） |
| 適用シナリオ | 統一的なエンコード動作 | カスタム型のシリアライズマッピング |

## Config のエンコード関連フィールド

| フィールド | 型 | 説明 |
|------|------|------|
| `CustomEncoder` | `CustomEncoder` | カスタムエンコーダインターフェース |
| `CustomTypeEncoders` | `map[reflect.Type]TypeEncoder` | 型ごとに登録されたエンコーダ |

## 関連

- [インターフェース定義](./interfaces) - CustomEncoder と TypeEncoder インターフェース
- [設定オプション](./config) - Config エンコード関連フィールド
