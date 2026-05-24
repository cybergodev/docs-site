---
title: "コア概念 - CyberGo DD | アーキテクチャと設計理念"
description: "CyberGo DD ログライブラリのコアアーキテクチャと設計理念を深く理解。Logger と LoggerEntry の関係とライフサイクル、構造化フィールド Field の型安全使用パターン、ログ処理パイプラインの完全処理フロー、4 層の段階的インターフェース設計、スレッドセーフな並行モデルを含み、DD ライブラリの体系的理解を構築します。"
---

# コア概念

DD のコア概念を理解することは、本ライブラリを効率的に使用するための基礎となります。本章では Logger 体系、フィールドシステム、処理パイプライン、インターフェース階層について説明します。

## Logger 体系

DD のログ記録は 3 つのコアタイプを中心に展開します：

```text
Logger（ロガー）
  │
  ├── 直接使用 → logger.Info("message")
  │
  └── WithFields() → LoggerEntry（プリセットフィールド付き Entry）
                        │
                        └── entry.Info("message")  // プリセットフィールドを自動付与
```

### Logger

`Logger` はコアとなるロガーで、`dd.New()` で作成します：

```go
logger, _ := dd.New(dd.DefaultConfig())
defer logger.Close()

logger.Info("サービス起動")
logger.InfoWith("リクエスト処理",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)
```

各 Logger は独立した設定、出力先、セキュリティフィルター、ライフサイクルを持ち、異なるモジュール間で安全に共有できます。

### LoggerEntry

`LoggerEntry` は `WithFields()` で作成される、不変のプリセットフィールドコンテナです：

```go
// プリセットフィールド付き Entry を作成
requestLog := logger.WithFields(
    dd.String("service", "user-api"),
    dd.String("version", "2.1.0"),
)

// 各呼び出しでプリセットフィールドが自動付与される
requestLog.Info("サービス起動")
// 出力: ... サービス起動 service=user-api version=2.1.0

requestLog.InfoWith("ユーザーログイン",
    dd.String("user", "alice"),
)
// 出力: ... ユーザーログイン service=user-api version=2.1.0 user=alice
```

:::tip 不変設計
`WithFields()` を呼び出すたびに新しい `LoggerEntry` が作成され、元の Entry は影響を受けません。つまり、異なる goroutine で安全に同じ Entry を再利用できます。
:::

### グローバルロガー

DD はグローバルロガーを提供し、シンプルなシナリオや迅速なプロトタイピングに適しています：

```go
// パッケージレベル関数を直接使用（グローバル Logger 経由）
dd.Info("グローバルログ")

// 以下と同等
dd.Default().Info("グローバルログ")
```

## フィールドシステム

### Field 型

`Field` は構造化ログの基本単位で、キーと値のペアで構成されます：

```go
// フィールドコンストラクタは全ての一般的な型をカバー
dd.String("method", "GET")           // 文字列
dd.Int("status", 200)                // 整数
dd.Float64("latency", 0.123)         // 浮動小数点
dd.Bool("success", true)             // 真偽値
dd.Duration("elapsed", 150*time.Millisecond) // 所要時間
dd.Time("timestamp", time.Now())     // タイムスタンプ
dd.Err(err)                          // エラー（key は "error"）
dd.ErrWithKey("db_error", err)       // エラー（カスタム key）
dd.Any("data", payload)              // 任意の型
```

### フィールドのチェーン渡し

フィールドは Logger、Entry の間で階層的に渡すことができます：

```go
// 第 1 層：サービスレベルフィールド
serviceLog := logger.WithFields(
    dd.String("service", "api-gateway"),
)

// 第 2 層：リクエストレベルフィールド（サービスレベルに追加）
requestLog := serviceLog.WithFields(
    dd.String("request_id", "req-001"),
    dd.String("path", "/api/users"),
)

// 第 3 層：実際のログ（さらにフィールドを追加）
requestLog.InfoWith("処理完了",
    dd.Int("status", 200),
    dd.Duration("elapsed", 50*time.Millisecond),
)
// 出力に含まれる: service=api-gateway request_id=req-001 path=/api/users status=200 elapsed=50ms
```

## ログ処理パイプライン

各ログは以下の処理フローを経ます：

```text
ユーザーが logger.InfoWith("msg", fields...) を呼び出し
       │
       ▼
  ① レベルチェック ─── レベルが無効 → 即座に返却（オーバーヘッドなし）
       │
       ▼
  ② セキュリティフィルタリング ─── メッセージとフィールドの機密データ → [REDACTED]
       │
       ▼
  ③ コンテキスト抽出 ── 登録済みエクストラクタから TraceID/SpanID 等を抽出
       │
       ▼
  ④ BeforeLog フック
       │
       ▼
  ⑤ フォーマット ──── テキストフォーマット または JSON フォーマット
       │
       ▼
  ⑥ セキュリティサイズ制限 ─── Security.MaxMessageSize を超えると切り詰め（0 は制限なし）
       │
       ▼
  ⑦ 書き込み ────── 1 つ以上の Writer に出力
       │
       ▼
  ⑧ AfterLog フック
       │
       ▼
  ⑨ Fatal 処理 ── LevelFatal のみ、os.Exit またはカスタム FatalHandler を呼び出し
```

:::info パフォーマンス設計
レベルチェック（ステップ ①）はアトミック操作を使用し、ロック不要でほぼゼロオーバーヘッドです。セキュリティフィルタリング（ステップ ②）は小さい入力を同期的に処理し、大きい入力は独立した goroutine でタイムアウト保護付きで処理するため、メインフローをブロックしません。
:::

## インターフェース階層

DD は 4 つのインターフェースを定義し、精密な依存性注入をサポートします：

```text
CoreLogger                    ← 基本ログ：Debug/Info/Warn/Error/Fatal + WithFields
    │
    ├── LevelLogger           ← レベル管理：GetLevel/SetLevel/IsLevelEnabled（CoreLogger を埋め込み）
    │
    └── ConfigurableLogger    ← 設定管理：Writer/セキュリティ/コンテキスト/フック（CoreLogger を埋め込み）

LogProvider                   ← 完全機能：全メソッドを含む独立したフラットインターフェース
```

```go
// 基本ログだけでいい？ CoreLogger を注入
type Service struct {
    log dd.CoreLogger
}

// レベルを動的に調整したい？ LevelLogger を注入
type Handler struct {
    log dd.LevelLogger
}
```

:::tip ベストプラクティス
コンストラクタで最小限必要なインターフェースを受け取るようにしてください。具体的な型ではなくインターフェースを受け取ることで、コードがテストしやすく、柔軟になります。
:::

## スレッドセーフモデル

DD のコア設計原則：**複数 goroutine で安全に使用可能、追加の同期は不要**。

| コンポーネント | 安全メカニズム |
|------|----------|
| Logger | すべてのメソッドが安全に並行呼び出し可能 |
| LoggerEntry | 不変、作成後は読み取り専用 |
| Config | Clone() メソッドで安全なコピー |
| Writers | アトミックポインタ、ロックフリー読み取り |
| SensitiveDataFilter | 読み書き分離、独立した goroutine |
| HookRegistry | ミューテックスで登録を保護、アトミック読み取りで実行 |

```go
// 安全：複数の goroutine が同じ Logger を共有
var logger *dd.Logger  // 一度だけ初期化

func handleRequest(w http.ResponseWriter, r *http.Request) {
    // 安全：並行呼び出し
    logger.InfoWith("リクエスト到着",
        dd.String("path", r.URL.Path),
        dd.String("method", r.Method),
    )
}
```

## 出力先体系

DD は 3 種類の出力先をサポートし、自由に組み合わせ可能：

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),                    // コンソール
        dd.FileOutput("logs/app.log"),         // ファイル（自動ローテーション）
        dd.CustomOutput(customWriter),         // カスタム io.Writer
    },
})
```

組み込み Writer コンポーネント：

| コンポーネント | 用途 |
|------|------|
| `FileWriter` | ファイル書き込み + サイズ/時間ローテーション + 圧縮 |
| `BufferedWriter` | バッファ書き込み、I/O 回数を削減 |
| `MultiWriter` | マルチ出力先ディスパッチ、複数の Writer に書き込み |

## 次のステップ

- [構造化ログ](./structured-logging) -- フィールドの使い方詳細
- [ファイル出力とローテーション](./file-output) -- ファイルログ設定
- [機密データフィルタリング](./sensitive-filtering) -- セキュリティフィルタリング実践
- [API リファレンス](../api-reference/) -- 完全 API ドキュメント
