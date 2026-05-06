import type { DefaultTheme } from 'vitepress'

export const jaSidebars: Record<string, DefaultTheme.SidebarItem[]> = {
  '/ja/json/': [
    {
      text: 'はじめに',
      collapsed: false,
      items: [
        { text: '概要', link: '/ja/json/' },
        { text: 'クイックスタート', link: '/ja/json/getting-started' },
        { text: 'パス式の構文', link: '/ja/json/path-syntax' },
        { text: 'チートシート', link: '/ja/json/cheatsheet' }
      ]
    },
    {
      text: 'API リファレンス',
      collapsed: false,
      items: [
        { text: '概要', link: '/ja/json/api-reference/' },
        {
          text: 'パッケージ関数',
          collapsed: true,
          items: [
            { text: '概要', link: '/ja/json/api-reference/functions' },
            { text: 'クエリと取得', link: '/ja/json/api-reference/functions/get' },
            { text: '変更操作', link: '/ja/json/api-reference/functions/modify' },
            { text: 'エンコード・デコード', link: '/ja/json/api-reference/functions/encode-decode' },
            { text: 'ファイル I/O', link: '/ja/json/api-reference/functions/file-io' }
          ]
        },
        {
          text: 'Processor',
          collapsed: true,
          items: [
            { text: '概要', link: '/ja/json/api-reference/processor/' },
            { text: 'パスクエリ', link: '/ja/json/api-reference/processor/query' },
            { text: 'データ変更', link: '/ja/json/api-reference/processor/modify' },
            { text: '出力メソッド', link: '/ja/json/api-reference/processor/output' },
            { text: 'パースと読み込み', link: '/ja/json/api-reference/processor/parse' },
            { text: 'イテレーション', link: '/ja/json/api-reference/processor/iterate' },
            { text: 'バッチ操作', link: '/ja/json/api-reference/processor/batch' },
            { text: 'JSONL 処理', link: '/ja/json/api-reference/processor/jsonl' },
            { text: 'ライフサイクル', link: '/ja/json/api-reference/processor/lifecycle' }
          ]
        },
        { text: 'Config', link: '/ja/json/api-reference/config' },
        { text: '型定義', link: '/ja/json/api-reference/types' },
        { text: 'インターフェース定義', link: '/ja/json/api-reference/interfaces' },
        { text: '定数とエラー', link: '/ja/json/api-reference/constants' },
        { text: 'ヘルパー関数', link: '/ja/json/api-reference/helpers' },
        { text: 'イテレータ', link: '/ja/json/api-reference/iterator' },
        { text: 'ジェネリクス', link: '/ja/json/api-reference/generics' },
        { text: '出力関数', link: '/ja/json/api-reference/print' }
      ]
    },
    {
      text: 'ストリーミング処理',
      collapsed: true,
      items: [
        { text: '大規模ファイルガイド', link: '/ja/json/large-files' },
        { text: '大規模ファイル API', link: '/ja/json/api-reference/large-file' },
        { text: 'JSONL プロセッサ', link: '/ja/json/api-reference/jsonl' }
      ]
    },
    {
      text: '拡張インターフェース',
      collapsed: true,
      items: [
        { text: 'Hook システム', link: '/ja/json/api-reference/hooks' },
        { text: 'Validator', link: '/ja/json/api-reference/validator' },
        { text: 'カスタムエンコーダ', link: '/ja/json/api-reference/custom-encoder' }
      ]
    },
    {
      text: 'セキュリティ',
      collapsed: true,
      items: [
        { text: 'セキュリティ概要', link: '/ja/json/security/' },
        { text: 'セキュリティモード', link: '/ja/json/api-reference/security' },
        { text: '本番チェックリスト', link: '/ja/json/security/production-checklist' }
      ]
    },
    {
      text: '応用',
      collapsed: true,
      items: [
        { text: 'パフォーマンス最適化', link: '/ja/json/advanced/performance' },
        { text: 'エラー処理', link: '/ja/json/advanced/error-handling' }
      ]
    },
    {
      text: 'サンプル',
      collapsed: true,
      items: [
        { text: '基本サンプル', link: '/ja/json/examples' },
        { text: '高度なサンプル', link: '/ja/json/examples-advanced' }
      ]
    }
  ],

  '/ja/jwt/': [
    {
      text: 'はじめに',
      collapsed: false,
      items: [
        { text: '概要', link: '/ja/jwt/' },
        { text: 'クイックスタート', link: '/ja/jwt/getting-started' }
      ]
    },
    {
      text: 'ガイド',
      collapsed: false,
      items: [
        { text: '署名アルゴリズム', link: '/ja/jwt/guides/signing-algorithms' },
        { text: 'カスタム Claims', link: '/ja/jwt/guides/custom-claims' },
        { text: 'トークンブラックリスト', link: '/ja/jwt/guides/blacklist' },
        { text: 'レート制限', link: '/ja/jwt/guides/rate-limiting' },
        { text: 'エラー処理', link: '/ja/jwt/guides/error-handling' },
        { text: 'テストとクロック注入', link: '/ja/jwt/guides/testing' }
      ]
    },
    {
      text: 'API リファレンス',
      collapsed: false,
      items: [
        { text: '概要', link: '/ja/jwt/api-reference/' },
        { text: 'パッケージ関数', link: '/ja/jwt/api-reference/functions' },
        { text: 'Processor', link: '/ja/jwt/api-reference/processor' },
        { text: 'Config', link: '/ja/jwt/api-reference/config' },
        { text: 'Claims', link: '/ja/jwt/api-reference/claims' },
        { text: 'インターフェース定義', link: '/ja/jwt/api-reference/interfaces' },
        { text: '型と定数', link: '/ja/jwt/api-reference/types' },
        { text: 'エラー', link: '/ja/jwt/api-reference/errors' }
      ]
    },
    {
      text: 'サンプル',
      collapsed: false,
      items: [
        { text: '基本サンプル', link: '/ja/jwt/examples/basic' },
        { text: '高度なサンプル', link: '/ja/jwt/examples/advanced' }
      ]
    }
  ],

  '/ja/httpc/': [
    {
      text: 'はじめに',
      collapsed: false,
      items: [
        { text: '概要', link: '/ja/httpc/' },
        { text: 'クイックスタート', link: '/ja/httpc/getting-started' },
        { text: 'チートシート', link: '/ja/httpc/cheatsheet' }
      ]
    },
    {
      text: 'ガイド',
      collapsed: false,
      items: [
        { text: 'チュートリアル', link: '/ja/httpc/guides/tutorial' },
        { text: 'リクエストとレスポンス', link: '/ja/httpc/guides/request-response' },
        { text: 'ドメインクライアントとセッション', link: '/ja/httpc/guides/domain-session' },
        { text: 'ファイルアップロードとダウンロード', link: '/ja/httpc/guides/file-transfer' },
        { text: 'リトライとフォールトトレランス', link: '/ja/httpc/guides/retry-fault-tolerance' },
        { text: 'ミドルウェアチェーン', link: '/ja/httpc/guides/middleware-chain' },
        { text: 'テストガイド', link: '/ja/httpc/guides/testing' }
      ]
    },
    {
      text: 'API リファレンス',
      collapsed: false,
      items: [
        { text: '概要', link: '/ja/httpc/api-reference/' },
        {
          text: 'コア',
          collapsed: false,
          items: [
            { text: 'パッケージ関数', link: '/ja/httpc/api-reference/functions' },
            { text: 'リクエストオプション', link: '/ja/httpc/api-reference/options' },
            { text: 'Result', link: '/ja/httpc/api-reference/result' }
          ]
        },
        {
          text: 'クライアントと設定',
          collapsed: true,
          items: [
            { text: '設定', link: '/ja/httpc/api-reference/config' },
            { text: 'ドメインクライアント', link: '/ja/httpc/api-reference/domain-client' },
            { text: 'セッション管理', link: '/ja/httpc/api-reference/session' },
            { text: 'ファイルダウンロード', link: '/ja/httpc/api-reference/download' },
            { text: 'ミドルウェア', link: '/ja/httpc/api-reference/middleware' }
          ]
        },
        {
          text: 'タイプ定義',
          collapsed: true,
          items: [
            { text: 'インターフェース', link: '/ja/httpc/api-reference/interfaces' },
            { text: '定数とタイプ', link: '/ja/httpc/api-reference/constants' },
            { text: 'エラータイプ', link: '/ja/httpc/api-reference/errors' }
          ]
        }
      ]
    },
    {
      text: 'セキュリティ',
      collapsed: false,
      items: [
        { text: 'セキュリティ概要', link: '/ja/httpc/security/' },
        { text: 'SSRF 防護', link: '/ja/httpc/security/ssrf' },
        { text: 'TLS と証明書ピンニング', link: '/ja/httpc/security/tls-certpin' },
        { text: '本番チェックリスト', link: '/ja/httpc/security/production-checklist' }
      ]
    },
    {
      text: '応用',
      collapsed: true,
      items: [
        { text: 'パフォーマンス', link: '/ja/httpc/advanced/performance' },
        { text: 'エラー処理', link: '/ja/httpc/advanced/error-handling' },
        { text: 'コネクションプールとプロキシ', link: '/ja/httpc/advanced/connection-pool' }
      ]
    },
    {
      text: 'サンプル',
      collapsed: true,
      items: [
        { text: '基本サンプル', link: '/ja/httpc/examples/basic-usage' },
        { text: '高度なサンプル', link: '/ja/httpc/examples/advanced-usage' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: 'FAQ', link: '/ja/httpc/faq' }
      ]
    }
  ],

  '/ja/html/': [
    {
      text: 'はじめに',
      collapsed: false,
      items: [
        { text: '概要', link: '/ja/html/' },
        { text: 'クイックスタート', link: '/ja/html/getting-started' },
        { text: 'チートシート', link: '/ja/html/cheatsheet' }
      ]
    },
    {
      text: 'ガイド',
      collapsed: false,
      items: [
        {
          text: 'コア機能',
          collapsed: false,
          items: [
            { text: 'コンテンツ抽出実践', link: '/ja/html/guides/content-extraction' },
            { text: '出力形式の選択', link: '/ja/html/guides/output-formats' },
            { text: 'リンク抽出とグループ化', link: '/ja/html/guides/link-extraction' }
          ]
        },
        {
          text: '高度なパターン',
          collapsed: false,
          items: [
            { text: 'Processor の再利用とキャッシュ', link: '/ja/html/guides/processor-cache' },
            { text: '監査システム実践', link: '/ja/html/guides/audit-pipeline' }
          ]
        },
        {
          text: '統合と拡張',
          collapsed: true,
          items: [
            { text: 'HTTP 統合', link: '/ja/html/guides/http-integration' },
            { text: 'テストとカスタム拡張', link: '/ja/html/guides/testing-custom' }
          ]
        }
      ]
    },
    {
      text: 'API リファレンス',
      collapsed: false,
      items: [
        { text: '概要', link: '/ja/html/api-reference/' },
        {
          text: 'コア',
          collapsed: false,
          items: [
            { text: 'パッケージ関数', link: '/ja/html/api-reference/functions' },
            { text: 'Processor', link: '/ja/html/api-reference/processor' },
            { text: '設定', link: '/ja/html/api-reference/config' }
          ]
        },
        {
          text: '機能モジュール',
          collapsed: false,
          items: [
            { text: '出力形式', link: '/ja/html/api-reference/output' },
            { text: 'リンク抽出', link: '/ja/html/api-reference/links' },
            { text: 'バッチ処理', link: '/ja/html/api-reference/batch' },
            { text: '監査システム', link: '/ja/html/api-reference/audit' }
          ]
        },
        {
          text: '型定義',
          collapsed: true,
          items: [
            { text: 'インターフェース定義', link: '/ja/html/api-reference/interfaces' },
            { text: '型定義', link: '/ja/html/api-reference/types' },
            { text: '定数とエラー', link: '/ja/html/api-reference/constants' }
          ]
        }
      ]
    },
    {
      text: 'セキュリティ',
      collapsed: false,
      items: [
        { text: 'セキュリティ概要', link: '/ja/html/security/' },
        { text: '本番チェックリスト', link: '/ja/html/security/production-checklist' }
      ]
    },
    {
      text: '応用',
      collapsed: true,
      items: [
        { text: 'パフォーマンス最適化', link: '/ja/html/advanced/performance' },
        { text: 'エラー処理', link: '/ja/html/advanced/error-handling' }
      ]
    },
    {
      text: 'サンプル',
      collapsed: true,
      items: [
        { text: '基本サンプル', link: '/ja/html/examples/basic-usage' },
        { text: '高度なサンプル', link: '/ja/html/examples/advanced-usage' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: 'よくある質問', link: '/ja/html/faq' }
      ]
    }
  ],

  '/ja/dd/': [
    {
      text: 'はじめに',
      collapsed: false,
      items: [
        { text: '概要', link: '/ja/dd/' },
        { text: 'クイックスタート', link: '/ja/dd/getting-started' },
        { text: 'チートシート', link: '/ja/dd/cheatsheet' }
      ]
    },
    {
      text: 'ガイド',
      collapsed: false,
      items: [
        { text: 'コア概念', link: '/ja/dd/guides/core-concepts' },
        { text: '構造化ロギング', link: '/ja/dd/guides/structured-logging' },
        { text: 'ファイル出力とローテーション', link: '/ja/dd/guides/file-output' },
        { text: '機密データフィルタリング', link: '/ja/dd/guides/sensitive-filtering' },
        { text: '監査ログ', link: '/ja/dd/guides/audit-logging' },
        { text: 'フックシステム', link: '/ja/dd/guides/hooks' },
        { text: '分散トレーシング統合', link: '/ja/dd/guides/context-tracing' },
        { text: 'マイグレーションガイド', link: '/ja/dd/guides/migration' }
      ]
    },
    {
      text: 'API リファレンス',
      collapsed: false,
      items: [
        { text: '概要', link: '/ja/dd/api-reference/' },
        {
          text: 'コア',
          collapsed: false,
          items: [
            { text: 'パッケージ関数', link: '/ja/dd/api-reference/functions' },
            { text: 'Logger', link: '/ja/dd/api-reference/logger' },
            { text: 'LoggerEntry', link: '/ja/dd/api-reference/entry' },
            { text: '設定', link: '/ja/dd/api-reference/config' },
            { text: 'インターフェース定義', link: '/ja/dd/api-reference/interfaces' }
          ]
        },
        {
          text: '出力と統合',
          collapsed: false,
          items: [
            { text: '出力先', link: '/ja/dd/api-reference/writers' },
            { text: 'コンテキスト統合', link: '/ja/dd/api-reference/context' },
            { text: '構造化フィールド', link: '/ja/dd/api-reference/fields' }
          ]
        },
        {
          text: 'セキュリティと監査',
          collapsed: true,
          items: [
            { text: 'フックシステム', link: '/ja/dd/api-reference/hooks' },
            { text: 'セキュリティフィルタ', link: '/ja/dd/api-reference/security' },
            { text: '監査ログ', link: '/ja/dd/api-reference/audit' },
            { text: '整合性署名', link: '/ja/dd/api-reference/integrity' }
          ]
        },
        {
          text: '開発ツール',
          collapsed: false,
          items: [
            { text: 'デバッグ出力', link: '/ja/dd/api-reference/debug-visual' },
            { text: 'テスト補助', link: '/ja/dd/api-reference/recorder' },
            { text: '定数とエラー', link: '/ja/dd/api-reference/constants' }
          ]
        }
      ]
    },
    {
      text: 'サンプル',
      collapsed: false,
      items: [
        { text: '基本的な使い方', link: '/ja/dd/examples/basic-usage' },
        { text: 'Web サービス統合', link: '/ja/dd/examples/web-service' },
        { text: 'セキュリティと監査実践', link: '/ja/dd/examples/security-audit' },
        { text: 'テストパターン', link: '/ja/dd/examples/testing-patterns' }
      ]
    },
    {
      text: 'セキュリティ',
      collapsed: true,
      items: [
        { text: '概要', link: '/ja/dd/security/' },
        { text: '業界コンプライアンス設定', link: '/ja/dd/security/compliance' },
        { text: '本番チェックリスト', link: '/ja/dd/security/production-checklist' }
      ]
    },
    {
      text: '応用',
      collapsed: true,
      items: [
        { text: 'パフォーマンス', link: '/ja/dd/advanced/performance' },
        { text: 'エラー処理', link: '/ja/dd/advanced/error-handling' },
        { text: 'HMAC 署名実践', link: '/ja/dd/advanced/integrity' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: 'よくある質問', link: '/ja/dd/faq' }
      ]
    }
  ],

  '/ja/env/': [
    {
      text: 'はじめに',
      collapsed: false,
      items: [
        { text: '概要', link: '/ja/env/' },
        { text: 'クイックスタート', link: '/ja/env/getting-started' },
        { text: 'チートシート', link: '/ja/env/cheatsheet' }
      ]
    },
    {
      text: 'ガイド',
      collapsed: false,
      items: [
        { text: '構造体マッピング', link: '/ja/env/guides/struct-mapping' },
        { text: 'シリアライズ', link: '/ja/env/guides/serialization' },
        { text: 'マルチフォーマット設定', link: '/ja/env/guides/multi-format' },
        { text: '変数展開', link: '/ja/env/guides/variable-expansion' },
        { text: '監査ログ', link: '/ja/env/guides/audit-logging' },
        { text: 'テスト', link: '/ja/env/guides/testing' },
        { text: 'カスタムパーサー', link: '/ja/env/guides/custom-parser' }
      ]
    },
    {
      text: 'API リファレンス',
      collapsed: false,
      items: [
        { text: '概要', link: '/ja/env/api-reference/' },
        { text: 'パッケージ関数', link: '/ja/env/api-reference/functions' },
        { text: 'Loader API', link: '/ja/env/api-reference/loader' },
        { text: 'Config API', link: '/ja/env/api-reference/config' },
        { text: 'SecureValue API', link: '/ja/env/api-reference/secure-value' },
        { text: 'インターフェース定義', link: '/ja/env/api-reference/interfaces' },
        { text: '定数とエラー', link: '/ja/env/api-reference/constants' },
        { text: 'ComponentFactory API', link: '/ja/env/api-reference/factory' }
      ]
    },
    {
      text: 'セキュリティ',
      collapsed: false,
      items: [
        { text: 'セキュリティ概要', link: '/ja/env/security/' },
        { text: '本番チェックリスト', link: '/ja/env/security/production-checklist' }
      ]
    },
    {
      text: '応用',
      collapsed: false,
      items: [
        { text: 'パフォーマンス最適化', link: '/ja/env/advanced/performance' },
        { text: 'エラー処理', link: '/ja/env/advanced/error-handling' }
      ]
    },
    {
      text: 'リファレンス',
      collapsed: false,
      items: [
        { text: 'ファイル形式', link: '/ja/env/reference/file-format' }
      ]
    }
  ]
}
