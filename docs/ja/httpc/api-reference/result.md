---
title: "Result - HTTPC"
description: "HTTPC ResultレスポンスタイプAPIリファレンス：StatusCode/Body/RawBody基本メソッド、IsSuccess/IsClientErrorステータス判定、Cookie操作、Unmarshal JSON解析、SaveToFileファイル保存とRequestInfo/ResponseInfo/RequestMetaサブタイプ。"
---

# Result

ResultはHTTPレスポンスとリクエストメタデータをカプセル化し、便利なアクセスメソッドを提供します。`Client.Request()`またはパッケージ関数で取得します。

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
defer httpc.ReleaseResult(result)

fmt.Println(result.StatusCode()) // 200
fmt.Println(result.Body())       // {"id":1,"name":"test"}
```

:::warning 警告
使用後は必ず`ReleaseResult(result)`を呼び出してオブジェクトプールに返却してください。呼び出し後はResultにアクセスできません。
:::

## 基本メソッド

### StatusCode

```go
func (r *Result) StatusCode() int
```

HTTPステータスコードを返します。nilセーフで、0を返します。

### Body

```go
func (r *Result) Body() string
```

レスポンスボディの文字列を返します。nilセーフで、空文字列を返します。

### RawBody

```go
func (r *Result) RawBody() []byte
```

レスポンスボディの生バイトを返します。nilセーフで、nilを返します。

### Proto

```go
func (r *Result) Proto() string
```

HTTPプロトコルバージョンを返します（例：`"HTTP/1.1"`、`"HTTP/2.0"`）。

## ステータス判定

### IsSuccess

```go
func (r *Result) IsSuccess() bool
```

ステータスコードが2xxの場合にtrueを返します。

### IsRedirect

```go
func (r *Result) IsRedirect() bool
```

ステータスコードが3xxの場合にtrueを返します。

### IsClientError

```go
func (r *Result) IsClientError() bool
```

ステータスコードが4xxの場合にtrueを返します。

### IsServerError

```go
func (r *Result) IsServerError() bool
```

ステータスコードが5xxの場合にtrueを返します。

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

## Cookieメソッド

### ResponseCookies

```go
func (r *Result) ResponseCookies() []*http.Cookie
```

レスポンス内のすべてのCookieを返します。

### GetCookie

```go
func (r *Result) GetCookie(name string) *http.Cookie
```

名前でレスポンスCookieを取得します。見つからない場合はnilを返します。

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

レスポンスに指定した名前のCookieが存在するかを確認します。

### RequestCookies

```go
func (r *Result) RequestCookies() []*http.Cookie
```

リクエストで送信されたすべてのCookieを返します。

### GetRequestCookie

```go
func (r *Result) GetRequestCookie(name string) *http.Cookie
```

名前でリクエストCookieを取得します。

### HasRequestCookie

```go
func (r *Result) HasRequestCookie(name string) bool
```

リクエストに指定した名前のCookieが存在するかを確認します。

## JSON解析

### Unmarshal

```go
func (r *Result) Unmarshal(v any) error
```

JSONレスポンスボディをターゲット変数に解析します。`json.Unmarshal`の規約に従います。

| エラー | 発生条件 |
|--------|----------|
| `ErrResponseBodyEmpty` | レスポンスボディが空 |
| `ErrResponseBodyTooLarge` | レスポンスボディが50MBのJSON解析サイズ制限を超過 |

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

レスポンスボディをファイルに保存します。ファイルパスはセキュリティ検証を受けます（パストラバーサル防止、シンボリックリンクチェック、システムパス保護）。

| エラー | 発生条件 |
|--------|----------|
| `ErrResponseBodyEmpty` | レスポンスボディが空 |

```go
result, _ := client.Get("https://example.com/data.csv")
defer httpc.ReleaseResult(result)

if err := result.SaveToFile("/tmp/data.csv"); err != nil {
    log.Fatal(err)
}
```

## 文字列表現

### String

```go
func (r *Result) String() string
```

人間が読める文字列表現を返します。機密ヘッダーは自動的にマスクされ、レスポンスボディは200文字で切り詰められます。

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

リクエストの詳細情報。`result.Request`でアクセスします。

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

レスポンスデータ。`result.Response`でアクセスします。

### RequestMeta

```go
type RequestMeta struct {
    Duration      time.Duration
    Attempts      int
    RedirectChain []string
    RedirectCount int
}
```

リクエスト実行メタデータ。`result.Meta`でアクセスします。

```go
result, _ := client.Get(url)

fmt.Println(result.Meta.Duration)      // 125ms
fmt.Println(result.Meta.Attempts)       // 2（1回リトライ）
fmt.Println(result.Meta.RedirectCount)  // 1（1回リダイレクトに追従）
```

## ReleaseResult

```go
func ReleaseResult(r *Result)
```

Resultをオブジェクトプールに返却します。レスポンスボディデータは安全にクリアされ（機密データの残留を防止するため全体をゼロクリア）、すべての内部データがゼロクリアされます。呼び出し後はResultのフィールドやメソッドにアクセスできません。

```go
result, _ := httpc.Get(url)
defer httpc.ReleaseResult(result)
// resultを使用...
```

## 関連項目

- [パッケージ関数](./functions) - Resultを取得するリクエストメソッド
- [リクエストオプション](./options) - リクエスト動作の設定
- [ファイルダウンロード](./download) - ダウンロード結果タイプDownloadResult
