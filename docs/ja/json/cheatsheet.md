---
title: "チートシート - CyberGo JSON | API クイックリファレンス"
description: "CyberGo JSON API チートシート：GetString/GetInt クエリ、Set/Delete 変更、Marshal/Unmarshal シリアライズ、設定、イテレータ、セキュリティ関数を素早く参照できる Go 開発向けリファレンスです。"
---

# チートシート

よく使う API とコードスニペットを素早く検索できます。

## パスクエリ

| 操作 | 関数 | 例 |
|------|------|------|
| 文字列を取得 | `GetString` | `json.GetString(data, "user.name")` |
| 整数を取得 | `GetInt` | `json.GetInt(data, "count")` |
| 浮動小数点数を取得 | `GetFloat` | `json.GetFloat(data, "price")` |
| ブーリアンを取得 | `GetBool` | `json.GetBool(data, "enabled")` |
| 配列を取得 | `GetArray` | `json.GetArray(data, "items")` |
| オブジェクトを取得 | `GetObject` | `json.GetObject(data, "user")` |
| 任意の値を取得 | `Get` | `json.Get(data, "items[0].id")` |
| ジェネリック取得 | `GetTyped[T]` | `json.GetTyped[User](data, "user")` |

### デフォルト値付き

`GetString`、`GetInt`、`GetFloat`、`GetBool` などの関数はオプションのデフォルト値パラメータをサポートしています：

| 操作 | 関数 | 例 |
|------|------|------|
| 文字列 | `GetString` | `json.GetString(data, "name", "unknown")` |
| 整数 | `GetInt` | `json.GetInt(data, "count", 0)` |
| 浮動小数点数 | `GetFloat` | `json.GetFloat(data, "rate", 0.5)` |
| ブーリアン | `GetBool` | `json.GetBool(data, "debug", false)` |

## 変更操作

| 操作 | 関数 | 例 |
|------|------|------|
| 値を設定 | `Set` | `json.Set(data, "user.name", "Alice")` |
| 一括設定 | `SetMultiple` | `json.SetMultiple(data, map[string]any{"a": 1, "b": 2})` |
| パスを作成して設定 | `SetCreate` | `json.SetCreate(data, "a.b.c", 1)` |
| 一括パス作成設定 | `SetMultipleCreate` | `json.SetMultipleCreate(data, updates)` |
| 値を削除 | `Delete` | `json.Delete(data, "user.temporary")` |
| 削除してクリーンアップ | `DeleteClean` | `json.DeleteClean(data, "user.temporary")` |

```go
// 値を設定
result, err := json.Set(`{"user":{}}`, "user.name", "Alice")
// {"user":{"name":"Alice"}}

// 複数のフィールドを順番に設定
result, err = json.Set(data, "user.name", "Bob")
result, err = json.Set(result, "user.age", 25)

// 削除
result, err = json.Delete(data, "user.temporary")
```

## シリアライズ

| 操作 | 関数 | 例 |
|------|------|------|
| エンコード | `Marshal` | `json.Marshal(data)` |
| フォーマット付きエンコード | `MarshalIndent` | `json.MarshalIndent(data, "", "  ")` |
| デコード | `Unmarshal` | `json.Unmarshal(bytes, &v)` |
| パース | `Parse` | `var v T; json.Parse(jsonStr, &v)` |
| any にパース | `ParseAny` | `json.ParseAny(jsonStr)` |
| フォーマット | `Prettify` | `json.Prettify(jsonStr)` |
| 圧縮 | `Compact` | `json.Compact(&buf, []byte(data))` |

```go
// エンコード
b, err := json.Marshal(map[string]any{"name": "test"})

// フォーマット出力
pretty, err := json.MarshalIndent(data, "", "  ")

// 構造体にパース
var result map[string]any
err = json.Parse(`{"name": "test"}`, &result)

// any にパース
parsed, err := json.ParseAny(`{"name": "test"}`)

// JSON 文字列をフォーマット
pretty, err = json.Prettify(`{"name":"Alice","age":30}`)
```

## バリデーション

| 操作 | 関数 | 例 |
|------|------|------|
| クイックバリデーション | `Valid` | `json.Valid([]byte(data))` |

```go
// クイックバリデーション
if json.Valid([]byte(data)) {
    // 有効な JSON
}

// Schema バリデーション
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name"},
    Properties: map[string]*json.Schema{
        "name": {Type: "string"},
        "age":  {Type: "number"},
    },
}
p, err := json.New()
if err != nil {
    panic(err)
}
errors, _ := p.ValidateSchema(data, schema)
```

## ユーティリティ関数

| 操作 | 関数 | 例 |
|------|------|------|
| 比較 | `CompareJSON` | `json.CompareJSON(a, b)` |
| マージ | `MergeJSON` | `json.MergeJSON(a, b)` |
| 複数マージ | `MergeMany` | `json.MergeMany([]string{s1, s2, s3})` |

```go
// 比較（キーの順序と数値精度を無視）
equal, _ := json.CompareJSON(`{"a":1.0,"b":2}`, `{"b":2,"a":1}`)
fmt.Println("Equal:", equal) // true（順序と精度を無視）

// JSON のマージ
base := `{"database":{"host":"localhost","port":5432},"debug":false}`
override := `{"database":{"host":"prod-server","ssl":true},"monitoring":true}`

// マージ
merged, _ := json.MergeJSON(base, override)
// 結果: {"database":{"host":"prod-server","port":5432,"ssl":true},"debug":false,"monitoring":true}

// 複数マージ
result, _ := json.MergeMany([]string{
    `{"a":1}`,
    `{"b":2}`,
    `{"c":3}`,
})
```

## Processor メソッド

```go
// プロセッサを作成
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// 値の取得
result := processor.GetString(data, "user.profile.name")

// セーフティ取得（AccessResult を返す）
accessResult := processor.SafeGet(data, "user.age")
age, err := accessResult.AsInt()
```

### 設定付きで作成

```go
// デフォルト設定
processor, err := json.New(json.DefaultConfig())

// セキュリティ設定（信頼できない入力を処理）
processor, err = json.New(json.SecurityConfig())

// カスタム設定
cfg := json.DefaultConfig()
cfg.CreatePaths = true
processor, err = json.New(cfg)
```

## ストリーム処理

### Processor.ForeachFile（大規模ファイル）

```go
// 大規模ファイルを処理
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

err = processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    // データ項目を処理
    id := item.GetInt("id")
    name := item.GetString("name")
    return nil // item.Break() を返すと中断
})
```

### NDJSON/JSONL

```go
// JSONL をパース
results, err := json.ParseJSONL(jsonlBytes)

// ジェネリックパース（StreamLinesInto を使用）
file, _ := os.Open("data.jsonl")
defer file.Close()
users, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    return nil
})

// ストリーム書き込み
outputFile, _ := os.Create("output.jsonl")
defer outputFile.Close()
writer := json.NewJSONLWriter(outputFile)
_ = writer.Write(map[string]any{"name": "Alice"})
_ = writer.Write(map[string]any{"name": "Bob"})
```

## 設定オプション

```go
// 推奨方法：デフォルト設定をベースに変更
cfg := json.DefaultConfig()
cfg.MaxJSONSize = 200 * 1024 * 1024 // カスタムサイズ制限
cfg.FullSecurityScan = true          // 完全セキュリティスキャンを有効化
```

### 設定プリセット

```go
// デフォルト設定
cfg := json.DefaultConfig()

// セキュリティ設定（信頼できない入力を処理）
// cfg = json.SecurityConfig()

// フォーマット設定
// cfg = json.PrettyConfig()
```

## パス構文

| 構文 | 説明 | 例 |
|------|------|------|
| `.property` | プロパティアクセス | `user.name` |
| `[n]` | 配列インデックス | `items[0]` |
| `[*]` | ワイルドカード | `items[*].id` |
| `[start:end]` | スライス | `items[0:5]` |
| `[start:end:step]` | ステップ付きスライス | `items[0:10:2]` |
| `{field1,field2}` | フィールド抽出 | `user{name,email}` |
| `[+]` | 追加 | `items[+]` |
| `[-1]` | 負のインデックス（末尾） | `items[-1]` |

## よくあるパターン

### ネストされた値のセーフティ取得

```go
// デフォルト値付きの取得関数を使用
name := json.GetString(data, "user.profile.name", "unknown")

// エラータイプを区別する必要がある場合は Get を使用
val, err := json.Get(data, "user.profile.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // パスが存在しない
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // タイプの不一致
    }
}
```

### デフォルト値付きで取得

```go
// GetString/GetInt などの関数はオプションのデフォルト値パラメータをサポート
timeout := json.GetInt(data, "timeout", 30)
debug := json.GetBool(data, "debug", false)
name := json.GetString(data, "user.nickname", "unknown")
```

### 型アサーション

```go
val, _ := json.Get(data, "value")
switch v := val.(type) {
case string:
    fmt.Println("文字列:", v)
case float64:
    fmt.Println("数値:", v)
case bool:
    fmt.Println("ブーリアン:", v)
case []any:
    fmt.Println("配列:", len(v), "個の要素")
case map[string]any:
    fmt.Println("オブジェクト:", len(v), "個のキー")
}
```

### 設定のマージ

```go
// デフォルト設定 + ユーザー設定
defaults := `{"timeout": 30, "retries": 3}`
userConfig := `{"timeout": 60, "debug": true}`

merged, _ := json.MergeJSON(defaults, userConfig)
// {"timeout": 60, "retries": 3, "debug": true}
```

### エラー処理

```go
val, err := json.Get(data, path)
if err != nil {
    // エラータイプを確認
    if errors.Is(err, json.ErrPathNotFound) {
        // パスが存在しない
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // JSON フォーマットエラー
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // タイプの不一致
    }
}
```

## キャッシュ管理

```go
// キャッシュのウォームアップ
paths := []string{"user.name", "user.email", "items[*].id"}
result, _ := json.WarmupCache(data, paths)
fmt.Printf("ウォームアップ成功: %d/%d\n", result.Successful, result.TotalPaths)

// キャッシュをクリア
json.ClearCache()

// 統計を取得
stats := json.GetStats()
fmt.Printf("キャッシュヒット率: %.2f%%\n", stats.HitRatio * 100)
```

## グローバルプロセッサ

```go
// カスタムグローバルプロセッサを設定
cfg := json.SecurityConfig()
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
json.SetGlobalProcessor(p)

// 以降、すべてのパッケージレベル関数がこのプロセッサを使用
name := json.GetString(data, "user.name")

// アプリケーション終了時にクリーンアップ
defer json.ShutdownGlobalProcessor()
```

## 関連

- [パッケージ関数](./api-reference/functions) - 完全な API リファレンス
- [ヘルパー関数](./api-reference/helpers) - 型変換ツール
- [Processor](./api-reference/processor/) - プロセッサメソッド
- [設定](./api-reference/config) - 設定オプション
- [型定義](./api-reference/types) - AccessResult、Schema など
