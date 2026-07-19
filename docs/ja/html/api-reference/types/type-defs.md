---
sidebar_label: "データ型"
title: "型定義 - CyberGo html | データ型リファレンス"
description: "CyberGo html データ型：Result、ImageInfo、LinkInfo、LinkResource、Statistics、BatchResult などコア型のフィールドを説明します。"
sidebar_position: 2
---

# 型定義

## Result

抽出結果。テキスト、メタデータ、メディア情報を含みます。

```go
type Result struct {
    Text           string        `json:"text"`
    Title          string        `json:"title"`
    Images         []ImageInfo   `json:"images,omitempty"`
    Links          []LinkInfo    `json:"links,omitempty"`
    Videos         []VideoInfo   `json:"videos,omitempty"`
    Audios         []AudioInfo   `json:"audios,omitempty"`
    ProcessingTime time.Duration `json:"-"`       // 処理時間（標準シリアライズに含まれない）
    WordCount      int           `json:"word_count"`
    ReadingTime    time.Duration `json:"-"`       // 推定読了時間（標準シリアライズに含まれない）
}
```

### MarshalJSON

カスタム JSON シリアライズ。`ProcessingTime` と `ReadingTime` は `json:"-"` タグを持ちますが（標準シリアライズではスキップ）、カスタム `MarshalJSON()` メソッドによりミリ秒数として出力されます。

```go
func (r *Result) MarshalJSON() ([]byte, error)
```

:::warning 警告
`Result`は`UnmarshalJSON`を**実装していません**。`MarshalJSON()`の出力を再度`Result`にデシリアライズすると、`ProcessingTime`や`ReadingTime`などの duration フィールドが**失われます** — JSON 出力のキー名（`processing_time_ms`, `reading_time_ms`）が struct フィールド名と一致しないため、復元できません。

これは**意図的な設計**です。この JSON 形式は外部消費（API レスポンス、ログ、フロントエンド表示など）を対象としており、双方向シリアライズを想定したものではありません。
:::

## ImageInfo

画像情報。

```go
type ImageInfo struct {
    URL          string `json:"url"`           // 画像アドレス
    Alt          string `json:"alt"`           // 代替テキスト
    Title        string `json:"title"`         // タイトル
    Width        string `json:"width"`         // 幅
    Height       string `json:"height"`        // 高さ
    IsDecorative bool   `json:"is_decorative"` // 装飾画像かどうか
    Position     int    `json:"position"`      // ドキュメント内の位置
}
```

## LinkInfo

リンク情報。

```go
type LinkInfo struct {
    URL        string `json:"url"`         // リンクアドレス
    Text       string `json:"text"`        // リンクテキスト
    Title      string `json:"title"`       // リンクタイトル
    IsExternal bool   `json:"is_external"` // 外部リンクかどうか（URL 自体が絶対外部 URL かで判定し、BaseURL とは比較しない）
    IsNoFollow bool   `json:"is_nofollow"` // nofollow かどうか
    Position   int    `json:"position"`    // ドキュメント内の位置
}
```

## VideoInfo

動画情報。

```go
type VideoInfo struct {
    URL      string `json:"url"`      // 動画アドレス
    Type     string `json:"type"`     // 動画タイプ
    Poster   string `json:"poster"`   // サムネイル画像アドレス
    Width    string `json:"width"`    // 幅
    Height   string `json:"height"`   // 高さ
    Duration string `json:"duration"` // 再生時間
}
```

## AudioInfo

音声情報。

```go
type AudioInfo struct {
    URL      string `json:"url"`      // 音声アドレス
    Type     string `json:"type"`     // 音声タイプ
    Duration string `json:"duration"` // 再生時間
}
```

## LinkResource

リンクリソース（リンク抽出 API で使用）。

```go
type LinkResource struct {
    URL   string // リンクアドレス
    Title string // リンクタイトル
    Type  string // リンクタイプ
}
```

## Statistics

処理統計情報。

```go
type Statistics struct {
    TotalProcessed    int64         // 総処理数
    CacheHits         int64         // キャッシュヒット数
    CacheMisses       int64         // キャッシュミス数
    ErrorCount        int64         // エラー数
    AverageProcessTime time.Duration // 平均処理時間
}
```

## BatchResult

バッチ処理結果。

```go
type BatchResult struct {
    Results   []*Result // 抽出結果、失敗またはキャンセル時は nil
    Errors    []error   // 失敗したエラー
    Success   int       // 成功数
    Failed    int       // 失敗数
    Cancelled int       // キャンセル数
}
```

## NodeAttr

HTML ノード属性。

```go
type NodeAttr struct {
    Key   string // 属性名
    Value string // 属性値
}
```
