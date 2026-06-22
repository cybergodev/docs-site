---
title: "Result - CyberGo HTTPC | Result応答タイプ"
description: "HTTPC Result レスポンスタイプ API リファレンス: StatusCode/Body 基本メソッド、ステータス判定、Cookie 操作、Unmarshal JSON 解析、SaveToFile ファイル保存の完全な使い方を提供します。"
---

# Result

Result は HTTP レスポンスとリクエストメタデータをカプセル化し、便利なアクセスメソッドを提供します。`Client.Request()` またはパッケージレベル関数で取得します。

```go
type Result struct {
    Request  *RequestInfo
    Response *ResponseInfo
    Meta     *RequestMeta
}
```

```go
result, err := httpc.Get("https://api.example.com/users/1")
if err != nil {
    log.Fatal(err)
}

fmt.Println(result.StatusCode()) // 200
fmt.Println(result.Body())       // {"id":1,"name":"test"}
```

:::tip
Result はリクエストごとに新規作成され、GC が自動的に回収するため、手動での解放は不要です。
:::

## 基本メソッド

### StatusCode

```go
func (r *Result) StatusCode() int
```

HTTP ステータスコードを返します。nil セーフで、0 を返します。

### Body

```go
func (r *Result) Body() string
```

レスポンスボディの文字列を返します。nil セーフで、空文字列を返します。

### RawBody

```go
func (r *Result) RawBody() []byte
```

レスポンスボディの生バイトを返します。nil セーフで、nil を返します。

### Proto

```go
func (r *Result) Proto() string
```

HTTP プロトコルバージョンを返します（例：`"HTTP/1.1"`、`"HTTP/2.0"`）。

## ステータス判定

### IsSuccess

```go
func (r *Result) IsSuccess() bool
```

ステータスコードが 2xx の場合に true を返します。

### IsRedirect

```go
func (r *Result) IsRedirect() bool
```

ステータスコードが 3xx の場合に true を返します。

### IsClientError

```go
func (r *Result) IsClientError() bool
```

ステータスコードが 4xx の場合に true を返します。

### IsServerError

```go
func (r *Result) IsServerError() bool
```

ステータスコードが 5xx の場合に true を返します。

```go
result, _ := client.Get(url)
switch {
case result.IsSuccess():
    handleSuccess(result)
case result.IsClientError():
    handleClientError(result)
case result.IsServerError():
    handleServerError(result)
}
```

## Cookie メソッド

### ResponseCookies

```go
func (r *Result) ResponseCookies() []*http.Cookie
```

レスポンスに含まれるすべての Cookie を返します。

### GetCookie

```go
func (r *Result) GetCookie(name string) *http.Cookie
```

名前でレスポンス Cookie を取得します。見つからない場合は nil を返します。

```go
cookie := result.GetCookie("session")
if cookie != nil {
    fmt.Println(cookie.Value)
}
```

### HasCookie

```go
func (r *Result) HasCookie(name string) bool
```

レスポンスに指定した名前の Cookie が存在するかを確認します。

### RequestCookies

```go
func (r *Result) RequestCookies() []*http.Cookie
```

リクエストで送信されたすべての Cookie を返します。

### GetRequestCookie

```go
func (r *Result) GetRequestCookie(name string) *http.Cookie
```

名前でリクエスト Cookie を取得します。

### HasRequestCookie

```go
func (r *Result) HasRequestCookie(name string) bool
```

リクエストに指定した名前の Cookie が存在するかを確認します。

## JSON 解析

### Unmarshal

```go
func (r *Result) Unmarshal(v any) error
```

JSON レスポンスボディをターゲット変数に解析します。`json.Unmarshal` の規約に従います。

| エラー | 発生条件 |
|--------|---------|
| `ErrResponseBodyEmpty` | レスポンスボディが空 |
| `ErrResponseBodyTooLarge` | レスポンスボディが 50MB の JSON 解析サイズ制限を超過 |

```go
var user User
if err := result.Unmarshal(&user); err != nil {
    log.Fatal(err)
}
fmt.Println(user.Name)
```

## ファイル保存

### SaveToFile

```go
func (r *Result) SaveToFile(filePath string) error
```

レスポンスボディをファイルに保存します。ファイルパスはセキュリティ検証を通過します（パストラバーサル対策、シンボリックリンクチェック、システムパス保護）。

| エラー | 発生条件 |
|--------|---------|
| `ErrResponseBodyEmpty` | レスポンスボディが空 |

```go
result, _ := client.Get("https://example.com/data.csv")

if err := result.SaveToFile("/tmp/data.csv"); err != nil {
    log.Fatal(err)
}
```

## 文字列表現

### String

```go
func (r *Result) String() string
```

人間可読の文字列表現を返します。機密ヘッダーは自動的にマスクされ、レスポンスボディは 200 文字に切り詰められます。

```go
result, _ := client.Get(url)
fmt.Println(result.String())
// Result{Status: 200 OK, ContentLength: 1024, Duration: 125ms, Attempts: 1, ...}
```

## サブタイプ

### RequestInfo

```go
type RequestInfo struct {
    URL     string
    Method  string
    Headers http.Header
    Cookies []*http.Cookie
}
```

リクエストの詳細。`result.Request` でアクセスします。

### ResponseInfo

```go
type ResponseInfo struct {
    StatusCode    int
    Status        string
    Proto         string
    Headers       http.Header
    Body          string
    RawBody       []byte
    ContentLength int64
    Cookies       []*http.Cookie
}
```

レスポンスデータ。`result.Response` でアクセスします。

### RequestMeta

```go
type RequestMeta struct {
    Duration      time.Duration
    Attempts      int
    RedirectChain []string
    RedirectCount int
}
```

リクエスト実行メタデータ。`result.Meta` でアクセスします。

```go
result, _ := client.Get(url)

fmt.Println(result.Meta.Duration)      // 125ms
fmt.Println(result.Meta.Attempts)       // 2（1 回リトライ）
fmt.Println(result.Meta.RedirectCount)  // 1（1 回リダイレクトに追従）
```

## 関連項目

- [パッケージ関数](./functions) - Result を取得するリクエストメソッド
- [リクエストオプション](./options) - リクエスト動作の設定
- [ファイルダウンロード](./download) - ダウンロード結果タイプ DownloadResult
