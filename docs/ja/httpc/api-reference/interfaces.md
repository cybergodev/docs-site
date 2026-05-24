---
title: "インターフェース定義 - HTTPC"
description: "HTTPCコアインターフェースAPIリファレンス：Client全機能インターフェース（7種類のHTTPメソッドと4種類のダウンロード付き）、Doer最小実行インターフェース、DomainClienterドメインクライアント（セッション管理付き）、RetryPolicyリトライポリシー、RequestMutator/ResponseMutatorミドルウェアインターフェースとHandler/MiddlewareFunc定義。"
---

# インターフェース定義

## Client

```go
type Client interface {
    Doer

    // HTTPメソッド
    Get(url string, options ...RequestOption) (*Result, error)
    Post(url string, options ...RequestOption) (*Result, error)
    Put(url string, options ...RequestOption) (*Result, error)
    Patch(url string, options ...RequestOption) (*Result, error)
    Delete(url string, options ...RequestOption) (*Result, error)
    Head(url string, options ...RequestOption) (*Result, error)
    Options(url string, options ...RequestOption) (*Result, error)

    // ファイルダウンロード
    DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
    DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
    DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
    DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)

    // ライフサイクル
    Close() error
}
```

メインクライアントインターフェース。`New()`で作成します。詳しくは[パッケージ関数](./functions)をご覧ください。

## Doer

```go
type Doer interface {
    Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
}
```

最小インターフェース。コアの`Request`メソッドのみを含みます。カスタム実装に適しています。

```go
type MyDoer struct{}

func (d *MyDoer) Request(ctx context.Context, method, url string, options ...httpc.RequestOption) (*httpc.Result, error) {
    // カスタム実装
    return nil, nil
}
```

## DomainClienter

```go
type DomainClienter interface {
    Client

    // URLアクセス
    URL() string
    Domain() string

    // セッションヘッダー管理
    SetHeader(key, value string) error
    SetHeaders(headers map[string]string) error
    DeleteHeader(key string)
    ClearHeaders()
    GetHeaders() map[string]string

    // セッションCookie管理
    SetCookie(cookie *http.Cookie) error
    SetCookies(cookies []*http.Cookie) error
    DeleteCookie(name string)
    ClearCookies()
    GetCookies() []*http.Cookie
    GetCookie(name string) *http.Cookie

    // セッションアクセス
    Session() *SessionManager
}
```

ドメインスコープのクライアント。Cookieとヘッダーを自動的に管理します。詳しくは[ドメインクライアント](./domain-client)と[セッション管理](./session)をご覧ください。

## RetryPolicy

```go
type RetryPolicy interface {
    ShouldRetry(resp ResponseReader, err error, attempt int) bool
    GetDelay(attempt int) time.Duration
    MaxRetries() int
}
```

カスタムリトライポリシーインターフェース。

| メソッド | 説明 |
|----------|------|
| `ShouldRetry(resp, err, attempt)` | リトライするかどうかを判定。`attempt`は0から開始 |
| `GetDelay(attempt)` | 次回リトライまでの待機時間を返す |
| `MaxRetries()` | 最大リトライ回数を返す |

:::warning 警告 内部タイプの制限
`ShouldRetry`の`resp`パラメータタイプ`ResponseReader`は内部インターフェース（`internal/types`パッケージにあります）であり、外部コードからは直接参照できません。そのため、`RetryPolicy`は同じモジュール内でのみ実装可能です。ほとんどのシナリオでは`RetryConfig`設定と`WithMaxRetries`オプションでリトライ要件を満たせます。カスタムポリシーが必要な場合は、プロジェクト内部パッケージで`RetryPolicy`インターフェースを実装してください。
:::

以下の例は`RetryPolicy`の実装パターンを示しています。`ResponseReader`は内部タイプであるため、このコードは`httpc`モジュール内でのみコンパイル可能です：

```go
// 注意：ResponseReaderは内部タイプ（internal/typesパッケージ）です。
// このコードはhttpcモジュール外部ではコンパイルできません。
// ほとんどのユーザーはRetryConfigとWithMaxRetriesでリトライを設定してください。

type MyRetryPolicy struct {
    maxRetries int
}

func (p *MyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxRetries {
        return false
    }
    if err != nil {
        return true
    }
    return resp.StatusCode() >= 500
}

func (p *MyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(1<<attempt)
}

func (p *MyRetryPolicy) MaxRetries() int {
    return p.maxRetries
}
```

## コアタイプ

### RequestMutator

```go
type RequestMutator interface {
    // 読み取りメソッド
    Method() string
    URL() string
    Headers() map[string]string
    QueryParams() map[string]any
    Body() any
    Timeout() time.Duration
    MaxRetries() int
    Context() context.Context
    Cookies() []http.Cookie
    FollowRedirects() *bool
    MaxRedirects() *int
    StreamBody() bool

    // 書き込みメソッド
    SetMethod(string)
    SetURL(string)
    SetHeaders(map[string]string)
    SetHeader(key, value string)
    SetQueryParams(map[string]any)
    SetBody(any)
    SetTimeout(time.Duration)
    SetMaxRetries(int)
    SetContext(context.Context)
    SetCookies([]http.Cookie)
    SetFollowRedirects(*bool)
    SetMaxRedirects(*int)
    SetStreamBody(bool)
}
```

ミドルウェアで使用する、リクエストの読み書きアクセスを提供します。内部インターフェース`RequestReader`と`RequestWriter`で構成されています。

### ResponseMutator

```go
type ResponseMutator interface {
    // 読み取りメソッド
    StatusCode() int
    Status() string
    Proto() string
    Headers() http.Header
    Body() string
    RawBody() []byte
    ContentLength() int64
    Duration() time.Duration
    Attempts() int
    Cookies() []*http.Cookie
    RedirectChain() []string
    RedirectCount() int
    RequestHeaders() http.Header
    RequestURL() string
    RequestMethod() string

    // 書き込みメソッド
    SetStatusCode(int)
    SetStatus(string)
    SetProto(string)
    SetHeaders(http.Header)
    SetBody(string)
    SetRawBody([]byte)
    SetContentLength(int64)
    SetDuration(time.Duration)
    SetAttempts(int)
    SetCookies([]*http.Cookie)
    SetRedirectChain([]string)
    SetRedirectCount(int)
    SetRequestHeaders(http.Header)
    SetRequestURL(string)
    SetRequestMethod(string)
    SetHeader(key string, values ...string)
}
```

ミドルウェアで使用する、レスポンスの読み書きアクセスを提供します。内部インターフェース`ResponseReader`と`ResponseWriter`で構成されています。

### Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

リクエスト処理関数のシグネチャ。

### MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

ミドルウェア関数のシグネチャ。次のHandlerを受け取り、ラップしたHandlerを返します。

## 関連ページ

| タイプ | 詳細リファレンス |
|--------|------------------|
| `Result` / `RequestInfo` / `ResponseInfo` / `RequestMeta` | [Result](./result) |
| `SessionManager` メソッド | [セッション管理](./session) |
| `DomainClient` 実装 | [ドメインクライアント](./domain-client) |
| `DownloadConfig` / `DownloadResult` | [ファイルダウンロード](./download) |
| `ClientError` / `ErrorType` / エラー変数 | [エラータイプ](./errors) |
| `FormData` / `FileData` / `BodyKind` | [定数とタイプ](./constants) |
