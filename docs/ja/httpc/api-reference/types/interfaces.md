---
sidebar_label: "インターフェース"
title: "インターフェース定義 - CyberGo HTTPC | コアインターフェース"
description: "HTTPC コアインターフェース API リファレンス: Client 全機能インターフェース、Doer 最小実行インターフェース、DomainClienter、RetryPolicy リトライポリシー、ミドルウェアインターフェース定義の完全な説明を提供します。"
sidebar_position: 1
---

# インターフェース定義

## Client

```go
type Client interface {
    Doer

    // HTTP メソッド
    Get(url string, options ...RequestOption) (*Result, error)
    Post(url string, options ...RequestOption) (*Result, error)
    Put(url string, options ...RequestOption) (*Result, error)
    Patch(url string, options ...RequestOption) (*Result, error)
    Delete(url string, options ...RequestOption) (*Result, error)
    Head(url string, options ...RequestOption) (*Result, error)
    Options(url string, options ...RequestOption) (*Result, error)

    // ファイルダウンロード
    Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)

    // ライフサイクル
    Close() error
}
```

メインクライアントインターフェース。`New()` で作成します。詳しくは [パッケージ関数とクライアントメソッド](../core/functions) をご覧ください。

## Doer

```go
type Doer interface {
    Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
}
```

最小インターフェース。コアの `Request` メソッドのみを含みます。カスタム実装に適しています。

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

    // URL アクセス
    URL() string
    Domain() string

    // セッションヘッダー管理
    SetHeader(key, value string) error
    SetHeaders(headers map[string]string) error
    DeleteHeader(key string)
    ClearHeaders()
    GetHeaders() map[string]string

    // セッション Cookie 管理
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

ドメインスコープクライアント。Cookie とヘッダーを自動管理します。詳しくは [ドメインクライアント](../client-config/domain-client) と [セッション管理](../client-config/session) をご覧ください。

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
|---------|------|
| `ShouldRetry(resp, err, attempt)` | リトライするかどうかを判定。`attempt` は 0 から開始 |
| `GetDelay(attempt)` | 次回リトライまでの待機時間を返す |
| `MaxRetries()` | 最大リトライ回数を返す |

:::warning 内部タイプの制限
ShouldRetry の `resp` パラメータのタイプ ResponseReader は内部インターフェース（`internal/types` パッケージに配置）であり、外部コードからは直接参照できません。そのため、`RetryPolicy` は同じモジュール内でのみ実装可能です。ほとんどのシナリオでは `RetryConfig` 設定と `WithMaxRetries` オプションでリトライ要件を満たせます。カスタムポリシーが必要な場合は、プロジェクト内のパッケージで `RetryPolicy` インターフェースを実装してください。
:::

以下の例は `RetryPolicy` の実装パターンを示しています。ResponseReader は内部タイプであるため、このコードは `httpc` モジュール内部でのみコンパイル可能です：

```go
// 注意：ResponseReader は内部タイプ（internal/types パッケージ）です。
// このコードは httpc モジュール外部ではコンパイルできません。
// ほとんどのユーザーは RetryConfig と WithMaxRetries でリトライを設定してください。

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

ミドルウェアで使用され、リクエストの読み書きアクセスを提供します。内部インターフェース RequestReader と RequestWriter で構成されています。完全なメソッド契約と読み書きの例は [リクエストとレスポンスミューテータ](../handler/mutators) を参照してください。

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

ミドルウェアで使用され、レスポンスの読み書きアクセスを提供します。内部インターフェース ResponseReader と ResponseWriter で構成されています。完全なメソッド契約は [リクエストとレスポンスミューテータ](../handler/mutators) を参照してください。

### Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

リクエスト処理関数のシグネチャ。

### MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

ミドルウェア関数のシグネチャ。次の Handler を受け取り、ラップされた Handler を返します。

## 証明書ピンニング

証明書ピンニング（Certificate Pinning）は、TLS ハンドシェイク時にサーバー証明書が事前に固定された公開鍵/証明書と一致するかを検証します。信頼された CA が侵害されていてもハンドシェイクは拒否されるため、中間者攻撃を防げます。

### CertificatePinner

```go
type CertificatePinner = security.CertificatePinner
```

証明書ピンナーインターフェース。以下のコンストラクタで作成後、`SecurityConfig.CertificatePinner` フィールド（`Config.Security` 経由でアクセス）に代入します。

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // 現在の鍵
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // バックアップ鍵（ローテーション用）
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, err := httpc.New(cfg)
```

:::tip
Pinner の実装は並行安全であり、同じ `Config` から作成された複数のクライアントで共有できます（ディープコピー時は参照渡しされ、複製されません）。上級者はこのインターフェースを直接実装して、カスタムピンニング戦略（公開鍵ではなく完全な証明書を固定するなど）をサポートすることも可能です。
:::

### NewSPKIHashPinner

```go
func NewSPKIHashPinner(hashes ...string) (CertificatePinner, error)
```

1 つ以上の base64 エンコードされた SHA-256 ハッシュ値（DER エンコードされた SubjectPublicKeyInfo/SPKI に対する）から証明書ピンナーを作成します。これは最も一般的なピンニング形式（HPKP が採用）であり、推奨されるアプローチです。

複数のハッシュを渡すことで鍵のローテーションに対応できます——対向側の公開鍵が固定されたハッシュの**いずれか 1 つ**に一致すれば、ハンドシェイクは成功します。

以下のコマンドで証明書からハッシュを生成します:

```bash
openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | openssl enc -base64
```

有効なハッシュが提供されない、またはハッシュが正当な base64 でない場合、エラーを返します。

### NewPublicKeyPinner

```go
func NewPublicKeyPinner(publicKeys ...[]byte) (CertificatePinner, error)
```

1 つ以上の DER エンコードされた PKIX 公開鍵（`x509.MarshalPKIXPublicKey` が返すもの）から証明書ピンナーを作成します。内部で各公開鍵の SHA-256 ハッシュを計算します。すでに元の公開鍵バイトを保持している場合は、`NewSPKIHashPinner` よりも便利な選択肢です。

有効な公開鍵が提供されない場合、エラーを返します。

### NewCertificatePinnerChain

```go
func NewCertificatePinnerChain(pinners ...CertificatePinner) CertificatePinner
```

複数のピンナーを 1 つに組み合わせます。ラップされたピンナーの**いずれか 1 つ**が証明書を受け入れれば、証明書は受け入れられます。複数のピンニング戦略を同時にサポートする場合や、異なるコンストラクタで構築したローテーション用鍵を組み合わせる場合に使用します。

::: warning ゼロ引数の挙動：すべての証明書を許可
引数を渡さない場合、空のチェーンを返します。このチェーンは**一切の証明書検証を行いません**（検証ロジックが直接 `nil` を返します）。つまり**すべての証明書を受け入れます（証明書ピンニングが無効化された状態 = fail-open）**。これは「ピンナーがない＝すべて拒否」という直感と逆の挙動です（ソースコード `internal/security/certpin.go` のコメント "No pinners means no pinning" を参照）。**常に少なくとも 1 つの有効な pinner を渡してください**。ゼロ引数の挙動に依存しないでください。
:::

:::tip さらに詳しく
証明書ピンニングの完全なガイド（ハッシュ生成、鍵のローテーション戦略、本番デプロイ）は [TLS 証明書ピンニング](../../security/tls-certpin) をご覧ください。
:::

## 関連ページ

| タイプ | 詳細リファレンス |
|--------|----------------|
| `Result` / `RequestInfo` / `ResponseInfo` / `RequestMeta` | [Result](../core/result) |
| `SessionManager` メソッド | [セッション管理](../client-config/session) |
| `DomainClient` 実装 | [ドメインクライアント](../client-config/domain-client) |
| `DownloadConfig` / `DownloadResult` | [ファイルダウンロード](../client-config/download) |
| `ClientError` / `ErrorType` / エラー変数 | [エラータイプ](./errors) |
| `FormData` / `FileData` / `BodyKind` | [定数とタイプ](./constants) |
